import { NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook.service';
import { minisaas } from '@/lib/minisaas';

export async function POST(request: Request) {
  try {
    const rawText = await request.text();
    // Strip trailing null characters (\u0000) sent by MT5 string serialization
    const cleanText = rawText.replace(/\0/g, '').trim();
    const payload = JSON.parse(cleanText);

    if (!payload.symbol || !payload.timeframe || !payload.direction || !payload.price) {
      return NextResponse.json(
        { status: 'rejected', decision: 'INVALID_PAYLOAD', error: 'Missing core attributes (symbol, timeframe, direction, price).' },
        { status: 400 }
      );
    }

    if (String(payload.symbol).toUpperCase().includes('BTC')) {
      return NextResponse.json(
        { status: 'rejected', decision: 'BTC_DISABLED', error: 'BTCUSD signals are disabled. Gold AI Signal now supports XAUUSD only.' },
        { status: 400 }
      );
    }

    const result = await WebhookService.processWebhook({
      secret: payload.secret,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      direction: payload.direction,
      price: parseFloat(payload.price),
      strategy: payload.strategy || 'support_bounce',
      timestamp: payload.timestamp || new Date().toISOString(),
    });

    if (result.status === 'rejected') {
      // Report warning to Mini SaaS Center
      minisaas.trackError("WARNING", `TradingView Webhook Rejected: ${result.decision}`, JSON.stringify(result)).catch(() => {});
      return NextResponse.json(result, { status: 401 });
    }

    if (result.status === 'error') {
      // Report error to Mini SaaS Center
      minisaas.trackError("ERROR", `TradingView Webhook Error: ${result.error_message || 'Unknown error'}`, JSON.stringify(result)).catch(() => {});
      return NextResponse.json(result, { status: 500 });
    }

    // Report success usage event to Mini SaaS Center
    minisaas.trackUsage("signal.received", {
      direction: payload.direction,
      timeframe: payload.timeframe,
      price: parseFloat(payload.price),
      strategy: payload.strategy || 'support_bounce',
      decision: result.decision,
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (err: any) {
    // Report unhandled system error to Mini SaaS Center
    minisaas.trackError("CRITICAL", err.message || "System failed to parse webhook request.", err.stack).catch(() => {});

    return NextResponse.json(
      { status: 'error', decision: 'UNHANDLED_SERVER_ERROR', error: err.message || 'System failed to parse webhook request.' },
      { status: 500 }
    );
  }
}
