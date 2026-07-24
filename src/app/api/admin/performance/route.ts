import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { StrategyResearchService } from '@/lib/services/strategy-research.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Bucket = { wins: number; losses: number; be: number; total: number; netR: number; netPoints: number };

const emptyBucket = (): Bucket => ({ wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 });

const addTrade = (bucket: Bucket, trade: any) => {
  if (trade.result === 'WIN') bucket.wins++;
  else if (trade.result === 'LOSS') bucket.losses++;
  else bucket.be++;
  bucket.total++;
  bucket.netR += Number(trade.rrResult || 0);
  if (typeof trade.exitPrice === 'number' && Number.isFinite(trade.exitPrice)) {
    const priceMove = trade.direction === 'BUY'
      ? trade.exitPrice - trade.entry
      : trade.entry - trade.exitPrice;
    bucket.netPoints += Math.round(priceMove * 100);
  }
};

const getWinRate = (trades: any[]) => {
  const wins = trades.filter((trade) => trade.result === 'WIN').length;
  const losses = trades.filter((trade) => trade.result === 'LOSS').length;
  return { winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0, total: wins + losses };
};

const getSetupName = (trade: any) => {
  try {
    const reason = JSON.parse(trade.signal?.reason || '{}');
    return reason.strategyLabel || reason.strategyMode || reason.strategyId || 'ไม่ระบุกลยุทธ์';
  } catch {
    return 'ไม่ระบุกลยุทธ์';
  }
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { role: true, subscriptionStatus: true, subscriptionEndsAt: true },
    });
    const expired = user?.subscriptionEndsAt && user.subscriptionEndsAt < new Date();
    if (!user || (user.role !== 'admin' && (user.subscriptionStatus !== 'active' || expired))) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const [totalSignalsCount, closedTrades] = await Promise.all([
      prisma.signal.count({ where: { symbol: { contains: 'XAU' } } }),
      prisma.paperTrade.findMany({
        where: { symbol: { contains: 'XAU' }, result: { in: ['WIN', 'LOSS', 'BE'] } },
        orderBy: { closedAt: 'asc' },
        include: { signal: true },
      }),
    ]);

    const now = Date.now();
    const periodStats = (days: number) => getWinRate(closedTrades.filter((trade) => {
      const closedAt = trade.closedAt?.getTime();
      return closedAt && closedAt >= now - days * 86_400_000;
    }));
    const stats7 = periodStats(7);
    const stats30 = periodStats(30);
    const stats90 = periodStats(90);

    const wins = closedTrades.filter((trade) => trade.result === 'WIN');
    const losses = closedTrades.filter((trade) => trade.result === 'LOSS');
    const breakEven = closedTrades.filter((trade) => trade.result === 'BE');
    const decided = wins.length + losses.length;
    const grossProfitR = wins.reduce((sum, trade) => sum + Math.max(0, Number(trade.rrResult || 0)), 0);
    const grossLossR = losses.reduce((sum, trade) => sum + Math.abs(Math.min(0, Number(trade.rrResult || -1))), 0);
    const totalR = closedTrades.reduce((sum, trade) => sum + Number(trade.rrResult || 0), 0);
    const tradesWithExit = closedTrades.filter((trade) => typeof trade.exitPrice === 'number' && Number.isFinite(trade.exitPrice));
    const totalPoints = tradesWithExit.reduce((sum, trade) => {
      const move = trade.direction === 'BUY' ? trade.exitPrice! - trade.entry : trade.entry - trade.exitPrice!;
      return sum + Math.round(move * 100);
    }, 0);

    let losingStreak = 0;
    let maxLosingStreak = 0;
    for (const trade of closedTrades) {
      if (trade.result === 'LOSS') {
        losingStreak++;
        maxLosingStreak = Math.max(maxLosingStreak, losingStreak);
      } else if (trade.result === 'WIN') {
        losingStreak = 0;
      }
    }

    const sessions: Record<string, Bucket & { name: string }> = {
      Asia: { name: 'Asia', ...emptyBucket() },
      London: { name: 'London', ...emptyBucket() },
      NewYork: { name: 'New York', ...emptyBucket() },
    };
    const timeframes: Record<string, Bucket> = {};
    const setups: Record<string, Bucket> = {};

    for (const trade of closedTrades) {
      const referenceDate = trade.openedAt || trade.closedAt || new Date();
      const bangkokHour = (referenceDate.getUTCHours() + 7) % 24;
      const sessionKey = bangkokHour >= 7 && bangkokHour < 15 ? 'Asia' : bangkokHour >= 15 && bangkokHour < 22 ? 'London' : 'NewYork';
      addTrade(sessions[sessionKey], trade);

      const timeframe = trade.signal?.timeframe || 'ไม่ระบุ';
      timeframes[timeframe] ||= emptyBucket();
      addTrade(timeframes[timeframe], trade);

      const setup = getSetupName(trade);
      setups[setup] ||= emptyBucket();
      addTrade(setups[setup], trade);
    }

    const bestBucket = (entries: Array<[string, Bucket]>) => entries
      .filter(([, bucket]) => bucket.wins + bucket.losses >= 3)
      .sort(([, a], [, b]) => b.netR - a.netR)[0]?.[0] || 'ตัวอย่างยังไม่พอ';

    let strategyResearch = await StrategyResearchService.getStoredReport('XAUUSD');
    strategyResearch = strategyResearch
      ? await StrategyResearchService.refreshStoredReportFromPaperTrades('XAUUSD')
      : await StrategyResearchService.runFromDatabase('XAUUSD');

    return NextResponse.json({
      summary: {
        totalSignalsCount,
        totalClosed: closedTrades.length,
        decidedSampleSize: decided,
        wins: wins.length,
        losses: losses.length,
        breakEven: breakEven.length,
        winRate: decided > 0 ? Math.round((wins.length / decided) * 100) : 0,
        winRate7d: stats7.winRate,
        total7d: stats7.total,
        winRate30d: stats30.winRate,
        total30d: stats30.total,
        winRate90d: stats90.winRate,
        total90d: stats90.total,
        profitFactor: grossLossR > 0 ? Number((grossProfitR / grossLossR).toFixed(2)) : null,
        averageRR: closedTrades.length ? Number((totalR / closedTrades.length).toFixed(2)) : 0,
        totalR: Number(totalR.toFixed(2)),
        averagePoints: tradesWithExit.length ? Math.round(totalPoints / tradesWithExit.length) : null,
        totalPoints: tradesWithExit.length ? totalPoints : null,
        pointSampleSize: tradesWithExit.length,
        maxLosingStreak,
        bestSession: bestBucket(Object.entries(sessions)),
        bestTimeframe: bestBucket(Object.entries(timeframes)),
        bestSetupType: bestBucket(Object.entries(setups)),
      },
      sessions,
      timeframes,
      setups,
      strategyResearch,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to calculate performance metrics.', details: error.message }, { status: 500 });
  }
}
