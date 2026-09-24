import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification.service';
import { PaperTradeService } from '@/lib/services/paper-trade.service';

export interface MT5QuoteData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  timestamp: string;
  session?: string;
  atr?: number;
  atr_m15?: number;
  indicators?: {
    m5?: { ema20?: number; ema50?: number; rsi?: number; trend?: string };
    m15?: { ema20?: number; ema50?: number; trend?: string };
  };
  sessionHigh?: number;
  sessionLow?: number;
  sessionOpen?: number;
  prevDayHigh?: number;
  prevDayLow?: number;
  prevDayClose?: number;
  asiaHigh?: number;
  asiaLow?: number;
  londonHigh?: number;
  londonLow?: number;
  lastCandleM5?: {
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    body?: number;
    upperWick?: number;
    lowerWick?: number;
    totalRange?: number;
    isBullish?: boolean;
    rejectionType?: string;
  };
  barsM5?: Array<{ t: string; o: number; h: number; l: number; c: number; v?: number }>;
  barsM15?: Array<{ t: string; o: number; h: number; l: number; c: number; v?: number }>;
}

export interface TradePlanResult {
  id: string;
  approved: boolean;
  action: 'BUY' | 'SELL' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'WAIT';
  direction: 'BUY' | 'SELL' | 'WAIT';
  type: string;
  entry: number;
  entry1: number;
  entry2?: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2?: number;
  confidence: number;
  title: string;
  reason: string;
  invalidation?: string;
  source: string;
  timeframe: string;
  strategyLabel: string;
  createdAtThailand: string;
  lockedAt: string;
}

export class GeminiTradePlanService {
  private static BRIDGE_URL = process.env.QUOTE_BRIDGE_URL || 'http://127.0.0.1:8787/quote';

  private static getWineMt5CommonDir(): string {
    return path.join(
      os.homedir(),
      'Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files'
    );
  }

