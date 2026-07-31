import { prisma } from '../prisma';
import { StrategyResearchService } from './strategy-research.service';
import { NotificationService } from './notification.service';

export interface OpenTradeParams {
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  initialResult?: 'PLAN' | 'TESTING' | 'OPEN';
  notes?: string;
}

export class PaperTradeService {
  private static getSymbolFilter(symbol: string) {
    const clean = (symbol || '').toUpperCase();
    const isGold = clean.includes('XAU') || clean.includes('GOLD');
    const normalizedSymbol = isGold ? 'XAUUSD' : symbol;
    return {
      in: [
        normalizedSymbol,
        'XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'GOLD.ecn', 'GOLD.r', 'GOLD_M',
        'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw', 'XAUUSD_M', 'XAUUSD.ecn',
        symbol,
      ],
    };
  }

  private static async clearActivePlanSetting(symbol: string, reason?: string) {
    const clean = (symbol || '').toUpperCase();
    const isGold = clean.includes('XAU') || clean.includes('GOLD');
    const normalizedSymbol = isGold ? 'XAUUSD' : clean;
    try {
      const key = `ACTIVE_ORDER_PLAN_${normalizedSymbol}`;
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (existing?.value) {
        const plan = JSON.parse(existing.value);
        plan.isClosed = true;
        plan.closedReason = reason || 'SL/TP Hit';
        plan.closedAt = new Date().toISOString();
        await prisma.systemSetting.update({
          where: { key },
          data: { value: JSON.stringify(plan) },
        });
      }
    } catch {
      await prisma.systemSetting.deleteMany({
        where: { key: `ACTIVE_ORDER_PLAN_${normalizedSymbol}` },
      });
    }
  }

  /**
   * Creates a measurable plan lifecycle record before or after entry is reached.
   */
  static async openTrade(params: OpenTradeParams) {
    const { signalId, symbol, direction, entry, stopLoss, takeProfit1, takeProfit2, initialResult = 'PLAN', notes } = params;

    return prisma.paperTrade.create({
      data: {
        signalId: signalId && signalId.trim() !== '' ? signalId : undefined,
        symbol,
        direction,
        entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        result: initialResult,
        rrResult: 0.0,
        openedAt: new Date(),
        notes: notes || (initialResult === 'TESTING'
          ? 'Forward test from saved plan. Auto-tracks TP/SL before real use.'
          : 'Saved as a suggested plan for review.'),
      },
    });
  }

  /**
   * Starts forward-testing a saved plan without marking it as a real active trade.
   */
  static async startPlanTest(id: string) {
    const plan = await prisma.paperTrade.findUnique({
      where: { id },
    });

    if (!plan || plan.result !== 'PLAN') {
      throw new Error('Saved plan not found or already testing.');
    }

    if (plan.signalId) {
      await prisma.signal.update({
        where: { id: plan.signalId },
        data: { status: 'active' },
      });
    }

    return prisma.paperTrade.update({
      where: { id },
      data: {
        result: 'TESTING',
        openedAt: new Date(),
        notes: 'Forward test started. Auto-tracks TP/SL for algorithm improvement.',
      },
    });
  }

  /**
   * Moves a waiting plan into active result tracking.
   */
  static async approvePlan(id: string) {
    const plan = await prisma.paperTrade.findUnique({
      where: { id },
    });

    if (!plan || !['PLAN', 'TESTING'].includes(plan.result)) {
      throw new Error('Suggested plan not found or already active/closed.');
    }

    return prisma.paperTrade.update({
      where: { id },
      data: {
        result: 'OPEN', // Transition to open position!
        openedAt: new Date(),
        notes: 'Promoted from saved/test plan to active tracking.',
      },
    });
  }

