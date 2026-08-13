import { NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook.service';
import { minisaas } from '@/lib/minisaas';

export async function POST(request: Request) {
  if (process.env.MT5_WEBHOOK_PAUSED === 'true') {
    return NextResponse.json(
      {
        status: 'accepted',
        decision: 'SYSTEM_MAINTENANCE',
        message: 'Gold AI Signal is temporarily pausing market ingestion.',
      },
      {
        status: 202,
        headers: { 'Retry-After': '300' },
      },
    );
  }

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

    const upperSym = String(payload.symbol || '').toUpperCase().trim();
    const isGoldSymbol = upperSym.includes('XAU') || upperSym.includes('GOLD');

    if (!isGoldSymbol) {
      return NextResponse.json(
        {
          status: 'accepted',
          decision: 'IGNORED_NON_GOLD',
          message: 'Gold AI Signal processes XAU and GOLD symbols only.',
        },
        { status: 200 },
      );
    }

    const result = await WebhookService.processWebhook({
      secret: payload.secret,
      symbol: 'XAUUSD', // Normalize XAUUSD.iux, GOLD#, etc. to XAUUSD
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
  } catch (error: unknown) {
    const err = error instanceof Error
      ? error
      : new Error('System failed to parse webhook request.');

    // Report unhandled system error to Mini SaaS Center
    minisaas.trackError("CRITICAL", err.message || "System failed to parse webhook request.", err.stack).catch(() => {});

    return NextResponse.json(
      { status: 'error', decision: 'UNHANDLED_SERVER_ERROR', error: err.message || 'System failed to parse webhook request.' },
      { status: 500 }
    );
  }
}
