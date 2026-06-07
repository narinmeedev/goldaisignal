import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Fetch total counts
    const totalSignals = await prisma.signal.count();
    const totalTrades = await prisma.paperTrade.count();
    
    // 2. Fetch active open trades
    const openTrades = await prisma.paperTrade.findMany({
      where: { result: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    // Fetch proposed trading plans
    const suggestedPlans = await prisma.paperTrade.findMany({
      where: { result: 'PLAN' },
      orderBy: { openedAt: 'desc' },
      include: { signal: true },
    });

    // 3. Fetch latest 5 signals
    const latestSignals = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    // 4. Fetch closed trades to compute Win Rate and Net R
    const closedTrades = await prisma.paperTrade.findMany({
      where: { result: { in: ['WIN', 'LOSS', 'BE'] } },
    });

    const winCount = closedTrades.filter((t: any) => t.result === 'WIN').length;
    const lossCount = closedTrades.filter((t: any) => t.result === 'LOSS').length;
    const totalClosed = closedTrades.length;
    const winRate = totalClosed > 0 ? Math.round((winCount / totalClosed) * 100) : 0;
    const netR = parseFloat(closedTrades.reduce((sum: number, t: any) => sum + t.rrResult, 0).toFixed(2));

    // 5. Group by Setup Type (Strategy)
    const setupPerformance: Record<string, { rSum: number; count: number }> = {};
    for (const trade of closedTrades) {
      const setup = trade.signalId ? 'support_bounce' : 'general_setup'; // simple group
      if (!setupPerformance[setup]) {
        setupPerformance[setup] = { rSum: 0, count: 0 };
      }
      setupPerformance[setup].count += 1;
      setupPerformance[setup].rSum += trade.rrResult;
    }

    let bestSetup = 'N/A';
    let worstSetup = 'N/A';
    let maxR = -Infinity;
    let minR = Infinity;

    for (const [setup, stats] of Object.entries(setupPerformance)) {
      if (stats.rSum > maxR) {
        maxR = stats.rSum;
        bestSetup = setup === 'support_bounce' ? 'Support Bounce' : setup;
      }
      if (stats.rSum < minR) {
        minR = stats.rSum;
        worstSetup = setup === 'support_bounce' ? 'Support Bounce' : setup;
      }
    }

    if (totalClosed === 0) {
      bestSetup = 'N/A';
      worstSetup = 'N/A';
    }

    // 6. Fetch zone count for indicator
    const zoneCount = await prisma.zone.count();

    // 7. NEW: Market Intelligence & Proactive AI Planning
    const assets = ['XAUUSD', 'BTCUSD'];
    const marketIntelligence: Record<string, any> = {};

    for (const symbol of assets) {
      const searchSymbol = symbol === 'XAUUSD' ? 'XAU' : 'BTC';
      
      // Get latest tick price from webhook events
      const latestEvent = await prisma.webhookEvent.findFirst({
        where: { symbol: { contains: searchSymbol }, status: 'processed' },
        orderBy: { receivedAt: 'desc' },
      });

      const activeSymbol = latestEvent ? latestEvent.symbol : symbol;
      let currentPrice = symbol === 'XAUUSD' ? 4450.0 : 68000.0;
      let recentCandles: any[] = [];
      
      const isEventRecent = latestEvent && (Date.now() - latestEvent.receivedAt.getTime() < 5 * 60 * 1000);
      if (isEventRecent) {
        try {
          const payload = JSON.parse(latestEvent.rawPayload);
          if (payload.price) currentPrice = parseFloat(payload.price);
        } catch {}
      }

      // Try to get from database first (MT5 Sync or previously cached fallback candles)
      let m15Candles: any[] = await prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 50,
      });

      let h1Candles: any[] = await prisma.candle.findMany({
        where: { symbol: activeSymbol, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 50,
      });

      // Check if DB is empty or stale (> 45 minutes since last candle close/time)
      const isDbStale = m15Candles.length === 0 || (Date.now() - m15Candles[0].time.getTime() > 45 * 60 * 1000);
      
      // Rate limit protection: If the latest candle in the database was created less than 3 minutes ago, do not fetch from Yahoo/Binance again.
      const isRecentFetch = m15Candles.length > 0 && (Date.now() - m15Candles[0].createdAt.getTime() < 3 * 60 * 1000);
      
      // If DB does not have enough candles, or they are stale (and we didn't fetch recently), FALLBACK to public APIs
      if ((m15Candles.length < 20 || h1Candles.length < 20 || isDbStale) && !isRecentFetch) {
        try {
          if (symbol === 'BTCUSD') {
            const [res15m, res1h] = await Promise.all([
              fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50'),
              fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=50')
            ]);
            
            const data15m = await res15m.json();
            const data1h = await res1h.json();
            
            m15Candles = data15m.map((d: any) => ({
              time: new Date(d[0]),
              open: parseFloat(parseFloat(d[1]).toFixed(2)),
              high: parseFloat(parseFloat(d[2]).toFixed(2)),
              low: parseFloat(parseFloat(d[3]).toFixed(2)),
              close: parseFloat(parseFloat(d[4]).toFixed(2)),
              volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
            })).reverse();
            
            h1Candles = data1h.map((d: any) => ({
              time: new Date(d[0]),
              open: parseFloat(parseFloat(d[1]).toFixed(2)),
              high: parseFloat(parseFloat(d[2]).toFixed(2)),
              low: parseFloat(parseFloat(d[3]).toFixed(2)),
              close: parseFloat(parseFloat(d[4]).toFixed(2)),
              volume: parseFloat(parseFloat(d[5] || 0).toFixed(0)),
            })).reverse();

            // Cache fallback candles in database
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

            // Cache fallback candles in database
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
                await ZoneService.updateZones(activeSymbol, 'H1');
              }
            } catch (errDb) {
              console.error('Failed to cache XAU fallback candles in DB:', errDb);
            }
          }
        } catch (err) {
          // Fallback handled below
        }
      }
      
      if (m15Candles.length > 0 && !isEventRecent) {
        currentPrice = m15Candles[0].close;
      }

      
      if (m15Candles.length === 0) m15Candles = recentCandles;
      if (h1Candles.length === 0) h1Candles = recentCandles;
      recentCandles = m15Candles; // legacy variable compatibility
      
      // --- Technical Indicators Math ---
      const calcSMA = (data: any[], period: number) => {
        if (data.length < period) return data[0]?.close || 0;
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[i].close;
        return sum / period;
      };

      const calcEMA = (data: any[], period: number) => {
        if (data.length < period) return calcSMA(data, data.length);
        const k = 2 / (period + 1);
        let ema = data[data.length - 1].close; 
        for (let i = data.length - 2; i >= 0; i--) {
          ema = (data[i].close * k) + (ema * (1 - k));
        }
        return ema;
      };

      const calcATR = (data: any[], period: number) => {
        if (data.length < period + 1) return 3.0; 
        let trSum = 0;
        let validPeriods = 0;
        for (let i = 0; i < period; i++) {
          const current = data[i];
          const prev = data[i + 1];
          if (!prev) continue;
          const hl = current.high - current.low;
          const hc = Math.abs(current.high - prev.close);
          const lc = Math.abs(current.low - prev.close);
          trSum += Math.max(hl, hc, lc);
          validPeriods++;
        }
        return validPeriods > 0 ? trSum / validPeriods : 3.0;
      };

      const calcRSI = (data: any[], period: number) => {
        if (data.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = 0; i < period; i++) {
          const change = data[i].close - data[i+1].close;
          if (change > 0) gains += change;
          else losses -= change; 
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
      };

      // Calculate Bias based on MTF Analysis
      let bias = 'NEUTRAL';
      let trendStrength = 50;
      let volatility = 'LOW';
      
      const currentUtcHour = new Date().getUTCHours();
      let marketSession = 'Asian Session';
      let sessionVolatility = 'LOW';

      if (currentUtcHour >= 23 || currentUtcHour < 8) {
        marketSession = 'Asian Session';
        sessionVolatility = 'LOW';
      } else if (currentUtcHour >= 8 && currentUtcHour < 13) {
        marketSession = 'London Session';
        sessionVolatility = 'MEDIUM';
      } else if (currentUtcHour >= 13 && currentUtcHour < 16) {
        marketSession = 'London & New York Overlap';
        sessionVolatility = 'EXTREME';
      } else if (currentUtcHour >= 16 && currentUtcHour < 21) {
        marketSession = 'New York Session';
        sessionVolatility = 'HIGH';
      } else if (currentUtcHour >= 21 && currentUtcHour < 23) {
        marketSession = 'Late NY / Post-Market';
        sessionVolatility = 'LOW';
      }

      volatility = sessionVolatility;
      let atr14 = 3.0;
      let rsi14 = 50;
      let isOverbought = false;
      let isOversold = false;
      
      let isSurgingGlobal = false;
      let isCrashingGlobal = false;

      if (recentCandles.length >= 20) {
        // --- Calculate MTF Trends ---
        const ema20_m15 = calcEMA(m15Candles, 20);
        const ema20_h1 = calcEMA(h1Candles, 20);
        atr14 = calcATR(m15Candles, 14);
        rsi14 = calcRSI(m15Candles, 14);
        
        isOverbought = rsi14 > 70;
        isOversold = rsi14 < 30;

        const m15Trend = currentPrice > ema20_m15 ? 'BULLISH' : 'BEARISH';
        const h1Trend = currentPrice > ema20_h1 ? 'BULLISH' : 'BEARISH';
        
        // Multi-candle analysis (last 5 candles on M15) for immediate momentum
        let consecutiveDrops = 0;
        let consecutiveSurges = 0;
        for (let i = 0; i < Math.min(recentCandles.length, 5); i++) {
          const c = recentCandles[i];
          if (c.close < c.open) {
            if (consecutiveSurges > 0) break;
            consecutiveDrops++;
          } else if (c.close > c.open) {
            if (consecutiveDrops > 0) break;
            consecutiveSurges++;
          }
        }
        
        const prevCandle = recentCandles[1];
        const isCrashing = (currentPrice < prevCandle.low) || consecutiveDrops >= 3;
        const isSurging = (currentPrice > prevCandle.high) || consecutiveSurges >= 3;
        
        isSurgingGlobal = isSurging;
        isCrashingGlobal = isCrashing;

        // MTF Alignment logic
        if (m15Trend === 'BULLISH' && h1Trend === 'BULLISH') {
           bias = 'BULLISH';
           trendStrength = 70 + (consecutiveSurges * 5);
        } else if (m15Trend === 'BEARISH' && h1Trend === 'BEARISH') {
           bias = 'BEARISH';
           trendStrength = 70 + (consecutiveDrops * 5);
        } else {
           // MTF Conflict
           bias = 'WAIT_AND_SEE';
           trendStrength = 40;
        }

        // Momentum overrides (if short term is extremely strong against MTF)
        if (isCrashing && bias !== 'BEARISH') {
           bias = 'BEARISH'; 
           trendStrength = 60 + (consecutiveDrops * 10);
        } else if (isSurging && bias !== 'BULLISH') {
           bias = 'BULLISH';
           trendStrength = 60 + (consecutiveSurges * 10);
        }
        
        // Normalize strength
        trendStrength = Math.min(100, Math.max(10, trendStrength));

        // Spike volatility overrides session base volatility
        const currentCandle = recentCandles[0];
        const currentRange = Math.abs(currentCandle.high - currentCandle.low);
        if (currentRange > atr14 * 1.5 || isCrashing || isSurging) {
          volatility = 'HIGH';
        }
        if (currentRange > atr14 * 2.5) {
          volatility = 'EXTREME';
        }
      }


      // Find nearest zones (if any in DB, otherwise generate dynamic temporary zones for demo out-of-the-box)
      let allZones = await prisma.zone.findMany({
        where: { symbol: activeSymbol },
        orderBy: { priceMin: 'asc' },
      });

      // Filter out zones that are too far from the current price (e.g. old seed data when price was much lower)
      const maxDistance = symbol === 'BTCUSD' ? 5000 : 150;
      let zones = allZones.filter((z: any) => Math.abs(z.priceMin - currentPrice) <= maxDistance);

      // If no relevant zones in DB, let's create some realistic dynamic ones based on current price so the UI isn't empty!
      if (zones.length === 0) {
        const step = symbol === 'BTCUSD' ? 1000 : 20;
        zones = [
          { type: 'SUPPORT', priceMin: currentPrice - step - 5, priceMax: currentPrice - step, strength: 3, symbol: activeSymbol } as any,
          { type: 'SUPPORT', priceMin: currentPrice - (step*2) - 5, priceMax: currentPrice - (step*2), strength: 5, symbol: activeSymbol } as any,
          { type: 'RESISTANCE', priceMin: currentPrice + step, priceMax: currentPrice + step + 5, strength: 3, symbol: activeSymbol } as any,
          { type: 'RESISTANCE', priceMin: currentPrice + (step*2), priceMax: currentPrice + (step*2) + 5, strength: 5, symbol: activeSymbol } as any,
          { type: 'LIQUIDITY', priceMin: currentPrice - (step*1.5) - 2, priceMax: currentPrice - (step*1.5) + 2, strength: 1, symbol: activeSymbol } as any,
        ];
      }


      const nearestSupport = zones.filter((z: any) => z.type === 'SUPPORT' && z.priceMax < currentPrice).sort((a: any, b: any) => b.priceMax - a.priceMax).slice(0, 3);
      const nearestResistance = zones.filter((z: any) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).sort((a: any, b: any) => a.priceMin - b.priceMin).slice(0, 3);
      const dangerZones = zones.filter((z: any) => z.type === 'LIQUIDITY' && Math.abs(z.priceMin - currentPrice) < 5).slice(0, 2);

      // Generate AI Proactive Plans (SaaS Grade MTF + ATR + RSI Logic)
      const proactivePlans = [];
      const isBtc = symbol === 'BTCUSD';
      
      // Dynamic Risk via ATR (1.5x for SL, 3.0x for TP)
      const atrSL = isBtc ? Math.max(100, atr14 * 1.5) : Math.max(2, atr14 * 1.5);
      const atrTP = isBtc ? Math.max(200, atr14 * 3.0) : Math.max(4, atr14 * 3.0);
      
      // 3 Entry offset based on ATR
      const diff = isBtc ? Math.max(100, atr14 * 0.8) : Math.max(2.0, atr14 * 0.8);

      if (nearestSupport.length > 0) {
        const support = nearestSupport[0];
        
        let planConfidence = support.strength > 3 ? 85 : 75;
        let planTitle = 'โซนเฝ้าระวังดักซื้อ (Support Zone)';
        let planReason = `ราคามีโอกาสย่อตัวลงมาทดสอบแนวรับที่ ${support.priceMax.toFixed(2)} แนะนำให้รอแท่งเทียนกลับตัว (Pinbar/Engulfing) เพื่อยืนยันก่อนเข้า Buy`;
        
        // Anti-Falling Knife Logic + Session Volatility Consideration
        const isCounterTrend = bias === 'BEARISH' && trendStrength > 60;
        const isExtremeVol = sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH';

        if (isCounterTrend || isExtremeVol) {
          planConfidence = isExtremeVol ? 30 : 40;
          planTitle = '⚠️ ระวัง! ความเสี่ยงสูง (Risky Support)';
          planReason = isExtremeVol 
            ? `ตลาดอเมริกาผันผวนรุนแรง การดักซื้อที่แนวรับมีความเสี่ยงสูงที่จะโดนลากทะลุ แนะนำให้รอ Price Action แท่งเทียนกลับตัวก่อนเข้าเสมอ`
            : `ตลาดกำลังดิ่งลงแรง (${Math.round(trendStrength)}%) โซนแนวรับนี้เสี่ยงที่จะรับไม่อยู่ แนะนำให้รอดูการสร้างฐานราคาใหม่`;
        }

        proactivePlans.push({
          id: `ai-plan-buy-${symbol}`,
          type: 'BUY_ZONE',
          title: planTitle,
          entry: support.priceMax,
          entry1: support.priceMax,
          entry2: support.priceMax - diff,
          entry3: support.priceMax - diff * 2,
          stopLoss: support.priceMin - atrSL,
          takeProfit: support.priceMax + atrTP,
          reason: planReason,
          confidence: planConfidence,
        });
      }

      if (nearestResistance.length > 0) {
        const res = nearestResistance[0];
        
        let planConfidence = res.strength > 3 ? 85 : 75;
        let planTitle = 'โซนเฝ้าระวังดักขาย (Resistance Zone)';
        let planReason = `ราคามีโอกาสขึ้นไปทดสอบแนวต้านที่ ${res.priceMin.toFixed(2)} แนะนำให้รอแท่งเทียนกลับตัว (Pinbar/Engulfing) เพื่อยืนยันก่อนเข้า Sell`;

        // Anti-Rocket Logic + Session Volatility Consideration
        const isCounterTrend = bias === 'BULLISH' && trendStrength > 60;
        const isExtremeVol = sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH';

        if (isCounterTrend || isExtremeVol) {
          planConfidence = isExtremeVol ? 30 : 40;
          planTitle = '⚠️ ระวัง! ความเสี่ยงสูง (Risky Resistance)';
          planReason = isExtremeVol
            ? `ตลาดอเมริกาผันผวนรุนแรง การดักขายที่แนวต้านมีความเสี่ยงสูงที่จะโดนลากทะลุ แนะนำให้รอ Price Action แท่งเทียนกลับตัวก่อนเข้าเสมอ`
            : `ตลาดกำลังพุ่งขึ้นแรง (${Math.round(trendStrength)}%) โซนแนวต้านนี้เสี่ยงที่จะต้านไม่อยู่ แนะนำให้รอดูการสร้างฐานราคาใหม่`;
        }

        proactivePlans.push({
          id: `ai-plan-sell-${symbol}`,
          type: 'SELL_ZONE',
          title: planTitle,
          entry: res.priceMin,
          entry1: res.priceMin,
          entry2: res.priceMin + diff,
          entry3: res.priceMin + diff * 2,
          stopLoss: res.priceMax + atrSL,
          takeProfit: res.priceMin - atrTP,
          reason: planReason,
          confidence: planConfidence,
        });
      }

      if (bias === 'BULLISH') {
        if (isOverbought) {
           proactivePlans.push({
             id: `ai-plan-follow-buy-${symbol}`,
             type: 'WAIT',
             title: '🚫 งดซื้อตามน้ำ (Overbought)',
             entry: currentPrice,
             stopLoss: currentPrice - atrSL,
             takeProfit: currentPrice + atrTP,
             reason: `RSI สูงเกินไป (${Math.round(rsi14)}) ตลาดอยู่ในภาวะซื้อมากเกินไป (Overbought) ห้ามไล่ราคาเด็ดขาด ให้รอราคาย่อตัว`,
             confidence: 10,
           });
        } else {
          let buyConfidence = Math.round(trendStrength);
          if (sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH') buyConfidence -= 15;
          
          proactivePlans.push({
            id: `ai-plan-follow-buy-${symbol}`,
            type: 'BUY_MARKET',
            title: 'ซื้อตามน้ำ (Follow Trend)',
            entry: currentPrice,
            entry1: currentPrice,
            entry2: currentPrice - diff,
            entry3: currentPrice - diff * 2,
            stopLoss: currentPrice - atrSL,
            takeProfit: currentPrice + atrTP,
            reason: `ทิศทางกราฟ 1H และ 15M สอดคล้องกันเป็นขาขึ้น (Strength: ${trendStrength.toFixed(0)}%)`,
            confidence: Math.max(10, buyConfidence),
          });
        }
      } else if (bias === 'BEARISH') {
        if (isOversold) {
           proactivePlans.push({
             id: `ai-plan-follow-sell-${symbol}`,
             type: 'WAIT',
             title: '🚫 งดขายตามน้ำ (Oversold)',
             entry: currentPrice,
             stopLoss: currentPrice + atrSL,
             takeProfit: currentPrice - atrTP,
             reason: `RSI ต่ำเกินไป (${Math.round(rsi14)}) ตลาดอยู่ในภาวะขายมากเกินไป (Oversold) ห้ามไล่ราคาเด็ดขาด ให้รอราคาเด้งกลับ`,
             confidence: 10,
           });
        } else {
          let sellConfidence = Math.round(trendStrength);
          if (sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH') sellConfidence -= 15;
 
          proactivePlans.push({
            id: `ai-plan-follow-sell-${symbol}`,
            type: 'SELL_MARKET',
            title: 'ขายตามน้ำ (Follow Trend)',
            entry: currentPrice,
            entry1: currentPrice,
            entry2: currentPrice + diff,
            entry3: currentPrice + diff * 2,
            stopLoss: currentPrice + atrSL,
            takeProfit: currentPrice - atrTP,
            reason: `ทิศทางกราฟ 1H และ 15M สอดคล้องกันเป็นขาลง (Strength: ${trendStrength.toFixed(0)}%)`,
            confidence: Math.max(10, sellConfidence),
          });
        }
      }

      // --- Scalping Logic (For high-risk tolerance) ---
      // Scalping doesn't care about MTF alignment, it only cares about immediate M15 momentum.
      const scalpSL = isBtc ? Math.max(80, atr14 * 0.8) : Math.max(1.5, atr14 * 0.8);
      const scalpTP = isBtc ? Math.max(150, atr14 * 1.5) : Math.max(3.0, atr14 * 1.5);
      
      if (isSurgingGlobal && !isOverbought) {
         proactivePlans.push({
           id: `ai-plan-scalp-buy-${symbol}`,
           type: 'BUY_MARKET', // Scalp is usually market execution
           title: '⚡ Scalping Buy (ความเสี่ยงสูง)',
           entry: currentPrice,
           entry1: currentPrice,
           entry2: currentPrice - diff,
           entry3: currentPrice - diff * 2,
           stopLoss: currentPrice - scalpSL,
           takeProfit: currentPrice + scalpTP,
           reason: `(สำหรับสายซิ่ง) โมเมนตัมระยะสั้นกำลังพุ่งขึ้นแรงมาก เหมาะสำหรับการเข้าทำกำไรสั้นๆ เก็บเร็วหนีเร็ว`,
           confidence: 65, // Lower confidence because it's a scalp
         });
      } else if (isCrashingGlobal && !isOversold) {
         proactivePlans.push({
           id: `ai-plan-scalp-sell-${symbol}`,
           type: 'SELL_MARKET',
           title: '⚡ Scalping Sell (ความเสี่ยงสูง)',
           entry: currentPrice,
           entry1: currentPrice,
           entry2: currentPrice + diff,
           entry3: currentPrice + diff * 2,
           stopLoss: currentPrice + scalpSL,
           takeProfit: currentPrice - scalpTP,
           reason: `(สำหรับสายซิ่ง) โมเมนตัมระยะสั้นกำลังถูกเทขายอย่างหนัก เหมาะสำหรับการเข้าทำกำไรสั้นๆ เก็บเร็วหนีเร็ว`,
           confidence: 65,
         });
      }

      marketIntelligence[symbol] = {
        currentPrice,
        bias,
        trendStrength: Math.round(trendStrength),
        volatility,
        nearestSupport,
        nearestResistance,
        dangerZones,
        proactivePlans,
        marketSession,
      };

    }

    // 8. Determine MT5 Connection Status (Check only actual MT5-driven events, ignore fallback candles creation)
    const latestEventOverall = await prisma.webhookEvent.findFirst({
      where: {
        source: { in: ['tradingview', 'mt5_sync'] },
        status: 'processed',
      },
      orderBy: { receivedAt: 'desc' },
    });

    const lastSyncTime = latestEventOverall ? latestEventOverall.receivedAt.getTime() : 0;
    const isMt5Live = (Date.now() - lastSyncTime) < 5 * 60 * 1000; // 5 minutes

    // 8.5 Fetch recent webhook events log for diagnostics
    const recentEvents = await prisma.webhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 10,
    });

    const formattedEvents = recentEvents.map(event => {
      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(event.rawPayload);
      } catch {}

      // Mask secret key for security
      if (parsedPayload && parsedPayload.secret) {
        parsedPayload.secret = '***';
      }

      return {
        id: event.id,
        source: event.source,
        symbol: event.symbol,
        timeframe: event.timeframe,
        receivedAt: event.receivedAt.toISOString(),
        status: event.status,
        errorMessage: event.errorMessage,
        payload: parsedPayload,
      };
    });

    return NextResponse.json({
      totalSignals,
      totalTrades,
      openTradesCount: openTrades.length,
      openTrades,
      suggestedPlansCount: suggestedPlans.length,
      suggestedPlans,
      latestSignals,
      winRate,
      netR,
      bestSetup,
      worstSetup,
      zoneCount,
      winCount,
      lossCount,
      marketIntelligence,
      mt5Connection: {
        isLive: isMt5Live,
        lastSyncAt: lastSyncTime > 0 ? new Date(lastSyncTime).toISOString() : null,
        recentEvents: formattedEvents
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics.', details: err.message },
      { status: 500 }
    );
  }
}
