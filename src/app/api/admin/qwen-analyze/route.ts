import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QwenLocalAiService } from '@/lib/services/qwen-ai.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';
import { NotificationService } from '@/lib/services/notification.service';
import { SmartTrendStructureService } from '@/lib/services/smart-trend-structure.service';

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

    const GOLD_SYMBOLS = ['GOLD#', 'XAUUSD', 'GOLD', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.raw', 'GOLD.ecn'];
    const symbol = 'GOLD#';

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
          symbol: 'GOLD#',
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
        where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'H4' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.candle.findMany({
        where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'M5' },
        orderBy: { time: 'desc' },
        take: 30,
      }),
      prisma.paperTrade.findMany({
        where: { symbol: { in: GOLD_SYMBOLS }, result: 'LOSS' },
        orderBy: { closedAt: 'desc' },
        take: 5,
        select: { direction: true, entry: true, stopLoss: true, notes: true, closedAt: true },
      }),
    ]);

    const currentPriceCandle = m5Candles[0] || m15Candles[0] || h1Candles[0] || h4Candles[0];
    const currentPrice = currentPriceCandle ? currentPriceCandle.close : 4015.0;

    // Run SmartTrendStructure Indicator Engine Calculations (M5/M15/H1 EMA20/50 + RSI + Swing CHoCH/BOS)
    const stsResult = SmartTrendStructureService.analyze({
      currentPrice,
      m5Candles: m5Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      m15Candles: m15Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      h1Candles: h1Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
    });

    const zones = await prisma.zone.findMany({
      where: { symbol: { in: GOLD_SYMBOLS } },
      orderBy: { priceMin: 'asc' },
    });

    const dbSupports = zones.filter((z) => z.type === 'SUPPORT' && z.priceMax < currentPrice).map((z) => z.priceMax).slice(0, 3);
    const dbResistances = zones.filter((z) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).map((z) => z.priceMin).slice(0, 3);

    const stsSupports = stsResult.supportLevels.map((s) => s.price);
    const stsResistances = stsResult.resistanceLevels.map((r) => r.price);

    const combinedSupports = Array.from(new Set([...dbSupports, ...stsSupports])).slice(0, 3);
    const combinedResistances = Array.from(new Set([...dbResistances, ...stsResistances])).slice(0, 3);

    // Compute Structural Swing Range
    const recentHigh = Math.max(...m15Candles.map((c) => c.high), currentPrice);
    const recentLow = Math.min(...m15Candles.map((c) => c.low), currentPrice);
    const swingRange = Math.max(recentHigh - recentLow, 8.0);

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

    const targetDirection: 'BUY' | 'SELL' = stsResult.overallSignal === 'SELL' ? 'SELL' : 'BUY';
    const smcTag = stsResult.lastStructureEvent?.tag
      ? `⚡ [SmartTrendStructure]: ${stsResult.lastStructureEvent.tag}`
      : `🟢 [SmartTrendStructure]: M5 (${stsResult.biases.M5.bias}) | M15 (${stsResult.biases.M15.bias}) | H1 (${stsResult.biases.H1.bias})`;

    const h1Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = stsResult.biases.H1.bias === 'BULLISH' ? 'BULLISH' : stsResult.biases.H1.bias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
    const m15Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = stsResult.biases.M15.bias === 'BULLISH' ? 'BULLISH' : stsResult.biases.M15.bias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';

    const fib50 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.50).toFixed(2)) : Number((recentLow + swingRange * 0.50).toFixed(2));
    const fib618 = targetDirection === 'BUY' ? Number((recentHigh - swingRange * 0.618).toFixed(2)) : Number((recentLow + swingRange * 0.618).toFixed(2));

    const exactSupportKey = combinedSupports.length > 0 ? Number(combinedSupports[0].toFixed(2)) : Number((recentLow + 0.5).toFixed(2));
    const exactResistanceKey = combinedResistances.length > 0 ? Number(combinedResistances[0].toFixed(2)) : Number((recentHigh - 0.5).toFixed(2));

    // INSTITUTIONAL ORDER BLOCK (OB) & FAIR VALUE GAP (FVG) CALCULATION
    let fvgSupportPx = exactSupportKey;
    let fvgResistancePx = exactResistanceKey;

    if (m15Candles.length >= 3) {
      // Bullish FVG: Low of candle 0 > High of candle 2
      for (let i = 0; i < m15Candles.length - 2; i++) {
        if (m15Candles[i].low > m15Candles[i + 2].high + 0.8) {
          fvgSupportPx = Number(((m15Candles[i].low + m15Candles[i + 2].high) / 2).toFixed(2));
          break;
        }
        // Bearish FVG: High of candle 0 < Low of candle 2
        if (m15Candles[i].high < m15Candles[i + 2].low - 0.8) {
          fvgResistancePx = Number(((m15Candles[i].high + m15Candles[i + 2].low) / 2).toFixed(2));
          break;
        }
      }
    }

    let targetEntry = 0;
    if (targetDirection === 'SELL') {
      // Use Order Block / FVG Supply Zone
      targetEntry = fvgResistancePx > currentPrice ? fvgResistancePx : exactResistanceKey;
      if (targetEntry <= currentPrice + 1.8) {
        targetEntry = Number((currentPrice + 2.5).toFixed(2));
      }
    } else {
      // Use Order Block / FVG Demand Zone
      targetEntry = fvgSupportPx < currentPrice ? fvgSupportPx : exactSupportKey;
      if (targetEntry >= currentPrice - 1.8) {
        targetEntry = Number((currentPrice - 2.5).toFixed(2));
      }
    }
    targetEntry = Number(targetEntry.toFixed(2));

    // Tight Scalp Stop Loss ($3.50 - $4.50 max risk distance)
    const tightSLDistance = Math.min(4.50, Math.max(3.50, atr14 * 0.70));
    const targetSL = targetDirection === 'BUY'
      ? Number((targetEntry - tightSLDistance).toFixed(2))
      : Number((targetEntry + tightSLDistance).toFixed(2));

    // High Risk/Reward Scalping Take Profit ($9.50 - $14.50 Gold Difference)
    const scalpProfitDist = Math.min(14.50, Math.max(9.50, tightSLDistance * 2.5));
    const targetTP = targetDirection === 'BUY'
      ? Number((targetEntry + scalpProfitDist).toFixed(2))
      : Number((targetEntry - scalpProfitDist).toFixed(2));

    const qwenResult = await QwenLocalAiService.refineTradePlan({
      symbol,
      currentPrice,
      h1Bias,
      m15Bias,
      trendStrength: stsResult.overallSignal !== 'WAIT' ? 90 : 75,
      rsi14M5: stsResult.biases.M5.rsi,
      rsi14M15: stsResult.biases.M15.rsi,
      rsi14H1: stsResult.biases.H1.rsi,
      atr14,
      ema20_m15: stsResult.biases.M15.fastEMA,
      ema50_m15: stsResult.biases.M15.slowEMA,
      fib50,
      fib618,
      sessionHigh: recentHigh,
      sessionLow: recentLow,
      nearestSupport: combinedSupports.length > 0 ? combinedSupports : [currentPrice - 4.5],
      nearestResistance: combinedResistances.length > 0 ? combinedResistances : [currentPrice + 4.5],
      proposedType: targetDirection === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT',
      proposedEntry: targetEntry,
      proposedSL: targetSL,
      proposedTP: targetTP,
      h1Candles: h1Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      m15Candles: m15Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      m5Candles: m5Candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
      recentLosses: recentLosses.map((l) => ({ direction: l.direction, entry: l.entry, stopLoss: l.stopLoss, notes: l.notes, closedAt: l.closedAt })),
    });

    // Format Thailand Local Time (UTC+7)
    const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const bangkokTimeStr = `${nowBangkok.getUTCHours().toString().padStart(2, '0')}:${nowBangkok.getUTCMinutes().toString().padStart(2, '0')} น.`;

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
      planTime: bangkokTimeStr,
      createdAtThailand: `${bangkokTimeStr} (เวลาไทย)`,
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

    // Send automatic LINE Push notification to all connected LINE users with Thailand Time
    const lineMessage = `⚡ [ Gold AI Signal สัญญาณใหม่ ] ⚡\n\n🕒 เวลาที่ให้แผน: ${bangkokTimeStr} (เวลาไทย)\n📌 แผน: ${planToApply.title}\n📊 ประเภท: ${planToApply.type}\n🎯 จุดเข้า (Entry Target): $${planToApply.entry.toFixed(2)}\n🔴 Stop Loss (SL): $${planToApply.stopLoss.toFixed(2)}\n🟢 Take Profit (TP): $${planToApply.takeProfit.toFixed(2)}\n\n💡 เหตุผลวิเคราะห์:\n${planToApply.reason.replace(/\*/g, '')}\n\n👉 ดูรายละเอียดเพิ่มเติมและกราฟสดได้ที่ goldaisig.com`;

    NotificationService.sendNotification(lineMessage).catch((err) => {
      console.error('[Qwen Analyze] LINE Push Notification Error:', err);
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
