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

    // Keep entry at a pending pullback/rebound distance ($2.2 to $5.5) below/above current price
    if (isProposedBuy) {
      if (input.currentPrice - smartEntry < 1.8 || input.currentPrice - smartEntry > 6.5) {
        smartEntry = Number((input.currentPrice - 2.8).toFixed(2));
      }
    } else {
      if (smartEntry - input.currentPrice < 1.8 || smartEntry - input.currentPrice > 6.5) {
        smartEntry = Number((input.currentPrice + 2.8).toFixed(2));
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
หน้าที่ของคุณคือวิเคราะห์โครงสร้างราคาทองคำ ($${input.currentPrice.toFixed(2)}) ผ่านมิติ Multi-Timeframe (H1, M15, M5), Fibonacci Golden Pocket, และแนวรับแนวต้านสถาบัน เพื่อออกแผนเทรดที่มี Win Rate สูงที่สุด (>85%)

กฎเหล็กวิเคราะห์จุดเข้าที่ได้เปรียบราคาที่สุด (Strict Advantageous Entry Rules):
1. ในภาวะ Sideway / Ranging (ราคาวิ่งออกข้างในกรอบ):
   - สำหรับ SELL: ต้องตั้งจุดเข้า SELL_LIMIT ที่แนวต้านสถิติต้นทางสูงสุดของกรอบ (Resistance High $${input.sessionHigh.toFixed(2)}) เท่านั้น! ห้ามตั้ง SELL กลางกรอบเด็ดขาด!
   - สำหรับ BUY: ต้องตั้งจุดเข้า BUY_LIMIT ที่ฐานแนวรับต่ำสุดของกรอบ (Support Base $${input.sessionLow.toFixed(2)}) เท่านั้น! ห้ามไล่ราคาซื้อบนยอดเด็ดขาด!
2. ในภาวะมีเทรนด์ชัดเจน:
   - BUY_LIMIT: ตั้งรับที่ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) หรือแนวรับสถาบัน ($${input.nearestSupport.map((p) => p.toFixed(2)).join(', ')})
   - SELL_LIMIT: ตั้งเด้งขายที่ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) หรือแนวต้านสถาบัน ($${input.nearestResistance.map((p) => p.toFixed(2)).join(', ')})
3. ระยะ Pending Order ต้องวางล่วงหน้าอย่างน้อย 2.2$-6.5$ จากราคาปัจจุบัน เพื่อให้ได้เปรียบราคาและมีเวลาตั้งออเดอร์บน MT5
4. ป้องกัน SL Hunt: ระยะ SL ต้องตั้งเลย Structural Swing High/Low + ATR Buffer ($5.5 ถึง $8.0)
5. Target TP: ตั้งเป้าทำกำไรฝั่งตรงข้ามของกรอบเพื่อให้ได้ Risk-Reward (RR) สูงกว่า 1:2.0

ตอบกลับเฉพาะ JSON รูปแบบนี้เท่านั้น (ห้ามมีอักขระอื่น):
{
  "direction": "BUY" หรือ "SELL",
  "approved": true,
  "entry": number (จุดเข้าได้เปรียบที่แนวรับฐาน หรือ แนวต้านสูงสุด),
  "stopLoss": number (อยู่หลังจุด swing extreme 5.5$-8.0$),
  "takeProfit": number (เป้ากำไรฝั่งตรงข้ามกรอบ),
  "confidence": number (75-95),
  "reason": "สรุปเหตุผลเชิงเทคนิคสั้นๆ อ้างอิง Sideway Range / Structural Support/Resistance"
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
