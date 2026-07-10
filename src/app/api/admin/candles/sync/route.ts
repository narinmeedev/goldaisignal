import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
};

const maxStoredCandlesByTimeframe: Record<string, number> = {
  M5: 720,
  M15: 480,
  H1: 360,
  D1: 240,
};

/**
 * Endpoint for MT5 EA to sync historical candles.
 * Payload should be:
 * {
 *   "symbol": "XAUUSD",
 *   "timeframe": "H1",
 *   "candles": [
 *     { "time": "2023-10-01T00:00:00Z", "open": 1900.5, "high": 1910.0, "low": 1890.0, "close": 1905.2, "volume": 1200 },
 *     ...
 *   ]
 * }
 */
export async function POST(request: Request) {
  let body: any = null;
  try {
    const rawText = await request.text();
    const cleanText = rawText.replace(/\0/g, '').trim();
    body = JSON.parse(cleanText);
  } catch (err: any) {
    // Log json parsing error
    await prisma.webhookEvent.create({
      data: {
        symbol: 'UNKNOWN',
        timeframe: 'UNKNOWN',
        source: 'mt5_sync_error',
        rawPayload: JSON.stringify({ error: 'JSON parse failed', details: err.message }),
        status: 'error',
        errorMessage: err.message,
      }
    });
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400, headers: noStoreHeaders });
  }

  const { symbol, timeframe, candles } = body;

  try {
    if (!symbol || !timeframe || !Array.isArray(candles)) {
      await prisma.webhookEvent.create({
        data: {
          symbol: symbol || 'UNKNOWN',
          timeframe: timeframe || 'UNKNOWN',
          source: 'mt5_sync_error',
          rawPayload: JSON.stringify(body),
          status: 'rejected',
          errorMessage: 'Missing symbol, timeframe, or candles array.',
        }
      });
      return NextResponse.json({ error: 'Missing symbol, timeframe, or candles array.' }, { status: 400, headers: noStoreHeaders });
    }

    if (String(symbol).toUpperCase().includes('BTC')) {
      await prisma.webhookEvent.create({
        data: {
          symbol,
          timeframe,
          source: 'mt5_sync_error',
          rawPayload: JSON.stringify(body),
          status: 'rejected',
          errorMessage: 'BTCUSD candle sync is disabled.',
        }
      });
      return NextResponse.json(
        { error: 'BTCUSD candle sync is disabled. Gold AI Signal now supports XAUUSD only.' },
        { status: 400, headers: noStoreHeaders },
      );
    }

    // Insert or update candles
    const dataToInsert = candles
      .map((c: any) => ({
        symbol,
        timeframe,
        time: new Date(c.time),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume || 0),
      }))
      .filter((c: any) =>
        Number.isFinite(c.time.getTime()) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      );

    if (dataToInsert.length === 0) {
      await prisma.webhookEvent.create({
        data: {
          symbol,
          timeframe,
          source: 'mt5_sync_error',
          rawPayload: JSON.stringify(body),
          status: 'rejected',
          errorMessage: 'Candles array is empty.',
        }
      });
      return NextResponse.json({ error: 'Candles array is empty.' }, { status: 400, headers: noStoreHeaders });
    }

    const latestBefore = await prisma.candle.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: 'desc' },
      select: { time: true, open: true, high: true, low: true, close: true },
    });

    const touchedAt = new Date();
    for (let index = 0; index < dataToInsert.length; index += 50) {
      const chunk = dataToInsert.slice(index, index + 50);
      await prisma.$transaction(
        chunk.map((c: any) => prisma.candle.upsert({
          where: {
            symbol_timeframe_time: {
              symbol: c.symbol,
              timeframe: c.timeframe,
              time: c.time,
            },
          },
          update: {
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            createdAt: touchedAt,
          },
          create: c,
        }))
      );
    }

    const maxStoredCandles = maxStoredCandlesByTimeframe[timeframe] || 360;
    const excessCandles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: 'desc' },
      skip: maxStoredCandles,
      select: { id: true },
    });

    if (excessCandles.length > 0) {
      await prisma.candle.deleteMany({
        where: { id: { in: excessCandles.map((c: any) => c.id) } },
      });
    }

    const latestIncoming = dataToInsert.reduce((latest: any, candle: any) =>
      candle.time.getTime() > latest.time.getTime() ? candle : latest
    , dataToInsert[0]);
    const oldestIncoming = dataToInsert.reduce((oldest: any, candle: any) =>
      candle.time.getTime() < oldest.time.getTime() ? candle : oldest
    , dataToInsert[0]);

    const latestChanged =
      !latestBefore ||
      latestBefore.time.getTime() !== latestIncoming.time.getTime() ||
      latestBefore.open !== latestIncoming.open ||
      latestBefore.high !== latestIncoming.high ||
      latestBefore.low !== latestIncoming.low ||
      latestBefore.close !== latestIncoming.close;

    if (latestChanged) {
      await ZoneService.updateZones(symbol, timeframe);
    }

    // Log success
    await prisma.webhookEvent.create({
      data: {
        symbol,
        timeframe,
        source: 'mt5_sync',
        rawPayload: JSON.stringify({
          count: dataToInsert.length,
          oldestCandleAt: oldestIncoming.time.toISOString(),
          latestCandleAt: latestIncoming.time.toISOString(),
          maxStoredCandles,
        }),
        status: 'processed',
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${dataToInsert.length} candles for ${symbol} ${timeframe}.`,
      latestCandleAt: latestIncoming.time.toISOString(),
      zonesUpdated: latestChanged,
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    await prisma.webhookEvent.create({
      data: {
        symbol: symbol || 'UNKNOWN',
        timeframe: timeframe || 'UNKNOWN',
        source: 'mt5_sync_error',
        rawPayload: JSON.stringify(body || {}),
        status: 'error',
        errorMessage: err.message,
      }
    });
    return NextResponse.json(
      { error: 'Failed to sync candles.', details: err.message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
