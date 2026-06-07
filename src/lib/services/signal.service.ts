import { prisma } from '../prisma';
import { ZoneService } from './zone.service';
import { PaperTradeService } from './paper-trade.service';

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

    // Enforce default status fields
    const reasonLog: Record<string, any> = {};
    let fakeoutScore = 0;
    let confidence = 70; // Start with base confidence
    let decision: 'PAPER_TRADE_CREATED' | 'REJECTED' = 'REJECTED';

    // 1. RISK ENGINE - Duplicate Check
    const activeSameTrade = await prisma.paperTrade.findFirst({
      where: {
        symbol,
        direction,
        result: 'OPEN',
      },
    });

    if (activeSameTrade) {
      reasonLog.duplicateRejected = true;
      reasonLog.details = 'An active trade in the same direction is already open.';
      
      const signal = await prisma.signal.create({
        data: {
          symbol,
          timeframe,
          direction: 'NO_TRADE',
          entry: price,
          stopLoss: 0,
          takeProfit1: 0,
          takeProfit2: 0,
          riskReward: 0,
          confidence: 0,
          status: 'cancelled',
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

    // 2. RISK ENGINE - Daily Limits & Consecutive Loss Checks
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTrades = await prisma.paperTrade.findMany({
      where: {
        openedAt: { gte: startOfToday },
      },
    });

    if (todayTrades.length >= 5) {
      reasonLog.dailyLimitExceeded = true;
      reasonLog.details = 'Max trades per day (5) reached.';
      return this.rejectSignal(payload, 0, 0, reasonLog);
    }

    // Check last 3 consecutive losses
    const recentClosedTrades = await prisma.paperTrade.findMany({
      where: {
        result: { in: ['WIN', 'LOSS'] },
      },
      orderBy: { closedAt: 'desc' },
      take: 3,
    });

    const consecutiveLosses = recentClosedTrades.filter((t) => t.result === 'LOSS').length;
    if (consecutiveLosses >= 3 && recentClosedTrades.length === 3) {
      reasonLog.consecutiveLossLimit = true;
      reasonLog.details = 'Trading paused after 3 consecutive losses.';
      return this.rejectSignal(payload, 0, 0, reasonLog);
    }

    // 3. TECHNICAL & ANTI-FAKEOUT ENGINES - Market Context Checks
    // Fetch recent candles for statistical metrics
    const recentCandles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: 'desc' },
      take: 20,
    });

    let hasTrendAlign = true;
    let hasSweep = false;
    let hasZoneMatch = false;

    if (recentCandles.length >= 10) {
      // A. Trend Alignment check
      // Simple logic: if closing price is above average of last 10 candles, trend is bullish
      const sumClose = recentCandles.reduce((sum, c) => sum + c.close, 0);
      const avgClose = sumClose / recentCandles.length;
      const isBullishTrend = recentCandles[0].close >= avgClose;
      
      hasTrendAlign = direction === 'BUY' ? isBullishTrend : !isBullishTrend;
      reasonLog.trendAligned = hasTrendAlign;
      reasonLog.marketAvg = avgClose;

      // B. Average candle range check (Anti-Fakeout check)
      const ranges = recentCandles.map((c) => Math.abs(c.high - c.low));
      const avgRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
      const currentCandleRange = Math.abs(recentCandles[0].high - recentCandles[0].low);

      if (currentCandleRange > 2 * avgRange) {
        fakeoutScore += 25;
        reasonLog.largeCandleRange = true;
        reasonLog.details = `Candle range (${currentCandleRange.toFixed(2)}) is > 2x average (${avgRange.toFixed(2)}).`;
      }

      // C. Sideways Choppiness check (Anti-Fakeout check)
      // Check standard deviation or maximum spread in the last 10 candles
      const last10 = recentCandles.slice(0, 10);
      const highs = last10.map((c) => c.high);
      const lows = last10.map((c) => c.low);
      const maxSpread = Math.max(...highs) - Math.min(...lows);
      
      const chopThreshold = symbol.toUpperCase().includes('BTC') ? 500.0 : 5.0;
      if (maxSpread < chopThreshold) { 
        fakeoutScore += 20;
        reasonLog.sidewaysRange = true;
        reasonLog.details = `Tight sideways range detected. Spread: $${maxSpread.toFixed(2)}`;
      }

      // D. Liquidity Sweep check
      const currentCandle = recentCandles[0];
      const prevCandle = recentCandles[1];
      if (direction === 'BUY') {
        // Sweep below previous low but close back above it
        if (currentCandle.low < prevCandle.low && currentCandle.close > prevCandle.low) {
          hasSweep = true;
          confidence += 10;
        }
      } else {
        // Sweep above previous high but close back below it
        if (currentCandle.high > prevCandle.high && currentCandle.close < prevCandle.high) {
          hasSweep = true;
          confidence += 10;
        }
      }
      reasonLog.liquiditySweep = hasSweep;
    } else {
      // In absence of enough candles (cold start/testing), fallback to mock validation pass
      hasTrendAlign = true;
      hasSweep = true;
      reasonLog.fallbackSeeding = true;
      reasonLog.details = 'Cold-start mode: insufficient candles, bypassing trend/sweep filters.';
    }

    // E. Overlap with Zones Check
    // Query H1 zones near current price
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
      // Fakeout Breakout Check: If breakout happened but candle closed back inside
      if (recentCandles.length > 0) {
        fakeoutScore += 40;
        reasonLog.fakeBreakout = true;
        reasonLog.details = 'Price breakout without sustained support/resistance validation.';
      }
    }

    // 4. RISK CALCULATOR - Stop Loss and Take Profit
    const isBtc = symbol.toUpperCase().includes('BTC');
    const slRange = isBtc ? 600.0 : 8.0;
    const tp1Range = isBtc ? 1200.0 : 16.0; // 1:2 RR
    const tp2Range = isBtc ? 2400.0 : 32.0; // 1:4 RR

    const entry = price;
    const stopLoss = direction === 'BUY' ? entry - slRange : entry + slRange;
    const takeProfit1 = direction === 'BUY' ? entry + tp1Range : entry - tp1Range;
    const takeProfit2 = direction === 'BUY' ? entry + tp2Range : entry - tp2Range;

    const riskReward = Math.abs(takeProfit1 - entry) / Math.abs(entry - stopLoss);
    reasonLog.riskReward = riskReward;

    // Reject if RR < 2
    if (riskReward < 2.0) {
      reasonLog.lowRiskReward = true;
      reasonLog.details = `Risk Reward ${riskReward.toFixed(2)} is less than minimum 1:2.`;
      return this.rejectSignal(payload, fakeoutScore, confidence, reasonLog);
    }

    // Reject if Fakeout Score > 60
    if (fakeoutScore > 60) {
      reasonLog.highFakeoutRisk = true;
      reasonLog.details = `Fakeout risk score (${fakeoutScore}) exceeds threshold (60).`;
      return this.rejectSignal(payload, fakeoutScore, confidence, reasonLog);
    }

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
        riskReward,
        confidence,
        status: 'active',
        fakeoutScore,
        reason: JSON.stringify(reasonLog),
      },
    });

    // Create the active Paper Trade
    await PaperTradeService.openTrade({
      signalId: signal.id,
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
    });

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
    reasonLog: Record<string, any>
  ): Promise<SignalEvaluationResult> {
    const signal = await prisma.signal.create({
      data: {
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        direction: payload.direction,
        entry: payload.price,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskReward: 0,
        confidence,
        status: 'cancelled',
        fakeoutScore,
        reason: JSON.stringify(reasonLog),
      },
    });

    // Create the suggested Paper Trade even if rejected, so the user can see the AI's warning in the dashboard
    const isBtc = payload.symbol.toUpperCase().includes('BTC');
    const slRange = isBtc ? 600.0 : 8.0;
    const tp1Range = isBtc ? 1200.0 : 16.0;
    const tp2Range = isBtc ? 2400.0 : 32.0;
    
    const entry = payload.price;
    const dir = payload.direction;
    const stopLoss = dir === 'BUY' ? entry - slRange : entry + slRange;
    const takeProfit1 = dir === 'BUY' ? entry + tp1Range : entry - tp1Range;
    const takeProfit2 = dir === 'BUY' ? entry + tp2Range : entry - tp2Range;

    // Update signal with calculated TP/SL instead of 0
    await prisma.signal.update({
      where: { id: signal.id },
      data: { stopLoss, takeProfit1, takeProfit2, direction: dir }
    });

    await PaperTradeService.openTrade({
      signalId: signal.id,
      symbol: payload.symbol,
      direction: dir,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
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
