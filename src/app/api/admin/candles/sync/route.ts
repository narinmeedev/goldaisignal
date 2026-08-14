import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';
import { SmartTrendStructureService } from '@/lib/services/smart-trend-structure.service';
import { NotificationService } from '@/lib/services/notification.service';

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

const timeframeDurationMs: Record<string, number> = {
  M5: 5 * 60 * 1000,
  M15: 15 * 60 * 1000,
  H1: 60 * 60 * 1000,
  D1: 24 * 60 * 60 * 1000,
};

const runPlanAutomation = async (request: Request, symbol: string, timeframe: string, latestChanged: boolean) => {
  const upperSym = (symbol || '').toUpperCase();
  const isGoldSymbol = upperSym.includes('XAU') || upperSym.includes('GOLD');
  if (!isMarketOpen() || !isGoldSymbol) {
    return 'skipped';
  }

  let shouldRunQwen = timeframe === 'M15' && latestChanged;

  if (!shouldRunQwen) {
    try {
      const lastSetting = await prisma.systemSetting.findUnique({
        where: { key: 'LAST_QWEN_ANALYSIS_TIME' },
      });
      const lastTime = lastSetting ? parseInt(lastSetting.value) : 0;
      if (Date.now() - lastTime >= 15 * 60 * 1000) {
        shouldRunQwen = true;
      }
    } catch {}
  }

  if (shouldRunQwen) {
    try {
      const qwenUrl = new URL('/api/admin/qwen-analyze', request.url);
      fetch(qwenUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
      console.info('[Plan Automation] 15-minute interval / M15 candle close triggered automatic Qwen AI re-analysis.');
    } catch (qwenErr) {
      console.warn('[Plan Automation] Automatic Qwen re-analysis skipped:', qwenErr);
    }
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
function parseCandleTime(rawTime: any): Date {
  if (rawTime === null || rawTime === undefined) return new Date();
  if (typeof rawTime === 'number') {
    if (rawTime < 1e11) return new Date(rawTime * 1000);
    return new Date(rawTime);
  }
  if (typeof rawTime === 'string') {
    let str = rawTime.trim().replace(/\./g, '-');
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(rawTime);
}

function normalizeBrokerCandleTimes<T extends { time: Date }>(items: T[], timeframe: string, now: Date) {
  if (items.length === 0) return items;

  const frameMs = timeframeDurationMs[timeframe] || 5 * 60 * 1000;
  const latestTime = Math.max(...items.map((item) => item.time.getTime()));
  const expectedFrameStart = Math.floor(now.getTime() / frameMs) * frameMs;
  const futureToleranceMs = Math.min(frameMs, 5 * 60 * 1000);

  // Older EA versions send broker-local wall-clock strings without a timezone.
  // Infer the broker's whole-hour UTC offset only when the current bar lands in the future.
  if (latestTime <= now.getTime() + futureToleranceMs) return items;

  const inferredOffsetHours = Math.round((latestTime - expectedFrameStart) / (60 * 60 * 1000));
  if (inferredOffsetHours < 1 || inferredOffsetHours > 14) return items;

  const offsetMs = inferredOffsetHours * 60 * 60 * 1000;
  const correctedLatestTime = latestTime - offsetMs;
  if (correctedLatestTime > now.getTime() + futureToleranceMs || correctedLatestTime < expectedFrameStart - frameMs * 2) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    time: new Date(item.time.getTime() - offsetMs),
  }));
}

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
  const upperRaw = rawSymbol ? String(rawSymbol).toUpperCase().trim() : '';
  const isGoldSymbol = upperRaw.includes('XAU') || upperRaw.includes('GOLD');
  const symbol = isGoldSymbol ? 'XAUUSD' : (rawSymbol || 'XAUUSD');

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

    if (!isGoldSymbol) {
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

    const normalizedSymbol = isGoldSymbol ? 'XAUUSD' : rawSymbol.toUpperCase().trim();

    // Insert or update candles
    const receivedAt = new Date();
    const parsedCandles = candles
      .map((c: any) => ({
        symbol: normalizedSymbol,
        timeframe,
        time: parseCandleTime(c.time),
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
    const dataToInsert = normalizeBrokerCandleTimes(parsedCandles, timeframe, receivedAt);

    if (dataToInsert.length === 0) {
      await prisma.webhookEvent.create({
        data: {
          symbol: normalizedSymbol,
          timeframe,
          source: 'mt5_sync_error',
          rawPayload: JSON.stringify(body),
          status: 'rejected',
          errorMessage: 'Candles array is empty.',
        }
      });
      return NextResponse.json({ error: 'Candles array is empty.' }, { status: 400, headers: noStoreHeaders });
    }

    const frameMs = timeframeDurationMs[timeframe] || 5 * 60 * 1000;
    const futureCutoff = new Date(receivedAt.getTime() + Math.min(frameMs, 5 * 60 * 1000));

    // Remove rows created by older EA payloads whose broker-local time was mistaken for UTC.
    await prisma.candle.deleteMany({
      where: {
        symbol: normalizedSymbol,
        timeframe,
        time: { gt: futureCutoff },
      },
    });

    const latestBefore = await prisma.candle.findFirst({
      where: { symbol: normalizedSymbol, timeframe },
      orderBy: { time: 'desc' },
      select: { time: true, open: true, high: true, low: true, close: true },
    });

    const touchedAt = receivedAt;

    // Optimize database writes: Fetch existing candles in this timeframe range first
    const existingCandles = await prisma.candle.findMany({
      where: {
        symbol: normalizedSymbol,
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
          price: latestIncoming.close,
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

    // Automatic Live Plan Refresh: Expire stale plans (>30 mins or price moved >$8.00 away) & generate fresh plan
    let activePlan = null;
    try {
      const currentPrice = latestIncoming.close;
      const activePlanSetting = await prisma.systemSetting.findUnique({
        where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' }
      });

      let parsedPlan: any = null;
      if (activePlanSetting?.value) {
        try { parsedPlan = JSON.parse(activePlanSetting.value); } catch {}
      }

      const planAgeMs = parsedPlan?.lockedAt ? Date.now() - new Date(parsedPlan.lockedAt).getTime() : 999999999;
      const priceDistance = parsedPlan?.entry ? Math.abs(currentPrice - parsedPlan.entry) : 999;

      // Auto-refresh if active plan is closed, older than 30 minutes, or price moved > $8.00 away from entry
      const isStale = !parsedPlan || Boolean(parsedPlan.isClosed) || planAgeMs > 30 * 60 * 1000 || priceDistance > 8.0;

      if (isStale) {
        console.log(`[MT5 SYNC] Active plan is missing/closed/stale (Closed: ${Boolean(parsedPlan?.isClosed)}, Age: ${Math.round(planAgeMs / 60000)}m, Dist: $${priceDistance.toFixed(2)}). Generating fresh live plan...`);

        const xauSymbolsFilter = {
          in: [
            'XAUUSD',
            'GOLD',
            'GOLD#',
            'GOLD.a',
            'GOLDm',
            'GOLDmicro',
            'GOLD.ecn',
            'XAUUSD#',
            'XAUUSD.iux',
            'XAUUSD.a',
            'XAUUSDm',
            'XAUUSD.raw',
          ],
        };

        const [m5Candles, m15Candles, h1Candles] = await Promise.all([
          prisma.candle.findMany({ where: { symbol: xauSymbolsFilter, timeframe: 'M5' }, orderBy: { time: 'desc' }, take: 40 }),
          prisma.candle.findMany({ where: { symbol: xauSymbolsFilter, timeframe: 'M15' }, orderBy: { time: 'desc' }, take: 40 }),
          prisma.candle.findMany({ where: { symbol: xauSymbolsFilter, timeframe: 'H1' }, orderBy: { time: 'desc' }, take: 40 }),
        ]);

        const m5Data = m5Candles.length > 0 ? m5Candles : dataToInsert;
        const m15Data = m15Candles.length > 0 ? m15Candles : m5Data;
        const h1Data = h1Candles.length > 0 ? h1Candles : m5Data;

        if (m5Data.length > 0) {
          const analysis = SmartTrendStructureService.analyze({
            currentPrice,
            m5Candles: m5Data,
            m15Candles: m15Data,
            h1Candles: h1Data,
          });

          const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
          const bangkokTimeStr = `${nowBangkok.getUTCHours().toString().padStart(2, '0')}:${nowBangkok.getUTCMinutes().toString().padStart(2, '0')} น.`;

          const targetDir = analysis.overallSignal !== 'WAIT' ? analysis.overallSignal : (analysis.score >= 0 ? 'BUY' : 'SELL');
          const planType = targetDir === 'BUY'
            ? (analysis.entryTarget < currentPrice ? 'BUY_LIMIT' : 'BUY_MARKET')
            : (analysis.entryTarget > currentPrice ? 'SELL_LIMIT' : 'SELL_MARKET');

          const freshPlan = {
            id: `qwen-plan-${Date.now()}`,
            type: planType,
            title: `[M15 Live Sync] ${targetDir === 'BUY' ? 'BUY แนวรับสำคัญ' : 'SELL แนวต้านสำคัญ'} $${analysis.entryTarget.toFixed(2)} (เป้าเก็บส่วนต่าง $16-$22)`,
            entry: analysis.entryTarget,
            entry1: analysis.entryTarget,
            stopLoss: analysis.stopLossTarget,
            takeProfit: analysis.takeProfitTarget,
            reason: `[ซิงค์สด ${bangkokTimeStr}] ${analysis.reason}`,
            timeframe: 'M15',
            confidence: analysis.confidence,
            strategyLabel: 'SmartTrendStructure Auto-Engine (Live MT5 Sync)',
            planTime: bangkokTimeStr,
            createdAtThailand: `${bangkokTimeStr} (เวลาไทย)`,
            lockedAt: new Date().toISOString(),
          };

          // Save fresh plan to SystemSetting
          await prisma.systemSetting.upsert({
            where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
            update: { value: JSON.stringify(freshPlan) },
            create: { key: 'ACTIVE_ORDER_PLAN_XAUUSD', value: JSON.stringify(freshPlan) },
          });

          // Expire older pending PLANs
          await prisma.paperTrade.updateMany({
            where: { symbol: 'XAUUSD', result: 'PLAN' },
            data: { result: 'EXPIRED', notes: `ยกเลิกแผนเก่าเนื่องจากราคาขยับไปไกล ($${priceDistance.toFixed(2)}) หรือเกินเวลา 30 นาที` }
          });

          // Record new plan
          await prisma.paperTrade.create({
            data: {
              symbol: 'XAUUSD',
              direction: targetDir,
              entry: freshPlan.entry,
              stopLoss: freshPlan.stopLoss,
              takeProfit1: freshPlan.takeProfit,
              takeProfit2: freshPlan.takeProfit,
              result: 'PLAN',
              notes: freshPlan.reason,
            }
          });

          // Dispatch LINE notification
          const lineMessage = `⚡ [ Gold AI Signal สัญญาณอัปเดตใหม่ ] ⚡\n\n🕒 เวลาที่ปรับแผน: ${bangkokTimeStr} (เวลาไทย)\n📌 แผน: ${freshPlan.title}\n📊 ประเภท: ${freshPlan.type}\n🎯 จุดเข้า (Entry Target): $${freshPlan.entry.toFixed(2)}\n🔴 Stop Loss (SL): $${freshPlan.stopLoss.toFixed(2)}\n🟢 Take Profit (TP): $${freshPlan.takeProfit.toFixed(2)}\n\n💡 เหตุผลวิเคราะห์:\n${freshPlan.reason}\n\n👉 ดูรายละเอียดเพิ่มเติมและกราฟสดได้ที่ goldaisig.com`;

          NotificationService.sendNotification(lineMessage).catch(() => {});

          parsedPlan = freshPlan;
        }
      }

      if (parsedPlan && parsedPlan.entry && parsedPlan.stopLoss && parsedPlan.takeProfit) {
        activePlan = {
          id: parsedPlan.id,
          type: parsedPlan.type,
          title: parsedPlan.title,
          entry: parsedPlan.entry,
          stopLoss: parsedPlan.stopLoss,
          takeProfit: parsedPlan.takeProfit,
          confidence: parsedPlan.confidence,
          timeframe: parsedPlan.timeframe,
          isClosed: Boolean(parsedPlan.isClosed),
          closedReason: parsedPlan.closedReason || null,
          lockedAt: parsedPlan.lockedAt || null,
        };
      }
    } catch (planErr) {
      console.error('Failed to update/attach activePlan in MT5 sync response:', planErr);
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
