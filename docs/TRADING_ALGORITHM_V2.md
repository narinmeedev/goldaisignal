# Trading Algorithm V2 safety specification

This version prioritizes capital preservation and evidence quality over signal frequency. It does not claim to beat the market or guarantee a win rate.

## Decision sequence

1. Validate feed integrity: sufficient candles, valid OHLC geometry, no duplicate timestamps, limited data gaps, and no extreme range expansion.
2. Classify the current regime as `TREND_UP`, `TREND_DOWN`, `RANGE`, `TRANSITION`, `HIGH_VOLATILITY`, or `DATA_UNRELIABLE`.
3. Enable only strategies appropriate for that regime.
4. Require multi-timeframe direction agreement. An M5 reversal pattern may veto a trade but may not create a counter-trend trade.
5. Apply risk, evidence, spread, RR, and portfolio circuit-breaker gates. If any gate fails, return `NO_TRADE`.

## Regime strategy matrix

| Regime | Eligible strategy families |
| --- | --- |
| TREND_UP | EMA20 pullback with higher-timeframe alignment; confirmed support rejection |
| TREND_DOWN | EMA20 pullback with higher-timeframe alignment; confirmed resistance rejection |
| RANGE | Confirmed support/resistance mean reversion; short-duration zone reversal |
| TRANSITION | No trade |
| HIGH_VOLATILITY | No trade |
| DATA_UNRELIABLE | No trade |

## Promotion criteria

- Historical optimization only nominates a strategy for shadow testing; it never approves live use.
- Parameter selection uses the earlier 70% of outcomes and reports the later 30% as out-of-sample validation.
- Backtests include an execution-cost penalty and conservative stop-first handling when TP and SL occur in the same candle.
- Live approval requires at least 20 decided forward samples, positive net R, at least 40% observed wins, and a 95% Wilson win-rate lower bound of at least 30%.
- A daily result of `-2R` or three consecutive losses stops new entries for the Bangkok trading day.
- Unapproved candidates are recorded as shadow paper trades and are excluded from the customer-facing active plan.

## Broker/feed limitations

One broker feed cannot prove deliberate price manipulation. The current gates detect malformed OHLC, gaps, duplicate timestamps, abnormal ranges, stale data, invalid bid/ask geometry, and excessive spread. A production anti-manipulation claim additionally requires an independent reference feed and a logged cross-feed deviation policy.

## EA execution rules

- Auto trading is off by default until forward validation passes.
- Never chase a missed limit entry with a market order.
- Reject invalid SL/TP geometry, RR below 1:1.8, spread above the configured threshold, and market-price slippage beyond the configured threshold.
