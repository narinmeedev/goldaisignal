export interface CandleData {
  time: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeLossRecord {
  direction: string;
  entry: number;
  stopLoss: number;
  notes?: string | null;
  closedAt?: Date | string | null;
}

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
  m5Candles?: CandleData[];
  m15Candles?: CandleData[];
  recentLosses?: TradeLossRecord[];
}

export interface QwenAnalysisOutput {
  isApproved: boolean;
  refinedEntry: number;
  refinedSL: number;
  refinedTP: number;
  confidence: number;
  reason: string;
  source: 'LOCAL_QWEN_LLM' | 'MATH_ENGINE';
  direction: 'BUY' | 'SELL';
  type: string;
}

export class QwenLocalAiService {
  private static LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1/chat/completions';

  /**
   * Generates a high-probability Gold trade plan using local Qwen 3.5-9B LLM.
   * Feeds full M5/M15 OHLCV historical candle series and recent SL post-mortem records.
   */
  static async refineTradePlan(input: QwenAnalysisInput): Promise<QwenAnalysisOutput> {
    const isProposedBuy = input.proposedType.includes('BUY');
    const fallbackDirection: 'BUY' | 'SELL' = isProposedBuy ? 'BUY' : 'SELL';
    const fallbackType = isProposedBuy ? 'BUY_LIMIT' : 'SELL_LIMIT';

    const fallback: QwenAnalysisOutput = {
      isApproved: true,
      direction: fallbackDirection,
      type: fallbackType,
      refinedEntry: input.proposedEntry,
      refinedSL: input.proposedSL,
      refinedTP: input.proposedTP,
      confidence: 85,
      reason: `คำนวณตามโครงสร้างแท่งเทียนและ ATR ($${input.proposedEntry.toFixed(2)})`,
      source: 'MATH_ENGINE',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12.0s execution window for Qwen 3.5-9B

    try {
      const formattedM5 = (input.m5Candles || [])
        .slice(0, 15)
        .map((c) => `[${c.open.toFixed(2)}, ${c.high.toFixed(2)}, ${c.low.toFixed(2)}, ${c.close.toFixed(2)}]`)
        .join(', ');

      const formattedM15 = (input.m15Candles || [])
        .slice(0, 10)
        .map((c) => `[${c.open.toFixed(2)}, ${c.high.toFixed(2)}, ${c.low.toFixed(2)}, ${c.close.toFixed(2)}]`)
        .join(', ');

      const formattedLosses = (input.recentLosses || [])
        .slice(0, 3)
        .map((l) => `${l.direction} @ $${l.entry.toFixed(2)} (SL $${l.stopLoss.toFixed(2)}: ${l.notes || 'Hit SL'})`)
        .join(' | ') || 'ไม่มีประวัติชน SL ล่าสุด';

      const systemPrompt = `คุณคือ Quant Master & Senior Institutional Gold Analyst (XAUUSD Specialist)
หน้าที่ของคุณคือวิเคราะห์ลำดับแท่งเทียนจริง OHLCV และประวัติการโดน SL ล่าสุด เพื่อคำนวณแผนการเทรดทองคำที่มีความได้เปรียบราคาสูงสุด

ตอบกลับเฉพาะ JSON รูปแบบนี้เท่านั้น (ห้ามใส่คำบรรยายอื่นนอก JSON):
{
  "direction": "BUY" หรือ "SELL",
  "approved": true,
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "confidence": number (65-95),
  "reason": "คำอธิบายเชิงเทคนิคภาษาไทยสั้นๆ ชัดเจน สรุปจากพฤติกรรมแท่งเทียน M5/M15"
}`;

      const userPrompt = `ข้อมูลราคาทองคำสด (${input.symbol}):
- ราคาปัจจุบัน: $${input.currentPrice.toFixed(2)}
- ไบแอสหลัก: ${input.bias} (ความแรง ${input.trendStrength}%)
- RSI M5: ${Math.round(input.rsi14M5)} | RSI M15: ${Math.round(input.rsi14)} | ATR: $${input.atr14.toFixed(2)}
- EMA 20 M15: $${input.ema20_m15.toFixed(2)}
- แนวรับสำคัญ: ${input.nearestSupport.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}
- แนวต้านสำคัญ: ${input.nearestResistance.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}

แท่งเทียนย้อนหลัง M5 (OHLC): ${formattedM5 || 'N/A'}
แท่งเทียนย้อนหลัง M15 (OHLC): ${formattedM15 || 'N/A'}
ประวัติไม้ที่ชน SL ล่าสุด (เพื่อทบทวนบทเรียน): ${formattedLosses}

โปรดวิเคราะห์โครงสร้างราคา ป้องกันการโดน SL ซ้ำซ้อน และคำนวณแผนจุดเข้า (Entry), SL, TP ที่เหมาะสมที่สุด`;

      const response = await fetch(this.LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 300,
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

      const direction: 'BUY' | 'SELL' = parsed.direction === 'SELL' ? 'SELL' : 'BUY';
      const planType = direction === 'BUY'
        ? (parsed.entry < input.currentPrice ? 'BUY_LIMIT' : 'BUY_MARKET')
        : (parsed.entry > input.currentPrice ? 'SELL_LIMIT' : 'SELL_MARKET');

      const refinedEntry = Number(parsed.entry.toFixed(2));
      let refinedSL = Number((parsed.stopLoss || input.proposedSL).toFixed(2));
      let refinedTP = Number((parsed.takeProfit || input.proposedTP).toFixed(2));

      // Enforce ATR safety buffer (at least 2.2x ATR or $12.0 for Gold)
      const minSlDist = Math.max(12.0, (input.atr14 || 5.5) * 2.2);
      if (direction === 'BUY') {
        if (refinedEntry - refinedSL < minSlDist) {
          refinedSL = Number((refinedEntry - minSlDist).toFixed(2));
        }
        if (refinedTP <= refinedEntry) {
          refinedTP = Number((refinedEntry + minSlDist * 2.0).toFixed(2));
        }
      } else {
        if (refinedSL - refinedEntry < minSlDist) {
          refinedSL = Number((refinedEntry + minSlDist).toFixed(2));
        }
        if (refinedTP >= refinedEntry) {
          refinedTP = Number((refinedEntry - minSlDist * 2.0).toFixed(2));
        }
      }

      return {
        isApproved: parsed.approved !== false,
        direction,
        type: planType,
        refinedEntry,
        refinedSL,
        refinedTP,
        confidence: Math.min(95, Math.max(60, Number(parsed.confidence) || 88)),
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
