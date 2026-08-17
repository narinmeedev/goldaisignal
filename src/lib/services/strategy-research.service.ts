import { prisma } from '../prisma';
import { M5EntryConfirmationService } from './m5-entry-confirmation.service';

type Direction = 'BUY' | 'SELL';
type StrategyMode = 'SCALP' | 'SWING' | 'FOLLOW_TREND';
type ResearchStatus = 'APPROVED' | 'RESEARCHING';

export type ResearchCandle = {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type StrategyCandidateResult = {
  id: string;
  label: string;
  mode: StrategyMode;
  status: ResearchStatus;
  winRate: number;
  sampleSize: number;
  wins: number;
  losses: number;
  netR: number;
  expectancyR?: number;
  maxDrawdownR?: number;
  wilsonLowerBound?: number;
  parameters: {
    confirmation: string;
    slPoints?: number;
    riskReward: number;
    lookaheadBars: number;
  };
  backtest?: {
    winRate: number;
    sampleSize: number;
    wins: number;
    losses: number;
    netR: number;
    expectancyR?: number;
    maxDrawdownR?: number;
    wilsonLowerBound?: number;
  };
  liveForwardTest?: {
    winRate: number;
    sampleSize: number;
    wins: number;
    losses: number;
    breakEven: number;
    netR: number;
  };
  rationale: string;
};

export type StrategyResearchReport = {
  symbol: string;
  generatedAt: string;
  targetWinRate: number;
  approvedStrategies: string[];
  candidates: StrategyCandidateResult[];
};

type BacktestOutcome = {
  result: 'WIN' | 'LOSS';
  rr: number;
};

type BacktestVariant = {
  confirmation: string;
  slPoints?: number;
  riskReward: number;
  lookaheadBars: number;
};

const TARGET_WIN_RATE = 50;
const MIN_BACKTEST_SAMPLES = 30;
const MIN_FORWARD_SAMPLES_TO_APPROVE = 20;
const MIN_FORWARD_WILSON_LOWER_BOUND = 30;
const ESTIMATED_EXECUTION_COST_R = 0.08;

const normalizeCandles = (candles: ResearchCandle[]) =>
  [...candles]
    .filter((candle) => Number.isFinite(candle.open) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const pointValueForSymbol = (_symbol: string) => 0.01;

const calcEMAAt = (candles: ResearchCandle[], endIndex: number, period: number) => {
  const start = Math.max(0, endIndex - period + 1);
  const sample = candles.slice(start, endIndex + 1);
  if (sample.length === 0) return candles[endIndex]?.close ?? 0;
  const k = 2 / (period + 1);
  let ema = sample[0].close;
  for (let i = 1; i < sample.length; i++) {
    ema = sample[i].close * k + ema * (1 - k);
  }
  return ema;
};

const calcATRAt = (candles: ResearchCandle[], endIndex: number, period = 14) => {
  if (endIndex < 1) return Math.abs(candles[endIndex]?.high - candles[endIndex]?.low) || 1;
  const start = Math.max(1, endIndex - period + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIndex; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    );
    sum += tr;
    count++;
  }
  return count > 0 ? sum / count : 1;
};

const findLastClosedCandleIndex = (
  candles: ResearchCandle[],
  decisionTime: Date,
  timeframeMs: number,
) => {
  const cutoff = decisionTime.getTime() - timeframeMs;
  for (let index = candles.length - 1; index >= 0; index--) {
    if (candles[index].time.getTime() <= cutoff) return index;
  }
  return -1;
};

const evaluateOutcome = (
  candles: ResearchCandle[],
  index: number,
  direction: Direction,
  entry: number,
  stopLoss: number,
  takeProfit: number,
  lookaheadBars: number,
): BacktestOutcome | null => {
  const end = Math.min(candles.length - 1, index + lookaheadBars);
  for (let i = index + 1; i <= end; i++) {
    const candle = candles[i];
    if (direction === 'BUY') {
      if (candle.low <= stopLoss) return { result: 'LOSS', rr: -1 - ESTIMATED_EXECUTION_COST_R };
      if (candle.high >= takeProfit) return { result: 'WIN', rr: Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss) - ESTIMATED_EXECUTION_COST_R };
    } else {
      if (candle.high >= stopLoss) return { result: 'LOSS', rr: -1 - ESTIMATED_EXECUTION_COST_R };
      if (candle.low <= takeProfit) return { result: 'WIN', rr: Math.abs(entry - takeProfit) / Math.abs(stopLoss - entry) - ESTIMATED_EXECUTION_COST_R };
    }
  }
  return null;
};

