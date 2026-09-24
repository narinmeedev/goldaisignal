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
    // Run Gemini 2.5 Flash Market Analysis & Trade Plan Generation
    const evalResult = await GeminiTradePlanService.evaluateMarketAndGeneratePlan();

    if (!evalResult || !evalResult.plan) {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถสร้างแผนจาก AI ได้ในขณะนี้',
      }, { status: 500, headers: noStoreHeaders });
    }

    const { plan, quote } = evalResult;

    // Apply plan: Save to SystemSetting, write to MT5 wine file, record PaperTrade, and send Line broadcast
    const broadcastResult = await GeminiTradePlanService.applyAndBroadcastPlan(plan, quote);

    return NextResponse.json({
      success: true,
      model: plan.source || 'Google Gemini 2.5 Flash',
      currentPrice: quote.last || quote.bid,
      result: {
        isApproved: plan.approved,
        direction: plan.direction,
        type: plan.type,
        refinedEntry: plan.entry,
        refinedSL: plan.stopLoss,
        refinedTP: plan.takeProfit,
        confidence: plan.confidence,
        reason: plan.reason,
        invalidation: plan.invalidation,
      },
      appliedPlan: plan,
      autoApplied: true,
      broadcastResult,
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[AI Analyze Route Error]:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'ไม่สามารถประมวลผล AI ได้',
    }, { status: 500, headers: noStoreHeaders });
  }
}

export async function GET() {
  return POST(new Request('http://localhost/api/admin/qwen-analyze', { method: 'POST' }));
}
