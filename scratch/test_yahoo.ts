async function main() {
  console.log('--- Testing Yahoo Finance Fetch ---');
  try {
    const res15m = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=15m&range=5d');
    const data15m = await res15m.json() as any;
    
    if (!data15m.chart || !data15m.chart.result) {
      console.log('No chart result in Yahoo response:', JSON.stringify(data15m));
      return;
    }
    
    const result = data15m.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0];
    console.log('Yahoo returned result. Timestamps count:', timestamps.length);
    console.log('Quotes close count:', quotes.close ? quotes.close.length : 'N/A');
    
    const candles = [];
    for (let idx = quotes.close.length - 1; idx >= 0; idx--) {
      if (quotes.close[idx] !== null && quotes.open[idx] !== null && quotes.high[idx] !== null && quotes.low[idx] !== null) {
        candles.push({
          time: new Date(timestamps[idx] * 1000),
          open: quotes.open[idx],
          high: quotes.high[idx],
          low: quotes.low[idx],
          close: quotes.close[idx],
        });
        if (candles.length >= 50) break;
      }
    }
    console.log('Parsed candles count:', candles.length);
    if (candles.length > 0) {
      console.log('Latest candle:', candles[0]);
      console.log('Oldest candle parsed:', candles[candles.length - 1]);
    }
  } catch (err) {
    console.error('Yahoo fetch failed:', err);
  }
}

main();
