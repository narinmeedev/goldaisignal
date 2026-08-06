import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { role: true, subscriptionStatus: true, subscriptionEndsAt: true },
    });
    const expired = user?.subscriptionEndsAt && user.subscriptionEndsAt < new Date();
    if (!user || (user.role !== 'admin' && (user.subscriptionStatus !== 'active' || expired))) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const GOLD_SYMBOLS = [
      'XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'GOLD.ecn', 'GOLD.r', 'GOLD_M',
      'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw', 'XAUUSD_M', 'XAUUSD.ecn'
    ];

    const trades = await prisma.paperTrade.findMany({
      where: { symbol: { in: GOLD_SYMBOLS } },
      orderBy: { createdAt: 'desc' },
      include: {
        signal: true,
      },
    });

    return NextResponse.json(trades);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve paper trades log.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { role: true },
    });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    // Delete all paper trades and signals
    const [deletedTrades, deletedSignals] = await Promise.all([
      prisma.paperTrade.deleteMany({}),
      prisma.signal.deleteMany({}),
    ]);

    // Clear active plan setting
    await prisma.systemSetting.deleteMany({
      where: { key: { in: ['ACTIVE_ORDER_PLAN_XAUUSD', 'ACTIVE_TRADE_TRACKER_XAUUSD'] } }
    });

    console.log(`[Stats Reset] Deleted ${deletedTrades.count} trades, ${deletedSignals.count} signals.`);

    return NextResponse.json({
      success: true,
      message: 'รีเซ็ตสถิติการเทรดและประวัติสัญญาณทั้งหมดเรียบร้อยแล้ว พร้อมวัดผลใหม่ 100%',
      deletedTrades: deletedTrades.count,
      deletedSignals: deletedSignals.count,
    });
  } catch (err: any) {
    console.error('Failed to reset trades:', err);
    return NextResponse.json(
      { error: 'Failed to reset paper trades.', details: err.message },
      { status: 500 }
    );
  }
}
