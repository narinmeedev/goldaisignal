import { NextResponse } from 'next/server';
import { GeminiTradePlanService } from '@/lib/services/gemini-trade-plan.service';

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

    const evalResult = await GeminiTradePlanService.evaluateMarketAndGeneratePlan();

    if (!evalResult || !evalResult.plan) {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถสร้างแผนจาก AI ได้',
      }, { status: 500, headers: noStoreHeaders });
    }

    const { plan, quote } = evalResult;

    // Optionally auto-apply if requested or by default
    let broadcastResult = null;
    if (body.apply !== false) {
      broadcastResult = await GeminiTradePlanService.applyAndBroadcastPlan(plan, quote);
    }

    return NextResponse.json({
      success: true,
      model: plan.source || 'Google Gemini 2.5 Flash',
      quote: {
        symbol: quote.symbol,
        last: quote.last,
        bid: quote.bid,
        ask: quote.ask,
        spread: quote.spread,
        timestamp: quote.timestamp,
      },
      plan,
      broadcastResult,
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[AI Plan Evaluate Route Error]:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'ไม่สามารถประมวลผลการวิเคราะห์ AI ได้',
    }, { status: 500, headers: noStoreHeaders });
  }
}

export async function GET() {
  return POST(new Request('http://localhost/api/admin/ai-plan/evaluate', { method: 'POST' }));
}
