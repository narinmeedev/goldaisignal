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
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s fast execution window with instant SmartTrendStructure fallback

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

กฎเหล็กยกระดับ WIN RATE สูงสุด และคุมความเสี่ยงเข้มงวด:
1. ห้ามสวนเทรนด์เด็ดขาด (100% Anti-Counter-Trend): หาก H4 หรือ H1 เป็นขาขึ้น ห้ามออกสัญญาณ SELL เด็ดขาด! ให้รอ BUY_LIMIT ย่อรับแนวรับเท่านั้น
2. จุดเข้าต้องได้เปรียบราคา (No FOMO / Demand-Supply Entry Only):
   - BUY_LIMIT: ต้องตั้งรับที่แนวรับสถาบัน ($${input.nearestSupport.map((p) => p.toFixed(2)).join(', ')}) หรือ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) ซึ่งต่ำกว่าราคาปัจจุบันอย่างน้อย $2.5 - $6.0
   - SELL_LIMIT: ต้องตั้งเด้งขายที่แนวต้านสถาบัน ($${input.nearestResistance.map((p) => p.toFixed(2)).join(', ')}) หรือ Fibonacci 50%-61.8% ($${input.fib50.toFixed(2)} - $${input.fib618.toFixed(2)}) ซึ่งสูงกว่าราคาปัจจุบันอย่างน้อย $2.5 - $6.0
3. ระยะ Stop Loss ป้องกันการโดนเกี่ยวไส้เทียน (Anti-Wick Hunt SL Buffer): วาง SL เลยจุด Swing Low/High ล่าสุดออกไปอีก $2.50 - $3.50 เพื่อกันความผันผวนปกติของทองคำ
4. อัตรา Risk-Reward Ratio ต้องไม่ต่ำกว่า 1:2.0 (Target RR 1:2.2 ถึง 1:3.0): ระยะ TP ต้องเป็นอย่างน้อย 2.2 เท่าของระยะ SL เสมอ
5. หากสภาวะตลาดก้ำกวมหรือไม่เข้าเงื่อนไข ให้ปรับ confidence ต่ำกว่า 80 และอธิบายเหตุผลว่าควรรอราคาเข้าโซน

ตอบกลับเฉพาะ JSON รูปแบบนี้เท่านั้น (ห้ามมีอักขระอื่น):
{
  "direction": "BUY" หรือ "SELL",
  "approved": true หรือ false,
  "entry": number (จุดเข้าได้เปรียบที่แนวรับฐาน หรือ แนวต้านสูงสุด),
  "stopLoss": number (อยู่หลังจุด swing extreme 5.5$-8.0$),
  "takeProfit": number (เป้ากำไรฝั่งตรงข้ามกรอบ),
  "confidence": number (80-98),
  "reason": "สรุปเหตุผลเชิงเทคนิคสั้นๆ อ้างอิง Structural Support/Resistance และ SMC Confluence"
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

      let refinedEntry = Number(parsed.entry.toFixed(2));

      // STRICT S/R BOUNDARY OVERRIDE: NEVER ALLOW BUY AT RESISTANCE / H1 PEAK!
      const nearestSupportPx = input.nearestSupport?.[0] || (input.sessionLow + 0.5);
      const nearestResistancePx = input.nearestResistance?.[0] || (input.sessionHigh - 0.5);
      const rangeDist = Math.max(8.0, input.sessionHigh - input.sessionLow);
      const maxAllowedBuyPx = input.sessionLow + rangeDist * 0.35;
      const minAllowedSellPx = input.sessionHigh - rangeDist * 0.35;

      if (direction === 'BUY') {
        // If Qwen recommended BUY near resistance or above discount base, FORCE ENTRY DOWN TO EXACT SUPPORT!
        if (refinedEntry > maxAllowedBuyPx || (input.sessionHigh - refinedEntry < 3.0)) {
          refinedEntry = Number(nearestSupportPx.toFixed(2));
        }
      } else {
        // If Qwen recommended SELL near support or below premium peak, FORCE ENTRY UP TO EXACT RESISTANCE!
        if (refinedEntry < minAllowedSellPx || (refinedEntry - input.sessionLow < 3.0)) {
          refinedEntry = Number(nearestResistancePx.toFixed(2));
        }
      }

      // Tight Scalp SL Guard ($3.50 - $4.80) and TP ($9.50 - $14.50, RR >= 1:2.5)
      const targetSlDist = Math.max(3.50, Math.min(4.80, (input.atr14 || 3.5) * 1.2));
      const targetTpDist = Math.max(9.50, targetSlDist * 2.5);

      let refinedSL = direction === 'BUY'
        ? Number((refinedEntry - targetSlDist).toFixed(2))
        : Number((refinedEntry + targetSlDist).toFixed(2));

      let refinedTP = direction === 'BUY'
        ? Number((refinedEntry + targetTpDist).toFixed(2))
        : Number((refinedEntry - targetTpDist).toFixed(2));

      const entryNote = direction === 'BUY'
        ? `(ย่อตัวลงมาแตะแนวรับสำคัญ $${refinedEntry.toFixed(2)} ก่อนเปิด BUY)`
        : `(เด้งตัวขึ้นไปแตะแนวต้านสำคัญ $${refinedEntry.toFixed(2)} ก่อนเปิด SELL)`;

      return {
        isApproved: parsed.approved !== false,
        direction,
        type: planType,
        refinedEntry,
        refinedSL,
        refinedTP,
        confidence: Math.min(95, Math.max(75, Number(parsed.confidence) || 90)),
        reason: `${entryNote} | ${parsed.reason || fallback.reason}`,
        source: 'LOCAL_QWEN_LLM',
      };
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
