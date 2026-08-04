import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QwenLocalAiService } from '@/lib/services/qwen-ai.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';

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
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const symbol = 'XAUUSD';

    // Handle Action: Apply Qwen Plan to Dashboard & MT5
    if (body.action === 'apply' && body.plan) {
      const planToApply = {
        id: `qwen-plan-${Date.now()}`,
        type: body.plan.type || (body.plan.refinedEntry < body.plan.currentPrice ? 'BUY_LIMIT' : 'BUY_MARKET'),
        title: `แผนวิเคราะห์โดย Qwen 3.5-9B AI`,
        entry: Number(body.plan.refinedEntry || body.plan.entry),
        entry1: Number(body.plan.refinedEntry || body.plan.entry),
        stopLoss: Number(body.plan.refinedSL || body.plan.stopLoss),
        takeProfit: Number(body.plan.refinedTP || body.plan.takeProfit),
        confidence: Number(body.plan.confidence) || 88,
        reason: `🤖 [Qwen 3.5-9B AI]: ${body.plan.reason}`,
        strategyLabel: 'Qwen 3.5-9B Local AI Analyst',
        timeframe: 'M15',
        lockedAt: new Date().toISOString(),
      };

      // Save as active order plan for MT5 & Dashboard with retry safety
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await prisma.systemSetting.upsert({
            where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
            update: { value: JSON.stringify(planToApply) },
            create: { key: 'ACTIVE_ORDER_PLAN_XAUUSD', value: JSON.stringify(planToApply) },
          });
          await prisma.systemSetting.upsert({
            where: { key: 'LAST_QWEN_ANALYSIS_TIME' },
            update: { value: Date.now().toString() },
            create: { key: 'LAST_QWEN_ANALYSIS_TIME', value: Date.now().toString() },
          });
          break;
        } catch (dbErr) {
          if (attempt === 2) throw dbErr;
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      // Create a paper trade record
      try {
        await PaperTradeService.openTrade({
          signalId: '',
          symbol: 'XAUUSD',
          direction: planToApply.type.includes('BUY') ? 'BUY' : 'SELL',
          entry: planToApply.entry,
          stopLoss: planToApply.stopLoss,
          takeProfit1: planToApply.takeProfit,
          takeProfit2: planToApply.takeProfit + 2.0,
          initialResult: 'OPEN',
          notes: planToApply.reason,
        });
      } catch (ptErr) {
        console.error('[Qwen Apply] Failed to create paper trade:', ptErr);
      }

      return NextResponse.json({
        success: true,
        message: 'นำแผนของ Qwen 3.5-9B ไปใช้งานบนหน้าจอและ MT5 เรียบร้อยแล้ว',
        appliedPlan: planToApply,
      }, { headers: noStoreHeaders });
    }

    // Fetch candle history (H1, M15, M5) and recent loss records for Qwen post-mortem analysis
    const [h1Candles, m15Candles, m5Candles, recentLosses] = await Promise.all([
      prisma.candle.findMany({
        where: { symbol, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol, timeframe: 'M5' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.paperTrade.findMany({
        where: { symbol, result: 'LOSS' },
        orderBy: { closedAt: 'desc' },
        take: 5,
        select: { direction: true, entry: true, stopLoss: true, notes: true, closedAt: true },
      }),
    ]);

    const currentPriceCandle = m5Candles[0] || m15Candles[0] || h1Candles[0];
    const currentPrice = currentPriceCandle ? currentPriceCandle.close : 4015.0;

    const zones = await prisma.zone.findMany({
      where: { symbol },
      orderBy: { priceMin: 'asc' },
    });

    const supports = zones.filter((z) => z.type === 'SUPPORT' && z.priceMax < currentPrice).map((z) => z.priceMax).slice(0, 3);
    const resistances = zones.filter((z) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).map((z) => z.priceMin).slice(0, 3);

    // Detect V-Shape Bounce from Base vs Peak Rejection
    const minM5Low = Math.min(...m5Candles.slice(0, 12).map((c) => c.low), currentPrice);
    const maxM5High = Math.max(...m5Candles.slice(0, 12).map((c) => c.high), currentPrice);

    const bounceFromBase = currentPrice - minM5Low;
    const rejectionFromPeak = maxM5High - currentPrice;

    // Compute dynamic ATR(14) from M15 candles
    let atr14 = 5.5;
    if (m15Candles.length >= 14) {
      let trSum = 0;
      for (let i = 0; i < 14; i++) {
        const high = m15Candles[i].high;
        const low = m15Candles[i].low;
        const prevClose = m15Candles[i + 1]?.close || low;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
      }
      atr14 = trSum / 14;
    }

    // Compute EMAs for M15
    const ema20_m15 = m15Candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(20, m15Candles.length));
    const ema50_m15 = m15Candles.slice(0, 30).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(30, m15Candles.length));

    // Fetch active order plan to enforce Directional Hysteresis Lock (prevent flip-flopping within 60 mins)
    const existingPlanSetting = await prisma.systemSetting.findUnique({
      where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
    });
    let activeDirectionLock: 'BUY' | 'SELL' | null = null;
    let activeLockAgeMinutes = 999;
    if (existingPlanSetting?.value) {
      try {
        const parsed = JSON.parse(existingPlanSetting.value);
        if (parsed?.type?.includes('BUY')) activeDirectionLock = 'BUY';
        if (parsed?.type?.includes('SELL')) activeDirectionLock = 'SELL';
        if (parsed?.lockedAt) {
          activeLockAgeMinutes = (Date.now() - new Date(parsed.lockedAt).getTime()) / (60 * 1000);
        }
      } catch {}
    }

    // Compute Structural Swing Range (24h / M15 Range)
    const recentHigh = Math.max(...m15Candles.map((c) => c.high), currentPrice);
    const recentLow = Math.min(...m15Candles.map((c) => c.low), currentPrice);
    const swingRange = Math.max(recentHigh - recentLow, 8.0);
    const rangeMid = (recentHigh + recentLow) / 2;

    // 3-Zone Range Boundaries
    const lowerZoneBoundary = recentLow + swingRange * 0.30; // Lower 30% Zone (Support Base)
    const upperZoneBoundary = recentHigh - swingRange * 0.30; // Upper 30% Zone (Resistance High)
    const isPriceInMiddleZone = currentPrice > lowerZoneBoundary && currentPrice < upperZoneBoundary;
    const isSideway = swingRange >= 10.0 && swingRange <= 45.0;

    // Compute RSI(14) for M15 candles to detect overbought/oversold extremes
    let rsi14_m15 = 50;
    if (m15Candles.length >= 15) {
      let gains = 0;
      let losses = 0;
      for (let i = 0; i < 14; i++) {
        const change = m15Candles[i].close - (m15Candles[i + 1]?.close || m15Candles[i].close);
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      rsi14_m15 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    // Compute M5 Wave Position & Retracement Ratio
    const posRatio = (currentPrice - recentLow) / (swingRange || 1);
    
    // M5 Short-Term Rejection Check
    const isM5BearishRejection = m5Candles.slice(0, 3).some((c) => c.high >= recentHigh - 2.0 && c.close < c.open);
    const isM5BullishBounce = m5Candles.slice(0, 3).some((c) => c.low <= recentLow + 2.0 && c.close > c.open);

    // H1 Trend Alignment
    const ema20_h1 = h1Candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(20, h1Candles.length));
    const ema50_h1 = h1Candles.slice(0, 30).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(30, h1Candles.length));
    const isH1Bullish = ema20_h1 >= ema50_h1;

    // Direction Determination: Look at M5 Pullback Highs & Lows
    let targetDirection: 'BUY' | 'SELL' = 'BUY';

    if (posRatio >= 0.55 || isM5BearishRejection || rsi14_m15 >= 58) {
      // Price is in Upper Range Half ($4060+) or rejecting off M5 Peak -> ISSUE SELL_LIMIT FOR M5 RETRACEMENT!
      targetDirection = 'SELL';
    } else if (posRatio <= 0.45 || isM5BullishBounce || rsi14_m15 <= 42) {
      // Price is in Lower Range Half ($4046-) or bouncing off M5 Base -> ISSUE BUY_LIMIT FOR M5 DIP!
      targetDirection = 'BUY';
    } else {
      targetDirection = activeDirectionLock || (isH1Bullish ? 'BUY' : 'SELL');
    }

    const h1Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = targetDirection === 'BUY' ? 'BULLISH' : 'BEARISH';
    const m15Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = targetDirection === 'BUY' ? 'BULLISH' : 'BEARISH';

    const fib50 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.50).toFixed(2)) : Number((recentLow + swingRange * 0.50).toFixed(2));
    const fib618 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.618).toFixed(2)) : Number((recentLow + swingRange * 0.618).toFixed(2));

    const closeSupportDeep = supports.find((s) => currentPrice - s >= 2.5 && currentPrice - s <= 8.0);
    const closeResistanceDeep = resistances.find((r) => r - currentPrice >= 2.5 && r - currentPrice <= 8.0);

    let targetEntry = 0;

    if (targetDirection === 'SELL') {
      // SELL_LIMIT on M5 Pullback High near Resistance ($4068+)
      targetEntry = Number((recentHigh - Math.min(1.5, swingRange * 0.05)).toFixed(2));
      if (targetEntry <= currentPrice + 1.8) {
        targetEntry = Number((currentPrice + 2.5).toFixed(2));
      }
      const minAllowedSellEntry = Number((recentHigh - swingRange * 0.40).toFixed(2));
      if (targetEntry < minAllowedSellEntry) {
        targetEntry = minAllowedSellEntry;
      }
    } else {
      // BUY_LIMIT on M5 Dip Base near Support ($4046+)
      targetEntry = Number((recentLow + Math.min(1.5, swingRange * 0.05)).toFixed(2));
      if (targetEntry >= currentPrice - 1.8) {
        targetEntry = Number((currentPrice - 2.5).toFixed(2));
      }
      const maxAllowedBuyEntry = Number((recentLow + swingRange * 0.40).toFixed(2));
      if (targetEntry > maxAllowedBuyEntry) {
        targetEntry = maxAllowedBuyEntry;
      }
    }
    targetEntry = Number(targetEntry.toFixed(2));

    // Place Stop Loss safely behind structural extreme + ATR buffer
    const targetSL = targetDirection === 'BUY'
      ? Number((Math.min(recentLow - 1.5, targetEntry - Math.max(7.5, atr14 * 1.4))).toFixed(2))
      : Number((Math.max(recentHigh + 1.5, targetEntry + Math.max(7.5, atr14 * 1.4))).toFixed(2));

    // Target TP towards opposite boundary of range for maximum Risk/Reward
    const targetTP = targetDirection === 'BUY'
      ? Number((Math.max(targetEntry + 15.0, recentHigh - 2.0)).toFixed(2))
      : Number((Math.min(targetEntry - 15.0, recentLow + 2.0)).toFixed(2));

    const qwenResult = await QwenLocalAiService.refineTradePlan({
      symbol,
      currentPrice,
      h1Bias,
      m15Bias,
      trendStrength: 85,
      rsi14M5: 48,
      rsi14M15: 52,
      rsi14H1: 55,
      atr14,
      ema20_m15,
      ema50_m15,
      fib50,
      fib618,
      sessionHigh: recentHigh,
      sessionLow: recentLow,
      nearestSupport: supports.length > 0 ? supports : [currentPrice - 4.5],
      nearestResistance: resistances.length > 0 ? resistances : [currentPrice + 4.5],
      proposedType: targetDirection === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT',
      proposedEntry: targetEntry,
      proposedSL: targetSL,
      proposedTP: targetTP,
      h1Candles: h1Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      m15Candles: m15Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      m5Candles: m5Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      recentLosses: recentLosses.map((l) => ({ direction: l.direction, entry: l.entry, stopLoss: l.stopLoss, notes: l.notes, closedAt: l.closedAt })),
    });

    // AUTO-APPLY Qwen's plan directly to ACTIVE_ORDER_PLAN_XAUUSD
    const planToApply = {
      id: `qwen-plan-${Date.now()}`,
      type: qwenResult.type || (qwenResult.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT'),
      title: `แผนวิเคราะห์โดย Qwen 3.5-9B AI (วิเคราะห์ลำดับแท่งเทียน + ทบทวน SL)`,
      entry: qwenResult.refinedEntry,
      entry1: qwenResult.refinedEntry,
      stopLoss: qwenResult.refinedSL,
      takeProfit: qwenResult.refinedTP,
      confidence: qwenResult.confidence,
      reason: `🤖 [Qwen 3.5-9B AI]: ${qwenResult.reason}`,
      strategyLabel: `Qwen 3.5-9B Quantitative AI (${qwenResult.source})`,
      timeframe: 'M15',
      lockedAt: new Date().toISOString(),
    };

    await prisma.systemSetting.upsert({
      where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
      update: { value: JSON.stringify(planToApply) },
      create: { key: 'ACTIVE_ORDER_PLAN_XAUUSD', value: JSON.stringify(planToApply) },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'LAST_QWEN_ANALYSIS_TIME' },
      update: { value: Date.now().toString() },
      create: { key: 'LAST_QWEN_ANALYSIS_TIME', value: Date.now().toString() },
    });

    // Deduplication Guard: Check if an active or pending paper trade is already running for this exact plan
    const newDir = planToApply.type.includes('BUY') ? 'BUY' : 'SELL';
    const existingActiveTrade = await prisma.paperTrade.findFirst({
      where: {
        symbol: 'XAUUSD',
        result: { in: ['PLAN', 'OPEN', 'TESTING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingActiveTrade) {
      // If trade is OPEN or TESTING, preserve it! Let it run until it hits TP or SL naturally!
      if (existingActiveTrade.result === 'OPEN' || existingActiveTrade.result === 'TESTING') {
        console.log(`[Qwen Analyze] Active trade ${existingActiveTrade.id} is currently OPEN/TESTING. Preserving execution tracking to TP/SL.`);
        return NextResponse.json({
          success: true,
          model: 'Qwen 3.5-9B (LM Studio)',
          currentPrice,
          result: qwenResult,
          appliedPlan: planToApply,
          autoApplied: false,
          trackingActiveTrade: true,
        });
      }

      const isSamePlan = existingActiveTrade.direction === newDir && Math.abs(existingActiveTrade.entry - planToApply.entry) < 1.5;
      if (isSamePlan) {
        console.log(`[Qwen Analyze] Active trade ${existingActiveTrade.id} (${existingActiveTrade.direction} @ ${existingActiveTrade.entry}) already matches current plan. Skipping duplicate creation.`);
        return NextResponse.json({
          success: true,
          model: 'Qwen 3.5-9B (LM Studio)',
          currentPrice,
          result: qwenResult,
          appliedPlan: planToApply,
          autoApplied: true,
          skippedDuplicate: true,
        });
      }

      // If existing trade is a stale pending plan (result: 'PLAN'), cancel old plan so new plan can take precedence
      console.log(`[Qwen Analyze] Replacing stale pending plan ${existingActiveTrade.id} (${existingActiveTrade.direction} @ ${existingActiveTrade.entry}) with fresh plan (${newDir} @ ${planToApply.entry}).`);
      await prisma.paperTrade.updateMany({
        where: {
          symbol: 'XAUUSD',
          result: 'PLAN',
        },
        data: {
          result: 'CANCELLED',
          closedAt: new Date(),
        },
      });
    }

    // Create a measurable signal and paper trade record for Qwen AI
    try {
      const signal = await prisma.signal.create({
        data: {
          symbol: 'XAUUSD',
          direction: planToApply.type.includes('BUY') ? 'BUY' : 'SELL',
          entry: planToApply.entry,
          stopLoss: planToApply.stopLoss,
          takeProfit1: planToApply.takeProfit,
          takeProfit2: Number((planToApply.takeProfit + (planToApply.type.includes('BUY') ? 2.0 : -2.0)).toFixed(2)),
          riskReward: 2.5,
          confidence: planToApply.confidence,
          timeframe: 'M15',
          status: 'active',
          reason: JSON.stringify({
            planType: planToApply.type,
            reason: planToApply.reason,
            strategyId: 'qwen_ai_quant_3_5',
            source: qwenResult.source || 'LOCAL_QWEN_LLM',
          }),
        },
      });

      const isLimitPlan = planToApply.type.includes('LIMIT') || planToApply.type.includes('STOP');

      await prisma.paperTrade.create({
        data: {
          signalId: signal.id,
          symbol: 'XAUUSD',
          direction: planToApply.type.includes('BUY') ? 'BUY' : 'SELL',
          entry: planToApply.entry,
          stopLoss: planToApply.stopLoss,
          takeProfit1: planToApply.takeProfit,
          takeProfit2: Number((planToApply.takeProfit + (planToApply.type.includes('BUY') ? 2.0 : -2.0)).toFixed(2)),
          result: isLimitPlan ? 'PLAN' : 'OPEN',
          rrResult: 0.0,
          openedAt: isLimitPlan ? undefined : new Date(),
          notes: `🤖 [Qwen 3.5-9B AI Quant]: ${planToApply.reason}`,
        },
      });
      console.log(`[Qwen Analyze] Recorded signal ${signal.id} and paper trade for Qwen AI plan.`);
    } catch (ptErr) {
      console.error('[Qwen Analyze] Failed to create paper trade:', ptErr);
    }

    return NextResponse.json({
      success: true,
      model: 'Qwen 3.5-9B (LM Studio)',
      currentPrice,
      result: qwenResult,
      appliedPlan: planToApply,
      autoApplied: true,
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[Qwen Analyze Route Error]:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'ไม่สามารถประมวลผล Qwen AI ได้',
    }, { status: 500, headers: noStoreHeaders });
  }
}
