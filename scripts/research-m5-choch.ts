import { prisma } from '../src/lib/prisma';
import { M5EntryConfirmationService } from '../src/lib/services/m5-entry-confirmation.service';

type Direction = 'BUY' | 'SELL';

const symbols = ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'];
const round = (value: number) => Number(value.toFixed(3));
const ema = (values: number[], period: number) => {
  const sample = values.slice(-period);
  const multiplier = 2 / (period + 1);
  return sample.slice(1).reduce((value, next) => next * multiplier + value * (1 - multiplier), sample[0] || 0);
};

const main = async () => {
  const [m5Rows, m15Rows, h1Rows] = await Promise.all(['M5', 'M15', 'H1'].map((timeframe) => prisma.candle.findMany({
    where: { symbol: { in: symbols }, timeframe },
    orderBy: { time: 'asc' },
    take: 9000,
  })));
  const candles = m5Rows.sort((a, b) => a.time.getTime() - b.time.getTime());
  const m15 = m15Rows.sort((a, b) => a.time.getTime() - b.time.getTime());
  const h1 = h1Rows.sort((a, b) => a.time.getTime() - b.time.getTime());

  const variants = [
    { id: 'market-structural-2R', entry: 'MARKET', stop: 'STRUCTURE', rr: 2 },
    { id: 'market-fixed5-1.5R', entry: 'MARKET', stop: 'FIXED5', rr: 1.5 },
    { id: 'market-fixed5-2R', entry: 'MARKET', stop: 'FIXED5', rr: 2 },
    { id: 'retest-break-fixed5-1.5R', entry: 'RETEST', stop: 'FIXED5', rr: 1.5 },
    { id: 'retest-break-fixed5-2R', entry: 'RETEST', stop: 'FIXED5', rr: 2 },
  ];
  const results = new Map(variants.map((variant) => [variant.id, { wins: 0, losses: 0, unresolved: 0, signals: 0, netR: 0 }]));
  const diagnostic = new Map<string, { wins: number; losses: number; netR: number }>();

  for (let index = 48; index < candles.length - 25; index++) {
    const candle = candles[index];
    const signal = M5EntryConfirmationService.analyze({
      candles: candles.slice(index - 48, index + 1),
      currentPrice: candle.close,
      now: new Date(candle.time.getTime() + 5 * 60_000 + 1),
    });
    if (signal.direction === 'WAIT' || signal.structureBreak === null || signal.stopLoss === null) continue;
    const direction = signal.direction as Direction;
    const m15Closed = m15.filter((row) => row.time.getTime() + 15 * 60_000 <= candle.time.getTime()).slice(-50);
    const h1Closed = h1.filter((row) => row.time.getTime() + 60 * 60_000 <= candle.time.getTime()).slice(-50);
    const aligned = m15Closed.length >= 50 && h1Closed.length >= 50 && (direction === 'BUY'
      ? ema(m15Closed.map((row) => row.close), 20) > ema(m15Closed.map((row) => row.close), 50) && ema(h1Closed.map((row) => row.close), 20) > ema(h1Closed.map((row) => row.close), 50)
      : ema(m15Closed.map((row) => row.close), 20) < ema(m15Closed.map((row) => row.close), 50) && ema(h1Closed.map((row) => row.close), 20) < ema(h1Closed.map((row) => row.close), 50));

    for (const variant of variants) {
      const stats = results.get(variant.id)!;
      stats.signals++;
      const entry = variant.entry === 'RETEST' ? signal.structureBreak : candle.close;
      const stopLoss = variant.stop === 'FIXED5'
        ? direction === 'BUY' ? entry - 5 : entry + 5
        : signal.stopLoss;
      const risk = Math.abs(entry - stopLoss);
      const takeProfit = direction === 'BUY' ? entry + risk * variant.rr : entry - risk * variant.rr;
      let entered = variant.entry === 'MARKET';
      let outcome: 'WIN' | 'LOSS' | null = null;
      for (let lookahead = index + 1; lookahead <= Math.min(candles.length - 1, index + 24); lookahead++) {
        const future = candles[lookahead];
        if (!entered) {
          entered = future.low <= entry && future.high >= entry;
          if (!entered) continue;
        }
        const hitStop = direction === 'BUY' ? future.low <= stopLoss : future.high >= stopLoss;
        const hitTarget = direction === 'BUY' ? future.high >= takeProfit : future.low <= takeProfit;
        if (hitStop) { outcome = 'LOSS'; break; }
        if (hitTarget) { outcome = 'WIN'; break; }
      }
      if (outcome === 'WIN') { stats.wins++; stats.netR += variant.rr - 0.08; }
      else if (outcome === 'LOSS') { stats.losses++; stats.netR -= 1.08; }
      else stats.unresolved++;
      if (variant.id === 'market-fixed5-2R' && outcome) {
        const hour = candle.time.getUTCHours();
        for (const key of [`direction:${direction}`, `hour:${hour}`, `direction-hour:${direction}-${hour}`, `mtf-aligned:${aligned}`, `direction-aligned:${direction}-${aligned}`]) {
          const row = diagnostic.get(key) || { wins: 0, losses: 0, netR: 0 };
          if (outcome === 'WIN') { row.wins++; row.netR += variant.rr - 0.08; }
          else { row.losses++; row.netR -= 1.08; }
          diagnostic.set(key, row);
        }
      }
    }
  }

  console.log(JSON.stringify({
    candleCount: candles.length,
    variants: variants.map((variant) => {
      const stats = results.get(variant.id)!;
      const resolved = stats.wins + stats.losses;
      return {
        ...variant,
        ...stats,
        winRate: resolved ? round(stats.wins / resolved * 100) : 0,
        expectancyR: resolved ? round(stats.netR / resolved) : 0,
      };
    }),
    diagnostic: [...diagnostic.entries()].map(([key, value]) => ({
      key,
      ...value,
      sampleSize: value.wins + value.losses,
      winRate: round(value.wins / (value.wins + value.losses) * 100),
      expectancyR: round(value.netR / (value.wins + value.losses)),
    })).filter((row) => row.sampleSize >= 3).sort((a, b) => b.expectancyR - a.expectancyR),
  }, null, 2));
};

main().finally(() => prisma.$disconnect());