const isBullishEngulfing = (current: ResearchCandle, previous: ResearchCandle) =>
  previous.close < previous.open &&
  current.close > current.open &&
  current.open <= previous.close &&
  current.close >= previous.open;

const isBearishEngulfing = (current: ResearchCandle, previous: ResearchCandle) =>
  previous.close > previous.open &&
  current.close < current.open &&
  current.open >= previous.close &&
  current.close <= previous.open;

const summarizeOutcomes = (outcomes: BacktestOutcome[]) => {
  const wins = outcomes.filter((trade) => trade.result === 'WIN').length;
  const losses = outcomes.filter((trade) => trade.result === 'LOSS').length;
  const sampleSize = wins + losses;
  const winRate = sampleSize > 0 ? (wins / sampleSize) * 100 : 0;
  const netR = outcomes.reduce((sum, trade) => sum + trade.rr, 0);
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  outcomes.forEach((trade) => {
    equity += trade.rr;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  });

  // 95% Wilson score lower bound. This keeps small, lucky samples from being
  // presented as reliable probabilities.
  const z = 1.96;
  const p = sampleSize > 0 ? wins / sampleSize : 0;
  const denominator = 1 + (z * z) / Math.max(sampleSize, 1);
  const centre = p + (z * z) / (2 * Math.max(sampleSize, 1));
  const margin = z * Math.sqrt(
    (p * (1 - p)) / Math.max(sampleSize, 1) + (z * z) / (4 * Math.max(sampleSize, 1) ** 2),
  );
  const wilsonLowerBound = sampleSize > 0 ? ((centre - margin) / denominator) * 100 : 0;

  return {
    wins,
    losses,
    sampleSize,
    winRate: round(winRate, 1),
    netR: round(netR, 2),
    expectancyR: sampleSize > 0 ? round(netR / sampleSize, 3) : 0,
    maxDrawdownR: round(maxDrawdownR, 2),
    wilsonLowerBound: round(wilsonLowerBound, 1),
  };
};

const chooseBestVariant = (
  variants: BacktestVariant[],
  tester: (variant: BacktestVariant) => BacktestOutcome[],
) => {
  return variants
    .map((variant) => {
      const outcomes = tester(variant);
      const splitIndex = Math.max(1, Math.floor(outcomes.length * 0.7));
      return {
        variant,
        trainingStats: summarizeOutcomes(outcomes.slice(0, splitIndex)),
        stats: summarizeOutcomes(outcomes.slice(splitIndex)),
      };
    })
    .sort((a, b) => {
      if (b.trainingStats.expectancyR !== a.trainingStats.expectancyR) {
        return b.trainingStats.expectancyR - a.trainingStats.expectancyR;
      }
      if (b.trainingStats.wilsonLowerBound !== a.trainingStats.wilsonLowerBound) {
        return b.trainingStats.wilsonLowerBound - a.trainingStats.wilsonLowerBound;
      }
      return b.trainingStats.sampleSize - a.trainingStats.sampleSize;
    })[0] ?? {
      variant: variants[0],
      trainingStats: summarizeOutcomes([]),
      stats: summarizeOutcomes([]),
    };
};

const buildCandidate = (
  id: string,
  label: string,
  mode: StrategyMode,
  rationale: string,
  best: ReturnType<typeof chooseBestVariant>,
): StrategyCandidateResult => {
  // Historical optimization never approves a live strategy by itself. It can
  // only nominate a candidate for forward/shadow testing.
  const historicallyViable = best.stats.sampleSize >= MIN_BACKTEST_SAMPLES &&
    best.stats.netR > 0 && best.stats.expectancyR > 0;
  return {
    id,
    label,
    mode,
    status: 'RESEARCHING',
    winRate: best.stats.winRate,
    sampleSize: best.stats.sampleSize,
    wins: best.stats.wins,
    losses: best.stats.losses,
    netR: best.stats.netR,
    expectancyR: best.stats.expectancyR,
    maxDrawdownR: best.stats.maxDrawdownR,
    wilsonLowerBound: best.stats.wilsonLowerBound,
    backtest: {
      winRate: best.stats.winRate,
      sampleSize: best.stats.sampleSize,
      wins: best.stats.wins,
      losses: best.stats.losses,
      netR: best.stats.netR,
      expectancyR: best.stats.expectancyR,
      maxDrawdownR: best.stats.maxDrawdownR,
      wilsonLowerBound: best.stats.wilsonLowerBound,
    },
    parameters: best.variant,
    rationale: `${rationale} | ${historicallyViable ? 'ผ่านเกณฑ์ส่งเข้า shadow test' : 'ข้อมูล out-of-sample ยังไม่พอสำหรับเปิดใช้จริง'}`,
  };
};

