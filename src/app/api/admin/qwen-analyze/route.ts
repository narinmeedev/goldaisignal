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

      // Save as active order plan for MT5 & Dashboard
      await prisma.systemSetting.upsert({
        where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
        update: { value: JSON.stringify(planToApply) },
        create: { key: 'ACTIVE_ORDER_PLAN_XAUUSD', value: JSON.stringify(planToApply) },
      });

      // Clear caches so the next dashboard-stats query fetches the new plan immediately
      await prisma.systemSetting.deleteMany({
        where: {
          key: {
            in: [
              'CACHE_DASHBOARD_STATS_PUBLIC',
              'CACHE_DASHBOARD_STATS_VIEWER',
              'CACHE_DASHBOARD_STATS_ADMIN',
            ],
          },
        },
      });

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
          initialResult: 'PLAN',
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

    // Default Action: Run Qwen Analysis
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

    const zones = await prisma.zone.findMany({
      where: { symbol },
      orderBy: { priceMin: 'asc' },
    });

    const supports = zones.filter((z) => z.type === 'SUPPORT' && z.priceMax < currentPrice).map((z) => z.priceMax).slice(0, 3);
    const resistances = zones.filter((z) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).map((z) => z.priceMin).slice(0, 3);

    // Compute dynamic ATR(14) from M15 candles
    let atr14 = 5.0;
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

    const slBuffer = Math.max(12.0, atr14 * 2.2);
    const tpBuffer = slBuffer * 2.2;
    const isBullish = currentPrice > (m15Candles[10]?.close || currentPrice);

    const qwenResult = await QwenLocalAiService.refineTradePlan({
      symbol,
      currentPrice,
      bias: isBullish ? 'BULLISH' : 'BEARISH',
      trendStrength: 82,
      rsi14M5: 48,
      rsi14: 52,
      atr14,
      ema20_m15: m15Candles[0]?.close || currentPrice,
      nearestSupport: supports.length > 0 ? supports : [currentPrice - slBuffer],
      nearestResistance: resistances.length > 0 ? resistances : [currentPrice + tpBuffer],
      proposedType: isBullish ? 'BUY_LIMIT' : 'SELL_LIMIT',
      proposedEntry: Number((isBullish ? currentPrice - 1.5 : currentPrice + 1.5).toFixed(2)),
      proposedSL: Number((isBullish ? currentPrice - 1.5 - slBuffer : currentPrice + 1.5 + slBuffer).toFixed(2)),
      proposedTP: Number((isBullish ? currentPrice - 1.5 + tpBuffer : currentPrice + 1.5 - tpBuffer).toFixed(2)),
    });

    return NextResponse.json({
      success: true,
      model: 'Qwen 3.5-9B (LM Studio)',
      currentPrice,
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
