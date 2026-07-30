export interface CandleData {
  time: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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
  h1Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m15Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength: number;
  rsi14M5: number;
  rsi14M15: number;
  rsi14H1: number;
  atr14: number;
  ema20_m15: number;
  ema50_m15: number;
  fib50: number;
  fib618: number;
  sessionHigh: number;
  sessionLow: number;
  nearestSupport: number[];
  nearestResistance: number[];
  proposedType: string;
  proposedEntry: number;
  proposedSL: number;
  proposedTP: number;
  h1Candles?: CandleData[];
  m15Candles?: CandleData[];
  m5Candles?: CandleData[];
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
   * Generates a high-winrate Gold trade plan using local Qwen 3.5-9B LLM + Institutional Quant Engine.
   * Feeds full H1/M15/M5 OHLCV structural candle series, Fibonacci Golden Pocket, and SL post-mortem feedback.
   */
  static async refineTradePlan(input: QwenAnalysisInput): Promise<QwenAnalysisOutput> {
    const isProposedBuy = input.h1Bias === 'BULLISH' || input.m15Bias === 'BULLISH' || input.proposedType.includes('BUY');
    const fallbackDirection: 'BUY' | 'SELL' = isProposedBuy ? 'BUY' : 'SELL';
    const fallbackType = isProposedBuy ? 'BUY_LIMIT' : 'SELL_LIMIT';

    // Calculate smart quantitative fallback plan using Anti-Wick Hunt SL Buffer ($7.8 to $11.0)
    const atrBuffer = Math.max(7.8, Math.min(11.0, input.atr14 * 1.5));
    let smartEntry = isProposedBuy ? input.fib50 : input.fib618;

    // Keep entry close to current price ($1.2 to $3.5 distance) for fast execution
    if (isProposedBuy) {
      if (input.currentPrice - smartEntry < 1.0 || input.currentPrice - smartEntry > 4.5) {
        smartEntry = Number((input.currentPrice - 2.2).toFixed(2));
      }
    } else {
      if (smartEntry - input.currentPrice < 1.0 || smartEntry - input.currentPrice > 4.5) {
        smartEntry = Number((input.currentPrice + 2.2).toFixed(2));
      }
    }
    smartEntry = Number(smartEntry.toFixed(2));

    const smartSL = isProposedBuy
      ? Number((smartEntry - atrBuffer).toFixed(2))
      : Number((smartEntry + atrBuffer).toFixed(2));

    const smartTP = isProposedBuy
      ? Number((smartEntry + atrBuffer * 2.2).toFixed(2))
      : Number((smartEntry - atrBuffer * 2.2).toFixed(2));

    const fallback: QwenAnalysisOutput = {
      isApproved: true,
      direction: fallbackDirection,
      type: fallbackType,
      refinedEntry: smartEntry,
      refinedSL: smartSL,
      refinedTP: smartTP,
      confidence: 88,
      reason: `คำนวณตามโครงสร้าง Fibonacci Golden Zone (50%-61.8%) และ ATR Volatility ($${smartEntry.toFixed(2)})`,
      source: 'MATH_ENGINE',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12.0s execution window for Qwen 3.5-9B

    try {
      const formattedH1 = (input.h1Candles || [])
        .slice(0, 10)
        .map((c) => `[${c.open.toFixed(2)}, ${c.high.toFixed(2)}, ${c.low.toFixed(2)}, ${c.close.toFixed(2)}]`)
        .join(', ');

      const formattedM15 = (input.m15Candles || [])
        .slice(0, 15)
        .map((c) => `[${c.open.toFixed(2)}, ${c.high.toFixed(2)}, ${c.low.toFixed(2)}, ${c.close.toFixed(2)}]`)
        .join(', ');

      const formattedM5 = (input.m5Candles || [])
        .slice(0, 15)
        .map((c) => `[${c.open.toFixed(2)}, ${c.high.toFixed(2)}, ${c.low.toFixed(2)}, ${c.close.toFixed(2)}]`)
        .join(', ');

      const formattedLosses = (input.recentLosses || [])
        .slice(0, 3)
        .map((l) => `${l.direction} @ $${l.entry.toFixed(2)} (SL $${l.stopLoss.toFixed(2)}: ${l.notes || 'Hit SL'})`)
        .join(' | ') || 'ไม่มีประวัติชน SL ล่าสุด';

      const systemPrompt = `คุณคือ Senior Institutional Quantitative Analyst & High-Winrate Gold Specialist (XAUUSD Expert)
หน้าที่ของคุณคือวิเคราะห์โครงสร้างราคาทองคำ ($${input.currentPrice.toFixed(2)}) ผ่านมิติ Multi-Timeframe (H1, M15, M5), Fibonacci Golden Pocket (50%-61.8%), และแนวรับแนวต้านสถาบัน เพื่อออกแผนเทรดที่มี Win Rate สูงที่สุด (>85%)

กฎเหล็กวิเคราะห์จุดเข้า (Strict Entry Rules):
1. ทิศทางแผนหลัก: ให้ยึดตามเทรนด์ H1 (${input.h1Bias}) และ M15 (${input.m15Bias}) ห้ามออกแผนสวนเทรนด์ใหญ่เด็ดขาด!
2. สำหรับ BUY: ตั้งจุดเข้า BUY_LIMIT ย่อรับที่ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) หรือโซนแนวรับ ($${input.nearestSupport.map((p) => p.toFixed(2)).join(', ')})
   - ระยะย่อ (Pullback Distance): ต้องอยู่ห่างจากราคาปัจจุบันเพียง $1.2 ถึง $3.5 เท่านั้น (เพื่อเน้นให้ติดไม้ง่ายและได้เปรียบราคา)
3. สำหรับ SELL: ตั้งจุดเข้า SELL_LIMIT เด้งขายที่ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) หรือโซนแนวต้าน ($${input.nearestResistance.map((p) => p.toFixed(2)).join(', ')})
   - ระยะเด้ง (Rebound Distance): ต้องอยู่ห่างจากราคาปัจจุบันเพียง $1.2 ถึง $3.5 เท่านั้น
4. ป้องกัน SL Hunt (Stop Loss Protection): 
   - ระยะ SL ต้องตั้งให้ปลอดภัยเลย Swing High/Low + ATR Buffer ($4.5 ถึง $6.0) เพื่อไม่ให้โดนไส้เทียนเหวี่ยงชน SL ปลอม
5. Target TP (Take Profit):
   - ต้องได้อัตรา Risk-Reward (RR) ไม่ต่ำกว่า 1:2.5 (ระยะ TP ประมาณ $11.0 ถึง $18.0)

ตอบกลับเฉพาะ JSON รูปแบบนี้เท่านั้น (ห้ามมีอักขระหรือข้อความอื่นนอก JSON):
{
  "direction": "BUY" หรือ "SELL",
  "approved": true,
  "entry": number (ย่อ/เด้ง ห่างจากราคาปัจจุบัน 1.2$-3.5$),
  "stopLoss": number (อยู่หลังจุดเข้า 4.5$-6.0$),
  "takeProfit": number (ระยะกำไรมากกว่า 11.0$-18.0$),
  "confidence": number (75-95),
  "reason": "สรุปเหตุผลเชิงเทคนิคสั้นๆ ชัดเจน อ้างอิง H1/M15 Trend + Fibonacci Zone"
}`;

      const userPrompt = `ข้อมูลราคาทองคำสด (${input.symbol}):
- ราคาปัจจุบัน: $${input.currentPrice.toFixed(2)}
- เทรนด์หลัก H1: ${input.h1Bias} | เทรนด์ M15: ${input.m15Bias} (ความแรง ${input.trendStrength}%)
- RSI H1: ${Math.round(input.rsi14H1)} | RSI M15: ${Math.round(input.rsi14M15)} | RSI M5: ${Math.round(input.rsi14M5)}
- Dynamic ATR (14): $${input.atr14.toFixed(2)}
- EMA 20 (M15): $${input.ema20_m15.toFixed(2)} | EMA 50 (M15): $${input.ema50_m15.toFixed(2)}
- Fibonacci Golden Pocket (50% - 61.8%): $${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}
- ราคาสูงสุด/ต่ำสุดรอบวัน (24h Range): $${input.sessionLow.toFixed(2)} - $${input.sessionHigh.toFixed(2)}
- แนวรับสำคัญ: ${input.nearestSupport.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}
- แนวต้านสำคัญ: ${input.nearestResistance.map((p) => '$' + p.toFixed(2)).join(', ') || 'N/A'}

แท่งเทียน H1 (OHLC ย้อนหลัง 10 แท่ง): ${formattedH1 || 'N/A'}
แท่งเทียน M15 (OHLC ย้อนหลัง 15 แท่ง): ${formattedM15 || 'N/A'}
แท่งเทียน M5 (OHLC ย้อนหลัง 15 แท่ง): ${formattedM5 || 'N/A'}
ประวัติไม้ที่ชน SL ล่าสุด (เพื่อทบทวนบทเรียนและหลีกเลี่ยงข้อผิดพลาดเดิม): ${formattedLosses}

โปรดวิเคราะห์จุดเข้าที่ได้เปรียบราคาที่สุดใกล้ราคาปัจจุบัน ($${input.currentPrice.toFixed(2)}) และคืนค่า JSON แผนเทรดสด`;

      const response = await fetch(this.LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.15,
          max_tokens: 350,
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
      let refinedSL = Number((parsed.stopLoss || smartSL).toFixed(2));
      let refinedTP = Number((parsed.takeProfit || smartTP).toFixed(2));

      // Tight SL distance guard (Anti-Wick Hunt: $7.5 to $11.5 for volatile Gold trading)
      const targetSlDist = Math.max(7.5, Math.min(11.5, (input.atr14 || 5.5) * 1.6));
      if (direction === 'BUY') {
        if (refinedEntry - refinedSL > 12.0 || refinedEntry - refinedSL < 7.0) {
          refinedSL = Number((refinedEntry - targetSlDist).toFixed(2));
        }
        if (refinedTP <= refinedEntry) {
          refinedTP = Number((refinedEntry + targetSlDist * 2.2).toFixed(2));
        }
      } else {
        if (refinedSL - refinedEntry > 12.0 || refinedSL - refinedEntry < 7.0) {
          refinedSL = Number((refinedEntry + targetSlDist).toFixed(2));
        }
        if (refinedTP >= refinedEntry) {
          refinedTP = Number((refinedEntry - targetSlDist * 2.2).toFixed(2));
        }
      }

      return {
        isApproved: parsed.approved !== false,
        direction,
        type: planType,
        refinedEntry,
        refinedSL,
        refinedTP,
        confidence: Math.min(95, Math.max(75, Number(parsed.confidence) || 90)),
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
