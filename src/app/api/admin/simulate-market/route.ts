import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'clear_candles') {
      await prisma.candle.deleteMany({});
      await prisma.webhookEvent.deleteMany({});
      return NextResponse.json({ success: true, message: 'All candles and webhooks wiped' });
    }

    if (action === 'seed_candles') {
      const timeframes = ['M15', 'H1', 'H4'];
      const symbols = ['XAUUSD', 'BTCUSD'];
      
      // Delete existing records to reset nicely
      await prisma.candle.deleteMany({});
      await prisma.zone.deleteMany({});

      let totalCreated = 0;

      for (const symbol of symbols) {
        for (const tf of timeframes) {
          const intervalMs = tf === 'M15' ? 15 * 60 * 1000 : tf === 'H1' ? 60 * 60 * 1000 : 4 * 60 * 1000 * 60;
          const nowMs = Date.now();
          const isBtc = symbol.toUpperCase().includes('BTC');
          let currentPrice = isBtc ? 68400.0 : 3330.0;
          const dataToInsert = [];

          for (let i = 150; i >= 0; i--) {
            const time = new Date(nowMs - i * intervalMs);
            
            // Dynamic waves and noise based on asset type
            const wave = Math.sin(i / 10) * (isBtc ? 750.0 : 15.0);
            const noise = (Math.random() - 0.5) * (isBtc ? 300.0 : 4.0);
            const trend = i * (isBtc ? -1.5 : -0.05);
            
            const close = parseFloat((currentPrice + wave + noise + trend).toFixed(2));
            const open = parseFloat((close - (Math.random() - 0.5) * (isBtc ? 200.0 : 3.0)).toFixed(2));
            const high = parseFloat((Math.max(open, close) + Math.random() * (isBtc ? 150.0 : 2.0)).toFixed(2));
            const low = parseFloat((Math.min(open, close) - Math.random() * (isBtc ? 150.0 : 2.0)).toFixed(2));
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
        message: `จำลองตารางแท่งเทียนย้อนหลังทั้งหมด ${totalCreated} แท่ง และคำนวณโซนแนวรับ/แนวต้านของ XAUUSD และ BTCUSD เรียบร้อยแล้ว!`,
      });
    }

    if (action === 'evaluate_price') {
      const { price, symbol } = body;
      if (!price) {
        return NextResponse.json({ error: 'Missing price parameter.' }, { status: 400 });
      }
      const targetSymbol = symbol || 'XAUUSD';

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
      });
    }

    if (action === 'approve_plan') {
      const { tradeId } = body;
      if (!tradeId) {
        return NextResponse.json({ error: 'Missing tradeId parameter.' }, { status: 400 });
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
      });
    }

    if (action === 'close_trade') {
      const { tradeId, exitPrice, notes } = body;
      if (!tradeId || !exitPrice) {
        return NextResponse.json({ error: 'Missing tradeId or exitPrice parameters.' }, { status: 400 });
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
      });
    }

    if (action === 'create_proactive_plan') {
      const { plan } = body;
      if (!plan) return NextResponse.json({ error: 'Missing plan payload' }, { status: 400 });

      // First create a dummy signal for this AI proactive plan
      const signal = await prisma.signal.create({
        data: {
          symbol: plan.symbol || 'XAUUSD',
          timeframe: 'H1',
          direction: plan.type.includes('BUY') ? 'BUY' : 'SELL',
          entry: plan.entry,
          stopLoss: plan.stopLoss,
          takeProfit1: plan.takeProfit,
          takeProfit2: plan.takeProfit,
          riskReward: Math.abs(plan.takeProfit - plan.entry) / Math.abs(plan.entry - plan.stopLoss),
          confidence: plan.confidence || 80,
          status: 'active',
          fakeoutScore: 0,
          reason: JSON.stringify({ proactiveReason: plan.reason }),
        },
      });

      // Then immediately open it as a PLAN (Suggested plan)
      const trade = await PaperTradeService.openTrade({
        signalId: signal.id,
        symbol: plan.symbol || 'XAUUSD',
        direction: plan.type.includes('BUY') ? 'BUY' : 'SELL',
        entry: plan.entry,
        stopLoss: plan.stopLoss,
        takeProfit1: plan.takeProfit,
        takeProfit2: plan.takeProfit,
      });

      // And auto-approve it so it goes to Active tracking
      const activeTrade = await PaperTradeService.approvePlan(trade.id);

      return NextResponse.json({
        success: true,
        message: 'Proactive plan activated.',
        trade: activeTrade,
      });
    }

    return NextResponse.json({ error: 'Invalid simulator action specified.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Simulator execution failed.', details: err.message },
      { status: 500 }
    );
  }
}
