import { prisma } from '../prisma';
import { ZoneService } from './zone.service';
import { PaperTradeService } from './paper-trade.service';
import { NotificationService } from './notification.service';

const MIN_RECOMMENDATION_CONFIDENCE = 70;

export interface SignalEvaluationResult {
  decision: 'PAPER_TRADE_CREATED' | 'REJECTED';
  signalId?: string;
  direction: 'BUY' | 'SELL' | 'NO_TRADE';
  confidence: number;
  fakeoutScore: number;
  reason: Record<string, any>;
}

export class SignalService {
  /**
   * Evaluates an incoming TradingView webhook alert,
   * runs the Technical Engine, Anti-Fakeout Engine, and Risk Engine,
   * saves the resulting Signal, and opens a Paper Trade if approved.
   */
  static async evaluateSignal(payload: {
    symbol: string;
    timeframe: string;
    direction: 'BUY' | 'SELL';
    price: number;
    strategy: string;
    timestamp: string;
  }): Promise<SignalEvaluationResult> {
    const { symbol, timeframe, direction, price, strategy } = payload;
    const normalizedSymbol = symbol.toUpperCase();

    if (normalizedSymbol.includes('BTC') || !normalizedSymbol.includes('XAU')) {
      return {
        decision: 'REJECTED',
        direction: 'NO_TRADE',
        confidence: 0,
        fakeoutScore: 100,
        reason: {
          disabledSymbol: symbol,
          details: 'Gold AI Signal supports XAUUSD only. BTC and non-gold signals are disabled.',
        },
      };
    }

    // Enforce default status fields
    const reasonLog: Record<string, any> = {};
    let fakeoutScore = 0;
    let confidence = 70; // Start with base confidence
    let decision: 'PAPER_TRADE_CREATED' | 'REJECTED' = 'REJECTED';

    // Fetch fundamental news override settings
    const biasSettingKey = 'FUNDAMENTAL_BIAS_XAUUSD';
    const warningSettingKey = 'FUNDAMENTAL_NEWS_WARNING_XAUUSD';
    const fundamentalBiasSetting = await prisma.systemSetting.findUnique({ where: { key: biasSettingKey } });
    const fundamentalWarningSetting = await prisma.systemSetting.findUnique({ where: { key: warningSettingKey } });
    const fundamentalBias = fundamentalBiasSetting?.value || 'NEUTRAL';
    const fundamentalWarning = fundamentalWarningSetting?.value || '';

    // 1. Fetch recent candles for indicator calculations
    const recentCandles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: 'desc' },
      take: 50,
    });

    const h1Candles = await prisma.candle.findMany({
      where: { symbol, timeframe: 'H1' },
      orderBy: { time: 'desc' },
      take: 50,
    });

    const entry = price;

    // Math helper functions
    const calcSMA = (data: any[], period: number) => {
      if (data.length < period) return data[0]?.close || 0;
      let sum = 0;
      for (let i = 0; i < period; i++) sum += data[i].close;
      return sum / period;
    };

    const calcEMA = (data: any[], period: number) => {
      if (data.length < period) return calcSMA(data, data.length);
      const k = 2 / (period + 1);
      let ema = data[data.length - 1].close; 
      for (let i = data.length - 2; i >= 0; i--) {
        ema = (data[i].close * k) + (ema * (1 - k));
      }
      return ema;
    };

    const calcATR = (data: any[], period: number) => {
      if (data.length < period + 1) return 3.0;
      let trSum = 0;
      let validPeriods = 0;
      for (let i = 0; i < period; i++) {
        const current = data[i];
        const prev = data[i + 1];
        if (!prev) continue;
        const hl = current.high - current.low;
        const hc = Math.abs(current.high - prev.close);
        const lc = Math.abs(current.low - prev.close);
        trSum += Math.max(hl, hc, lc);
        validPeriods++;
      }
      return validPeriods > 0 ? trSum / validPeriods : 3.0;
    };

    const calcRSI = (data: any[], period: number) => {
      if (data.length < period + 1) return 50;
      let gains = 0, losses = 0;
      for (let i = 0; i < period; i++) {
        const change = data[i].close - data[i+1].close;
        if (change > 0) gains += change;
        else losses -= change; 
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };

    // Calculate dynamic risk bounds (ATR 14, EMA 20, RSI 14)
    const atr14 = calcATR(recentCandles, 14);
    const rsi14 = calcRSI(recentCandles, 14);
    const ema20 = calcEMA(recentCandles, 20);

    // Stop Loss Range: Tightened based on timeframe to protect high lot sizes
    let slRange = atr14 * 1.0;
    if (timeframe === 'M5') {
      slRange = atr14 * 0.7;
      slRange = Math.min(3.5, Math.max(1.2, slRange)); // Cap M5 SL between 120 - 350 points ($1.2 - $3.5)
    } else if (timeframe === 'M15') {
      slRange = atr14 * 0.9;
      slRange = Math.min(6.5, Math.max(1.8, slRange)); // Cap M15 SL between 180 - 650 points ($1.8 - $6.5)
    } else {
      slRange = atr14 * 1.0;
      slRange = Math.min(12.0, Math.max(4.0, slRange)); // Cap H1/H4 SL between 400 - 1200 points ($4.0 - $12.0)
    }

    const tp1Range = slRange * 2.0; // 1:2 RR
    const tp2Range = slRange * 4.0; // 1:4 RR
    const tp3Range = slRange * 6.0; // 1:6 RR

    const stopLoss = direction === 'BUY' ? entry - slRange : entry + slRange;
    const takeProfit1 = direction === 'BUY' ? entry + tp1Range : entry - tp1Range;
    const takeProfit2 = direction === 'BUY' ? entry + tp2Range : entry - tp2Range;
    const takeProfit3 = direction === 'BUY' ? entry + tp3Range : entry - tp3Range;
    
    // Calculated RR check ratio
    const riskReward = Math.abs(takeProfit1 - entry) / Math.abs(entry - stopLoss);
    reasonLog.riskReward = riskReward;
    reasonLog.atr14 = atr14;
    reasonLog.rsi14 = rsi14;
    reasonLog.ema20 = ema20;

    // 2. RISK ENGINE - Duplicate Check
    const activeSameTrade = await prisma.paperTrade.findFirst({
      where: {
        symbol,
        direction,
        result: { in: ['OPEN', 'PLAN', 'TESTING'] },
      },
    });

    if (activeSameTrade) {
      reasonLog.duplicateRejected = true;
      reasonLog.details = 'An active or saved plan in the same direction already exists.';
      
      const signal = await prisma.signal.create({
        data: {
          symbol,
          timeframe,
          direction: 'NO_TRADE',
          entry: price,
          stopLoss: 0,
          takeProfit1: 0,
          takeProfit2: 0,
          takeProfit3: 0,
          riskReward: 0,
          confidence: 0,
          status: 'cancelled',
          bias: 'Wait',
          entryZone: `$${price.toFixed(2)}`,
          riskLevel: 'Low',
          marketCondition: 'Sideways',
          result: 'Pending',
          reason: JSON.stringify(reasonLog),
          fakeoutScore: 0,
        },
      });

      return {
        decision: 'REJECTED',
        signalId: signal.id,
        direction: 'NO_TRADE',
        confidence: 0,
        fakeoutScore: 0,
        reason: reasonLog,
      };
    }

    // --- DAILY LIMIT AND CONSECUTIVE LOSS LIMITS REMOVED AS REQUESTED BY USER ---
    // (This ensures all signals are evaluated and shown as proposed plans or active signals)

    // 3. TECHNICAL & ANTI-FAKEOUT ENGINES - Market Context Checks
    let hasTrendAlign = true;
    let hasH1TrendAlign = true;
    let hasSweep = false;
    let hasZoneMatch = false;

    // Calculate H1 Trend Alignment (EMA 20)
    let ema20_h1 = 0;
    if (h1Candles.length >= 20) {
      ema20_h1 = calcEMA(h1Candles, 20);
      const isH1Bullish = price > ema20_h1;
      hasH1TrendAlign = direction === 'BUY' ? isH1Bullish : !isH1Bullish;
      reasonLog.h1TrendAligned = hasH1TrendAlign;
      reasonLog.ema20_h1 = ema20_h1;
    }

    if (recentCandles.length >= 20) {
      // A. M15 Trend Alignment check (EMA 20 smoothing filter)
      const isBullishTrend = price > ema20;
      hasTrendAlign = direction === 'BUY' ? isBullishTrend : !isBullishTrend;
      reasonLog.trendAligned = hasTrendAlign;

      // Penalize for local trend mismatches
      if (!hasTrendAlign) {
        fakeoutScore += 30;
        reasonLog.trendMismatch = true;
        reasonLog.details = 'Signal is against the local M15 trend.';
      }

      // Penalize for major trend mismatches
      if (h1Candles.length >= 20 && !hasH1TrendAlign) {
        fakeoutScore += 35;
        reasonLog.h1TrendMismatch = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + 'Signal is against the major H1 trend.';
      }

      // B. Average candle range check (Anti-Fakeout check)
      const ranges = recentCandles.map((c) => Math.abs(c.high - c.low));
      const avgRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
      const currentCandleRange = Math.abs(recentCandles[0].high - recentCandles[0].low);

      if (currentCandleRange > 2 * avgRange) {
        fakeoutScore += 25;
        reasonLog.largeCandleRange = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `Candle range (${currentCandleRange.toFixed(2)}) is > 2x average (${avgRange.toFixed(2)}).`;
      }

      // C. Sideways Choppiness check (Anti-Fakeout check)
      const last10 = recentCandles.slice(0, 10);
      const highs = last10.map((c) => c.high);
      const lows = last10.map((c) => c.low);
      const maxSpread = Math.max(...highs) - Math.min(...lows);
      
      const chopThreshold = 5.0;
      if (maxSpread < chopThreshold) { 
        fakeoutScore += 20;
        reasonLog.sidewaysRange = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `Tight sideways range detected. Spread: $${maxSpread.toFixed(2)}`;
      }

      // D. Liquidity Sweep check
      const currentCandle = recentCandles[0];
      const prevCandle = recentCandles[1];
      if (direction === 'BUY') {
        if (currentCandle.low < prevCandle.low && currentCandle.close > prevCandle.low) {
          hasSweep = true;
          confidence += 10;
        }
      } else {
        if (currentCandle.high > prevCandle.high && currentCandle.close < prevCandle.high) {
          hasSweep = true;
          confidence += 10;
        }
      }
      reasonLog.liquiditySweep = hasSweep;

      // F. RSI Exhaustion filter (Anti-Buying-Top / Anti-Selling-Bottom)
      if (direction === 'BUY' && rsi14 > 75) {
        fakeoutScore += 40;
        reasonLog.overboughtAlert = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `RSI is extremely overbought (${rsi14.toFixed(1)} > 75). Buying at extreme highs is high risk.`;
      } else if (direction === 'SELL' && rsi14 < 25) {
        fakeoutScore += 40;
        reasonLog.oversoldAlert = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `RSI is extremely oversold (${rsi14.toFixed(1)} < 25). Selling at extreme lows is high risk.`;
      }

    } else {
      // Fallback seeding
      hasTrendAlign = true;
      hasSweep = true;
      reasonLog.fallbackSeeding = true;
      reasonLog.details = 'Cold-start mode: insufficient candles, bypassing trend/sweep filters.';
    }

    // E. Overlap with Zones Check
    const nearbyZones = await ZoneService.getZonesNearPrice(symbol, timeframe === 'M15' ? 'H1' : timeframe, price);
    const targetType = direction === 'BUY' ? 'SUPPORT' : 'RESISTANCE';
    const zoneMatch = nearbyZones.find((z) => z.type === targetType || z.type === 'LIQUIDITY');

    if (zoneMatch) {
      hasZoneMatch = true;
      confidence += 10;
      reasonLog.zoneHit = {
        type: zoneMatch.type,
        min: zoneMatch.priceMin,
        max: zoneMatch.priceMax,
        strength: zoneMatch.strength,
      };
    } else {
      // Fakeout Breakout Check
      if (recentCandles.length > 0) {
        fakeoutScore += 40;
        reasonLog.fakeBreakout = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + 'Price breakout without sustained support/resistance validation.';
      }
    }

    // G. Fundamental News Sentiment Override Filter
    if (fundamentalBias !== 'NEUTRAL') {
      reasonLog.fundamentalSentiment = fundamentalBias;
      reasonLog.fundamentalWarning = fundamentalWarning;
      
      if (direction === 'BUY' && fundamentalBias === 'BEARISH') {
        fakeoutScore += 50;
        reasonLog.fundamentalMismatch = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `BUY signal goes against bearish fundamental bias: "${fundamentalWarning}"`;
      } else if (direction === 'SELL' && fundamentalBias === 'BULLISH') {
        fakeoutScore += 50;
        reasonLog.fundamentalMismatch = true;
        reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `SELL signal goes against bullish fundamental bias: "${fundamentalWarning}"`;
      } else if (direction === fundamentalBias) {
        // News is in the same direction! Boost confidence score
        confidence += 15;
      }
    }

    confidence = Math.max(0, Math.min(95, Math.round(confidence - fakeoutScore * 0.35)));
    reasonLog.minimumConfidence = MIN_RECOMMENDATION_CONFIDENCE;
    reasonLog.adjustedConfidence = confidence;

    // Reject if RR < 2
    if (riskReward < 2.0) {
      reasonLog.lowRiskReward = true;
      reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `Risk Reward ${riskReward.toFixed(2)} is less than minimum 1:2.`;
      return this.rejectSignal(payload, fakeoutScore, confidence, reasonLog, stopLoss, takeProfit1, takeProfit2);
    }

    // Reject if Fakeout Score > 60
    if (fakeoutScore > 60) {
      reasonLog.highFakeoutRisk = true;
      reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `Fakeout risk score (${fakeoutScore}) exceeds threshold (60).`;
      return this.rejectSignal(payload, fakeoutScore, confidence, reasonLog, stopLoss, takeProfit1, takeProfit2);
    }

    // Reject if confidence is below recommendation threshold
    if (confidence < MIN_RECOMMENDATION_CONFIDENCE) {
      reasonLog.lowConfidence = true;
      reasonLog.details = (reasonLog.details ? reasonLog.details + ' ' : '') + `Confidence ${confidence}% is below the ${MIN_RECOMMENDATION_CONFIDENCE}% recommendation threshold.`;
      return this.rejectSignal(payload, fakeoutScore, confidence, reasonLog, stopLoss, takeProfit1, takeProfit2);
    }

    // Calculate entryZone
    let entryZone = '';
    if (zoneMatch) {
      entryZone = `$${zoneMatch.priceMin.toFixed(2)} - $${zoneMatch.priceMax.toFixed(2)}`;
    } else {
      const halfZoneWidth = atr14 * 0.25;
      entryZone = `$${(entry - halfZoneWidth).toFixed(2)} - $${(entry + halfZoneWidth).toFixed(2)}`;
    }

    // Determine riskLevel
    let riskLevel = 'Medium';
    if (confidence >= 80 && fakeoutScore <= 20) {
      riskLevel = 'Low';
    } else if (confidence < 70 || fakeoutScore > 50) {
      riskLevel = 'High';
    }

    // Determine marketCondition
    let marketCondition = 'Normal Volatility';
    if (reasonLog.sidewaysRange) {
      marketCondition = 'Sideways (Consolidation)';
    } else if (reasonLog.largeCandleRange) {
      marketCondition = 'High Volatility';
    } else if (rsi14 > 70) {
      marketCondition = 'Overbought Range';
    } else if (rsi14 < 30) {
      marketCondition = 'Oversold Range';
    } else if (hasTrendAlign) {
      marketCondition = direction === 'BUY' ? 'Bullish Trend' : 'Bearish Trend';
    }

    const bias = direction === 'BUY' ? 'Buy' : direction === 'SELL' ? 'Sell' : 'Wait';

    // All checks passed! Approve signal and create paper trade
    const signal = await prisma.signal.create({
      data: {
        symbol,
        timeframe,
        direction,
        entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        riskReward,
        confidence,
        status: 'pending',
        bias,
        entryZone,
        riskLevel,
        marketCondition,
        result: 'Pending',
        fakeoutScore,
        reason: JSON.stringify(reasonLog),
      },
    });

    // Create a saved plan. The user must explicitly approve it before live tracking.
    await PaperTradeService.openTrade({
      signalId: signal.id,
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
    });

    // Notify mobile of new signal
    const sideIcon = direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const msg = `📢 *สัญญาณใหม่ตรวจพบ (New Signal!)*\n\n*Symbol*: ${symbol} (${timeframe})\n*Position*: ${sideIcon}\n*Entry Target*: $${entry.toFixed(2)}\n*Stop Loss*: $${stopLoss.toFixed(2)}\n*Take Profit 1*: $${takeProfit1.toFixed(2)}\n*Take Profit 2*: $${takeProfit2.toFixed(2)}\n*Confidence*: ${confidence}%`;
    NotificationService.sendNotification(msg).catch(() => {});

    return {
      decision: 'PAPER_TRADE_CREATED',
      signalId: signal.id,
      direction,
      confidence,
      fakeoutScore,
      reason: reasonLog,
    };
  }

  private static async rejectSignal(
    payload: { symbol: string; timeframe: string; direction: 'BUY' | 'SELL'; price: number },
    fakeoutScore: number,
    confidence: number,
    reasonLog: Record<string, any>,
    stopLoss: number,
    takeProfit1: number,
    takeProfit2: number
  ): Promise<SignalEvaluationResult> {
    const dir = payload.direction;
    const entry = payload.price;

    const atr14 = reasonLog.atr14 || 3.0;
    const slRange = Math.abs(entry - stopLoss);
    const takeProfit3 = dir === 'BUY' ? entry + slRange * 6.0 : entry - slRange * 6.0;

    let entryZone = '';
    if (reasonLog.zoneHit) {
      entryZone = `$${reasonLog.zoneHit.min.toFixed(2)} - $${reasonLog.zoneHit.max.toFixed(2)}`;
    } else {
      const halfZoneWidth = atr14 * 0.25;
      entryZone = `$${(entry - halfZoneWidth).toFixed(2)} - $${(entry + halfZoneWidth).toFixed(2)}`;
    }

    let riskLevel = 'Medium';
    if (confidence >= 80 && fakeoutScore <= 20) {
      riskLevel = 'Low';
    } else if (confidence < 70 || fakeoutScore > 50) {
      riskLevel = 'High';
    }

    let marketCondition = 'Normal Volatility';
    if (reasonLog.sidewaysRange) {
      marketCondition = 'Sideways (Consolidation)';
    } else if (reasonLog.largeCandleRange) {
      marketCondition = 'High Volatility';
    } else if (reasonLog.rsi14 > 70) {
      marketCondition = 'Overbought Range';
    } else if (reasonLog.rsi14 < 30) {
      marketCondition = 'Oversold Range';
    } else if (reasonLog.trendAligned) {
      marketCondition = dir === 'BUY' ? 'Bullish Trend' : 'Bearish Trend';
    }

    const bias = 'Wait';

    const signal = await prisma.signal.create({
      data: {
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        direction: dir,
        entry: entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        riskReward: Math.abs(takeProfit1 - entry) / Math.abs(entry - stopLoss),
        confidence,
        status: 'cancelled',
        bias,
        entryZone,
        riskLevel,
        marketCondition,
        result: 'Pending',
        fakeoutScore,
        reason: JSON.stringify(reasonLog),
      },
    });

    return {
      decision: 'REJECTED',
      signalId: signal.id,
      direction: dir,
      confidence,
      fakeoutScore,
      reason: reasonLog,
    };
  }
}
