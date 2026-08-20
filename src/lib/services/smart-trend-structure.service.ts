export interface Candle {
  time: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TimeframeBiasResult {
  timeframe: 'M5' | 'M15' | 'H1';
  bias: 'BULLISH' | 'BEARISH' | 'RANGE';
  signal: 'BUY' | 'SELL' | 'WAIT';
  fastEMA: number;
  slowEMA: number;
  rsi: number;
}

export interface StructureEvent {
  type: 'BOS_UP' | 'BOS_DN' | 'CHoCH_UP' | 'CHoCH_DN';
  price: number;
  time: string | Date;
  tag: string;
}

export interface SRZoneLevel {
  timeframe: 'M5' | 'M15' | 'H1';
  type: 'SUPPORT' | 'RESISTANCE';
  price: number;
}

export interface SmartTrendStructureResult {
  overallSignal: 'BUY' | 'SELL' | 'WAIT';
  score: number; // -3 to +3
  biases: Record<'M5' | 'M15' | 'H1', TimeframeBiasResult>;
  supportLevels: SRZoneLevel[];
  resistanceLevels: SRZoneLevel[];
  lastStructureEvent: StructureEvent | null;
  entryTarget: number;
  stopLossTarget: number;
  takeProfitTarget: number;
  takeProfitTarget2?: number;
  confidence: number;
  reason: string;
}

export class SmartTrendStructureService {
  private static FAST_EMA_PERIOD = 20;
  private static SLOW_EMA_PERIOD = 50;
  private static RSI_PERIOD = 14;
  private static SWING_STRENGTH = 3;

  /**
   * Calculates Exponential Moving Average (EMA)
   */
  private static calcEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return Number(ema.toFixed(2));
  }

  /**
   * Calculates Relative Strength Index (RSI)
   */
  private static calcRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50.0;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100.0;
    const rs = avgGain / avgLoss;
    return Number((100 - 100 / (1 + rs)).toFixed(1));
  }

  /**
   * Computes Bias for a single timeframe based on EMA20/EMA50 + RSI50 threshold (MQL5 logic)
   */
  private static computeTimeframeBias(
    candles: Candle[],
    tf: 'M5' | 'M15' | 'H1'
  ): TimeframeBiasResult {
    if (candles.length < this.SLOW_EMA_PERIOD) {
      return {
        timeframe: tf,
        bias: 'RANGE',
        signal: 'WAIT',
        fastEMA: 0,
        slowEMA: 0,
        rsi: 50.0,
      };
    }

    const closes = candles.map((c) => c.close);
    const fastEMA = this.calcEMA(closes, this.FAST_EMA_PERIOD);
    const slowEMA = this.calcEMA(closes, this.SLOW_EMA_PERIOD);
    const rsi = this.calcRSI(closes, this.RSI_PERIOD);
    const recentRanges = candles.slice(-20).map((candle) => Math.max(0, candle.high - candle.low));
    const averageRange = recentRanges.reduce((sum, range) => sum + range, 0) / Math.max(1, recentRanges.length);
    const minimumTrendSeparation = Math.max(0.05, averageRange * 0.2);

    let bias: 'BULLISH' | 'BEARISH' | 'RANGE' = 'RANGE';
    let signal: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';

    // MQL5 logic: f[0] > s[0] && r[0] >= 50.0 -> BUY / BULLISH
    if (fastEMA - slowEMA >= minimumTrendSeparation && rsi >= 53.0) {
      bias = 'BULLISH';
      signal = 'BUY';
    } else if (slowEMA - fastEMA >= minimumTrendSeparation && rsi <= 47.0) {
      bias = 'BEARISH';
      signal = 'SELL';
    }

    return { timeframe: tf, bias, signal, fastEMA, slowEMA, rsi };
  }

  /**
   * Detect Swing High (High > 3 bars left & 3 bars right)
   */
  private static isSwingHigh(candles: Candle[], i: number): boolean {
    const s = this.SWING_STRENGTH;
    if (i < s || i >= candles.length - s) return false;
    const targetHigh = candles[i].high;
    for (let k = 1; k <= s; k++) {
      if (candles[i - k].high >= targetHigh || candles[i + k].high >= targetHigh) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detect Swing Low (Low < 3 bars left & 3 bars right)
   */
  private static isSwingLow(candles: Candle[], i: number): boolean {
    const s = this.SWING_STRENGTH;
    if (i < s || i >= candles.length - s) return false;
    const targetLow = candles[i].low;
    for (let k = 1; k <= s; k++) {
      if (candles[i - k].low <= targetLow || candles[i + k].low <= targetLow) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detects M5 Multiple Top Rejection (Double Top / Triple Top) or Bottom Rejection (Double Bottom)
   */
  private static detectM5Exhaustion(candles: Candle[], currentPrice: number) {
    if (candles.length < 15) {
      return { isTopExhaustion: false, isBottomExhaustion: false, peakPrice: 0, troughPrice: 0, tag: '' };
    }

    const recent = candles.slice(-20);
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = 2; i < recent.length - 2; i++) {
      if (recent[i].high >= recent[i - 1].high && recent[i].high >= recent[i - 2].high &&
          recent[i].high >= recent[i + 1].high && recent[i].high >= recent[i + 2].high) {
        swingHighs.push(recent[i].high);
      }
      if (recent[i].low <= recent[i - 1].low && recent[i].low <= recent[i - 2].low &&
          recent[i].low <= recent[i + 1].low && recent[i].low <= recent[i + 2].low) {
        swingLows.push(recent[i].low);
      }
    }

    let isTopExhaustion = false;
    let isBottomExhaustion = false;
    let peakPrice = 0;
    let troughPrice = 0;
    let tag = '';

    // Check Multiple Top Rejection near highs
    if (swingHighs.length >= 2) {
      const p1 = swingHighs[swingHighs.length - 2];
      const p2 = swingHighs[swingHighs.length - 1];
      if (Math.abs(p1 - p2) <= 1.80 && p2 >= currentPrice - 3.50) {
        isTopExhaustion = true;
        peakPrice = Math.max(p1, p2);
        tag = `[M5 Double/Triple Top Rejection] ขึ้นสูงติดจุดสูงสุด $${peakPrice.toFixed(2)} 2-3 ครั้งไม่ผ่าน เสี่ยงกลับตัวลงระยะสั้น-ยาว`;
      }
    }

    // Check Multiple Bottom Support near lows
    if (swingLows.length >= 2) {
      const b1 = swingLows[swingLows.length - 2];
      const b2 = swingLows[swingLows.length - 1];
      if (Math.abs(b1 - b2) <= 1.80 && b2 <= currentPrice + 3.50) {
        isBottomExhaustion = true;
        troughPrice = Math.min(b1, b2);
        tag = `[M5 Double/Triple Bottom Support] ลงต่ำติดจุดต่ำสุด $${troughPrice.toFixed(2)} 2-3 ครั้งไม่หลุด เสี่ยงดีดกลับขึ้นระยะสั้น-ยาว`;
      }
    }

    return { isTopExhaustion, isBottomExhaustion, peakPrice, troughPrice, tag };
  }

  /**
   * Main Analysis Engine combining MQL5 SmartTrendStructure logic with AI Scalping
   */
  public static analyze(data: {
    currentPrice: number;
    m5Candles: Candle[];
    m15Candles: Candle[];
    h1Candles: Candle[];
  }): SmartTrendStructureResult {
    const { currentPrice, m5Candles, m15Candles, h1Candles } = data;

    // Chronological order (oldest to newest)
    const m5 = [...m5Candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const m15 = [...m15Candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const h1 = [...h1Candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const m5Bias = this.computeTimeframeBias(m5, 'M5');
    const m15Bias = this.computeTimeframeBias(m15, 'M15');
    const h1Bias = this.computeTimeframeBias(h1, 'H1');

    // Detect M5 Top & Bottom Exhaustion Patterns
    const exhaustion = this.detectM5Exhaustion(m5, currentPrice);

    // Strict Multi-Timeframe Score & H1 Alignment Filter (Anti-Counter-Trend & Choppy Market Filter)
    let score = 0;
    if (m5Bias.signal === 'BUY') score++;
    else if (m5Bias.signal === 'SELL') score--;

    if (m15Bias.signal === 'BUY') score++;
    else if (m15Bias.signal === 'SELL') score--;

    if (h1Bias.signal === 'BUY') score += 2; // Extra weight on H1 trend
    else if (h1Bias.signal === 'SELL') score -= 2;

    let overallSignal: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    
    // Enforce 100% Anti-Counter-Trend: Never BUY in H1 BEARISH, Never SELL in H1 BULLISH
    if (score >= 2 && h1Bias.bias !== 'BEARISH') {
      overallSignal = 'BUY';
    } else if (score <= -2 && h1Bias.bias !== 'BULLISH') {
      overallSignal = 'SELL';
    }

    // Exhaustion recognition:
    // If higher timeframe trend aligns, use exhaustion bounce to trigger dip-buy or rally-sell.
    // If counter-trend, use exhaustion to veto/wait rather than entering into danger.
    if (exhaustion.isTopExhaustion) {
      if (overallSignal === 'BUY') {
        overallSignal = 'WAIT';
      } else if (overallSignal === 'WAIT' && h1Bias.bias === 'BEARISH') {
        overallSignal = 'SELL';
      }
    } else if (exhaustion.isBottomExhaustion) {
      if (overallSignal === 'SELL') {
        overallSignal = 'WAIT';
      } else if (overallSignal === 'WAIT' && h1Bias.bias === 'BULLISH') {
        overallSignal = 'BUY';
      }
    }

    // Extract Support / Resistance Swing Levels for M5, M15, H1
    const supportLevels: SRZoneLevel[] = [];
    const resistanceLevels: SRZoneLevel[] = [];

    const processSR = (candles: Candle[], tf: 'M5' | 'M15' | 'H1') => {
      let resCount = 0;
      let supCount = 0;
      for (let i = candles.length - this.SWING_STRENGTH - 1; i >= this.SWING_STRENGTH; i--) {
        if (resCount < 2 && this.isSwingHigh(candles, i)) {
          resistanceLevels.push({ timeframe: tf, type: 'RESISTANCE', price: Number(candles[i].high.toFixed(2)) });
          resCount++;
        }
        if (supCount < 2 && this.isSwingLow(candles, i)) {
          supportLevels.push({ timeframe: tf, type: 'SUPPORT', price: Number(candles[i].low.toFixed(2)) });
          supCount++;
        }
        if (resCount >= 2 && supCount >= 2) break;
      }
    };

    processSR(m5, 'M5');
    processSR(m15, 'M15');
    processSR(h1, 'H1');

    // Compute BOS / CHoCH structural markers from M15 series
    let lastStructureEvent: StructureEvent | null = null;
    let swingHigh = 0;
    let swingLow = 0;
    let marketTrend = 0;

    for (let i = this.SWING_STRENGTH; i < m15.length - this.SWING_STRENGTH; i++) {
      if (this.isSwingHigh(m15, i)) swingHigh = m15[i].high;
      if (this.isSwingLow(m15, i)) swingLow = m15[i].low;

      if (swingHigh > 0 && m15[i].close > swingHigh) {
        const isCHoCH = marketTrend < 0;
        lastStructureEvent = {
          type: isCHoCH ? 'CHoCH_UP' : 'BOS_UP',
          price: Number(swingHigh.toFixed(2)),
          time: m15[i].time,
          tag: isCHoCH ? 'CHoCH UP (กลับตัวเป็นขึ้น)' : 'BOS UP (เบรคทะลุไฮยึดเทรนด์ขึ้น)',
        };
        marketTrend = 1;
        swingHigh = 0;
      }

      if (swingLow > 0 && m15[i].close < swingLow) {
        const isCHoCH = marketTrend > 0;
        lastStructureEvent = {
          type: isCHoCH ? 'CHoCH_DN' : 'BOS_DN',
          price: Number(swingLow.toFixed(2)),
          time: m15[i].time,
          tag: isCHoCH ? 'CHoCH DN (กลับตัวเป็นลง)' : 'BOS DN (เบรคหลุดโลว์ยึดเทรนด์ลง)',
        };
        marketTrend = -1;
        swingLow = 0;
      }
    }

    // Determine Entry, Stop Loss, and Take Profit based on SmartTrendStructure
    const validSupports = supportLevels.filter((s) => s.price < currentPrice).map((s) => s.price);
    const validResistances = resistanceLevels.filter((r) => r.price > currentPrice).map((r) => r.price);

    const nearestSup = validSupports.length > 0 ? Math.max(...validSupports) : currentPrice - 3.5;
    const nearestRes = validResistances.length > 0 ? Math.min(...validResistances) : currentPrice + 3.5;

    // Calculate ATR for dynamic SL buffer
    let atr = 3.5;
    if (m15.length >= 14) {
      const trs = m15.slice(-14).map((c) => c.high - c.low);
      atr = trs.reduce((a, b) => a + b, 0) / 14;
    }

    // SAFE RISK/REWARD GUARD for High Win-Rate ($10 - $20 Targets)
    // Dynamic SL placed safely beyond structure ($5.00 - $6.50)
    // TP1 ($10.00 - $12.00 / 100-120 pips) for fast profit lock
    // TP2 ($18.00 - $22.00 / 180-220 pips) for trend runner
    const slBuffer = Math.max(5.00, Math.min(6.50, atr * 1.4));
    const tpDistance = Math.max(10.00, Math.min(12.00, slBuffer * 2.0)); // TP1 ($10 - $12)
    const tp2Distance = Math.max(18.00, Math.min(22.00, slBuffer * 3.5)); // TP2 ($18 - $22)

    let entryTarget = currentPrice;
    let stopLossTarget = currentPrice;
    let takeProfitTarget = currentPrice;
    let takeProfitTarget2 = currentPrice;

    if (overallSignal === 'SELL' && exhaustion.isTopExhaustion) {
      // Entry near peak resistance with safe SL above peak
      entryTarget = Number((currentPrice + 0.50).toFixed(2));
      stopLossTarget = Number((Math.max(exhaustion.peakPrice + 1.50, entryTarget + slBuffer)).toFixed(2));
      takeProfitTarget = Number((entryTarget - tpDistance).toFixed(2));
      takeProfitTarget2 = Number((entryTarget - tp2Distance).toFixed(2));
    } else if (overallSignal === 'BUY' && exhaustion.isBottomExhaustion) {
      // Entry near trough support with safe SL below trough
      entryTarget = Number((currentPrice - 0.50).toFixed(2));
      stopLossTarget = Number((Math.min(exhaustion.troughPrice - 1.50, entryTarget - slBuffer)).toFixed(2));
      takeProfitTarget = Number((entryTarget + tpDistance).toFixed(2));
      takeProfitTarget2 = Number((entryTarget + tp2Distance).toFixed(2));
    } else if (overallSignal === 'BUY') {
      // Entry at nearest support or conservative limit zone
      entryTarget = nearestSup > currentPrice - 2.50 ? Number((currentPrice - 1.50).toFixed(2)) : nearestSup;
      stopLossTarget = Number((entryTarget - slBuffer).toFixed(2));
      takeProfitTarget = Number((entryTarget + tpDistance).toFixed(2));
      takeProfitTarget2 = Number((entryTarget + tp2Distance).toFixed(2));
    } else if (overallSignal === 'SELL') {
      // Entry at nearest resistance or conservative limit zone
      entryTarget = nearestRes < currentPrice + 2.50 ? Number((currentPrice + 1.50).toFixed(2)) : nearestRes;
      stopLossTarget = Number((entryTarget + slBuffer).toFixed(2));
      takeProfitTarget = Number((entryTarget - tpDistance).toFixed(2));
      takeProfitTarget2 = Number((entryTarget - tp2Distance).toFixed(2));
    } else {
      // WAIT is a real no-trade state. Neutral levels prevent downstream code
      // from accidentally turning an undecided market into a BUY plan.
      entryTarget = Number(currentPrice.toFixed(2));
      stopLossTarget = Number(currentPrice.toFixed(2));
      takeProfitTarget = Number(currentPrice.toFixed(2));
      takeProfitTarget2 = Number(currentPrice.toFixed(2));
    }

    const alignedTimeframes = [m5Bias, m15Bias, h1Bias].filter((bias) => bias.signal === overallSignal).length;
    const confidence = overallSignal === 'WAIT'
      ? 0
      : Math.min(85, 55 + Math.abs(score) * 6 + alignedTimeframes * 2);
    const structureTag = exhaustion.tag || lastStructureEvent?.tag || 'กำลังสะสมพลัง';
    const reason = `[SmartTrendStructure Safe Scalp]: M5: ${m5Bias.bias} (${m5Bias.rsi} RSI) | M15: ${m15Bias.bias} (${m15Bias.rsi} RSI) | H1: ${h1Bias.bias} (${h1Bias.rsi} RSI) | โครงสร้าง: ${structureTag} | TP1: $${takeProfitTarget.toFixed(2)} ($${tpDistance.toFixed(2)}) | SL: $${stopLossTarget.toFixed(2)} ($${slBuffer.toFixed(2)})`;

    return {
      overallSignal,
      score,
      biases: { M5: m5Bias, M15: m15Bias, H1: h1Bias },
      supportLevels,
      resistanceLevels,
      lastStructureEvent,
      entryTarget,
      stopLossTarget,
      takeProfitTarget,
      takeProfitTarget2,
      confidence,
      reason,
    };
  }
}