  /**
   * 1. Fetch live quote from Local Bridge (8787), Wine file, or DB fallback
   */
  static async fetchQuote(): Promise<MT5QuoteData | null> {
    // Primary: HTTP quote bridge (port 8787)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(this.BRIDGE_URL, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data?.quote) {
          return data.quote as MT5QuoteData;
        }
      }
    } catch {
      // Ignore & try secondary file fallback
    }

    // Secondary: Read direct MT5 wine file
    try {
      const filePath = path.join(this.getWineMt5CommonDir(), 'gold_daytrade_quote.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed?.last || parsed?.bid) {
          return parsed as MT5QuoteData;
        }
      }
    } catch (fileErr) {
      console.warn('[GeminiTradePlan] Wine quote file fallback error:', fileErr);
    }

    // Tertiary: DB Candle fallback
    try {
      const GOLD_SYMBOLS = ['GOLD#', 'XAUUSD', 'GOLD', 'GOLDm', 'XAUUSD.iux', 'XAUUSDc'];
      const [m5Candles, m15Candles] = await Promise.all([
        prisma.candle.findMany({
          where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'M5' },
          orderBy: { time: 'desc' },
          take: 20,
        }),
        prisma.candle.findMany({
          where: { symbol: { in: GOLD_SYMBOLS }, timeframe: 'M15' },
          orderBy: { time: 'desc' },
          take: 20,
        }),
      ]);

      if (m5Candles.length > 0) {
        const latest = m5Candles[0];
        const highs = m5Candles.map((c) => c.high);
        const lows = m5Candles.map((c) => c.low);
        return {
          symbol: latest.symbol,
          bid: latest.close,
          ask: latest.close + 0.35,
          last: latest.close,
          spread: 35,
          timestamp: new Date().toISOString(),
          sessionHigh: Math.max(...highs),
          sessionLow: Math.min(...lows),
          atr: 3.5,
          atr_m15: 5.5,
          barsM5: m5Candles.map((c) => ({
            t: new Date(c.time).toISOString(),
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close,
            v: c.volume,
          })),
          barsM15: m15Candles.map((c) => ({
            t: new Date(c.time).toISOString(),
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close,
            v: c.volume,
          })),
        };
      }
    } catch (dbErr) {
      console.error('[GeminiTradePlan] DB quote fallback error:', dbErr);
    }

    return null;
  }

  /**
   * 2. Retrieve Gemini API Key from Env or DB
   */
  static async getGeminiApiKey(): Promise<string> {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      return process.env.GEMINI_API_KEY.trim();
    }
    try {
      const dbSetting = await prisma.systemSetting.findUnique({
        where: { key: 'GEMINI_API_KEY' },
      });
      if (dbSetting?.value && dbSetting.value.trim() !== '') {
        return dbSetting.value.trim();
      }
    } catch {
      // ignore
    }
    return '';
  }

  /**
   * 3. Quantitative Rule Fallback Engine (Instant zero latency)
   */
  private static generateQuantFallbackPlan(quote: MT5QuoteData, bangkokTimeStr: string): TradePlanResult {
    const currentPrice = quote.last || quote.bid || 4285.0;
    const m5Ema20 = quote.indicators?.m5?.ema20 || currentPrice;
    const m5Ema50 = quote.indicators?.m5?.ema50 || currentPrice;
    const m15Ema20 = quote.indicators?.m15?.ema20 || currentPrice;
    const atr = quote.atr_m15 || quote.atr || 4.5;
    const dayHigh = quote.sessionHigh || currentPrice + 15;
    const dayLow = quote.sessionLow || currentPrice - 15;
    const rejection = quote.lastCandleM5?.rejectionType || 'NONE';

    const isBearish = currentPrice < m15Ema20 && currentPrice <= m5Ema50;
    const direction: 'BUY' | 'SELL' = isBearish ? 'SELL' : 'BUY';

    let entry = currentPrice;
    let sl = currentPrice;
    let tp1 = currentPrice;
    let tp2 = currentPrice;

    const slBuffer = Math.max(3.8, Math.min(6.5, atr * 0.9));
    const tpBuffer = Math.max(8.5, slBuffer * 2.2);

    if (direction === 'SELL') {
      // Place entry at resistance/EMA pullback
      entry = Number(Math.max(currentPrice + 1.2, m5Ema50).toFixed(2));
      sl = Number((entry + slBuffer).toFixed(2));
      tp1 = Number((entry - tpBuffer).toFixed(2));
      tp2 = Number((entry - tpBuffer * 1.6).toFixed(2));
    } else {
      // Place entry at support/EMA pullback
      entry = Number(Math.min(currentPrice - 1.2, m5Ema20).toFixed(2));
      sl = Number((entry - slBuffer).toFixed(2));
      tp1 = Number((entry + tpBuffer).toFixed(2));
      tp2 = Number((entry + tpBuffer * 1.6).toFixed(2));
    }

    const planType = direction === 'BUY'
      ? (entry < currentPrice ? 'BUY_LIMIT' : 'BUY')
      : (entry > currentPrice ? 'SELL_LIMIT' : 'SELL');

    const title = direction === 'BUY'
      ? `[M15 Smart Plan] BUY ย่อรับแนวรับ $${entry.toFixed(2)} (เป้าเก็บกำไร $8-$16)`
      : `[M15 Smart Plan] SELL ดักแนวต้าน $${entry.toFixed(2)} (เป้าเก็บกำไร $8-$16)`;

    const reason = direction === 'BUY'
      ? `โครงสร้างราคายืนเหนือระดับสำคัญ พร้อมแนวรับ Fibonacci/EMA โซน $${entry.toFixed(2)} และสัญญาณปฏิเสธราคา ${rejection}`
      : `โครงสร้างราคากดตัวใต้แนวต้าน EMA50 M5 ($${m5Ema50.toFixed(2)}) และ EMA20 M15 ($${m15Ema20.toFixed(2)}) รอจังหวะเด้งเข้าทำกำไรฝั่งขาย`;

    return {
      id: `ai-plan-${Date.now()}`,
      approved: true,
      action: planType,
      direction,
      type: planType,
      entry,
      entry1: entry,
      entry2: direction === 'BUY' ? Number((entry - 2.0).toFixed(2)) : Number((entry + 2.0).toFixed(2)),
      stopLoss: sl,
      takeProfit: tp1,
      takeProfit2: tp2,
      confidence: 78,
      title,
      reason,
      invalidation: direction === 'BUY' ? `หลุดระดับ SL $${sl.toFixed(2)} หรือปิดแท่ง M15 ต่ำกว่าแนวรับ` : `ทะลุระดับ SL $${sl.toFixed(2)} หรือปิดแท่ง M15 สูงกว่าแนวต้าน`,
      source: 'Quantitative Rule Engine',
      timeframe: 'M15',
      strategyLabel: 'Gemini AI Quant Engine',
      createdAtThailand: bangkokTimeStr,
      lockedAt: new Date().toISOString(),
    };
  }

  /**
   * 4. Call Gemini 2.5 Flash with Real Market Microstructure
   */
  static async evaluateMarketAndGeneratePlan(): Promise<{
    success: boolean;
    plan: TradePlanResult;
    quote: MT5QuoteData;
    message?: string;
  }> {
    const quote = await this.fetchQuote();
    if (!quote || (!quote.last && !quote.bid)) {
      throw new Error('ไม่พบข้อมูล Quote ราคา real-time จาก MT5 หรือ Bridge');
    }

    // Bangkok Time
    const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const bangkokTimeStr = `${nowBangkok.getUTCHours().toString().padStart(2, '0')}:${nowBangkok.getUTCMinutes().toString().padStart(2, '0')} น.`;

    const currentPrice = quote.last || quote.bid;
    const apiKey = await this.getGeminiApiKey();

    // Fetch recent loss records to learn from past mistakes
    let recentLossesText = 'ไม่มีสถิติไม้ขาดทุนล่าสุด';
    try {
      const recentLosses = await prisma.paperTrade.findMany({
        where: { symbol: { in: ['XAUUSD', 'GOLD#', 'GOLD', 'XAUUSDc'] }, result: 'LOSS' },
        orderBy: { closedAt: 'desc' },
        take: 3,
        select: { direction: true, entry: true, stopLoss: true, notes: true },
      });
      if (recentLosses.length > 0) {
        recentLossesText = recentLosses
          .map((l) => `${l.direction} @ $${l.entry.toFixed(2)} (SL: $${l.stopLoss.toFixed(2)})`)
          .join(' | ');
      }
    } catch {
      // ignore
    }

    // Prepare Prompt for Gemini 2.5 Flash
    const prompt = `You are a high-performance XAUUSD (Gold) proprietary fund trader & quantitative analyst.
Analyze the live MT5 gold market microstructure and output a strict, high-probability day-trade plan.

=== REAL-TIME GOLD MARKET DATA (${quote.symbol || 'XAUUSD'}) ===
- Current Price: $${currentPrice.toFixed(2)} | Bid: $${quote.bid?.toFixed(2)} | Ask: $${quote.ask?.toFixed(2)} | Spread: ${quote.spread} pts
- Dynamic ATR M5: $${(quote.atr || 2.5).toFixed(2)} | Dynamic ATR M15: $${(quote.atr_m15 || 5.5).toFixed(2)}
- Indicators M5: EMA20=$${quote.indicators?.m5?.ema20?.toFixed(2) || 'N/A'}, EMA50=$${quote.indicators?.m5?.ema50?.toFixed(2) || 'N/A'}, RSI=${quote.indicators?.m5?.rsi?.toFixed(1) || 'N/A'}
- Indicators M15: EMA20=$${quote.indicators?.m15?.ema20?.toFixed(2) || 'N/A'}, EMA50=$${quote.indicators?.m15?.ema50?.toFixed(2) || 'N/A'}
- Key Levels Today: High=$${quote.sessionHigh?.toFixed(2) || 'N/A'}, Low=$${quote.sessionLow?.toFixed(2) || 'N/A'}
- Key Levels Prev Day: High=$${quote.prevDayHigh?.toFixed(2) || 'N/A'}, Low=$${quote.prevDayLow?.toFixed(2) || 'N/A'}
- Session Ranges: Asia ($${quote.asiaLow?.toFixed(2) || 'N/A'} - $${quote.asiaHigh?.toFixed(2) || 'N/A'}), London ($${quote.londonLow?.toFixed(2) || 'N/A'} - $${quote.londonHigh?.toFixed(2) || 'N/A'})
- Last M5 Candle: Open=$${quote.lastCandleM5?.open?.toFixed(2)}, High=$${quote.lastCandleM5?.high?.toFixed(2)}, Low=$${quote.lastCandleM5?.low?.toFixed(2)}, Close=$${quote.lastCandleM5?.close?.toFixed(2)}, UpperWick=$${quote.lastCandleM5?.upperWick?.toFixed(2)}, LowerWick=$${quote.lastCandleM5?.lowerWick?.toFixed(2)}, Pattern Rejection=${quote.lastCandleM5?.rejectionType || 'NONE'}
- Recent Closed M5 Bars: ${JSON.stringify(quote.barsM5?.slice(-6) || [])}
- Recent Loss Records: ${recentLossesText}

=== STRICT TRADING RULES ===
1. Trend & SMC Confluence: Follow the dominant M15/H1 structural trend. Do NOT FOMO buy into resistance peaks or panic sell at day lows.
2. Entry Pricing:
   - For BUY/BUY_LIMIT: Wait for pullbacks to discount demand/support/EMA zones (lower than current price or at fresh confirmed reversal).
   - For SELL/SELL_LIMIT: Wait for pullbacks to premium supply/resistance/EMA zones (higher than current price or at confirmed breakdown).
3. Risk Management:
   - Stop Loss (SL): Anti-Wick Hunt buffer ($3.80 to $6.50 distance from entry), placed behind structural swing invalidation.
   - Take Profit (TP1 & TP2): Minimum Risk:Reward 1:1.8 to 1:2.8 (TP1 distance $8.00 - $15.00 from entry).
4. If market is consolidation/range without clear edge, set "approved": true with safe pending limit orders, or "action": "WAIT" with "confidence" < 60.

=== OUTPUT JSON FORMAT ONLY (Strict JSON) ===
{
  "approved": true,
  "action": "BUY_LIMIT" or "SELL_LIMIT" or "BUY" or "SELL" or "WAIT",
  "direction": "BUY" or "SELL",
  "entry": 4284.50,
  "entry1": 4284.50,
  "entry2": 4282.50,
  "stopLoss": 4279.00,
  "takeProfit1": 4294.50,
  "takeProfit2": 4302.00,
  "confidence": 85,
  "title": "[M15 Scalp] แผนวิเคราะห์ภาษาไทยกระชับ",
  "reasoning": "อธิบายเหตุผลเชิงเทคนิคและโครงสร้างตลาดเป็นภาษาไทยอย่างชัดเจน 1-3 ประโยค",
  "invalidation": "เงื่อนไขยกเลิกแผน เช่น ปิดแท่ง M15 ทะลุระดับ $..."
}`;

    let planResult: TradePlanResult | null = null;

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.15,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(text);

        if (parsed && typeof parsed.entry === 'number' && typeof parsed.stopLoss === 'number') {
          const rawDir = parsed.direction === 'SELL' || parsed.action?.includes('SELL') ? 'SELL' : 'BUY';
          const entry = Number(parsed.entry.toFixed(2));
          let sl = Number(parsed.stopLoss.toFixed(2));
          let tp1 = Number((parsed.takeProfit1 || parsed.takeProfit || (rawDir === 'BUY' ? entry + 10 : entry - 10)).toFixed(2));
          const tp2 = parsed.takeProfit2 ? Number(parsed.takeProfit2.toFixed(2)) : undefined;

          // Geometry safety correction:
          if (rawDir === 'BUY') {
            if (sl >= entry) sl = Number((entry - 4.5).toFixed(2));
            if (tp1 <= entry) tp1 = Number((entry + 11.0).toFixed(2));
          } else {
            if (sl <= entry) sl = Number((entry + 4.5).toFixed(2));
            if (tp1 >= entry) tp1 = Number((entry - 11.0).toFixed(2));
          }

          const action = parsed.action || (rawDir === 'BUY' ? (entry < currentPrice ? 'BUY_LIMIT' : 'BUY') : (entry > currentPrice ? 'SELL_LIMIT' : 'SELL'));

          planResult = {
            id: `gemini-plan-${Date.now()}`,
            approved: parsed.approved !== false,
            action,
            direction: rawDir,
            type: action,
            entry,
            entry1: Number((parsed.entry1 || entry).toFixed(2)),
            entry2: parsed.entry2 ? Number(parsed.entry2.toFixed(2)) : undefined,
            stopLoss: sl,
            takeProfit: tp1,
            takeProfit2: tp2,
            confidence: Math.min(95, Math.max(40, Number(parsed.confidence) || 82)),
            title: parsed.title || `[M15 Scalp] ${rawDir} @ $${entry.toFixed(2)}`,
            reason: parsed.reasoning || parsed.reason || 'วิเคราะห์โครงสร้างตลาดและ SMC Confluence',
            invalidation: parsed.invalidation || `หลุดระดับ SL $${sl.toFixed(2)}`,
            source: 'Google Gemini 2.5 Flash',
            timeframe: 'M15',
            strategyLabel: 'Gemini 2.5 Flash AI Analyst',
            createdAtThailand: bangkokTimeStr,
            lockedAt: new Date().toISOString(),
          };
        }
      }
    } catch (aiErr) {
      console.warn('[GeminiTradePlan] Gemini API error, falling back to Quant Rule Engine:', aiErr);
    }

    if (!planResult) {
      planResult = this.generateQuantFallbackPlan(quote, bangkokTimeStr);
    }

    return {
      success: true,
      plan: planResult,
      quote,
    };
  }

  /**
   * 5. Apply plan: Save to SystemSetting, write to MT5 wine file, create PaperTrade, and send Line Notification
   */
  static async applyAndBroadcastPlan(plan: TradePlanResult, quote: MT5QuoteData): Promise<{
    dbSaved: boolean;
    mt5FileWritten: boolean;
    lineSent: boolean;
    paperTradeId?: string;
  }> {
    let dbSaved = false;
    let mt5FileWritten = false;
    let lineSent = false;
    let paperTradeId: string | undefined;

    // 1. Save Active Order Plan to DB for Dashboard & MT5 Webhook
    const planToStore = {
      id: plan.id,
      type: plan.type,
      title: plan.title,
      entry: plan.entry,
      entry1: plan.entry1,
      entry2: plan.entry2,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      takeProfit2: plan.takeProfit2,
      confidence: plan.confidence,
      reason: `🤖 [${plan.source}]: ${plan.reason}`,
      invalidation: plan.invalidation,
      strategyLabel: plan.strategyLabel,
      timeframe: plan.timeframe,
      locked: true,
      lockedAt: plan.lockedAt,
      createdAtThailand: `${plan.createdAtThailand} (เวลาไทย)`,
    };

    try {
      await Promise.all([
        prisma.systemSetting.upsert({
          where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
          update: { value: JSON.stringify(planToStore) },
          create: { key: 'ACTIVE_ORDER_PLAN_XAUUSD', value: JSON.stringify(planToStore) },
        }),
        prisma.systemSetting.upsert({
          where: { key: 'ACTIVE_ORDER_PLAN_GOLD#' },
          update: { value: JSON.stringify(planToStore) },
          create: { key: 'ACTIVE_ORDER_PLAN_GOLD#', value: JSON.stringify(planToStore) },
        }),
        prisma.systemSetting.upsert({
          where: { key: 'LAST_AI_ANALYSIS_TIME' },
          update: { value: Date.now().toString() },
          create: { key: 'LAST_AI_ANALYSIS_TIME', value: Date.now().toString() },
        }),
        prisma.systemSetting.upsert({
          where: { key: 'LAST_QWEN_ANALYSIS_TIME' },
          update: { value: Date.now().toString() },
          create: { key: 'LAST_QWEN_ANALYSIS_TIME', value: Date.now().toString() },
        }),
      ]);
      dbSaved = true;
    } catch (dbErr) {
      console.error('[GeminiTradePlan] Failed to save active order plan to DB:', dbErr);
    }

    // 2. Write Plan directly to MT5 Common Directory for EA execution & chart display
    try {
      const commonDir = this.getWineMt5CommonDir();
      if (fs.existsSync(commonDir)) {
        const planFilePath = path.join(commonDir, 'gold_daytrade_plan.json');
        const mt5Payload = {
          plan_id: plan.id,
          timestamp: new Date().toISOString(),
          action: plan.direction,
          type: plan.type,
          entry: plan.entry,
          sl: plan.stopLoss,
          tp1: plan.takeProfit,
          tp2: plan.takeProfit2 || plan.takeProfit,
          title: plan.title,
          active: true,
        };
        fs.writeFileSync(planFilePath, JSON.stringify(mt5Payload, null, 2), 'utf-8');
        mt5FileWritten = true;
      }
    } catch (fileErr) {
      console.warn('[GeminiTradePlan] Error writing MT5 plan file:', fileErr);
    }

    // 3. Record PaperTrade in DB for Statistical Tracking
    try {
      const existingActiveTrade = await prisma.paperTrade.findFirst({
        where: {
          symbol: { in: ['XAUUSD', 'GOLD#', 'GOLD', 'XAUUSDc'] },
          result: { in: ['PLAN', 'OPEN', 'TESTING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const isSamePlan = existingActiveTrade &&
        existingActiveTrade.direction === plan.direction &&
        Math.abs(existingActiveTrade.entry - plan.entry) < 1.2;

      if (!isSamePlan) {
        // If there was a pending PLAN (not yet executed/open), cancel old pending plan
        if (existingActiveTrade && existingActiveTrade.result === 'PLAN') {
          await prisma.paperTrade.update({
            where: { id: existingActiveTrade.id },
            data: { result: 'CANCELLED', closedAt: new Date() },
          });
        }

        const signal = await prisma.signal.create({
          data: {
            symbol: 'XAUUSD',
            direction: plan.direction,
            entry: plan.entry,
            stopLoss: plan.stopLoss,
            takeProfit1: plan.takeProfit,
            takeProfit2: plan.takeProfit2 || Number((plan.takeProfit + (plan.direction === 'BUY' ? 3.0 : -3.0)).toFixed(2)),
            riskReward: 2.2,
            confidence: plan.confidence,
            timeframe: plan.timeframe,
            status: 'active',
            reason: JSON.stringify({
              planType: plan.type,
              reason: plan.reason,
              strategyId: 'gemini_2_5_flash_ai',
              source: plan.source,
            }),
          },
        });

        const isLimit = plan.type.includes('LIMIT') || plan.type.includes('STOP');
        const pt = await prisma.paperTrade.create({
          data: {
            signalId: signal.id,
            symbol: 'XAUUSD',
            direction: plan.direction,
            entry: plan.entry,
            stopLoss: plan.stopLoss,
            takeProfit1: plan.takeProfit,
            takeProfit2: plan.takeProfit2 || Number((plan.takeProfit + (plan.direction === 'BUY' ? 3.0 : -3.0)).toFixed(2)),
            result: isLimit ? 'PLAN' : 'OPEN',
            rrResult: 0.0,
            openedAt: isLimit ? undefined : new Date(),
            notes: `🤖 [${plan.source}]: ${plan.reason}`,
          },
        });
        paperTradeId = pt.id;
      }
    } catch (ptErr) {
      console.error('[GeminiTradePlan] Failed to record paper trade in DB:', ptErr);
    }

    // 4. Send Line Broadcast/Push Notification with Cooldown Protection (10 mins)
    try {
      const lastSentSetting = await prisma.systemSetting.findUnique({
        where: { key: 'LAST_AI_PLAN_LINE_SENT' },
      });

      let shouldSendLine = true;
      if (lastSentSetting?.value) {
        try {
          const lastSent = JSON.parse(lastSentSetting.value);
          const timeDiffMinutes = (Date.now() - Number(lastSent.timestamp)) / (60 * 1000);
          const isSameDirection = lastSent.direction === plan.direction;
          const isSameEntry = Math.abs(Number(lastSent.entry) - plan.entry) < 1.5;

          // Prevent duplicate spam within 10 minutes for identical plan
          if (timeDiffMinutes < 10 && isSameDirection && isSameEntry) {
            shouldSendLine = false;
            console.log('[GeminiTradePlan] Line alert throttled: Identical plan sent recently.');
          }
        } catch {
          // ignore
        }
      }

      if (shouldSendLine) {
        const lineMessage =
          `⚡ [ Gold AI Signal แผนเทรดใหม่ ] ⚡\n\n` +
          `🕒 เวลาที่ให้แผน: ${plan.createdAtThailand} (เวลาไทย)\n` +
          `📌 แผน: ${plan.title}\n` +
          `📊 ประเภทคำสั่ง: ${plan.type}\n` +
          `🎯 จุดเข้า (Entry Target): $${plan.entry.toFixed(2)}${plan.entry2 ? ` (ไม้ 2: $${plan.entry2.toFixed(2)})` : ''}\n` +
          `🔴 Stop Loss (SL): $${plan.stopLoss.toFixed(2)}\n` +
          `🟢 Take Profit 1 (TP1): $${plan.takeProfit.toFixed(2)}\n` +
          (plan.takeProfit2 ? `🟢 Take Profit 2 (TP2): $${plan.takeProfit2.toFixed(2)}\n` : '') +
          `🧠 AI Confidence: ${plan.confidence}%\n\n` +
          `💡 เหตุผลวิเคราะห์:\n${plan.reason.replace(/\*/g, '')}\n` +
          (plan.invalidation ? `\n🚫 Invalidation Rule:\n${plan.invalidation}\n` : '') +
          `\n👉 ดูรายละเอียดเพิ่มเติมและกราฟสดได้ที่ goldaisig.com`;

        const res = await NotificationService.sendNotification(lineMessage);
        lineSent = Boolean(res.lineNotify?.success || res.lineUsers?.success);

        await prisma.systemSetting.upsert({
          where: { key: 'LAST_AI_PLAN_LINE_SENT' },
          update: {
            value: JSON.stringify({
              timestamp: Date.now(),
              direction: plan.direction,
              entry: plan.entry,
              sl: plan.stopLoss,
              tp: plan.takeProfit,
            }),
          },
          create: {
            key: 'LAST_AI_PLAN_LINE_SENT',
            value: JSON.stringify({
              timestamp: Date.now(),
              direction: plan.direction,
              entry: plan.entry,
              sl: plan.stopLoss,
              tp: plan.takeProfit,
            }),
          },
        });
      }
    } catch (notifErr) {
      console.error('[GeminiTradePlan] Error sending Line notification:', notifErr);
    }

    return { dbSaved, mt5FileWritten, lineSent, paperTradeId };
  }
}
