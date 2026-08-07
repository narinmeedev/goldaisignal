import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaperTradeService } from '@/lib/services/paper-trade.service';

const isMarketOpen = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // Market closes on Friday at 22:00 UTC and opens on Sunday at 22:00 UTC
  if (day === 5 && hour >= 22) return false;
  if (day === 6) return false;
  if (day === 0 && hour < 22) return false;

  return true;
};

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
    const xauSymbolsFilter = { in: ['GOLD#', 'XAUUSD', 'GOLD', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw', 'GOLD.ecn'] };

    const latestPriceEvent = await prisma.webhookEvent.findFirst({
      where: {
        symbol: xauSymbolsFilter,
        status: 'processed',
        source: 'tradingview',
      },
      orderBy: { receivedAt: 'desc' },
    });

    const latestSyncEvent = await prisma.webhookEvent.findFirst({
      where: {
        symbol: xauSymbolsFilter,
        status: 'processed',
        source: 'mt5_sync',
      },
      orderBy: { receivedAt: 'desc' },
    });

    const activeSymbol = latestPriceEvent?.symbol || latestSyncEvent?.symbol || 'XAUUSD';
    let currentPrice: number | null = null;

    const isPriceEventRecent = latestPriceEvent && Date.now() - latestPriceEvent.receivedAt.getTime() < 5 * 60 * 1000;
    if (isPriceEventRecent) {
      try {
        const payload = JSON.parse(latestPriceEvent.rawPayload);
        const price = Number(payload.price);
        if (Number.isFinite(price) && price > 0) currentPrice = price;
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
      currentPrice = m15Candles[0]?.close ?? h1Candles[0]?.close ?? null;
    }

    const latestMarketUpdate = isPriceEventRecent
      ? latestPriceEvent?.receivedAt
      : m15Candles[0]?.time ?? h1Candles[0]?.time ?? null;
    const dataAgeMs = latestMarketUpdate ? Date.now() - latestMarketUpdate.getTime() : null;
    const isLive = currentPrice !== null && dataAgeMs !== null && dataAgeMs < 20 * 60 * 1000;

    let bias = 'NEUTRAL';
    if (currentPrice !== null && h1Candles.length >= 20 && m15Candles.length >= 20) {
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
    } else if (currentPrice !== null && h1Candles.length > 0) {
      const avg = h1Candles.reduce((sum, candle) => sum + candle.close, 0) / h1Candles.length;
      bias = currentPrice > avg ? 'BULLISH' : 'BEARISH';
    }

    // Trigger real-time evaluation of paper trades/plans (only when market is open)
    try {
      if (isMarketOpen() && currentPrice !== null) {
        const latestM15 = m15Candles[0];
        const highPrice = latestM15 ? Math.max(currentPrice, latestM15.high) : currentPrice;
        const lowPrice = latestM15 ? Math.min(currentPrice, latestM15.low) : currentPrice;

        await PaperTradeService.evaluatePendingPlansWithPrice(activeSymbol, currentPrice);
        await PaperTradeService.evaluateOpenTradesWithPrice(activeSymbol, currentPrice, highPrice, lowPrice);
      }
    } catch (evalErr) {
      console.error('Error evaluating trades with latest price:', evalErr);
    }

    return NextResponse.json({
      XAUUSD: {
        price: currentPrice,
        bias,
        isLive,
        updatedAt: latestMarketUpdate?.toISOString() ?? null,
        dataAgeSeconds: dataAgeMs === null ? null : Math.max(0, Math.round(dataAgeMs / 1000)),
      },
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json({
      XAUUSD: { price: null, bias: 'NEUTRAL', isLive: false, updatedAt: null, dataAgeSeconds: null },
      error: err.message,
    }, { headers: noStoreHeaders });
  }
}
