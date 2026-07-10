import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';
import { StrategyResearchService } from '@/lib/services/strategy-research.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MIN_RECOMMENDATION_CONFIDENCE = 70;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'clear_candles') {
      await prisma.candle.deleteMany({});
      await prisma.webhookEvent.deleteMany({});
      return NextResponse.json({ success: true, message: 'All candles and webhooks wiped' }, { headers: noStoreHeaders });
    }

    if (action === 'seed_candles') {
      const timeframes = ['M5', 'M15', 'H1', 'H4'];
      const symbols = ['XAUUSD'];
      
      // Delete existing records to reset nicely
      await prisma.candle.deleteMany({});
      await prisma.zone.deleteMany({});

      let totalCreated = 0;

      for (const symbol of symbols) {
        for (const tf of timeframes) {
          const intervalMs = tf === 'M5'
            ? 5 * 60 * 1000
            : tf === 'M15'
              ? 15 * 60 * 1000
              : tf === 'H1'
                ? 60 * 60 * 1000
                : 4 * 60 * 1000 * 60;
          const nowMs = Date.now();
          const currentPrice = 3330.0;
          const dataToInsert = [];

          for (let i = 150; i >= 0; i--) {
            const time = new Date(nowMs - i * intervalMs);
            
            // Dynamic waves and noise based on asset type
            const wave = Math.sin(i / 10) * 15.0;
            const noise = (Math.random() - 0.5) * 4.0;
            const trend = i * -0.05;
            
            const close = parseFloat((currentPrice + wave + noise + trend).toFixed(2));
            const open = parseFloat((close - (Math.random() - 0.5) * 3.0).toFixed(2));
            const high = parseFloat((Math.max(open, close) + Math.random() * 2.0).toFixed(2));
            const low = parseFloat((Math.min(open, close) - Math.random() * 2.0).toFixed(2));
            const volume = Math.floor(Math.random() * 10000 + 1000);

            dataToInsert.push({
              symbol,
              timeframe: tf,
              time,
              open,
              high,
              low,
              close,
              volume,
            });
          }

          // Batch insert
          await prisma.candle.createMany({
            data: dataToInsert,
          });

          totalCreated += dataToInsert.length;

          // Automatically trigger zone calculations
          await ZoneService.updateZones(symbol, tf);
        }
      }

      return NextResponse.json({
        success: true,
        message: `จำลองตารางแท่งเทียนย้อนหลังทั้งหมด ${totalCreated} แท่ง และคำนวณโซนแนวรับ/แนวต้านของ XAUUSD เรียบร้อยแล้ว!`,
      }, { headers: noStoreHeaders });
    }

    if (action === 'evaluate_price') {
      const { price, symbol } = body;
      if (!price) {
        return NextResponse.json({ error: 'Missing price parameter.' }, { status: 400, headers: noStoreHeaders });
      }
      const targetSymbol = String(symbol || 'XAUUSD').toUpperCase().includes('BTC') ? 'XAUUSD' : (symbol || 'XAUUSD');

      const closedLogs = await PaperTradeService.evaluateOpenTradesWithPrice(
        targetSymbol,
        parseFloat(price),
        parseFloat(price),
        parseFloat(price)
      );

      return NextResponse.json({
        success: true,
        message: 'Price evaluation executed.',
        closedTrades: closedLogs,
      }, { headers: noStoreHeaders });
    }

    if (action === 'approve_plan') {
      const { tradeId } = body;
      if (!tradeId) {
        return NextResponse.json({ error: 'Missing tradeId parameter.' }, { status: 400, headers: noStoreHeaders });
      }

      const activeTrade = await PaperTradeService.approvePlan(tradeId);

      // Update parent signal status to active
      if (activeTrade.signalId) {
        await prisma.signal.update({
          where: { id: activeTrade.signalId },
          data: { status: 'active' },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Trading plan approved and paper position opened.',
        trade: activeTrade,
      }, { headers: noStoreHeaders });
    }

    if (action === 'start_plan_test') {
      const { tradeId } = body;
      if (!tradeId) {
        return NextResponse.json({ error: 'Missing tradeId parameter.' }, { status: 400, headers: noStoreHeaders });
      }

      const testingTrade = await PaperTradeService.startPlanTest(tradeId);

      return NextResponse.json({
        success: true,
        message: 'Saved plan is now forward-testing against live TP/SL.',
        trade: testingTrade,
      }, { headers: noStoreHeaders });
    }

    if (action === 'close_trade') {
      const { tradeId, exitPrice, notes } = body;
      if (!tradeId || !exitPrice) {
        return NextResponse.json({ error: 'Missing tradeId or exitPrice parameters.' }, { status: 400, headers: noStoreHeaders });
      }

      const closedTrade = await PaperTradeService.closeTrade(
        tradeId,
        parseFloat(exitPrice),
        notes || 'Closed manually from dashboard.'
      );

      return NextResponse.json({
        success: true,
        message: 'Trade closed successfully.',
        trade: closedTrade,
      }, { headers: noStoreHeaders });
    }

    if (action === 'run_strategy_research') {
      const symbol = 'XAUUSD';
      const report = await StrategyResearchService.runFromDatabase(symbol);

      return NextResponse.json({
        success: true,
        message: `Research bot finished. ${report.approvedStrategies.length} strategy filter(s) passed ${report.targetWinRate}% winrate.`,
        report,
      }, { headers: noStoreHeaders });
    }

    if (action === 'create_proactive_plan') {
      const { plan } = body;
      if (!plan) return NextResponse.json({ error: 'Missing plan payload' }, { status: 400, headers: noStoreHeaders });
      if (String(plan.symbol || 'XAUUSD').toUpperCase().includes('BTC')) {
        return NextResponse.json(
          { error: 'BTCUSD plans are disabled. Gold AI Signal now supports XAUUSD only.' },
          { status: 400, headers: noStoreHeaders },
        );
      }

      const confidence = Math.round(Number(plan.confidence || 0));
      if (!Number.isFinite(confidence) || confidence < MIN_RECOMMENDATION_CONFIDENCE) {
        return NextResponse.json(
          { error: `Plan confidence must be at least ${MIN_RECOMMENDATION_CONFIDENCE}% before it can be saved.` },
          { status: 400, headers: noStoreHeaders },
        );
      }

      if (plan.type === 'WAIT' || (!String(plan.type || '').includes('BUY') && !String(plan.type || '').includes('SELL'))) {
        return NextResponse.json(
          { error: 'Only BUY/SELL trading plans can be saved.' },
          { status: 400, headers: noStoreHeaders },
        );
      }

      const direction = String(plan.type).includes('BUY') ? 'BUY' : 'SELL';
      const entry = Number(plan.entry);
      const stopLoss = Number(plan.stopLoss);
      const takeProfit = Number(plan.takeProfit);
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);

      if (![entry, stopLoss, takeProfit, risk, reward].every(Number.isFinite) || risk <= 0 || reward <= 0) {
        return NextResponse.json(
          { error: 'Invalid plan risk values.' },
          { status: 400, headers: noStoreHeaders },
        );
      }

      const existingPlan = await prisma.paperTrade.findFirst({
        where: {
          symbol: 'XAUUSD',
          direction,
          result: { in: ['PLAN', 'TESTING', 'OPEN'] },
          entry: { gte: entry - risk * 0.2, lte: entry + risk * 0.2 },
        },
      });

      if (existingPlan) {
        return NextResponse.json(
          { error: 'A similar saved or active plan already exists.', trade: existingPlan },
          { status: 409, headers: noStoreHeaders },
        );
      }

      const tp3Val = direction === 'BUY' ? entry + risk * 6.0 : entry - risk * 6.0;
      const entryZoneVal = `$${(entry - risk * 0.25).toFixed(2)} - $${(entry + risk * 0.25).toFixed(2)}`;

      // First create a signal shell for this AI proactive plan.
      const signal = await prisma.signal.create({
        data: {
          symbol: 'XAUUSD',
          timeframe: plan.timeframe || 'H1',
          direction,
          entry,
          stopLoss,
          takeProfit1: takeProfit,
          takeProfit2: takeProfit,
          takeProfit3: tp3Val,
          riskReward: reward / risk,
          confidence,
          status: 'pending',
          bias: direction === 'BUY' ? 'Buy' : 'Sell',
          entryZone: entryZoneVal,
          riskLevel: confidence >= 80 ? 'Low' : 'Medium',
          marketCondition: 'Trending Market',
          result: 'Pending',
          fakeoutScore: 0,
          reason: JSON.stringify({
            proactiveReason: plan.reason,
            strategyId: plan.strategyId,
            strategyMode: plan.strategyMode,
            confirmation: plan.confirmation,
            researchWinRate: plan.researchWinRate,
            savedByUser: true,
          }),
        },
      });

      // Then save it as a forward test. It tracks TP/SL but is not a real active plan until promoted.
      const trade = await PaperTradeService.openTrade({
        signalId: signal.id,
          symbol: 'XAUUSD',
        direction,
        entry,
        stopLoss,
        takeProfit1: takeProfit,
        takeProfit2: takeProfit,
        initialResult: 'TESTING',
        notes: 'Forward test from saved AI plan. Auto-tracks TP/SL and feeds strategy research.',
      });

      return NextResponse.json({
        success: true,
        message: 'Proactive plan saved and started forward-testing. It will close automatically on TP/SL.',
        trade,
      }, { headers: noStoreHeaders });
    }

    return NextResponse.json({ error: 'Invalid simulator action specified.' }, { status: 400, headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Simulator execution failed.', details: err.message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
