import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { ZoneService } from '@/lib/services/zone.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
};

async function getAuthorizedUser() {
  const token = (await cookies()).get('auth_token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(payload.userId) },
    select: { role: true, subscriptionStatus: true, subscriptionEndsAt: true },
  });
  if (!user) return null;
  const expired = user.subscriptionEndsAt && user.subscriptionEndsAt < new Date();
  if (user.role !== 'admin' && (user.subscriptionStatus !== 'active' || expired)) return null;
  return user;
}

async function getActiveGoldSymbol() {
  const latestSync = await prisma.webhookEvent.findFirst({
    where: {
      symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
      source: 'mt5_sync',
      status: 'processed',
    },
    orderBy: { receivedAt: 'desc' },
    select: { symbol: true },
  });
  return latestSync?.symbol || 'XAUUSD';
}

export async function GET() {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  try {
    const symbol = await getActiveGoldSymbol();
    const zones = await prisma.zone.findMany({
      where: {
        symbol,
        type: { in: ['SUPPORT', 'RESISTANCE'] },
      },
      orderBy: [
        { timeframe: 'asc' },
        { priceMin: 'desc' },
      ],
    });

    return NextResponse.json({
      symbol,
      zones,
      updatedAt: zones.reduce<Date | null>(
        (latest, zone) => !latest || zone.updatedAt > latest ? zone.updatedAt : latest,
        null,
      ),
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[Zones] Failed to load zones:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแนวรับและแนวต้านได้' }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST() {
  const user = await getAuthorizedUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403, headers: noStoreHeaders });
  }

  try {
    const symbol = await getActiveGoldSymbol();
    const timeframes = await prisma.candle.findMany({
      where: { symbol },
      select: { timeframe: true },
      distinct: ['timeframe'],
    });
    if (timeframes.length === 0) {
      return NextResponse.json({ error: 'ยังไม่มีแท่งเทียน MT5 สำหรับคำนวณแนวรับและแนวต้าน' }, { status: 400, headers: noStoreHeaders });
    }

    for (const { timeframe } of timeframes) {
      await ZoneService.updateZones(symbol, timeframe);
    }
    return GET();
  } catch (error) {
    console.error('[Zones] Failed to refresh zones:', error);
    return NextResponse.json({ error: 'คำนวณแนวรับและแนวต้านไม่สำเร็จ' }, { status: 500, headers: noStoreHeaders });
  }
}