  /**
   * Manually closes an open paper trade from the dashboard.
   */
  static async closeTrade(id: string, exitPrice: number, notes?: string) {
    const trade = await prisma.paperTrade.findUnique({
      where: { id },
    });

    if (!trade || trade.result !== 'OPEN') {
      throw new Error('Trade not found or already closed.');
    }

    const { entry, direction, stopLoss } = trade;
    
    // Calculate R result based on standard risk distance
    const riskDistance = Math.abs(entry - stopLoss);
    let rrResult = 0.0;

    if (riskDistance > 0) {
      if (direction === 'BUY') {
        rrResult = (exitPrice - entry) / riskDistance;
      } else {
        rrResult = (entry - exitPrice) / riskDistance;
      }
    }

    let result = 'BE';
    if (rrResult > 0.5) result = 'WIN';
    if (rrResult < -0.5) result = 'LOSS';

    // Round values for premium output
    rrResult = parseFloat(rrResult.toFixed(2));

    const updatedTrade = await prisma.paperTrade.update({
      where: { id },
      data: {
        exitPrice,
        result,
        rrResult,
        closedAt: new Date(),
        notes: notes || 'Manually closed from admin console.',
      },
    });

    // Also update the parent signal status
    if (trade.signalId) {
      await prisma.signal.update({
        where: { id: trade.signalId },
        data: {
          status: result.toLowerCase() === 'win' ? 'win' : result.toLowerCase() === 'loss' ? 'loss' : 'cancelled',
          result: result === 'WIN' ? 'Win' : result === 'LOSS' ? 'Loss' : result === 'BE' ? 'BE' : 'Pending',
        },
      });
    }

    await StrategyResearchService.refreshStoredReportFromPaperTrades(trade.symbol);
    await this.clearActivePlanSetting(trade.symbol);

    return updatedTrade;
  }

  /**
   * Evaluates all open paper trades against a new price tick / candle.
   * This represents a dynamic execution bridge.
   */
  static async evaluateOpenTradesWithPrice(
    symbol: string,
    currentPrice: number,
    highPrice: number,
    lowPrice: number
  ): Promise<string[]> {
    const openTrades = await prisma.paperTrade.findMany({
      where: {
        symbol: this.getSymbolFilter(symbol),
        result: { in: ['OPEN', 'TESTING'] },
      },
      include: { signal: true },
    });

    const closedTradeLogs: string[] = [];

    for (const trade of openTrades) {
      let shouldClose = false;
      let exitPrice = currentPrice;
      let result = 'OPEN';
      let rrResult = 0.0;
      let reason = '';

      const { direction, entry, stopLoss, takeProfit1, takeProfit2 } = trade;
      const riskDistance = Math.abs(entry - stopLoss);

      if (direction === 'BUY') {
        // 1. Check Stop Loss
        if (lowPrice <= stopLoss) {
          shouldClose = true;
          exitPrice = stopLoss;
          result = 'LOSS';
          rrResult = -1.0;
          reason = `Stop Loss triggered at $${stopLoss.toFixed(2)}`;
        }
        // 2. Check Take Profit 2 (Ultimate Target)
        else if (highPrice >= takeProfit2) {
          shouldClose = true;
          exitPrice = takeProfit2;
          result = 'WIN';
          rrResult = riskDistance > 0 ? (takeProfit2 - entry) / riskDistance : 0;
          reason = `Take Profit 2 triggered at $${takeProfit2.toFixed(2)}`;
        }
        // 3. Check Take Profit 1 (First Target)
        else if (highPrice >= takeProfit1) {
          shouldClose = true;
          exitPrice = takeProfit1;
          result = 'WIN';
          rrResult = riskDistance > 0 ? (takeProfit1 - entry) / riskDistance : 0;
          reason = `Take Profit 1 triggered at $${takeProfit1.toFixed(2)}`;
        }
      } else {
        // SELL Trade Direction
        // 1. Check Stop Loss
        if (highPrice >= stopLoss) {
          shouldClose = true;
          exitPrice = stopLoss;
          result = 'LOSS';
          rrResult = -1.0;
          reason = `Stop Loss triggered at $${stopLoss.toFixed(2)}`;
        }
        // 2. Check Take Profit 2 (Ultimate Target)
        else if (lowPrice <= takeProfit2) {
          shouldClose = true;
          exitPrice = takeProfit2;
          result = 'WIN';
          rrResult = riskDistance > 0 ? (entry - takeProfit2) / riskDistance : 0;
          reason = `Take Profit 2 triggered at $${takeProfit2.toFixed(2)}`;
        }
        // 3. Check Take Profit 1 (First Target)
        else if (lowPrice <= takeProfit1) {
          shouldClose = true;
          exitPrice = takeProfit1;
          result = 'WIN';
          rrResult = riskDistance > 0 ? (entry - takeProfit1) / riskDistance : 0;
          reason = `Take Profit 1 triggered at $${takeProfit1.toFixed(2)}`;
        }
      }

      if (shouldClose) {
        const closedTrade = await prisma.paperTrade.updateMany({
          where: {
            id: trade.id,
            result: { in: ['OPEN', 'TESTING'] },
          },
          data: {
            exitPrice,
            result,
            rrResult: Number(rrResult.toFixed(2)),
            closedAt: new Date(),
            notes: `Auto-executed: ${reason}`,
          },
        });
        if (closedTrade.count === 0) continue;

        if (trade.signalId) {
          await prisma.signal.update({
            where: { id: trade.signalId },
            data: {
              status: result.toLowerCase() === 'win' ? 'win' : 'loss',
              result: result === 'WIN' ? 'Win' : result === 'LOSS' ? 'Loss' : result === 'BE' ? 'BE' : 'Pending',
            },
          });
        }

        // Send mobile notification on closing (TP or SL)
        const targetIcon = result === 'WIN' ? '✅ TP Hit' : '❌ SL Hit';
        const positionIcon = direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
        const roundedR = Number(rrResult.toFixed(2));
        const closeMsg = `🏁 *แผนทองคำปิดผลแล้ว*\n\n*Symbol*: ${trade.symbol}\n*Position*: ${positionIcon}\n*Status*: ${targetIcon}\n*Outcome*: ${result} (${roundedR > 0 ? '+' : ''}${roundedR}R)\n*Exit Price*: $${exitPrice.toFixed(2)}\n*Detail*: ${reason}`;
        await NotificationService.sendNotification(closeMsg);
        await this.clearActivePlanSetting(trade.symbol);

        closedTradeLogs.push(`Trade ${trade.id.slice(0, 8)} (${direction}) closed as ${result} at $${exitPrice.toFixed(2)} (${rrResult}R)`);
      }
    }

    if (closedTradeLogs.length > 0) {
      await StrategyResearchService.refreshStoredReportFromPaperTrades(symbol);
    }

    return closedTradeLogs;
  }

