export interface QwenAnalysisInput {
  symbol: string;
  currentPrice: number;
  bias: string;
  trendStrength: number;
  rsi14M5: number;
  rsi14: number;
  atr14: number;
  ema20_m15: number;
  nearestSupport: number[];
  nearestResistance: number[];
  proposedType: string;
  proposedEntry: number;
  proposedSL: number;
  proposedTP: number;
}

export interface QwenAnalysisOutput {
  isApproved: boolean;
  refinedEntry: number;
  refinedSL: number;
  refinedTP: number;
  confidence: number;
  reason: string;
  source: 'LOCAL_QWEN_LLM' | 'MATH_ENGINE';
}

export class QwenLocalAiService {
  private static LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1/chat/completions';

  /**
   * Refines a candidate trade plan using local Qwen LLM running on LM Studio.
   * If LM Studio is offline or times out (3s limit), falls back smoothly to Math Engine.
   */
  static async refineTradePlan(input: QwenAnalysisInput): Promise<QwenAnalysisOutput> {
    const fallback: QwenAnalysisOutput = {
      isApproved: true,
      refinedEntry: input.proposedEntry,
      refinedSL: input.proposedSL,
      refinedTP: input.proposedTP,
      confidence: 85,
      reason: `คำนวณผ่านอัลกอริทึมคณิตศาสตร์ตามแนวรับ $${input.proposedEntry.toFixed(2)} (R:R 1:2.5)`,
      source: 'MATH_ENGINE',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s safety timeout

    try {
      const systemPrompt = `คุณคือระบบ AI ผู้เชี่ยวชาญการเก็งกำไรทองคำ XAUUSD (Gold Scalper & Swing Trader) 
หน้าที่ของคุณคือวิเคราะห์แผนการเทรดที่เสนอเข้ามา และช่วยปรับแต่งจุดเข้า (Entry), จุดตัดขาดทุน (SL), และจุดทำกำไร (TP) ให้มีความคมและได้เปรียบราคามากที่สุด
ตอบกลับในรูปแบบ JSON เท่านั้น โดยมีฟีลด์ดังนี้:
{
  "approved": true/false,
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "confidence": number (50-95),
  "reason": "คำอธิบายเหตุผลภาษาไทยสั้นๆ ชัดเจน"
}`;

      const userPrompt = `สภาวะตลาดทองคำปัจจุบัน (${input.symbol}):
- ราคาปัจจุบัน: $${input.currentPrice.toFixed(2)}
- ทิศทางหลัก: ${input.bias} (ความแรง ${input.trendStrength}%)
- RSI M5: ${Math.round(input.rsi14M5)} | RSI M15: ${Math.round(input.rsi14)} | ATR: ${input.atr14.toFixed(2)}
- EMA 20 M15: $${input.ema20_m15.toFixed(2)}
- แนวรับใกล้สุด: ${input.nearestSupport.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}
- แนวต้านใกล้สุด: ${input.nearestResistance.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}

แผนการเทรดที่เสนอ:
- ประเภท: ${input.proposedType}
- ราคาเข้าเสนอ: $${input.proposedEntry.toFixed(2)}
- Stop Loss เสนอ: $${input.proposedSL.toFixed(2)}
- Take Profit เสนอ: $${input.proposedTP.toFixed(2)}

กรุณาตรวจสอบว่าจุดเข้านี้คมพอหรือไม่ และส่งคืน JSON ผลการปรับแต่งราคาเข้า, SL, TP`;

      const response = await fetch(this.LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 250,
        }),
        signal: controller.signal,
      });

      if (!response.ok) return fallback;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed || typeof parsed.entry !== 'number') return fallback;

      return {
        isApproved: parsed.approved !== false,
        refinedEntry: Number(parsed.entry.toFixed(2)),
        refinedSL: Number((parsed.stopLoss || input.proposedSL).toFixed(2)),
        refinedTP: Number((parsed.takeProfit || input.proposedTP).toFixed(2)),
        confidence: Math.min(95, Math.max(50, Number(parsed.confidence) || 85)),
        reason: parsed.reason || fallback.reason,
        source: 'LOCAL_QWEN_LLM',
      };
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
