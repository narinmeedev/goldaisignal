import { prisma } from '../prisma';

export interface ZoneCandidate {
  type: 'SUPPORT' | 'RESISTANCE' | 'LIQUIDITY';
  priceMin: number;
  priceMax: number;
  strength: number;
  touchCount: number;
}

export class ZoneService {
  /**
   * Scans recent candles, calculates swing highs/lows,
   * clusters them into support/resistance zones, and saves them.
   */
  static async updateZones(symbol: string, timeframe: string, lookback: number = 150): Promise<void> {
    // 1. Fetch recent candles ordered by time ascending
    const candles = await prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: 'asc' },
      take: lookback,
    });

    if (candles.length < 20) {
      // Need enough candles to detect swing points
      return;
    }

    const swingWindow = 5; // Left/right candle window to confirm swing
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    // 2. Identify Swing Highs and Swing Lows
    for (let i = swingWindow; i < candles.length - swingWindow; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= swingWindow; j++) {
        // Swing High checks
        if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
          isHigh = false;
        }
        // Swing Low checks
        if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
          isLow = false;
        }
      }

      if (isHigh) swingHighs.push(current.high);
      if (isLow) swingLows.push(current.low);
    }

    // 3. Cluster Swing Levels into Zones dynamically based on Symbol
    const threshold = symbol.toUpperCase().includes('BTC') ? 350.0 : 2.0; 
    const supportZones = this.clusterLevels(swingLows, 'SUPPORT', threshold);
    const resistanceZones = this.clusterLevels(swingHighs, 'RESISTANCE', threshold);

    // 4. Determine Liquidity Zones (top/bottom extremes where stops sit)
    const sortedHighs = [...swingHighs].sort((a, b) => b - a);
    const sortedLows = [...swingLows].sort((a, b) => a - b);
    const liquidityZones: ZoneCandidate[] = [];
    const buffer = symbol.toUpperCase().includes('BTC') ? 50.0 : 0.5;

    if (sortedHighs.length > 0) {
      // Major swing high is resistance-liquidity
      liquidityZones.push({
        type: 'LIQUIDITY',
        priceMin: sortedHighs[0] - buffer,
        priceMax: sortedHighs[0] + buffer,
        strength: 3,
        touchCount: 1,
      });
    }
    if (sortedLows.length > 0) {
      // Major swing low is support-liquidity
      liquidityZones.push({
        type: 'LIQUIDITY',
        priceMin: sortedLows[0] - buffer,
        priceMax: sortedLows[0] + buffer,
        strength: 3,
        touchCount: 1,
      });
    }

    const allZones = [...supportZones, ...resistanceZones, ...liquidityZones];

    // 5. Delete existing zones for this symbol/timeframe and insert new ones
    await prisma.zone.deleteMany({
      where: { symbol, timeframe },
    });

    for (const zone of allZones) {
      await prisma.zone.create({
        data: {
          symbol,
          timeframe,
          type: zone.type,
          priceMin: zone.priceMin,
          priceMax: zone.priceMax,
          strength: zone.strength,
          touchCount: zone.touchCount,
          lastTouchedAt: new Date(),
        },
      });
    }
  }

  /**
   * Simple clustering algorithm to group nearby prices.
   */
  private static clusterLevels(levels: number[], type: 'SUPPORT' | 'RESISTANCE', threshold: number): ZoneCandidate[] {
    if (levels.length === 0) return [];
    
    // Sort levels ascending
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[][] = [];
    
    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const price = sorted[i];
      const prevPrice = sorted[i - 1];

      if (price - prevPrice <= threshold) {
        currentCluster.push(price);
      } else {
        clusters.push(currentCluster);
        currentCluster = [price];
      }
    }
    clusters.push(currentCluster);

    // Convert clusters into zone candidates
    return clusters.map(cluster => {
      const avg = cluster.reduce((sum, p) => sum + p, 0) / cluster.length;
      const strength = Math.min(cluster.length, 5); // Caps strength score at 5
      
      return {
        type,
        // Create a buffer range around the average price of the cluster
        priceMin: Math.min(...cluster) - 0.5,
        priceMax: Math.max(...cluster) + 0.5,
        strength,
        touchCount: cluster.length,
      };
    });
  }

  /**
   * Helper to retrieve zones near a specific price
   */
  static async getZonesNearPrice(symbol: string, timeframe: string, price: number, tolerance: number = 3.0) {
    const activeTolerance = symbol.toUpperCase().includes('BTC') ? 400.0 : tolerance;
    return prisma.zone.findMany({
      where: {
        symbol,
        timeframe,
        priceMin: { lte: price + activeTolerance },
        priceMax: { gte: price - activeTolerance },
      },
    });
  }
}