  /**
   * Evaluates all pending plans (result: 'PLAN') against a new price tick.
   * If a plan's entry level is touched, triggers the active trade and dispatches mobile notifications.
   */
  static async evaluatePendingPlansWithPrice(
    symbol: string,
    currentPrice: number
  ): Promise<string[]> {
    const pendingPlans = await prisma.paperTrade.findMany({
      where: {
        symbol: this.getSymbolFilter(symbol),
        result: 'PLAN',
      },
      include: { signal: true },
    });

    const triggeredPlanLogs: string[] = [];

    for (const plan of pendingPlans) {
      let isTriggered = false;
      const { direction, entry } = plan;
      let planType = '';
      try {
        planType = JSON.parse(plan.signal?.reason || '{}').planType || '';
      } catch {
        planType = '';
      }
      const isMarketOrder = planType.includes('MARKET');
      const isStopOrder = planType.includes('STOP');

      if (isMarketOrder) {
        isTriggered = true;
      } else {
        isTriggered = isStopOrder
          ? direction === 'BUY' ? currentPrice >= entry : currentPrice <= entry
          : direction === 'BUY' ? currentPrice <= entry : currentPrice >= entry;
      }

      if (isTriggered) {
        // Update plan status to OPEN
        const triggeredPlan = await prisma.paperTrade.updateMany({
          where: { id: plan.id, result: 'PLAN' },
          data: {
            result: 'OPEN',
            openedAt: new Date(),
            notes: `Auto-triggered: Price reached entry level at $${currentPrice.toFixed(2)}`,
          },
        });
        if (triggeredPlan.count === 0) continue;

        // Also update parent signal to active
        if (plan.signalId) {
          await prisma.signal.update({
            where: { id: plan.signalId },
            data: { status: 'active' },
          });
        }

        // Notify mobile
        const sideIcon = direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
        const msg = `🔔 *ราคาถึงแนวเข้าออเดอร์ (Entry Target Hit!)*\n\n*Symbol*: ${symbol}\n*Position*: ${sideIcon}\n*Entry Target*: $${entry.toFixed(2)}\n*Triggered Price*: $${currentPrice.toFixed(2)}\n*Time*: ${new Date().toLocaleTimeString('th-TH')}`;
        
        await NotificationService.sendNotification(msg);

        triggeredPlanLogs.push(`Plan ${plan.id.slice(0, 8)} (${direction}) triggered at $${currentPrice.toFixed(2)}`);
      }
    }

    return triggeredPlanLogs;
  }
}
