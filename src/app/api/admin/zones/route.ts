import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: [
        { type: 'asc' },
        { priceMin: 'desc' },
      ],
    });

    return NextResponse.json(zones);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve support/resistance zones.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 1. Get unique symbol/timeframe combinations from existing candles
    const distinctCandles = await prisma.candle.findMany({
      select: { symbol: true, timeframe: true },
      distinct: ['symbol', 'timeframe'],
    });

    if (distinctCandles.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลแท่งเทียนในระบบ โปรดส่งข้อมูลจาก MT5 (Sync Candles) ก่อนสแกนโซน' },
        { status: 400 }
      );
    }

    // 2. Recalculate zones for all available combinations
    for (const { symbol, timeframe } of distinctCandles) {
      await ZoneService.updateZones(symbol, timeframe);
    }

    // 3. Return the fresh zones
    const zones = await prisma.zone.findMany({
      orderBy: [
        { type: 'asc' },
        { priceMin: 'desc' },
      ],
    });

    return NextResponse.json({ success: true, data: zones });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to scan and update zones.', details: err.message },
      { status: 500 }
    );
  }
}
