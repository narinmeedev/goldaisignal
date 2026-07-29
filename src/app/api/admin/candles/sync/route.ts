import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
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

const maxStoredCandlesByTimeframe: Record<string, number> = {
  M5: 720,
  M15: 480,
  H1: 360,
  D1: 240,
};

const runPlanAutomation = async (request: Request, symbol: string, timeframe: string, latestChanged: boolean) => {
  if (!isMarketOpen() || !symbol.toUpperCase().includes('XAU') || timeframe !== 'M15' || !latestChanged) {
    return 'skipped';
  }

  // 1. Trigger Qwen 3.5-9B AI re-analysis automatically on every M15 candle close
  try {
    const qwenUrl = new URL('/api/admin/qwen-analyze', request.url);
    await fetch(qwenUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    console.info('[Plan Automation] M15 candle close triggered automatic Qwen 3.5-9B AI re-analysis.');
  } catch (qwenErr) {
    console.warn('[Plan Automation] Automatic Qwen re-analysis skipped:', qwenErr);
  }

  const automationUrl = new URL('/api/admin/dashboard-stats', request.url);
  automationUrl.searchParams.set('asset', 'XAUUSD');
  automationUrl.searchParams.set('public', 'true');
  automationUrl.searchParams.set('automation', 'mt5-m15-sync');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const automationSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET';
    const response = await fetch(automationUrl, {
      cache: 'no-store',
      headers: {
        'x-plan-automation': 'mt5-m15-sync',
        'x-plan-automation-secret': automationSecret,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[Plan Automation] Dashboard scan returned HTTP ${response.status}.`);
      return 'failed';
    }

    await response.body?.cancel();
    console.info('[Plan Automation] M15 candle triggered a completed plan scan.');
    return 'completed';
  } catch (err) {
    console.error('[Plan Automation] M15 candle plan scan failed:', err);
    return 'failed';
  } finally {
    clearTimeout(timeout);
  }
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

  const { symbol: rawSymbol, timeframe, candles, secret } = body;
  const symbol = rawSymbol && String(rawSymbol).toUpperCase().includes('XAU') ? 'XAUUSD' : rawSymbol;

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

    if (!String(symbol).toUpperCase().includes('XAU')) {
      return NextResponse.json(
        {
          status: 'accepted',
          decision: 'IGNORED_NON_GOLD',
          message: 'Gold AI Signal processes XAU symbols only.',
        },
        { status: 200, headers: noStoreHeaders },
      );
    }

    const expectedSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET';
    const secretRequired = process.env.MT5_SYNC_REQUIRE_SECRET === 'true';
    if ((secret && secret !== expectedSecret) || (secretRequired && !secret)) {
      return NextResponse.json(
        { error: 'Invalid MT5 candle sync secret.' },
        { status: 401, headers: noStoreHeaders },
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

    // Optimize database writes: Fetch existing candles in this timeframe range first
    const existingCandles = await prisma.candle.findMany({
      where: {
        symbol,
        timeframe,
        time: { in: dataToInsert.map((c: any) => c.time) }
      },
      select: { time: true, open: true, high: true, low: true, close: true, volume: true }
    });

    const existingMap = new Map(existingCandles.map((c: any) => [new Date(c.time).getTime(), c]));

    // Filter to only write candles that do not exist or have changed
    const candlesToWrite = dataToInsert.filter((c: any) => {
      const existing = existingMap.get(new Date(c.time).getTime());
      if (!existing) return true;
      return (
        Math.abs(existing.open - c.open) > 0.0001 ||
        Math.abs(existing.high - c.high) > 0.0001 ||
        Math.abs(existing.low - c.low) > 0.0001 ||
        Math.abs(existing.close - c.close) > 0.0001 ||
        existing.volume !== c.volume
      );
    });

    const maxStoredCandles = maxStoredCandlesByTimeframe[timeframe] || 360;

    // Only run transaction if there are changes to save
    if (candlesToWrite.length > 0) {
      console.log(`[MT5 SYNC] Writing ${candlesToWrite.length} / ${dataToInsert.length} candles to database for ${symbol} ${timeframe}.`);
      for (let index = 0; index < candlesToWrite.length; index += 100) {
        const chunk = candlesToWrite.slice(index, index + 100);
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
          })),
          {
            timeout: 30000,
          }
        );
      }

      // Only delete excess candles if we wrote new ones
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
    } else {
      console.log(`[MT5 SYNC] No new or changed candles for ${symbol} ${timeframe}. Skipping DB write.`);
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
    const latestBarAdvanced = !latestBefore || latestBefore.time.getTime() !== latestIncoming.time.getTime();

    if (latestChanged) {
      await ZoneService.updateZones(symbol, timeframe);
    }

    // Evaluate paper trades against the incoming candle (only when market is open)
    if (dataToInsert.length > 0 && isMarketOpen()) {
      try {
        const latestCandle = dataToInsert.reduce((latest: any, candle: any) =>
          candle.time.getTime() > latest.time.getTime() ? candle : latest
        , dataToInsert[0]);

        await PaperTradeService.evaluateOpenTradesWithPrice(
          symbol,
          latestCandle.close,
          latestCandle.high,
          latestCandle.low
        );
        await PaperTradeService.evaluatePendingPlansWithPrice(symbol, latestCandle.close);
      } catch (evalErr) {
        console.error('Error evaluating paper trades on candle sync:', evalErr);
      }
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

    // Plan generation must keep running even when nobody has the dashboard open.
    const planAutomation = await runPlanAutomation(request, symbol, timeframe, latestBarAdvanced);

    // Check and consume one-shot MT5 pending command
    let pendingCommand = null;
    try {
      const commandSetting = await prisma.systemSetting.findUnique({
        where: { key: 'MT5_PENDING_COMMAND' }
      });
      if (commandSetting && commandSetting.value && commandSetting.value.trim() !== '') {
        pendingCommand = commandSetting.value;
        // Clear immediately
        await prisma.systemSetting.update({
          where: { key: 'MT5_PENDING_COMMAND' },
          data: { value: '' }
        });
        console.log(`[MT5 COMMAND] Consumed command: ${pendingCommand}`);
      }
    } catch (cmdErr) {
      console.error('Failed to consume MT5 command:', cmdErr);
    }

    // Attach active trade plan for MT5 automatic line drawing & execution
    let activePlan = null;
    try {
      const activePlanSetting = await prisma.systemSetting.findUnique({
        where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' }
      });
      if (activePlanSetting?.value) {
        const parsed = JSON.parse(activePlanSetting.value);
        if (parsed && parsed.entry && parsed.stopLoss && parsed.takeProfit) {
          activePlan = {
            id: parsed.id,
            type: parsed.type,
            title: parsed.title,
            entry: parsed.entry,
            stopLoss: parsed.stopLoss,
            takeProfit: parsed.takeProfit,
            confidence: parsed.confidence,
            timeframe: parsed.timeframe
          };
        }
      }
    } catch (planErr) {
      console.error('Failed to attach activePlan to MT5 sync response:', planErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${dataToInsert.length} candles for ${symbol} ${timeframe}.`,
      latestCandleAt: latestIncoming.time.toISOString(),
      zonesUpdated: latestChanged,
      planAutomation,
      command: pendingCommand,
      activePlan,
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
