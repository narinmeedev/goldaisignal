import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';

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
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Missing symbol, timeframe, or candles array.' }, { status: 400 });
    }

    // Insert or update candles
    const dataToInsert = candles.map((c: any) => ({
      symbol,
      timeframe,
      time: new Date(c.time),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume || 0),
    }));

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
      return NextResponse.json({ error: 'Candles array is empty.' }, { status: 400 });
    }

    // Delete existing candles for this symbol/timeframe and insert new ones
    await prisma.candle.deleteMany({
      where: { symbol, timeframe },
    });

    await prisma.candle.createMany({
      data: dataToInsert,
    });

    // Automatically trigger zone calculations after syncing candles
    await ZoneService.updateZones(symbol, timeframe);

    // Log success
    await prisma.webhookEvent.create({
      data: {
        symbol,
        timeframe,
        source: 'mt5_sync',
        rawPayload: JSON.stringify({ count: dataToInsert.length }),
        status: 'processed',
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${dataToInsert.length} candles and updated zones for ${symbol} ${timeframe}.`,
    });
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
      { status: 500 }
    );
  }
}

