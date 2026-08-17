import assert from 'node:assert/strict';
import { MarketRegimeService } from '../src/lib/services/market-regime.service.ts';
import { SmartTrendStructureService } from '../src/lib/services/smart-trend-structure.service.ts';
import { M5EntryConfirmationService } from '../src/lib/services/m5-entry-confirmation.service.ts';
import { hasValidTradeGeometry } from '../src/lib/services/trade-safety.service.ts';

const candles = (direction, count = 80) =>
  Array.from({ length: count }, (_, index) => {
    const drift = direction === 'UP' ? index * 0.55 : direction === 'DOWN' ? -index * 0.55 : Math.sin(index / 3) * 0.25;
    const open = 4300 + drift;
    const close = open + (direction === 'UP' ? 0.2 : direction === 'DOWN' ? -0.2 : Math.sin(index) * 0.05);
    return {
      time: new Date(Date.UTC(2026, 7, 10, 0, index * 5)),
      open,
      high: Math.max(open, close) + 0.35,
      low: Math.min(open, close) - 0.35,
      close,
      volume: 100,
    };
  });

const flat = candles('FLAT');
const waitResult = SmartTrendStructureService.analyze({
  currentPrice: flat.at(-1).close,
  m5Candles: flat,
  m15Candles: flat,
  h1Candles: flat,
});
assert.equal(waitResult.overallSignal, 'WAIT');
assert.equal(waitResult.confidence, 0);
assert.equal(waitResult.entryTarget, waitResult.stopLossTarget);
assert.equal(waitResult.entryTarget, waitResult.takeProfitTarget);

const up = candles('UP');
const trendResult = SmartTrendStructureService.analyze({
  currentPrice: up.at(-1).close,
  m5Candles: up,
  m15Candles: up,
  h1Candles: up,
});
assert.equal(trendResult.overallSignal, 'BUY');
assert.ok(trendResult.confidence <= 85);

const down = candles('DOWN');
const downResult = SmartTrendStructureService.analyze({
  currentPrice: down.at(-1).close,
  m5Candles: down,
  m15Candles: down,
  h1Candles: down,
});
assert.equal(downResult.overallSignal, 'SELL');

const rangeRegime = MarketRegimeService.assess(flat);
assert.equal(rangeRegime.regime, 'RANGE');
assert.equal(MarketRegimeService.strategyAllowed('RANGE', 'follow_trend_ema20_pullback'), false);

const broken = [...up];
broken[20] = { ...broken[20], high: broken[20].low - 1 };
assert.equal(MarketRegimeService.assess(broken).regime, 'DATA_UNRELIABLE');

const spiking = [...flat];
spiking[spiking.length - 1] = {
  ...spiking.at(-1),
  high: spiking.at(-1).high + 10,
};
assert.equal(MarketRegimeService.assess(spiking).regime, 'HIGH_VOLATILITY');

const setupStart = Date.UTC(2026, 7, 17, 10, 0);
const supportSetup = Array.from({ length: 25 }, (_, index) => {
  const open = 101.6 + Math.sin(index / 3) * 0.35;
  const close = open + (index % 2 ? -0.12 : 0.1);
  return { time: new Date(setupStart + index * 5 * 60_000), open, high: Math.max(open, close) + 0.25, low: Math.min(open, close) - 0.25, close };
});
supportSetup.push(
  { time: new Date(setupStart + 25 * 5 * 60_000), open: 101.2, high: 101.35, low: 99.9, close: 100.2 },
  { time: new Date(setupStart + 26 * 5 * 60_000), open: 100.25, high: 102.8, low: 100.1, close: 102.6 },
);
const confirmedBuy = M5EntryConfirmationService.analyze({
  candles: supportSetup,
  zones: [{ type: 'SUPPORT', timeframe: 'M5', priceMin: 99.8, priceMax: 100.3, strength: 3 }],
  currentPrice: 102.65,
  now: new Date(setupStart + 28 * 5 * 60_000),
});
assert.equal(confirmedBuy.direction, 'BUY');
assert.equal(confirmedBuy.gates.choch, true);
assert.equal(hasValidTradeGeometry(confirmedBuy), true);

const incompleteTrap = M5EntryConfirmationService.analyze({
  candles: [...supportSetup.slice(0, -1), { ...supportSetup.at(-1), time: new Date(setupStart + 28 * 5 * 60_000) }],
  zones: [{ type: 'SUPPORT', priceMin: 99.8, priceMax: 100.3 }],
  currentPrice: 102.65,
  now: new Date(setupStart + 28 * 5 * 60_000 + 60_000),
});
assert.notEqual(incompleteTrap.direction, 'BUY');
assert.equal(hasValidTradeGeometry({ direction: 'BUY', entry: 100, stopLoss: 100, takeProfit: 100 }), false);
assert.equal(hasValidTradeGeometry({ direction: 'SELL', entry: 100, stopLoss: 103, takeProfit: 96 }), true);

console.log('trading safety tests passed');
