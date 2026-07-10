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
    if (!symbol.toUpperCase().includes('XAU')) {
      return;
    }

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

    const swingWindow = timeframe === 'M5' ? 3 : timeframe === 'M15' ? 4 : 5; // Faster confirmation for scalping timeframes
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

    // 3. Cluster XAU swing levels into zones.
    const threshold = timeframe === 'M5' ? 0.8 : timeframe === 'M15' ? 1.4 : 2.0;
    const zoneBuffer = timeframe === 'M5' ? 0.25 : 0.5;
    const supportZones = this.clusterLevels(swingLows, 'SUPPORT', threshold, zoneBuffer);
    const resistanceZones = this.clusterLevels(swingHighs, 'RESISTANCE', threshold, zoneBuffer);

    // 4. Determine Liquidity Zones (top/bottom extremes where stops sit)
    const sortedHighs = [...swingHighs].sort((a, b) => b - a);
    const sortedLows = [...swingLows].sort((a, b) => a - b);
    const liquidityZones: ZoneCandidate[] = [];
    const buffer = zoneBuffer;

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

    const zoneData = allZones.map(zone => ({
      symbol,
      timeframe,
      type: zone.type,
      priceMin: zone.priceMin,
      priceMax: zone.priceMax,
      strength: zone.strength,
      touchCount: zone.touchCount,
      lastTouchedAt: new Date(),
    }));

    await prisma.zone.createMany({
      data: zoneData,
    });
  }

  /**
   * Simple clustering algorithm to group nearby prices.
   */
  private static clusterLevels(
    levels: number[],
    type: 'SUPPORT' | 'RESISTANCE',
    threshold: number,
    buffer: number
  ): ZoneCandidate[] {
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
      const strength = Math.min(cluster.length, 5); // Caps strength score at 5
      
      return {
        type,
        priceMin: Math.min(...cluster) - buffer,
        priceMax: Math.max(...cluster) + buffer,
        strength,
        touchCount: cluster.length,
      };
    });
  }

  /**
   * Helper to retrieve zones near a specific price
   */
  static async getZonesNearPrice(symbol: string, timeframe: string, price: number, tolerance: number = 3.0) {
    if (!symbol.toUpperCase().includes('XAU')) {
      return [];
    }

    const activeTolerance = tolerance;
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
