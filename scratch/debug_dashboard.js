const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { parse } = require('pg-connection-string');

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
console.log('Connection string exists:', !!connectionString);

const config = parse(connectionString || '');
const poolConfig = {
  ...config,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000
};

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const assets = ['XAUUSD', 'BTCUSD'];
    
    for (const symbol of assets) {
      console.log(`\n=== Processing symbol: ${symbol} ===`);
      const searchSymbol = symbol === 'XAUUSD' ? 'XAU' : 'BTC';
      const latestEvent = await prisma.webhookEvent.findFirst({
        where: { symbol: { contains: searchSymbol }, status: 'processed' },
        orderBy: { receivedAt: 'desc' },
      });
      const activeSymbol = latestEvent ? latestEvent.symbol : symbol;
      console.log(`Active symbol: ${activeSymbol}`);

      let m15Candles = [];
      let h1Candles = [];
      let d1Candles = [];

      console.log(`FORCING public API fallback fetch for ${symbol}...`);
      if (symbol === 'BTCUSD') {
        const [res15m, res1h, res1d] = await Promise.all([
          fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50'),
          fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=50'),
          fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=50')
        ]);
        const data15m = await res15m.json();
        const data1h = await res1h.json();
        const data1d = await res1d.json();

        m15Candles = data15m.map((d) => ({
          time: new Date(d[0]), open: parseFloat(parseFloat(d[1]).toFixed(2)),
          high: parseFloat(parseFloat(d[2]).toFixed(2)), low: parseFloat(parseFloat(d[3]).toFixed(2)),
          close: parseFloat(parseFloat(d[4]).toFixed(2)), volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
        })).reverse();
        
        h1Candles = data1h.map((d) => ({
          time: new Date(d[0]), open: parseFloat(parseFloat(d[1]).toFixed(2)),
          high: parseFloat(parseFloat(d[2]).toFixed(2)), low: parseFloat(parseFloat(d[3]).toFixed(2)),
          close: parseFloat(parseFloat(d[4]).toFixed(2)), volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
        })).reverse();

        d1Candles = data1d.map((d) => ({
          time: new Date(d[0]), open: parseFloat(parseFloat(d[1]).toFixed(2)),
          high: parseFloat(parseFloat(d[2]).toFixed(2)), low: parseFloat(parseFloat(d[3]).toFixed(2)),
          close: parseFloat(parseFloat(d[4]).toFixed(2)), volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
        })).reverse();

        console.log(`Fetched Binance candles: M15=${m15Candles.length}, H1=${h1Candles.length}, D1=${d1Candles.length}`);
      } else if (symbol === 'XAUUSD') {
        const [res15m, res1h, res1d] = await Promise.all([
          fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=15m&range=5d'),
          fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=14d'),
          fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=3mo')
        ]);
        
        const data15m = await res15m.json();
        const data1h = await res1h.json();
        const data1d = await res1d.json();

        const parseYahoo = (data, intervalName) => {
          console.log(`Parsing Yahoo Chart data for ${intervalName}...`);
          if (!data.chart || !data.chart.result || !data.chart.result[0].indicators.quote[0]) {
            console.log(`Missing chart result indicators for ${intervalName}`, !!data.chart, !!data.chart?.result);
            return [];
          }
          const result = data.chart.result[0];
          const timestamps = result.timestamp || [];
          const quotes = result.indicators.quote[0];
          const candles = [];
          
          if (!quotes.close) {
            console.log(`quotes.close is undefined for ${intervalName}!`);
            return [];
          }
          
          for (let idx = quotes.close.length - 1; idx >= 0; idx--) {
            if (quotes.close[idx] !== null && quotes.open[idx] !== null && quotes.high[idx] !== null && quotes.low[idx] !== null) {
              candles.push({
                time: new Date(timestamps[idx] * 1000),
                open: parseFloat(quotes.open[idx].toFixed(2)),
                high: parseFloat(quotes.high[idx].toFixed(2)),
                low: parseFloat(quotes.low[idx].toFixed(2)),
                close: parseFloat(quotes.close[idx].toFixed(2)),
                volume: parseFloat((quotes.volume ? quotes.volume[idx] || 0 : 0).toFixed(0)),
              });
              if (candles.length >= 50) break;
            }
          }
          return candles;
        };

        m15Candles = parseYahoo(data15m, 'M15');
        h1Candles = parseYahoo(data1h, 'H1');
        d1Candles = parseYahoo(data1d, 'D1');
        console.log(`Parsed Yahoo candles: M15=${m15Candles.length}, H1=${h1Candles.length}, D1=${d1Candles.length}`);
      }

      // SMA / EMA calculations
      const calcSMA = (data, period) => {
        if (data.length < period) return data[0]?.close || 0;
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[i].close;
        return sum / period;
      };

      const calcEMA = (data, period) => {
        if (data.length < period) return calcSMA(data, data.length);
        const k = 2 / (period + 1);
        let ema = data[data.length - 1].close; 
        for (let i = data.length - 2; i >= 0; i--) {
          ema = (data[i].close * k) + (ema * (1 - k));
        }
        return ema;
      };

      console.log(`Calculating indicators for ${symbol}...`);
      const recentCandles = m15Candles;
      
      let ema20_m15 = 0;
      let ema20_h1 = 0;
      let ema20_d1 = 0;

      if (recentCandles.length >= 20) {
        ema20_m15 = calcEMA(m15Candles, 20);
        ema20_h1 = calcEMA(h1Candles, 20);
        ema20_d1 = d1Candles.length >= 20 ? calcEMA(d1Candles, 20) : (d1Candles.length > 0 ? d1Candles[0].close : 0);
        console.log(`EMAs calculated: M15=${ema20_m15.toFixed(2)}, H1=${ema20_h1.toFixed(2)}, D1=${ema20_d1.toFixed(2)}`);
      } else {
        console.log(`recentCandles length is only ${recentCandles.length}, which is less than 20. Skipping EMAs.`);
      }
    }

    console.log('\nSUCCESS! Diagnostic completed.');
  } catch (err) {
    console.error('CRITICAL ERROR DURING RUN:', err);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

run();
