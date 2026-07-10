import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
};

const calcSMA = (candles: { close: number }[], period: number) => {
  const limit = Math.min(period, candles.length);
  if (limit === 0) return 0;
  let sum = 0;
  for (let i = 0; i < limit; i++) sum += candles[i].close;
  return sum / limit;
};

const calcEMA = (candles: { close: number }[], period: number) => {
  if (candles.length < period) return calcSMA(candles, candles.length);
  const k = 2 / (period + 1);
  let ema = candles[candles.length - 1].close;
  for (let i = candles.length - 2; i >= 0; i--) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return ema;
};

export async function GET() {
  try {
    const latestPriceEvent = await prisma.webhookEvent.findFirst({
      where: {
        symbol: { contains: 'XAU' },
        status: 'processed',
        source: 'tradingview',
      },
      orderBy: { receivedAt: 'desc' },
    });

    const latestSyncEvent = await prisma.webhookEvent.findFirst({
      where: {
        symbol: { contains: 'XAU' },
        status: 'processed',
        source: 'mt5_sync',
      },
      orderBy: { receivedAt: 'desc' },
    });

    const activeSymbol = latestPriceEvent?.symbol || latestSyncEvent?.symbol || 'XAUUSD';
    let currentPrice = 4450.0;

    const isPriceEventRecent = latestPriceEvent && Date.now() - latestPriceEvent.receivedAt.getTime() < 5 * 60 * 1000;
    if (isPriceEventRecent) {
      try {
        const payload = JSON.parse(latestPriceEvent.rawPayload);
        const price = Number(payload.price);
        if (Number.isFinite(price)) currentPrice = price;
      } catch {
        // Keep default/current candle price below.
      }
    }

    const [m15Candles, h1Candles] = await Promise.all([
      prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
    ]);

    if (!isPriceEventRecent) {
      currentPrice = m15Candles[0]?.close ?? h1Candles[0]?.close ?? currentPrice;
    }

    let bias = 'NEUTRAL';
    if (h1Candles.length >= 20 && m15Candles.length >= 20) {
      const ema20M15 = calcEMA(m15Candles, 20);
      const ema20H1 = calcEMA(h1Candles, 20);
      const h1Trend = currentPrice > ema20H1 ? 'BULLISH' : 'BEARISH';
      const m15Trend = currentPrice > ema20M15 ? 'BULLISH' : 'BEARISH';

      bias = m15Trend === h1Trend ? m15Trend : 'WAIT_AND_SEE';

      let consecutiveDrops = 0;
      let consecutiveSurges = 0;
      for (let i = 0; i < Math.min(m15Candles.length, 5); i++) {
        const candle = m15Candles[i];
        if (candle.close < candle.open) {
          if (consecutiveSurges > 0) break;
          consecutiveDrops++;
        } else if (candle.close > candle.open) {
          if (consecutiveDrops > 0) break;
          consecutiveSurges++;
        }
      }

      const prevCandle = m15Candles[1];
      if (prevCandle && (currentPrice < prevCandle.low || consecutiveDrops >= 3)) {
        bias = 'BEARISH';
      } else if (prevCandle && (currentPrice > prevCandle.high || consecutiveSurges >= 3)) {
        bias = 'BULLISH';
      }
    } else if (h1Candles.length > 0) {
      const avg = h1Candles.reduce((sum, candle) => sum + candle.close, 0) / h1Candles.length;
      bias = currentPrice > avg ? 'BULLISH' : 'BEARISH';
    }

    return NextResponse.json({
      XAUUSD: {
        price: currentPrice,
        bias,
      },
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json({
      XAUUSD: { price: 4450.0, bias: 'NEUTRAL' },
      error: err.message,
    }, { headers: noStoreHeaders });
  }
}
