import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StrategyResearchService } from '@/lib/services/strategy-research.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Fetch all signals that have been closed (Win, Loss, BE)
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        paperTrades: true
      }
    });

    const totalSignalsCount = signals.length;

    // Filter closed signals
    const closedSignals = signals.filter(
      (s) => s.result === 'Win' || s.result === 'Loss' || s.result === 'BE'
    );

    const totalClosed = closedSignals.length;

    // Helper: calculate time ranges
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;

    const getWinRateForDays = (days: number) => {
      const cutoff = new Date(now.getTime() - days * msInDay);
      const filtered = closedSignals.filter((s) => new Date(s.createdAt) >= cutoff);
      if (filtered.length === 0) return { winRate: 0, total: 0 };
      
      const wins = filtered.filter((s) => s.result === 'Win').length;
      const losses = filtered.filter((s) => s.result === 'Loss').length;
      const be = filtered.filter((s) => s.result === 'BE').length;
      
      const winRate = filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : 0;
      return { winRate, total: filtered.length, wins, losses, be };
    };

    const stats7 = getWinRateForDays(7);
    const stats30 = getWinRateForDays(30);
    const stats90 = getWinRateForDays(90);

    // 2. Profit Factor, Achieved R-multiple, and Points calculations
    let grossProfitR = 0;
    let grossLossR = 0;
    let totalR = 0;
    let totalPoints = 0;

    closedSignals.forEach((s) => {
      const trade = s.paperTrades[0];
      let rResult = 0;
      let diffPoints = 0;

      // Calculate R Result
      if (s.result === 'Win') {
        rResult = trade?.rrResult || s.riskReward || 2.0;
        grossProfitR += rResult;
      } else if (s.result === 'Loss') {
        rResult = trade?.rrResult || -1.0;
        grossLossR += Math.abs(rResult);
      }

      totalR += rResult;

      // Calculate Gold Points (1 usd move = 100 points)
      if (trade && typeof trade.exitPrice === 'number' && trade.exitPrice > 0) {
        const isBuy = trade.direction === 'BUY';
        const diff = isBuy ? (trade.exitPrice - trade.entry) : (trade.entry - trade.exitPrice);
        diffPoints = Math.round(diff * 100);
      } else {
        // Fallback estimate
        if (s.result === 'Win') {
          diffPoints = Math.round((s.takeProfit1 - s.entry) * 100) || 1000;
        } else if (s.result === 'Loss') {
          diffPoints = -Math.round(Math.abs(s.entry - s.stopLoss) * 100) || -500;
        }
      }
      totalPoints += diffPoints;
    });

    const profitFactor = grossLossR > 0 ? parseFloat((grossProfitR / grossLossR).toFixed(2)) : parseFloat(grossProfitR.toFixed(2));
    const averageRR = totalClosed > 0 ? parseFloat((totalR / totalClosed).toFixed(2)) : 0.0;
    const averagePoints = totalClosed > 0 ? Math.round(totalPoints / totalClosed) : 0;

    // 3. Max losing streak
    let maxLosingStreak = 0;
    let currentLosingStreak = 0;

    closedSignals.forEach((s) => {
      if (s.result === 'Loss') {
        currentLosingStreak++;
        if (currentLosingStreak > maxLosingStreak) {
          maxLosingStreak = currentLosingStreak;
        }
      } else if (s.result === 'Win') {
        currentLosingStreak = 0;
      }
    });

    // 4. Session Analysis (Bangkok hours UTC+7)
    const sessions = {
      Asia: { name: 'Asia', wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 },
      London: { name: 'London', wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 },
      NewYork: { name: 'New York', wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 }
    };

    closedSignals.forEach((s) => {
      const date = new Date(s.createdAt);
      const localHour = (date.getUTCHours() + 7) % 24;

      let sessionKey: 'Asia' | 'London' | 'NewYork' = 'Asia';
      if (localHour >= 7 && localHour < 15) {
        sessionKey = 'Asia';
      } else if (localHour >= 15 && localHour < 22) {
        sessionKey = 'London';
      } else {
        sessionKey = 'NewYork';
      }

      const trade = s.paperTrades[0];
      let rResult = 0;
      let diffPoints = 0;

      if (s.result === 'Win') {
        sessions[sessionKey].wins++;
        rResult = trade?.rrResult || s.riskReward || 2.0;
      } else if (s.result === 'Loss') {
        sessions[sessionKey].losses++;
        rResult = trade?.rrResult || -1.0;
      } else {
        sessions[sessionKey].be++;
      }

      // Calculate points
      if (trade && typeof trade.exitPrice === 'number' && trade.exitPrice > 0) {
        const isBuy = trade.direction === 'BUY';
        const diff = isBuy ? (trade.exitPrice - trade.entry) : (trade.entry - trade.exitPrice);
        diffPoints = Math.round(diff * 100);
      } else {
        if (s.result === 'Win') {
          diffPoints = Math.round((s.takeProfit1 - s.entry) * 100) || 1000;
        } else if (s.result === 'Loss') {
          diffPoints = -Math.round(Math.abs(s.entry - s.stopLoss) * 100) || -500;
        }
      }

      sessions[sessionKey].total++;
      sessions[sessionKey].netR += rResult;
      sessions[sessionKey].netPoints += diffPoints;
    });

    let bestSession = 'N/A';
    let maxSessionNetR = -999;
    Object.values(sessions).forEach((sess) => {
      if (sess.total > 0 && sess.netR > maxSessionNetR) {
        maxSessionNetR = sess.netR;
        bestSession = sess.name;
      }
    });

    // 5. Best Timeframe Analysis
    const timeframes: Record<string, { wins: number; losses: number; be: number; total: number; netR: number; netPoints: number }> = {};
    closedSignals.forEach((s) => {
      const tf = s.timeframe || 'H1';
      if (!timeframes[tf]) {
        timeframes[tf] = { wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 };
      }
      
      const trade = s.paperTrades[0];
      let rResult = 0;
      let diffPoints = 0;

      if (s.result === 'Win') {
        timeframes[tf].wins++;
        rResult = trade?.rrResult || s.riskReward || 2.0;
      } else if (s.result === 'Loss') {
        timeframes[tf].losses++;
        rResult = trade?.rrResult || -1.0;
      } else {
        timeframes[tf].be++;
      }

      if (trade && typeof trade.exitPrice === 'number' && trade.exitPrice > 0) {
        const isBuy = trade.direction === 'BUY';
        const diff = isBuy ? (trade.exitPrice - trade.entry) : (trade.entry - trade.exitPrice);
        diffPoints = Math.round(diff * 100);
      } else {
        if (s.result === 'Win') {
          diffPoints = Math.round((s.takeProfit1 - s.entry) * 100) || 1000;
        } else if (s.result === 'Loss') {
          diffPoints = -Math.round(Math.abs(s.entry - s.stopLoss) * 100) || -500;
        }
      }

      timeframes[tf].total++;
      timeframes[tf].netR += rResult;
      timeframes[tf].netPoints += diffPoints;
    });

    let bestTimeframe = 'N/A';
    let maxTfNetR = -999;
    Object.entries(timeframes).forEach(([tf, stats]) => {
      if (stats.total > 0 && stats.netR > maxTfNetR) {
        maxTfNetR = stats.netR;
        bestTimeframe = tf;
      }
    });

    // 6. Best Setup Type Analysis
    const setups: Record<string, { wins: number; losses: number; be: number; total: number; netR: number; netPoints: number }> = {};
    closedSignals.forEach((s) => {
      let setupType = 'Trend Alignment';
      try {
        const reasonObj = JSON.parse(s.reason || '{}');
        if (reasonObj.zoneHit) {
          setupType = `Zone ${reasonObj.zoneHit.type === 'SUPPORT' ? 'Support' : 'Resistance'} Bounce`;
        } else if (reasonObj.liquiditySweep) {
          setupType = 'Liquidity Sweep';
        } else if (reasonObj.fakeBreakout) {
          setupType = 'Fakeout Trap';
        } else if (reasonObj.strategyMode) {
          setupType = reasonObj.strategyMode;
        }
      } catch {
        // use default
      }

      if (!setups[setupType]) {
        setups[setupType] = { wins: 0, losses: 0, be: 0, total: 0, netR: 0, netPoints: 0 };
      }

      const trade = s.paperTrades[0];
      let rResult = 0;
      let diffPoints = 0;

      if (s.result === 'Win') {
        setups[setupType].wins++;
        rResult = trade?.rrResult || s.riskReward || 2.0;
      } else if (s.result === 'Loss') {
        setups[setupType].losses++;
        rResult = trade?.rrResult || -1.0;
      } else {
        setups[setupType].be++;
      }

      if (trade && typeof trade.exitPrice === 'number' && trade.exitPrice > 0) {
        const isBuy = trade.direction === 'BUY';
        const diff = isBuy ? (trade.exitPrice - trade.entry) : (trade.entry - trade.exitPrice);
        diffPoints = Math.round(diff * 100);
      } else {
        if (s.result === 'Win') {
          diffPoints = Math.round((s.takeProfit1 - s.entry) * 100) || 1000;
        } else if (s.result === 'Loss') {
          diffPoints = -Math.round(Math.abs(s.entry - s.stopLoss) * 100) || -500;
        }
      }

      setups[setupType].total++;
      setups[setupType].netR += rResult;
      setups[setupType].netPoints += diffPoints;
    });

    let bestSetupType = 'N/A';
    let maxSetupNetR = -999;
    Object.entries(setups).forEach(([setup, stats]) => {
      if (stats.total > 0 && stats.netR > maxSetupNetR) {
        maxSetupNetR = stats.netR;
        bestSetupType = setup;
      }
    });

    // Fetch and auto-refresh Strategy Research Report
    let strategyResearch = await StrategyResearchService.getStoredReport('XAUUSD');
    if (!strategyResearch) {
      strategyResearch = await StrategyResearchService.runFromDatabase('XAUUSD');
    } else {
      strategyResearch = await StrategyResearchService.refreshStoredReportFromPaperTrades('XAUUSD');
    }

    // Compile response
    return NextResponse.json({
      summary: {
        totalSignalsCount,
        totalClosed,
        winRate7d: stats7.winRate,
        total7d: stats7.total,
        winRate30d: stats30.winRate,
        total30d: stats30.total,
        winRate90d: stats90.winRate,
        total90d: stats90.total,
        profitFactor,
        averageRR,
        averagePoints,
        totalPoints,
        maxLosingStreak,
        bestSession,
        bestTimeframe,
        bestSetupType
      },
      sessions,
      timeframes,
      setups,
      strategyResearch
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to calculate performance metrics.', details: err.message },
      { status: 500 }
    );
  }
}
