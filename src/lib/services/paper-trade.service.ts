import { prisma } from '../prisma';

export interface OpenTradeParams {
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export class PaperTradeService {
  /**
   * Opens a new simulated paper trade (initially logged as a proposed plan).
   */
  static async openTrade(params: OpenTradeParams): Promise<any> {
    const { signalId, symbol, direction, entry, stopLoss, takeProfit1, takeProfit2 } = params;

    return prisma.paperTrade.create({
      data: {
        signalId,
        symbol,
        direction,
        entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        result: 'PLAN', // Saved as a suggested plan for the user to review
        rrResult: 0.0,
        openedAt: new Date(),
      },
    });
  }

  /**
   * Approves a suggested trading plan, starting the active paper trade simulation.
   */
  static async approvePlan(id: string): Promise<any> {
    const plan = await prisma.paperTrade.findUnique({
      where: { id },
    });

    if (!plan || plan.result !== 'PLAN') {
      throw new Error('Suggested plan not found or already active.');
    }

    return prisma.paperTrade.update({
      where: { id },
      data: {
        result: 'OPEN', // Transition to open position!
        openedAt: new Date(),
      },
    });
  }

  /**
   * Manually closes an open paper trade from the dashboard.
   */
  static async closeTrade(id: string, exitPrice: number, notes?: string): Promise<any> {
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
        },
      });
    }

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
      where: { symbol, result: 'OPEN' },
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
          rrResult = 4.0; // 4R reward
          reason = `Take Profit 2 triggered at $${takeProfit2.toFixed(2)}`;
        }
        // 3. Check Take Profit 1 (First Target)
        else if (highPrice >= takeProfit1) {
          shouldClose = true;
          exitPrice = takeProfit1;
          result = 'WIN';
          rrResult = 2.0; // 2R reward
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
          rrResult = 4.0;
          reason = `Take Profit 2 triggered at $${takeProfit2.toFixed(2)}`;
        }
        // 3. Check Take Profit 1 (First Target)
        else if (lowPrice <= takeProfit1) {
          shouldClose = true;
          exitPrice = takeProfit1;
          result = 'WIN';
          rrResult = 2.0;
          reason = `Take Profit 1 triggered at $${takeProfit1.toFixed(2)}`;
        }
      }

      if (shouldClose) {
        await prisma.paperTrade.update({
          where: { id: trade.id },
          data: {
            exitPrice,
            result,
            rrResult,
            closedAt: new Date(),
            notes: `Auto-executed: ${reason}`,
          },
        });

        if (trade.signalId) {
          await prisma.signal.update({
            where: { id: trade.signalId },
            data: {
              status: result.toLowerCase() === 'win' ? 'win' : 'loss',
            },
          });
        }

        closedTradeLogs.push(`Trade ${trade.id.slice(0, 8)} (${direction}) closed as ${result} at $${exitPrice.toFixed(2)} (${rrResult}R)`);
      }
    }

    return closedTradeLogs;
  }
}
