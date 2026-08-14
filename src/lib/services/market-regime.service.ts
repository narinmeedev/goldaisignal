export type RegimeCandle = {
  time: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketRegime =
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'RANGE'
  | 'TRANSITION'
  | 'HIGH_VOLATILITY'
  | 'DATA_UNRELIABLE';

export type MarketRegimeAssessment = {
  regime: MarketRegime;
  tradable: boolean;
  confidenceCap: number;
  reasons: string[];
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const ema = (values: number[], period: number) => {
  if (values.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  return values.slice(1).reduce(
    (current, value) => value * multiplier + current * (1 - multiplier),
    values[0],
  );
};

export class MarketRegimeService {
  static assess(candleInput: RegimeCandle[], timeframeMinutes = 5): MarketRegimeAssessment {
    const candles = [...candleInput]
      .filter((candle) => Number.isFinite(new Date(candle.time).getTime()))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const reasons: string[] = [];

    if (candles.length < 50) {
      return {
        regime: 'DATA_UNRELIABLE',
        tradable: false,
        confidenceCap: 0,
        reasons: [`มีแท่งเพียง ${candles.length} แท่ง ต้องมีอย่างน้อย 50 แท่ง`],
      };
    }

    const invalidOhlc = candles.some((candle) =>
      ![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) ||
      candle.high < candle.low ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close),
    );
    const expectedGapMs = timeframeMinutes * 60 * 1000;
    let suspiciousGapCount = 0;
    let duplicateCount = 0;
    for (let index = 1; index < candles.length; index++) {
      const gap = new Date(candles[index].time).getTime() - new Date(candles[index - 1].time).getTime();
      if (gap === 0) duplicateCount++;
      if (gap > expectedGapMs * 3 && gap < 36 * 60 * 60 * 1000) suspiciousGapCount++;
    }

    if (invalidOhlc || duplicateCount > 0 || suspiciousGapCount > 2) {
      if (invalidOhlc) reasons.push('พบ OHLC ที่ขัดกัน');
      if (duplicateCount > 0) reasons.push(`พบ timestamp ซ้ำ ${duplicateCount} จุด`);
      if (suspiciousGapCount > 2) reasons.push(`พบช่องว่างข้อมูล ${suspiciousGapCount} ช่วง`);
      return { regime: 'DATA_UNRELIABLE', tradable: false, confidenceCap: 0, reasons };
    }

    const recent = candles.slice(-50);
    const ranges = recent.map((candle) => candle.high - candle.low);
    const medianRange = median(ranges.slice(0, -1));
    const latestRange = ranges.at(-1) || 0;
    const extremeBars = medianRange > 0
      ? ranges.filter((range) => range > medianRange * 4).length
      : 0;
    if (medianRange <= 0 || latestRange > medianRange * 4 || extremeBars >= 2) {
      return {
        regime: 'HIGH_VOLATILITY',
        tradable: false,
        confidenceCap: 20,
        reasons: ['ช่วงราคาขยายผิดปกติเมื่อเทียบกับค่ากลางล่าสุด ให้รอข้อมูลนิ่งก่อน'],
      };
    }

    const closes = recent.map((candle) => candle.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const normalizedSeparation = Math.abs(ema20 - ema50) / Math.max(medianRange, 0.01);
    const slope = closes.at(-1)! - closes[Math.max(0, closes.length - 6)];
    const slopeThreshold = medianRange * 0.75;

    if (normalizedSeparation >= 0.8 && slope > slopeThreshold && ema20 > ema50) {
      return { regime: 'TREND_UP', tradable: true, confidenceCap: 80, reasons: ['EMA20 อยู่เหนือ EMA50 และมี slope ขาขึ้น'] };
    }
    if (normalizedSeparation >= 0.8 && slope < -slopeThreshold && ema20 < ema50) {
      return { regime: 'TREND_DOWN', tradable: true, confidenceCap: 80, reasons: ['EMA20 อยู่ใต้ EMA50 และมี slope ขาลง'] };
    }
    if (normalizedSeparation <= 0.45 && Math.abs(slope) <= slopeThreshold) {
      return { regime: 'RANGE', tradable: true, confidenceCap: 68, reasons: ['EMA บีบตัวและราคาไม่มี slope ชัดเจน'] };
    }

    return {
      regime: 'TRANSITION',
      tradable: false,
      confidenceCap: 35,
      reasons: ['โครงสร้างอยู่ระหว่างเปลี่ยน regime และยังไม่มี edge ชัดเจน'],
    };
  }

  static strategyAllowed(regime: MarketRegime, strategyId?: string) {
    if (!strategyId) return false;
    if (regime === 'TREND_UP') {
      return strategyId === 'follow_trend_ema20_pullback' || strategyId === 'support_m5_bullish_engulfing';
    }
    if (regime === 'TREND_DOWN') {
      return strategyId === 'follow_trend_ema20_pullback' || strategyId === 'resistance_m5_bearish_engulfing';
    }
    if (regime === 'RANGE') {
      return ['support_m5_bullish_engulfing', 'resistance_m5_bearish_engulfing', 'scalp_m5_zone_reversal'].includes(strategyId);
    }
    return false;
  }
}
