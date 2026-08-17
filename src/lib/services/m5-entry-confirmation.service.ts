import { hasValidTradeGeometry, type TradeDirection } from './trade-safety.service.ts';

export type EntryCandle = {
  time: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type EntryZone = {
  type: string;
  priceMin: number;
  priceMax: number;
  timeframe?: string;
  strength?: number;
};

export type M5EntryConfirmation = {
  direction: TradeDirection | 'WAIT';
  reason: string;
  confirmationTime: string | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  structureBreak: number | null;
  zone: EntryZone | null;
  gates: {
    closedCandle: boolean;
    zoneTouched: boolean;
    priorOppositeCandle: boolean;
    liftedFromZone: boolean;
    choch: boolean;
    notChasing: boolean;
  };
};

const M5_MS = 5 * 60 * 1000;
const round = (value: number) => Number(value.toFixed(2));

const trueRangeAverage = (candles: EntryCandle[], period = 14) => {
  const sample = candles.slice(Math.max(1, candles.length - period));
  if (sample.length === 0) return 1;
  const sum = sample.reduce((total, candle, index) => {
    const previous = candles[Math.max(0, candles.length - sample.length + index - 1)];
    return total + Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previous.close),
      Math.abs(candle.low - previous.close),
    );
  }, 0);
  return Math.max(0.01, sum / sample.length);
};

const waitResult = (reason: string, gates?: Partial<M5EntryConfirmation['gates']>): M5EntryConfirmation => ({
  direction: 'WAIT',
  reason,
  confirmationTime: null,
  entry: null,
  stopLoss: null,
  takeProfit: null,
  riskReward: null,
  structureBreak: null,
  zone: null,
  gates: {
    closedCandle: false,
    zoneTouched: false,
    priorOppositeCandle: false,
    liftedFromZone: false,
    choch: false,
    notChasing: false,
    ...gates,
  },
});

const findRecentOpposite = (candles: EntryCandle[], direction: TradeDirection) => {
  for (let index = candles.length - 2; index >= Math.max(0, candles.length - 7); index--) {
    const candle = candles[index];
    if (direction === 'BUY' ? candle.close < candle.open : candle.close > candle.open) return candle;
  }
  return null;
};

const deriveStructureZone = (history: EntryCandle[], direction: TradeDirection, atr: number): EntryZone | null => {
  const sample = history.slice(-24);
  if (sample.length < 8) return null;
  if (direction === 'BUY') {
    const priceMin = Math.min(...sample.map((candle) => candle.low));
    const priceMax = priceMin + atr * 0.4;
    const touches = sample.filter((candle) => candle.low <= priceMax).length;
    return touches >= 2 ? { type: 'SUPPORT', timeframe: 'M5', priceMin, priceMax, strength: Math.min(5, touches) } : null;
  }
  const priceMax = Math.max(...sample.map((candle) => candle.high));
  const priceMin = priceMax - atr * 0.4;
  const touches = sample.filter((candle) => candle.high >= priceMin).length;
  return touches >= 2 ? { type: 'RESISTANCE', timeframe: 'M5', priceMin, priceMax, strength: Math.min(5, touches) } : null;
};

const selectZone = (
  zones: EntryZone[],
  history: EntryCandle[],
  direction: TradeDirection,
  atr: number,
) => {
  const recent = history.slice(-7);
  const tolerance = atr * 0.2;
  const expectedType = direction === 'BUY' ? 'SUPPORT' : 'RESISTANCE';
  const matching = zones
    .filter((zone) => zone.type === expectedType && Number.isFinite(zone.priceMin) && Number.isFinite(zone.priceMax))
    .filter((zone) => recent.some((candle) => candle.low <= zone.priceMax + tolerance && candle.high >= zone.priceMin - tolerance))
    .sort((a, b) => (b.strength || 0) - (a.strength || 0));
  return matching[0] || deriveStructureZone(history, direction, atr);
};

