import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QwenLocalAiService } from '@/lib/services/qwen-ai.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
};

export async function POST(request: Request) {
  try {
    const symbol = 'XAUUSD';

    // Fetch latest candles and price for analysis
    const m15Candles = await prisma.candle.findMany({
      where: { symbol, timeframe: 'M15' },
      orderBy: { time: 'desc' },
      take: 30,
    });

    const m5Candles = await prisma.candle.findMany({
      where: { symbol, timeframe: 'M5' },
      orderBy: { time: 'desc' },
      take: 30,
    });

    const currentPriceCandle = m5Candles[0] || m15Candles[0];
    const currentPrice = currentPriceCandle ? currentPriceCandle.close : 4015.0;

    // Retrieve active support/resistance zones
    const zones = await prisma.zone.findMany({
      where: { symbol },
      orderBy: { priceMin: 'asc' },
    });

    const supports = zones.filter((z) => z.type === 'SUPPORT' && z.priceMax < currentPrice).map((z) => z.priceMax).slice(0, 3);
    const resistances = zones.filter((z) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).map((z) => z.priceMin).slice(0, 3);

    // Call Qwen 3.5-9b via LM Studio
    const qwenResult = await QwenLocalAiService.refineTradePlan({
      symbol,
      currentPrice,
      bias: currentPrice > (m15Candles[10]?.close || currentPrice) ? 'BULLISH' : 'BEARISH',
      trendStrength: 78,
      rsi14M5: 42,
      rsi14: 46,
      atr14: 3.5,
      ema20_m15: m15Candles[0]?.close || currentPrice,
      nearestSupport: supports.length > 0 ? supports : [currentPrice - 5.0],
      nearestResistance: resistances.length > 0 ? resistances : [currentPrice + 8.0],
      proposedType: 'BUY_LIMIT',
      proposedEntry: Number((currentPrice - 1.5).toFixed(2)),
      proposedSL: Number((currentPrice - 7.5).toFixed(2)),
      proposedTP: Number((currentPrice + 12.0).toFixed(2)),
    });

    return NextResponse.json({
      success: true,
      model: 'Qwen 3.5-9B (LM Studio)',
      result: qwenResult,
      analyzedAt: new Date().toISOString(),
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to run Qwen analysis.', details: err.message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
