import { prisma } from '../prisma';
import { SignalService, SignalEvaluationResult } from './signal.service';
import { PaperTradeService } from './paper-trade.service';

export class WebhookService {
  /**
   * Processes a TradingView alert webhook payload.
   * Validates the secret, logs raw payload, and kicks off signal evaluation.
   */
  static async processWebhook(payload: {
    secret?: string;
    symbol: string;
    timeframe: string;
    direction: 'BUY' | 'SELL';
    price: number;
    strategy: string;
    timestamp: string;
  }): Promise<{
    status: 'accepted' | 'rejected' | 'error';
    decision: string;
    signalId?: string;
    confidence?: number;
    error_message?: string;
  }> {
    const { secret, symbol, timeframe, direction, price, strategy, timestamp } = payload;

    // 1. Create a pending webhook event log
    const eventLog = await prisma.webhookEvent.create({
      data: {
        symbol: symbol || 'XAUUSD',
        timeframe: timeframe || 'M15',
        rawPayload: JSON.stringify(payload),
        status: 'pending',
      },
    });

    // 2. Validate secret
    const systemSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET';
    if (!secret || secret !== systemSecret) {
      const errorMsg = 'Invalid webhook secret key provided.';
      await prisma.webhookEvent.update({
        where: { id: eventLog.id },
        data: {
          status: 'rejected',
          errorMessage: errorMsg,
        },
      });
      return {
        status: 'rejected',
        decision: 'SECRET_VALIDATION_FAILED',
        error_message: errorMsg,
      };
    }

    try {
      // 3. Update active trades with the incoming price first (auto close hit SL/TP)
      // This turns any new signal price tick into a live evaluation for all active trades!
      const closedTradeSummaries = await PaperTradeService.evaluateOpenTradesWithPrice(
        symbol,
        price,
        price, // mock tick has high = low = close = price
        price
      );

      // 3.5 If it's a raw live price feed tick, bypass signal generation and return immediately
      if (strategy === 'price_feed' || strategy === 'tick') {
        await prisma.webhookEvent.update({
          where: { id: eventLog.id },
          data: {
            status: 'processed',
          },
        });
        return {
          status: 'accepted',
          decision: 'PRICE_FEED_UPDATED',
        };
      }

      // 4. Run Technical & Risk Signal Evaluation
      const evaluation: SignalEvaluationResult = await SignalService.evaluateSignal({
        symbol,
        timeframe,
        direction,
        price,
        strategy,
        timestamp,
      });

      // 5. Update WebhookEvent to processed
      await prisma.webhookEvent.update({
        where: { id: eventLog.id },
        data: {
          status: 'processed',
        },
      });

      return {
        status: 'accepted',
        decision: evaluation.decision,
        signalId: evaluation.signalId,
        confidence: evaluation.confidence,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'System failed to evaluate signal.';
      await prisma.webhookEvent.update({
        where: { id: eventLog.id },
        data: {
          status: 'error',
          errorMessage: errorMsg,
        },
      });
      return {
        status: 'error',
        decision: 'INTERNAL_EVALUATION_ERROR',
        error_message: errorMsg,
      };
    }
  }
}
