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

    // Fetch candle history (H4, H1, M15, M5) and recent loss records for Qwen post-mortem analysis
    const [h4Candles, h1Candles, m15Candles, m5Candles, recentLosses] = await Promise.all([
      prisma.candle.findMany({
        where: { symbol, timeframe: 'H4' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
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

    const currentPriceCandle = m5Candles[0] || m15Candles[0] || h1Candles[0] || h4Candles[0];
    const currentPrice = currentPriceCandle ? currentPriceCandle.close : 4015.0;

    const zones = await prisma.zone.findMany({
      where: { symbol },
      orderBy: { priceMin: 'asc' },
    });

    const supports = zones.filter((z) => z.type === 'SUPPORT' && z.priceMax < currentPrice).map((z) => z.priceMax).slice(0, 3);
    const resistances = zones.filter((z) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).map((z) => z.priceMin).slice(0, 3);

    // Compute EMAs for H4, H1, M15, M5
    const ema20_h4 = h4Candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(20, h4Candles.length));
    const ema50_h4 = h4Candles.slice(0, 30).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(30, h4Candles.length));
    const isH4Bullish = ema20_h4 >= ema50_h4 || currentPrice > ema20_h4;
    const isH4Bearish = ema20_h4 < ema50_h4 && currentPrice < ema20_h4;

    const ema20_h1 = h1Candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(20, h1Candles.length));
    const ema50_h1 = h1Candles.slice(0, 30).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(30, h1Candles.length));
    const isH1Bullish = ema20_h1 >= ema50_h1;

    // SMC Market Structure (CHoCH & BOS Detection)
    const prevM15High = Math.max(...m15Candles.slice(1, 10).map((c) => c.high));
    const prevM15Low = Math.min(...m15Candles.slice(1, 10).map((c) => c.low));
    const prevM5High = Math.max(...m5Candles.slice(1, 6).map((c) => c.high));
    const prevM5Low = Math.min(...m5Candles.slice(1, 6).map((c) => c.low));

    const isBullishBOS = currentPrice > prevM15High || (m5Candles[0]?.close > prevM5High && m5Candles[1]?.close <= prevM5High);
    const isBearishBOS = currentPrice < prevM15Low || (m5Candles[0]?.close < prevM5Low && m5Candles[1]?.close >= prevM5Low);

    const m5Lows = m5Candles.slice(0, 10).map((c) => c.low);
    const isHigherLows = m5Lows[0] > m5Lows[3] && m5Lows[3] > m5Lows[6];
    const isBullishCHoCH = isHigherLows && currentPrice > (m5Candles[2]?.high || currentPrice);

    // Compute Structural Swing Range
    const recentHigh = Math.max(...m15Candles.map((c) => c.high), currentPrice);
    const recentLow = Math.min(...m15Candles.map((c) => c.low), currentPrice);
    const swingRange = Math.max(recentHigh - recentLow, 8.0);
    const posRatio = (currentPrice - recentLow) / (swingRange || 1);

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

    // Compute RSI(14) for M15 candles
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

    // Direction Determination incorporating SMC CHoCH, BOS & H4 Major Trend
    let targetDirection: 'BUY' | 'SELL' = 'BUY';
    let smcTag = '';

    if (isBullishBOS || isBullishCHoCH) {
      // CRITICAL SMC RULE: In Bullish BOS / CHoCH (Uptrend Break), DO NOT SELL!
      targetDirection = 'BUY';
      smcTag = isBullishBOS ? '⚡ Bullish BOS (เบรคโครงสร้าง M15 ขึ้นสูง - ห้าม SELL สวน)' : '🔄 Bullish CHoCH (ยก Low สร้าง Uptrend)';
    } else if (isBearishBOS) {
      targetDirection = 'SELL';
      smcTag = '⚡ Bearish BOS (เบรคโครงสร้าง M15 ลงต่ำ - ห้าม BUY สวน)';
    } else if (isH4Bullish && posRatio < 0.65) {
      targetDirection = 'BUY';
      smcTag = '📈 H4 Major Uptrend (เทรนด์ใหญ่ H4 ขาขึ้น)';
    } else if (isH4Bearish && posRatio > 0.35) {
      targetDirection = 'SELL';
      smcTag = '📉 H4 Major Downtrend (เทรนด์ใหญ่ H4 ขาลง)';
    } else {
      targetDirection = posRatio >= 0.55 ? 'SELL' : 'BUY';
      smcTag = targetDirection === 'BUY' ? '🟢 ย่อรับฐาน Support' : '🔴 เด้งขายโซน Resistance';
    }

    const h1Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = targetDirection === 'BUY' ? 'BULLISH' : 'BEARISH';
    const m15Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = targetDirection === 'BUY' ? 'BULLISH' : 'BEARISH';

    const fib50 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.50).toFixed(2)) : Number((recentLow + swingRange * 0.50).toFixed(2));
    const fib618 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.618).toFixed(2)) : Number((recentLow + swingRange * 0.618).toFixed(2));

    const closeSupportDeep = supports.find((s) => currentPrice - s >= 2.5 && currentPrice - s <= 8.0);
    const closeResistanceDeep = resistances.find((r) => r - currentPrice >= 2.5 && r - currentPrice <= 8.0);

    // Precision Key Level Support & Resistance Selection
    const exactSupportKey = supports.length > 0 ? Number(supports[0].toFixed(2)) : Number((recentLow + 0.5).toFixed(2));
    const exactResistanceKey = resistances.length > 0 ? Number(resistances[0].toFixed(2)) : Number((recentHigh - 0.5).toFixed(2));

    let targetEntry = 0;
    if (targetDirection === 'SELL') {
      targetEntry = exactResistanceKey;
      if (targetEntry <= currentPrice + 1.5) {
        targetEntry = Number((currentPrice + 2.5).toFixed(2));
      }
    } else {
      targetEntry = exactSupportKey;
      if (targetEntry >= currentPrice - 1.5) {
        targetEntry = Number((currentPrice - 2.5).toFixed(2));
      }
    }
    targetEntry = Number(targetEntry.toFixed(2));

    // Place Stop Loss safely behind structural extreme (8.0$ SL distance)
    const targetSL = targetDirection === 'BUY'
      ? Number((targetEntry - 8.0).toFixed(2))
      : Number((targetEntry + 8.0).toFixed(2));

    // Lock in Short-Term Scalping Take Profit ($10.0 - $18.0 Gold Difference / 100 - 180 Pips)
    const scalpProfitDist = Math.min(18.0, Math.max(10.0, swingRange * 0.65));
    const targetTP = targetDirection === 'BUY'
      ? Number((targetEntry + scalpProfitDist).toFixed(2))
      : Number((targetEntry - scalpProfitDist).toFixed(2));

    const ema20_m15 = m15Candles.slice(0, 20).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(20, m15Candles.length));
    const ema50_m15 = m15Candles.slice(0, 30).reduce((acc, c) => acc + c.close, 0) / Math.max(1, Math.min(30, m15Candles.length));

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
    const timeframeTag = 'M15';
    const planToApply = {
      id: `qwen-plan-${Date.now()}`,
      type: qwenResult.type || (qwenResult.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT'),
      title: `[${timeframeTag} Scalp] ${targetDirection === 'BUY' ? 'BUY แนวรับสำคัญ' : 'SELL แนวต้านสำคัญ'} $${qwenResult.refinedEntry.toFixed(2)} (เป้าเก็บส่วนต่าง $10-$20)`,
      entry: qwenResult.refinedEntry,
      entry1: qwenResult.refinedEntry,
      stopLoss: qwenResult.refinedSL,
      takeProfit: qwenResult.refinedTP,
      reason: `[สัญญาณ ${timeframeTag}] ${smcTag} | เข้าตรงแนวสำคัญ $${qwenResult.refinedEntry.toFixed(2)} (เป้าเก็บสั้นส่วนต่าง $10-$20) | ${qwenResult.reason}`,
      timeframe: timeframeTag,
      confidence: qwenResult.confidence,
      strategyLabel: `Qwen 3.5-9B Quantitative AI (${qwenResult.source})`,
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
