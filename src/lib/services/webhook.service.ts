import { prisma } from '../prisma';
import { PaperTradeService } from './paper-trade.service';
import { triggerDashboardCacheRefresh } from '../dashboard-cache-refresh';

export class WebhookService {
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
    error_message?: string;
  }> {
    const { secret, symbol, timeframe, price, strategy } = payload;
    const systemSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET';
    if (!secret || secret !== systemSecret) {
      return {
        status: 'rejected',
        decision: 'SECRET_VALIDATION_FAILED',
        error_message: 'Invalid webhook secret key provided.',
      };
    }

    const safePayload = JSON.stringify({ ...payload, secret: undefined });

    try {
      // Existing open plans are evaluated before a waiting plan can enter on this tick.
      const closedLogs = await PaperTradeService.evaluateOpenTradesWithPrice(symbol, price, price, price);
      const triggeredLogs = await PaperTradeService.evaluatePendingPlansWithPrice(symbol, price);

      if (closedLogs.length > 0 || triggeredLogs.length > 0) {
        triggerDashboardCacheRefresh();
      }

      if (strategy === 'price_feed' || strategy === 'tick') {
        const latestPriceEvent = await prisma.webhookEvent.findFirst({
          where: {
            symbol: { in: ['XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'GOLD.ecn', 'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
            source: 'tradingview',
          },
          orderBy: { receivedAt: 'desc' },
          select: { id: true },
        });

        const data = {
          symbol,
          timeframe,
          source: 'tradingview',
          rawPayload: safePayload,
          status: 'processed',
          errorMessage: null,
          receivedAt: new Date(),
        };
        if (latestPriceEvent) {
          await prisma.webhookEvent.update({ where: { id: latestPriceEvent.id }, data });
        } else {
          await prisma.webhookEvent.create({ data });
        }

        return { status: 'accepted', decision: 'PRICE_FEED_UPDATED' };
      }

      await prisma.webhookEvent.create({
        data: {
          symbol,
          timeframe,
          source: 'tradingview',
          rawPayload: safePayload,
          status: 'processed',
        },
      });
      return { status: 'accepted', decision: 'TECHNICAL_EVENT_RECORDED' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'System failed to process market event.';
      await prisma.webhookEvent.create({
        data: {
          symbol,
          timeframe,
          source: 'tradingview',
          rawPayload: safePayload,
          status: 'error',
          errorMessage,
        },
      }).catch(() => undefined);
      return {
        status: 'error',
        decision: 'INTERNAL_EVALUATION_ERROR',
        error_message: errorMessage,
      };
    }
  }
}