const evaluateDirection = (
  candles: EntryCandle[],
  zones: EntryZone[],
  currentPrice: number,
  direction: TradeDirection,
): M5EntryConfirmation => {
  const confirmation = candles.at(-1)!;
  const history = candles.slice(0, -1);
  const atr = trueRangeAverage(candles);
  const zone = selectZone(zones, history, direction, atr);
  const opposite = findRecentOpposite(candles, direction);
  const recentTouchCandles = candles.slice(-7);
  const tolerance = atr * 0.2;
  const zoneTouched = Boolean(zone && recentTouchCandles.some((candle) =>
    candle.low <= zone.priceMax + tolerance && candle.high >= zone.priceMin - tolerance,
  ));
  const range = Math.max(0.01, confirmation.high - confirmation.low);
  const body = Math.abs(confirmation.close - confirmation.open);
  const closesInDirection = direction === 'BUY'
    ? confirmation.close > confirmation.open && confirmation.close >= confirmation.low + range * 0.62
    : confirmation.close < confirmation.open && confirmation.close <= confirmation.high - range * 0.62;
  const clearsOpposite = Boolean(opposite && (direction === 'BUY'
    ? confirmation.close > opposite.high
    : confirmation.close < opposite.low));
  const liftedFromZone = closesInDirection && clearsOpposite && body >= atr * 0.12;

  const structureSample = history.slice(-12, -1);
  const structureBreak = structureSample.length > 0
    ? direction === 'BUY'
      ? Math.max(...structureSample.map((candle) => candle.high))
      : Math.min(...structureSample.map((candle) => candle.low))
    : opposite
      ? direction === 'BUY' ? opposite.high : opposite.low
      : null;
  const choch = structureBreak !== null && (direction === 'BUY'
    ? confirmation.close > structureBreak
    : confirmation.close < structureBreak);
  const notChasing = direction === 'BUY'
    ? currentPrice <= confirmation.close + atr * 0.35
    : currentPrice >= confirmation.close - atr * 0.35;
  const gates = {
    closedCandle: true,
    zoneTouched,
    priorOppositeCandle: Boolean(opposite),
    liftedFromZone,
    choch,
    notChasing,
  };
  if (!Object.values(gates).every(Boolean) || !zone) {
    return {
      ...waitResult('รอให้ M5 ปิดยืนยันครบ: แตะโซนจริง, ปิดพ้นแท่งฝั่งตรงข้าม, เกิด CHOCH และราคาไม่วิ่งหนีจุดเข้า', gates),
      structureBreak: structureBreak === null ? null : round(structureBreak),
      zone,
    };
  }

  const entry = confirmation.close;
  const buffer = Math.max(0.35, atr * 0.18);
  const stopLoss = direction === 'BUY'
    ? Math.min(zone.priceMin, ...recentTouchCandles.map((candle) => candle.low)) - buffer
    : Math.max(zone.priceMax, ...recentTouchCandles.map((candle) => candle.high)) + buffer;
  const risk = Math.abs(entry - stopLoss);
  const takeProfit = direction === 'BUY' ? entry + risk * 2 : entry - risk * 2;
  const rounded = {
    direction,
    entry: round(entry),
    stopLoss: round(stopLoss),
    takeProfit: round(takeProfit),
  };
  if (!hasValidTradeGeometry(rounded)) return waitResult('โครงสร้างราคา Entry/SL/TP ไม่ถูกต้อง จึงไม่ออกสัญญาณ', gates);

  return {
    direction,
    reason: direction === 'BUY'
      ? `M5 แตะแนวรับ แล้วยกตัวปิดเหนือแท่งขายก่อนหน้าและ CHOCH UP เหนือ ${round(structureBreak!).toFixed(2)}`
      : `M5 แตะแนวต้าน แล้วกดตัวปิดต่ำกว่าแท่งซื้อก่อนหน้าและ CHOCH DOWN ใต้ ${round(structureBreak!).toFixed(2)}`,
    confirmationTime: new Date(confirmation.time).toISOString(),
    entry: rounded.entry,
    stopLoss: rounded.stopLoss,
    takeProfit: rounded.takeProfit,
    riskReward: 2,
    structureBreak: round(structureBreak!),
    zone,
    gates,
  };
};

export class M5EntryConfirmationService {
  static analyze(input: { candles: EntryCandle[]; zones?: EntryZone[]; currentPrice: number; now?: Date }) {
    const now = input.now || new Date();
    const candles = [...input.candles]
      .filter((candle) => {
        const time = new Date(candle.time).getTime();
        return Number.isFinite(time) && time + M5_MS <= now.getTime() &&
          [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
          candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close);
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    if (candles.length < 25) return waitResult('ข้อมูลแท่ง M5 ที่ปิดแล้วไม่พอ ต้องมีอย่างน้อย 25 แท่ง');

    const buy = evaluateDirection(candles, input.zones || [], input.currentPrice, 'BUY');
    if (buy.direction === 'BUY') return buy;
    const sell = evaluateDirection(candles, input.zones || [], input.currentPrice, 'SELL');
    if (sell.direction === 'SELL') return sell;
    return buy.gates.choch || buy.gates.zoneTouched ? buy : sell;
  }
}