const parseSignalReason = (value?: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value) as { strategyId?: string };
  } catch {
    return null;
  }
};

export class StrategyResearchService {
  static settingKey(_symbol: string) {
    return 'STRATEGY_RESEARCH_XAUUSD';
  }

  static parseReport(value?: string | null): StrategyResearchReport | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as StrategyResearchReport;
      if (!parsed || !Array.isArray(parsed.candidates)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static async getStoredReport(symbol: string): Promise<StrategyResearchReport | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: this.settingKey(symbol) },
    });
    return this.parseReport(setting?.value);
  }

  static async saveReport(report: StrategyResearchReport) {
    return prisma.systemSetting.upsert({
      where: { key: this.settingKey(report.symbol) },
      update: { value: JSON.stringify(report) },
      create: { key: this.settingKey(report.symbol), value: JSON.stringify(report) },
    });
  }

  static async refreshStoredReportFromPaperTrades(symbol: string): Promise<StrategyResearchReport | null> {
    const currentReport = await this.getStoredReport(symbol);
    if (!currentReport) return null;

    const updatedReport = await this.applyForwardTestResults(symbol, currentReport);
    await this.saveReport(updatedReport);
    return updatedReport;
  }

  static async applyForwardTestResults(
    symbol: string,
    report: StrategyResearchReport,
  ): Promise<StrategyResearchReport> {
    const searchSymbol = 'XAU';
    const testedTrades = await prisma.paperTrade.findMany({
      where: {
        symbol: {
          in: [
            'XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'GOLD.ecn', 'GOLD.r', 'GOLD_M',
            'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw', 'XAUUSD_M', 'XAUUSD.ecn'
          ]
        },
        result: { in: ['WIN', 'LOSS', 'BE'] },
        signal: { isNot: null },
      },
      include: { signal: true },
    });

    const liveStats: Record<string, { wins: number; losses: number; breakEven: number; netR: number }> = {};

    for (const trade of testedTrades) {
      const strategyId = parseSignalReason(trade.signal?.reason)?.strategyId;
      if (!strategyId) continue;

      if (!liveStats[strategyId]) {
        liveStats[strategyId] = { wins: 0, losses: 0, breakEven: 0, netR: 0 };
      }

      if (trade.result === 'WIN') liveStats[strategyId].wins++;
      if (trade.result === 'LOSS') liveStats[strategyId].losses++;
      if (trade.result === 'BE') liveStats[strategyId].breakEven++;
      liveStats[strategyId].netR += trade.rrResult;
    }

    const candidates = report.candidates.map((candidate) => {
      const base = candidate.backtest || {
        winRate: candidate.winRate,
        sampleSize: candidate.sampleSize,
        wins: candidate.wins,
        losses: candidate.losses,
        netR: candidate.netR,
      };
      const live = liveStats[candidate.id] || { wins: 0, losses: 0, breakEven: 0, netR: 0 };
      const liveSampleSize = live.wins + live.losses;
      const liveWinRate = liveSampleSize > 0 ? round((live.wins / liveSampleSize) * 100, 1) : 0;
      const combinedWins = base.wins + live.wins;
      const combinedLosses = base.losses + live.losses;
      const combinedSampleSize = combinedWins + combinedLosses;
      const combinedWinRate = combinedSampleSize > 0 ? round((combinedWins / combinedSampleSize) * 100, 1) : 0;
      const combinedNetR = round(base.netR + live.netR, 2);
      const liveSummary = summarizeOutcomes([
        ...Array.from({ length: live.wins }, () => ({ result: 'WIN' as const, rr: live.wins > 0 ? Math.max(0.1, live.netR + live.losses) / live.wins : 0 })),
        ...Array.from({ length: live.losses }, () => ({ result: 'LOSS' as const, rr: -1 })),
      ]);
      const approved = liveSampleSize >= MIN_FORWARD_SAMPLES_TO_APPROVE &&
        live.netR > 0 &&
        liveWinRate >= 40 &&
        liveSummary.wilsonLowerBound >= MIN_FORWARD_WILSON_LOWER_BOUND;
      const status: ResearchStatus = approved ? 'APPROVED' : 'RESEARCHING';

      return {
        ...candidate,
        status,
        winRate: combinedWinRate,
        sampleSize: combinedSampleSize,
        wins: combinedWins,
        losses: combinedLosses,
        netR: combinedNetR,
        expectancyR: combinedSampleSize > 0 ? round(combinedNetR / combinedSampleSize, 3) : 0,
        wilsonLowerBound: liveSummary.wilsonLowerBound,
        backtest: base,
        liveForwardTest: {
          winRate: liveWinRate,
          sampleSize: liveSampleSize,
          wins: live.wins,
          losses: live.losses,
          breakEven: live.breakEven,
          netR: round(live.netR, 2),
        },
      };
    });

    return {
      ...report,
      generatedAt: new Date().toISOString(),
      approvedStrategies: candidates.filter((candidate) => candidate.status === 'APPROVED').map((candidate) => candidate.id),
      candidates,
    };
  }

  static async runFromDatabase(symbol: string): Promise<StrategyResearchReport> {
    const targetSymbol = 'XAUUSD';
    const searchSymbol = 'XAU';
    const [m5Candles, m15Candles, h1Candles] = await Promise.all([
      prisma.candle.findMany({
        where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, timeframe: 'M5' },
        orderBy: { time: 'desc' },
        take: 9000,
      }),
      prisma.candle.findMany({
        where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, timeframe: 'M15' },
        orderBy: { time: 'desc' },
        take: 3000,
      }),
      prisma.candle.findMany({
        where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, timeframe: 'H1' },
        orderBy: { time: 'desc' },
        take: 1000,
      }),
    ]);

    const report = await this.applyForwardTestResults(targetSymbol, this.researchStrategies(targetSymbol, m5Candles, m15Candles, h1Candles));
    await this.saveReport(report);
    return report;
  }

  static researchStrategies(
    symbol: string,
    m5Input: ResearchCandle[],
    m15Input: ResearchCandle[],
    h1Input: ResearchCandle[],
  ): StrategyResearchReport {
    const m5 = normalizeCandles(m5Input);
    const m15 = normalizeCandles(m15Input);
    const h1 = normalizeCandles(h1Input);
    const point = pointValueForSymbol(symbol);
    const fixedSl = 500 * point;

    const supportVariants: BacktestVariant[] = [
      { confirmation: 'M5 bullish engulfing at support', slPoints: 500, riskReward: 2, lookaheadBars: 18 },
      { confirmation: 'M5 bullish engulfing at support', slPoints: 700, riskReward: 1.8, lookaheadBars: 24 },
      { confirmation: 'M5 green close reclaiming support', slPoints: 500, riskReward: 1.6, lookaheadBars: 18 },
    ];

    const resistanceVariants: BacktestVariant[] = [
      { confirmation: 'M5 bearish engulfing at resistance', slPoints: 500, riskReward: 2, lookaheadBars: 18 },
      { confirmation: 'M5 bearish engulfing at resistance', slPoints: 700, riskReward: 1.8, lookaheadBars: 24 },
      { confirmation: 'M5 red close rejecting resistance', slPoints: 500, riskReward: 1.6, lookaheadBars: 18 },
    ];

    const trendVariants: BacktestVariant[] = [
      { confirmation: 'EMA20 pullback with trend alignment', riskReward: 2, lookaheadBars: 16 },
      { confirmation: 'EMA20 pullback with trend alignment', riskReward: 2.5, lookaheadBars: 24 },
    ];

    const supportBest = chooseBestVariant(supportVariants, (variant) => {
      const outcomes: BacktestOutcome[] = [];
      for (let i = 24; i < m5.length - variant.lookaheadBars; i++) {
        const current = m5[i];
        const previous = m5[i - 1];
        const atr = calcATRAt(m5, i);
        const rollingSupport = Math.min(...m5.slice(Math.max(0, i - 24), i).map((candle) => candle.low));
        const isAtSupport = current.low <= rollingSupport + atr * 0.45;
        const hasConfirmation = variant.confirmation.includes('engulfing')
          ? isBullishEngulfing(current, previous)
          : current.close > current.open && current.close > rollingSupport;
        if (!isAtSupport || !hasConfirmation) continue;

        const entry = current.close;
        const stopLoss = entry - (variant.slPoints ? variant.slPoints * point : fixedSl);
        const risk = Math.abs(entry - stopLoss);
        const takeProfit = entry + risk * variant.riskReward;
        const outcome = evaluateOutcome(m5, i, 'BUY', entry, stopLoss, takeProfit, variant.lookaheadBars);
        if (outcome) outcomes.push(outcome);
      }
      return outcomes;
    });

    const resistanceBest = chooseBestVariant(resistanceVariants, (variant) => {
      const outcomes: BacktestOutcome[] = [];
      for (let i = 24; i < m5.length - variant.lookaheadBars; i++) {
        const current = m5[i];
        const previous = m5[i - 1];
        const atr = calcATRAt(m5, i);
        const rollingResistance = Math.max(...m5.slice(Math.max(0, i - 24), i).map((candle) => candle.high));
        const isAtResistance = current.high >= rollingResistance - atr * 0.45;
        const hasConfirmation = variant.confirmation.includes('engulfing')
          ? isBearishEngulfing(current, previous)
          : current.close < current.open && current.close < rollingResistance;
        if (!isAtResistance || !hasConfirmation) continue;

        const entry = current.close;
        const stopLoss = entry + (variant.slPoints ? variant.slPoints * point : fixedSl);
        const risk = Math.abs(stopLoss - entry);
        const takeProfit = entry - risk * variant.riskReward;
        const outcome = evaluateOutcome(m5, i, 'SELL', entry, stopLoss, takeProfit, variant.lookaheadBars);
        if (outcome) outcomes.push(outcome);
      }
      return outcomes;
    });

    const trendBest = chooseBestVariant(trendVariants, (variant) => {
      const outcomes: BacktestOutcome[] = [];
      for (let i = 30; i < m15.length - variant.lookaheadBars; i++) {
        const current = m15[i];
        const previous = m15[i - 1];
        const ema20 = calcEMAAt(m15, i, 20);
        const atr = calcATRAt(m15, i);
        const h1Index = findLastClosedCandleIndex(h1, current.time, 60 * 60 * 1000);
        if (h1Index < 20) continue;
        const h1Ema20 = calcEMAAt(h1, h1Index, 20);
        const h1Close = h1[h1Index].close;

        const bullishSetup = h1Close >= h1Ema20 && current.close > ema20 && previous.low <= ema20 && current.close > previous.high;
        const bearishSetup = h1Close <= h1Ema20 && current.close < ema20 && previous.high >= ema20 && current.close < previous.low;

        if (bullishSetup) {
          const entry = current.close;
          const stopLoss = Math.min(previous.low, ema20 - atr * 0.5);
          const risk = Math.abs(entry - stopLoss);
          const takeProfit = entry + risk * variant.riskReward;
          const outcome = evaluateOutcome(m15, i, 'BUY', entry, stopLoss, takeProfit, variant.lookaheadBars);
          if (outcome) outcomes.push(outcome);
        }

        if (bearishSetup) {
          const entry = current.close;
          const stopLoss = Math.max(previous.high, ema20 + atr * 0.5);
          const risk = Math.abs(stopLoss - entry);
          const takeProfit = entry - risk * variant.riskReward;
          const outcome = evaluateOutcome(m15, i, 'SELL', entry, stopLoss, takeProfit, variant.lookaheadBars);
          if (outcome) outcomes.push(outcome);
        }
      }
      return outcomes;
    });

    const scalpBest = chooseBestVariant([
      { confirmation: 'M5/M15 zone reversal with RSI filter', riskReward: 1.5, lookaheadBars: 10 },
      { confirmation: 'M5/M15 zone reversal with RSI filter', riskReward: 2, lookaheadBars: 14 },
    ], (variant) => {
      const outcomes: BacktestOutcome[] = [];
      for (let i = 24; i < m5.length - variant.lookaheadBars; i++) {
        const current = m5[i];
        const previous = m5[i - 1];
        const ema20 = calcEMAAt(m5, i, 20);
        const atr = calcATRAt(m5, i);
        const direction: Direction | null = current.close > current.open && current.low <= ema20 ? 'BUY' : current.close < current.open && current.high >= ema20 ? 'SELL' : null;
        if (!direction) continue;

        const entry = current.close;
        const stopLoss = direction === 'BUY' ? Math.min(previous.low, entry - atr) : Math.max(previous.high, entry + atr);
        const risk = Math.abs(entry - stopLoss);
        const takeProfit = direction === 'BUY' ? entry + risk * variant.riskReward : entry - risk * variant.riskReward;
        const outcome = evaluateOutcome(m5, i, direction, entry, stopLoss, takeProfit, variant.lookaheadBars);
        if (outcome) outcomes.push(outcome);
      }
      return outcomes;
    });

    const chochVariant: BacktestVariant = {
      confirmation: 'Closed M5 support/resistance reclaim with CHOCH',
      riskReward: 2,
      lookaheadBars: 24,
    };
    const testChochDirection = (direction: Direction) => chooseBestVariant([chochVariant], (variant) => {
      const outcomes: BacktestOutcome[] = [];
      for (let i = 30; i < m5.length - variant.lookaheadBars; i++) {
        const current = m5[i];
        const confirmation = M5EntryConfirmationService.analyze({
          candles: m5.slice(Math.max(0, i - 48), i + 1),
          currentPrice: current.close,
          now: new Date(current.time.getTime() + 5 * 60 * 1000 + 1),
        });
        if (confirmation.direction !== direction || confirmation.entry === null || confirmation.stopLoss === null || confirmation.takeProfit === null) continue;
        const outcome = evaluateOutcome(
          m5,
          i,
          direction,
          confirmation.entry,
          confirmation.stopLoss,
          confirmation.takeProfit,
          variant.lookaheadBars,
        );
        if (outcome) outcomes.push(outcome);
      }
      return outcomes;
    });
    const supportChochBest = testChochDirection('BUY');
    const resistanceChochBest = testChochDirection('SELL');

    const candidates = [
      buildCandidate(
        'support_m5_choch_reclaim',
        'Buy real support after closed M5 reclaim and CHOCH UP',
        'SWING',
        'แตะแนวรับก่อน จากนั้นแท่ง M5 ที่ปิดแล้วต้องยกตัว ปิดเหนือแท่งขายล่าสุด และเบรก lower-high ย่อยก่อนออก BUY',
        supportChochBest,
      ),
      buildCandidate(
        'resistance_m5_choch_reclaim',
        'Sell real resistance after closed M5 rejection and CHOCH DOWN',
        'SWING',
        'แตะแนวต้านก่อน จากนั้นแท่ง M5 ที่ปิดแล้วต้องกดตัว ปิดต่ำกว่าแท่งซื้อล่าสุด และเบรก higher-low ย่อยก่อนออก SELL',
        resistanceChochBest,
      ),
      buildCandidate(
        'support_m5_bullish_engulfing',
        'Buy support base after M5 bullish engulfing',
        'SWING',
        'ใช้เฉพาะเมื่อราคาทดสอบฐานแนวรับสำคัญแล้ว M5 ปิดเขียวแบบ engulfing พร้อม SL 500 จุดเป็นค่าเริ่มต้น',
        supportBest,
      ),
      buildCandidate(
        'resistance_m5_bearish_engulfing',
        'Sell resistance rejection after M5 bearish engulfing',
        'SWING',
        'ใช้เฉพาะเมื่อราคาทดสอบแนวต้านสำคัญแล้ว M5 ปิดแดงแบบ engulfing ก่อนขาย',
        resistanceBest,
      ),
      buildCandidate(
        'follow_trend_ema20_pullback',
        'Follow trend after EMA20 pullback',
        'FOLLOW_TREND',
        'ใช้เมื่อ H1 และ M15 ไปทางเดียวกัน แล้วราคาย่อกลับมาแถว EMA20 ก่อนไปต่อ',
        trendBest,
      ),
      buildCandidate(
        'scalp_m5_zone_reversal',
        'M5/M15 zone scalp reversal',
        'SCALP',
        'ใช้กับจังหวะสั้นใกล้โซน M5/M15 พร้อมยืนยันด้วยแท่งกลับตัวและกรอบความเสี่ยงสั้น',
        scalpBest,
      ),
    ];

    return {
      symbol: 'XAUUSD',
      generatedAt: new Date().toISOString(),
      targetWinRate: TARGET_WIN_RATE,
      approvedStrategies: candidates.filter((candidate) => candidate.status === 'APPROVED').map((candidate) => candidate.id),
      candidates,
    };
  }
}
