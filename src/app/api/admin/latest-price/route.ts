import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const assets = ['XAUUSD', 'BTCUSD'];
    const data: Record<string, { price: number; bias: string }> = {
      XAUUSD: { price: 4450.0, bias: 'NEUTRAL' },
      BTCUSD: { price: 68450.0, bias: 'NEUTRAL' },
    };

    for (const symbol of assets) {
      const searchSymbol = symbol === 'XAUUSD' ? 'XAU' : 'BTC';

      // 1. Check the latest processed webhook event for this symbol
      const latestEvent = await prisma.webhookEvent.findFirst({
        where: { 
          symbol: { contains: searchSymbol },
          status: 'processed' 
        },
        orderBy: { receivedAt: 'desc' },
      });

      const activeSymbol = latestEvent ? latestEvent.symbol : symbol;
      let currentPrice = data[symbol].price;

      const isEventRecent = latestEvent && (Date.now() - latestEvent.receivedAt.getTime() < 5 * 60 * 1000);
      if (isEventRecent) {
        try {
          const payload = JSON.parse(latestEvent.rawPayload);
          if (payload.price) {
            currentPrice = parseFloat(payload.price);
          }
        } catch {
          // ignore
        }
      }

      // 2. Fetch the latest database candles to compute bias (MTF Analysis)
      let m15Candles: any[] = await prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 30,
      });

      let h1Candles: any[] = await prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 30,
      });

      // Check if DB is empty or stale (> 45 minutes since last candle close/time)
      const isDbStale = m15Candles.length === 0 || (Date.now() - m15Candles[0].time.getTime() > 45 * 60 * 1000);
      
      // Rate limit protection: If the latest candle in the database was created less than 3 minutes ago, do not fetch again.
      const isRecentFetch = m15Candles.length > 0 && (Date.now() - m15Candles[0].createdAt.getTime() < 3 * 60 * 1000);

      if ((m15Candles.length < 20 || h1Candles.length < 20 || isDbStale) && !isRecentFetch) {
        try {
          if (symbol === 'BTCUSD') {
            const [res15m, res1h] = await Promise.all([
              fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50'),
              fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=50')
            ]);
            
            const data15m = await res15m.json();
            const data1h = await res1h.json();
            
            const parseBinance = (data: any) => {
              return data.map((d: any) => ({
                time: new Date(d[0]),
                open: parseFloat(parseFloat(d[1]).toFixed(2)),
                high: parseFloat(parseFloat(d[2]).toFixed(2)),
                low: parseFloat(parseFloat(d[3]).toFixed(2)),
                close: parseFloat(parseFloat(d[4]).toFixed(2)),
                volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
              })).reverse();
            };

            m15Candles = parseBinance(data15m);
            h1Candles = parseBinance(data1h);

            try {
              if (m15Candles.length > 0) {
                const dbCandles = m15Candles.map((c: any) => ({
                  symbol: activeSymbol,
                  timeframe: 'M15',
                  time: c.time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                }));
                await prisma.candle.deleteMany({ where: { symbol: activeSymbol, timeframe: 'M15' } });
                await prisma.candle.createMany({ data: dbCandles, skipDuplicates: true });
                const { ZoneService } = await import('@/lib/services/zone.service');
                await ZoneService.updateZones(activeSymbol, 'M15');
              }
              if (h1Candles.length > 0) {
                const dbCandles = h1Candles.map((c: any) => ({
                  symbol: activeSymbol,
                  timeframe: 'H1',
                  time: c.time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                }));
                await prisma.candle.deleteMany({ where: { symbol: activeSymbol, timeframe: 'H1' } });
                await prisma.candle.createMany({ data: dbCandles, skipDuplicates: true });
                const { ZoneService } = await import('@/lib/services/zone.service');
                await ZoneService.updateZones(activeSymbol, 'H1');
              }
            } catch (errDb) {
              console.error('Failed to cache BTC fallback candles in DB:', errDb);
            }
          } else if (symbol === 'XAUUSD') {
            const [res15m, res1h] = await Promise.all([
              fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=15m&range=5d'),
              fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=14d')
            ]);
            
            const data15m = await res15m.json();
            const data1h = await res1h.json();
            
            const parseYahoo = (data: any) => {
              if (!data.chart || !data.chart.result || !data.chart.result[0].indicators.quote[0]) return [];
              const result = data.chart.result[0];
              const timestamps = result.timestamp || [];
              const quotes = result.indicators.quote[0];
              const candles = [];
              for (let i = 1; i <= Math.min(50, quotes.close.length); i++) {
                const idx = quotes.close.length - i;
                if (idx >= 0 && quotes.close[idx] !== null && quotes.open[idx] !== null && quotes.high[idx] !== null && quotes.low[idx] !== null) {
                  candles.push({
                    time: new Date(timestamps[idx] * 1000),
                    open: parseFloat(quotes.open[idx].toFixed(2)),
                    high: parseFloat(quotes.high[idx].toFixed(2)),
                    low: parseFloat(quotes.low[idx].toFixed(2)),
                    close: parseFloat(quotes.close[idx].toFixed(2)),
                    volume: parseFloat((quotes.volume ? quotes.volume[idx] || 0 : 0).toFixed(0)),
                  });
                }
              }
              return candles;
            };
            
            m15Candles = parseYahoo(data15m);
            h1Candles = parseYahoo(data1h);

            try {
              if (m15Candles.length > 0) {
                const dbCandles = m15Candles.map((c: any) => ({
                  symbol: activeSymbol,
                  timeframe: 'M15',
                  time: c.time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                }));
                await prisma.candle.deleteMany({ where: { symbol: activeSymbol, timeframe: 'M15' } });
                await prisma.candle.createMany({ data: dbCandles, skipDuplicates: true });
                const { ZoneService } = await import('@/lib/services/zone.service');
                await ZoneService.updateZones(activeSymbol, 'M15');
              }
              if (h1Candles.length > 0) {
                const dbCandles = h1Candles.map((c: any) => ({
                  symbol: activeSymbol,
                  timeframe: 'H1',
                  time: c.time,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                }));
                await prisma.candle.deleteMany({ where: { symbol: activeSymbol, timeframe: 'H1' } });
                await prisma.candle.createMany({ data: dbCandles, skipDuplicates: true });
                const { ZoneService } = await import('@/lib/services/zone.service');
                await ZoneService.updateZones(activeSymbol, 'H1');
              }
            } catch (errDb) {
              console.error('Failed to cache XAU fallback candles in DB:', errDb);
            }
          }
        } catch (err) {
          console.error('Failed to fetch fallback candles in latest-price:', err);
        }
      }

      if (!isEventRecent) {
        if (m15Candles.length > 0) {
          currentPrice = m15Candles[0].close;
        } else if (h1Candles.length > 0) {
          currentPrice = h1Candles[0].close;
        }
      }

      const calcSMA = (candles: any[], period: number) => {
        let sum = 0;
        const limit = Math.min(period, candles.length);
        for (let i = 0; i < limit; i++) sum += candles[i].close;
        return limit > 0 ? sum / limit : 0;
      };

      const calcEMA = (candles: any[], period: number) => {
        if (candles.length < period) return calcSMA(candles, candles.length);
        const k = 2 / (period + 1);
        let ema = candles[candles.length - 1].close; 
        for (let i = candles.length - 2; i >= 0; i--) {
          ema = (candles[i].close * k) + (ema * (1 - k));
        }
        return ema;
      };

      let bias = 'NEUTRAL';

      if (h1Candles.length >= 20 && m15Candles.length >= 20) {
        const ema20_m15 = calcEMA(m15Candles, 20);
        const ema20_h1 = calcEMA(h1Candles, 20);
        
        const h1Trend = currentPrice > ema20_h1 ? 'BULLISH' : 'BEARISH';
        const m15Trend = currentPrice > ema20_m15 ? 'BULLISH' : 'BEARISH';
        
        // Multi-candle analysis (last 5 candles on M15) for immediate momentum
        let consecutiveDrops = 0;
        let consecutiveSurges = 0;
        for (let i = 0; i < Math.min(m15Candles.length, 5); i++) {
          const c = m15Candles[i];
          if (c.close < c.open) {
            if (consecutiveSurges > 0) break;
            consecutiveDrops++;
          } else if (c.close > c.open) {
            if (consecutiveDrops > 0) break;
            consecutiveSurges++;
          }
        }
        
        const prevCandle = m15Candles[1];
        const isCrashing = (currentPrice < prevCandle.low) || consecutiveDrops >= 3;
        const isSurging = (currentPrice > prevCandle.high) || consecutiveSurges >= 3;

        if (m15Trend === 'BULLISH' && h1Trend === 'BULLISH') {
           bias = 'BULLISH';
        } else if (m15Trend === 'BEARISH' && h1Trend === 'BEARISH') {
           bias = 'BEARISH';
        } else {
           bias = 'WAIT_AND_SEE';
        }

        // Momentum overrides (if short term is extremely strong against MTF)
        if (isCrashing && bias !== 'BEARISH') {
           bias = 'BEARISH'; 
        } else if (isSurging && bias !== 'BULLISH') {
           bias = 'BULLISH';
        }
      } else if (h1Candles.length > 0) {
        const avg = h1Candles.reduce((s, c) => s + c.close, 0) / h1Candles.length;
        bias = currentPrice > avg ? 'BULLISH' : 'BEARISH';
      }

      data[symbol].bias = bias;

      data[symbol].price = currentPrice;
    }


    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ 
      XAUUSD: { price: 4450.0, bias: 'NEUTRAL' }, 
      BTCUSD: { price: 68450.0, bias: 'NEUTRAL' }, 
      error: err.message 
    });
  }
}

