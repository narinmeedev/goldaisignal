import assert from 'node:assert/strict';
import { MarketRegimeService } from '../src/lib/services/market-regime.service.ts';
import { SmartTrendStructureService } from '../src/lib/services/smart-trend-structure.service.ts';

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
assert.ok(trendResult.confidence <= 82);

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

console.log('trading safety tests passed');
