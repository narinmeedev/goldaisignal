import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
import { StrategyResearchService, type StrategyResearchReport } from '@/lib/services/strategy-research.service';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { PaperTradeService } from '@/lib/services/paper-trade.service';
import { NotificationService } from '@/lib/services/notification.service';
import { QwenLocalAiService } from '@/lib/services/qwen-ai.service';
import { MarketRegimeService } from '@/lib/services/market-regime.service';
import { M5EntryConfirmationService } from '@/lib/services/m5-entry-confirmation.service';
import { hasValidTradeGeometry } from '@/lib/services/trade-safety.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GOLD_SYMBOL_LIST = [
  'XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'GOLDmicro', 'GOLD.ecn', 'GOLD.r', 'GOLD_M',
  'XAUUSD#', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw', 'XAUUSD_M', 'XAUUSD.ecn'
];

// Global in-memory cache for fallback fetch times to prevent concurrent fetch/write storms
const globalFetchCache = global as unknown as {
  lastFetchMap: Record<string, number>;
  cachedPublicStats: Record<string, any>;
  cachedPublicTime: Record<string, number>;
  cachedAdminStats: Record<string, any>;
  cachedAdminTime: Record<string, number>;
  lastResearchUpkeepMap: Record<string, number>;
};

const isMarketOpen = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // Market closes on Friday at 22:00 UTC and opens on Sunday at 22:00 UTC
  if (day === 5 && hour >= 22) return false; // Friday after 22:00 UTC
  if (day === 6) return false; // Saturday
  if (day === 0 && hour < 22) return false; // Sunday before 22:00 UTC

  return true;
};

if (!globalFetchCache.lastFetchMap) {
  globalFetchCache.lastFetchMap = {};
}
if (!globalFetchCache.cachedPublicStats) {
  globalFetchCache.cachedPublicStats = {};
}
if (!globalFetchCache.cachedPublicTime) {
  globalFetchCache.cachedPublicTime = {};
}
if (!globalFetchCache.cachedAdminStats) {
  globalFetchCache.cachedAdminStats = {};
}
if (!globalFetchCache.cachedAdminTime) {
  globalFetchCache.cachedAdminTime = {};
}
if (!globalFetchCache.lastResearchUpkeepMap) {
  globalFetchCache.lastResearchUpkeepMap = {};
}
const lastFetchMap = globalFetchCache.lastFetchMap;

type CandlePoint = {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  createdAt?: Date;
};

type LiveTick = {
  time: Date;
  receivedAt: Date;
  price: number;
};

type DecisionZone = {
  type: string;
  timeframe?: string;
  priceMin: number;
  priceMax: number;
  strength?: number;
};

type RecommendationPlan = {
  id: string;
  type: string;
  title: string;
  entry: number;
  entry1?: number;
  entry2?: number;
  entry3?: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  confidence: number;
  strategyId?: string;
  strategyMode?: 'SCALP' | 'SWING' | 'FOLLOW_TREND';
  strategyLabel?: string;
  confirmation?: string;
  pointStopLoss?: number;
  timeframe?: string;
  researchStatus?: string;
  researchWinRate?: number | null;
  researchSampleSize?: number;
  researchApproved?: boolean;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons?: string[];
  riskReward?: number;
  direction?: 'BUY' | 'SELL';
  locked?: boolean;
  lockedAt?: string;
  lockedUntil?: string;
  sourcePlanId?: string;
  distanceToEntry?: number;
  currentPriceAtLock?: number;
  updateReason?: string;
};

const roundPrice = (value: number) => parseFloat(value.toFixed(2));
const roundNumber = (value: number, digits = 2) => Number(value.toFixed(digits));
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getBangkokDayRange = (now: Date) => {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkokNow.getUTCFullYear();
  const month = bangkokNow.getUTCMonth();
  const day = bangkokNow.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - BANGKOK_OFFSET_MS);

  return {
    start,
    end: new Date(start.getTime() + DAY_MS),
  };
};

const getBangkokMonthRange = (now: Date) => {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkokNow.getUTCFullYear();
  const month = bangkokNow.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1) - BANGKOK_OFFSET_MS);
  const end = new Date(Date.UTC(year, month + 1, 1) - BANGKOK_OFFSET_MS);

  return { start, end };
};

const serializeOwnerTrade = (trade: any) => ({
  id: trade.id,
  signalId: trade.signalId,
  signalRef: trade.signalId ? trade.signalId.slice(0, 8) : trade.id.slice(0, 8),
  symbol: trade.symbol,
  direction: trade.direction,
  result: trade.result,
  entry: roundPrice(trade.entry),
  exitPrice: typeof trade.exitPrice === 'number' ? roundPrice(trade.exitPrice) : null,
  stopLoss: roundPrice(trade.stopLoss),
  takeProfit1: roundPrice(trade.takeProfit1),
  takeProfit2: typeof trade.takeProfit2 === 'number' ? roundPrice(trade.takeProfit2) : null,
  rrResult: roundNumber(trade.rrResult),
  confidence: trade.signal?.confidence ?? null,
  notes: trade.notes || null,
  openedAt: trade.openedAt?.toISOString?.() || null,
  closedAt: trade.closedAt?.toISOString?.() || null,
});

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
};

const serializeCandles = (candles: CandlePoint[], limit = CHART_CANDLE_LIMIT) =>
  candles
    .slice(0, limit)
    .reverse()
    .map((candle) => ({
      time: candle.time.toISOString(),
      open: roundPrice(candle.open),
      high: roundPrice(candle.high),
      low: roundPrice(candle.low),
      close: roundPrice(candle.close),
      volume: candle.volume,
    }));

const serializeLiveTicks = (ticks: LiveTick[], limit = 36) =>
  ticks
    .slice(-limit)
    .map((tick) => ({
      time: tick.time.toISOString(),
      receivedAt: tick.receivedAt.toISOString(),
      price: roundPrice(tick.price),
    }));

const serializeZone = (zone?: DecisionZone | null) => {
  if (!zone) return null;
  return {
    timeframe: zone.timeframe || 'M15',
    type: zone.type,
    priceMin: roundPrice(zone.priceMin),
    priceMax: roundPrice(zone.priceMax),
    strength: zone.strength || 1,
  };
};

const timeframeMs: Record<string, number> = {
  M5: 5 * 60 * 1000,
  M15: 15 * 60 * 1000,
  H1: 60 * 60 * 1000,
};

const parseEventPayload = (event?: { rawPayload: string } | null) => {
  if (!event) return null;
  try {
    return JSON.parse(event.rawPayload);
  } catch {
    return null;
  }
};

const getEventMarketTime = (event: { receivedAt: Date }, payload: any) => {
  const payloadTime = payload?.timestamp ? new Date(payload.timestamp) : null;
  if (payloadTime && Number.isFinite(payloadTime.getTime())) return payloadTime;
  return event.receivedAt;
};

const eventToLiveTick = (event: { rawPayload: string; receivedAt: Date } | null): LiveTick | null => {
  if (!event) return null;
  const payload = parseEventPayload(event);
  const price = Number(payload?.price);
  if (!Number.isFinite(price)) return null;

  return {
    time: event.receivedAt,
    receivedAt: event.receivedAt,
    price,
  };
};

const mergeLivePriceIntoCandles = (
  candles: CandlePoint[],
  timeframe: keyof typeof timeframeMs,
  livePrice: number,
  eventTime: Date,
) => {
  if (!Number.isFinite(livePrice)) return candles;

  const frameMs = timeframeMs[timeframe];
  const liveCandleTime = new Date(Math.floor(eventTime.getTime() / frameMs) * frameMs);

  const mergeIntoCandle = (candle: CandlePoint) => ({
    ...candle,
    high: Math.max(candle.high, livePrice),
    low: Math.min(candle.low, livePrice),
    close: livePrice,
    createdAt: eventTime,
  });

  if (candles.length === 0) {
    return [{
      time: liveCandleTime,
      open: livePrice,
      high: livePrice,
      low: livePrice,
      close: livePrice,
      volume: 0,
      createdAt: eventTime,
    }];
  }

  const [latest, ...rest] = candles;
  const latestTime = latest.time.getTime();
  const liveTime = liveCandleTime.getTime();

  if (liveTime > latestTime) {
    if (liveTime - latestTime > frameMs * 2) {
      return candles;
    }

    const open = latest.close;
    return [{
      time: liveCandleTime,
      open,
      high: Math.max(open, livePrice),
      low: Math.min(open, livePrice),
      close: livePrice,
      volume: 0,
      createdAt: eventTime,
    }, latest, ...rest].slice(0, 80);
  }

  if (liveTime === latestTime) {
    return [mergeIntoCandle(latest), ...rest];
  }

  let matched = false;
  const merged = candles.map((candle) => {
    if (candle.time.getTime() !== liveTime) return candle;
    matched = true;
    return mergeIntoCandle(candle);
  });

  return matched ? merged : candles;
};

const mergeLiveTicksIntoCandles = (
  candles: CandlePoint[],
  timeframe: keyof typeof timeframeMs,
  ticks: LiveTick[],
) => ticks.reduce(
  (mergedCandles, tick) => mergeLivePriceIntoCandles(mergedCandles, timeframe, tick.price, tick.time),
  candles,
);

const mergeDerivedCandles = (
  baseCandles: CandlePoint[],
  sourceCandles: CandlePoint[],
  timeframe: 'M15' | 'H1',
) => {
  const frameMs = timeframeMs[timeframe];
  const buckets = new Map<number, CandlePoint>();

  [...sourceCandles]
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .forEach((candle) => {
      const bucketTime = Math.floor(candle.time.getTime() / frameMs) * frameMs;
      const existing = buckets.get(bucketTime);

      if (!existing) {
        buckets.set(bucketTime, {
          ...candle,
          time: new Date(bucketTime),
        });
        return;
      }

      buckets.set(bucketTime, {
        ...existing,
        high: Math.max(existing.high, candle.high),
        low: Math.min(existing.low, candle.low),
        close: candle.close,
        volume: existing.volume + candle.volume,
        createdAt: candle.createdAt ?? existing.createdAt,
      });
    });

  const merged = new Map(baseCandles.map((candle) => [candle.time.getTime(), candle]));
  buckets.forEach((candle, time) => merged.set(time, candle));
  return [...merged.values()].sort((a, b) => b.time.getTime() - a.time.getTime());
};

const getResearchCandidate = (report: StrategyResearchReport | null, strategyId?: string) => {
  if (!report || !strategyId) return null;
  return report.candidates.find((candidate) => candidate.id === strategyId) || null;
};

const normalizePlanConfidence = (confidence: number) => Math.min(95, Math.max(0, Math.round(confidence)));

const MIN_RECOMMENDATION_CONFIDENCE = 60;
const MAX_RECOMMENDATION_RISK_SCORE = 65;
const STALE_MT5_CANDLE_BASE_MS = 60 * 60 * 1000;
const STALE_M5_CANDLE_SYNC_MS = 10 * 60 * 1000;
const CHART_CANDLE_LIMIT = 360;
const M5_CANDLE_FETCH_LIMIT = 420;
const M15_CANDLE_FETCH_LIMIT = 240;
const H1_CANDLE_FETCH_LIMIT = 180;
const D1_CANDLE_FETCH_LIMIT = 120;

const stablePlanSettingKey = (symbol: string) => `ACTIVE_ORDER_PLAN_${symbol.toUpperCase()}`;
const researchUpkeepKey = (symbol: string) => `RESEARCH_UPKEEP_${symbol.toUpperCase()}`;

const getPlanDirection = (plan?: { type?: string; direction?: string } | null): 'BUY' | 'SELL' | null => {
  if (!plan) return null;
  if (plan.direction === 'BUY' || plan.direction === 'SELL') return plan.direction;
  if (plan.type?.includes('BUY')) return 'BUY';
  if (plan.type?.includes('SELL')) return 'SELL';
  return null;
};

const getPlanEntryGuide = (plan: RecommendationPlan) => {
  const direction = getPlanDirection(plan);
  const entry = roundPrice(plan.entry);
  const stopLoss = roundPrice(plan.stopLoss);
  const action = plan.type.includes('LIMIT')
    ? direction === 'BUY'
      ? `รอราคาย่อลงแตะ Entry $${entry.toFixed(2)} ก่อน ห้ามไล่ซื้อเหนือจุดเข้า`
      : `รอราคาดีดขึ้นแตะ Entry $${entry.toFixed(2)} ก่อน ห้ามไล่ขายต่ำกว่าจุดเข้า`
    : plan.type.includes('STOP')
      ? direction === 'BUY'
        ? `รอราคาเบรกขึ้นถึง Entry $${entry.toFixed(2)} และยืนเหนือระดับนี้ก่อนเข้า`
        : `รอราคาเบรกลงถึง Entry $${entry.toFixed(2)} และยืนใต้ระดับนี้ก่อนเข้า`
      : `รอราคาแตะ Entry $${entry.toFixed(2)} และยืนยันเงื่อนไขก่อนเข้า`;
  const confirmation = plan.confirmation?.trim()
    ? `\nเงื่อนไขยืนยัน: ${plan.confirmation.trim()}`
    : '';
  return `${action}${confirmation}\nยกเลิกแผนทันทีเมื่อราคาชน Stop Loss $${stopLoss.toFixed(2)} และห้ามเปิดซ้ำจากแผนเดิม`;
};

const isM5DependentPlan = (plan: RecommendationPlan) =>
  plan.timeframe === 'M5' ||
  plan.strategyMode === 'SCALP' ||
  plan.strategyId?.includes('m5') ||
  plan.confirmation?.toLowerCase().includes('m5');

const getPlanLockMinutes = (plan: RecommendationPlan) => {
  if (plan.strategyMode === 'SCALP') return 15; // Extend scalp lock to 15 minutes
  if (plan.type.includes('MARKET')) return 20; // Extend market plan lock to 20 minutes
  return 45; // Extend swing/follow-trend lock to 45 minutes
};

const normalizeOrderPlan = (
  plan: RecommendationPlan,
  currentPrice: number,
  now: Date,
  updateReason: string,
): RecommendationPlan | null => {
  const direction = getPlanDirection(plan);
  if (!direction) return null;

  const lockedAt = plan.lockedAt || now.toISOString();
  const lockedUntil = plan.lockedUntil || new Date(now.getTime() + getPlanLockMinutes(plan) * 60 * 1000).toISOString();
  const entry = roundPrice(plan.entry);

  return {
    ...plan,
    id: plan.id,
    direction,
    entry,
    entry1: typeof plan.entry1 === 'number' ? roundPrice(plan.entry1) : entry,
    entry2: typeof plan.entry2 === 'number' ? roundPrice(plan.entry2) : undefined,
    entry3: typeof plan.entry3 === 'number' ? roundPrice(plan.entry3) : undefined,
    stopLoss: roundPrice(plan.stopLoss),
    takeProfit: roundPrice(plan.takeProfit),
    confidence: normalizePlanConfidence(plan.confidence),
    locked: true,
    lockedAt,
    lockedUntil,
    sourcePlanId: plan.sourcePlanId || plan.id,
    currentPriceAtLock: typeof plan.currentPriceAtLock === 'number'
      ? roundPrice(plan.currentPriceAtLock)
      : roundPrice(currentPrice),
    distanceToEntry: roundPrice(Math.abs(currentPrice - entry)),
    updateReason,
  };
};

const buildPlanRiskProfile = (
  plan: RecommendationPlan,
  context: {
    currentPrice: number;
    volatility: string;
    h1Bias: string;
    m15Bias: string;
    researchSampleSize: number;
    fundamentalBias?: string;
    fundamentalWarning?: string;
  },
): Required<Pick<RecommendationPlan, 'riskScore' | 'riskLevel' | 'riskReasons' | 'riskReward'>> => {
  const direction = getPlanDirection(plan);
  const riskDistance = Math.abs(plan.entry - plan.stopLoss);
  const rewardDistance = Math.abs(plan.takeProfit - plan.entry);
  const riskReward = riskDistance > 0 ? rewardDistance / riskDistance : 0;
  let riskScore = Math.max(5, 100 - normalizePlanConfidence(plan.confidence));
  const riskReasons: string[] = [];

  if (context.volatility === 'EXTREME') {
    riskScore += 25;
    riskReasons.push('ความผันผวนอยู่ระดับรุนแรงมาก ราคาอาจแกว่งชน SL ก่อนเลือกทิศทาง');
  } else if (context.volatility === 'HIGH') {
    riskScore += 15;
    riskReasons.push('ความผันผวนสูงกว่าปกติ มีความเสี่ยงจากไส้เทียนและ slippage');
  }

  if (direction && context.h1Bias !== 'NEUTRAL' && context.h1Bias !== direction) {
    riskScore += 20;
    riskReasons.push(`ทิศทางแผน ${direction} สวนโครงสร้าง H1`);
  }
  if (direction && context.m15Bias !== 'NEUTRAL' && context.m15Bias !== direction) {
    riskScore += 15;
    riskReasons.push(`ทิศทางแผน ${direction} สวนโมเมนตัม M15`);
  }

  const fundamentalDirection = context.fundamentalBias === 'BULLISH'
    ? 'BUY'
    : context.fundamentalBias === 'BEARISH'
      ? 'SELL'
      : null;
  if (direction && fundamentalDirection && fundamentalDirection !== direction) {
    riskScore += 25;
    riskReasons.push(`แผน ${direction} สวนปัจจัยข่าวที่ผู้ดูแลประเมินไว้`);
  }
  if (context.fundamentalWarning?.trim()) {
    riskScore += 15;
    riskReasons.push(`มีความเสี่ยงข่าว: ${context.fundamentalWarning.trim()}`);
  }

  if (riskReward < 2) {
    riskScore += 25;
    riskReasons.push(`ผลตอบแทนต่อความเสี่ยงเพียง 1:${riskReward.toFixed(1)} ต่ำกว่าเกณฑ์ 1:2`);
  }

  const distanceToEntry = Math.abs(context.currentPrice - plan.entry);
  if (riskDistance > 0 && distanceToEntry > riskDistance) {
    riskScore += 8;
    riskReasons.push(`ราคายังห่างจุดเข้า $${distanceToEntry.toFixed(2)} ต้องรอแตะ Entry ก่อนเท่านั้น`);
  }

  if (plan.confirmation?.toLowerCase().includes('wait')) {
    riskScore += 8;
    riskReasons.push('แผนยังต้องรอแท่งเทียนยืนยัน ห้ามเข้าเพียงเพราะราคาแตะโซน');
  }

  if (context.researchSampleSize < 10) {
    riskScore += 10;
    riskReasons.push(`ผลวัดกลยุทธ์ยังมีเพียง ${context.researchSampleSize} ตัวอย่าง ความน่าเชื่อถือทางสถิติยังจำกัด`);
  }

  riskScore = Math.min(95, Math.max(5, Math.round(riskScore)));
  const riskLevel: NonNullable<RecommendationPlan['riskLevel']> =
    riskScore <= 30 ? 'LOW' : riskScore <= 50 ? 'MEDIUM' : 'HIGH';

  if (riskReasons.length === 0) {
    riskReasons.push('โครงสร้าง M15 และ H1 ไปในทิศทางเดียวกัน แต่ยังมีความเสี่ยงที่ราคาจะชน SL');
  }

  return {
    riskScore,
    riskLevel,
    riskReasons: riskReasons.slice(0, 4),
    riskReward: roundNumber(riskReward),
  };
};

const parseStoredOrderPlan = (value?: string | null, currentPrice?: number): RecommendationPlan | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as RecommendationPlan & { isClosed?: boolean };
    if (!parsed || !parsed.id || !parsed.type) return null;
    if (parsed.isClosed) return null;
    if (!Number.isFinite(parsed.entry) || !Number.isFinite(parsed.stopLoss) || !Number.isFinite(parsed.takeProfit)) return null;
    const direction = getPlanDirection(parsed);
    if (!direction || !hasValidTradeGeometry({ direction, entry: parsed.entry, stopLoss: parsed.stopLoss, takeProfit: parsed.takeProfit })) return null;

    if (parsed.lockedAt) {
      const ageMs = Date.now() - new Date(parsed.lockedAt).getTime();
      if (ageMs > 30 * 60 * 1000) return null; // Expire plans older than 30 minutes
    }
    if (typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0) {
      if (Math.abs(currentPrice - parsed.entry) > 8.0) return null; // Expire plans where price moved > $8 away
    }
    return parsed;
  } catch {
    return null;
  }
};

const getOpenTrackingPlan = async (
  symbol: string,
  currentPrice: number,
): Promise<RecommendationPlan | null> => {
  const openTrades = await prisma.paperTrade.findMany({
    where: {
      symbol: { in: [symbol, ...GOLD_SYMBOL_LIST] },
      result: 'OPEN',
    },
    orderBy: { openedAt: 'desc' },
    take: 20,
    include: { signal: true },
  });
  const openTrade = openTrades.find((trade) => {
    try {
      return JSON.parse(trade.signal?.reason || '{}')?.shadowMode !== true;
    } catch {
      return true;
    }
  });
  if (!openTrade) return null;

  let tracking: Record<string, unknown> = {};
  try {
    tracking = JSON.parse(openTrade.signal?.reason || '{}') as Record<string, unknown>;
  } catch {
    tracking = {};
  }

  const direction = openTrade.direction === 'SELL' ? 'SELL' : 'BUY';
  const riskDistance = Math.abs(openTrade.entry - openTrade.stopLoss);
  const takeProfit = openTrade.takeProfit2 || openTrade.takeProfit1;
  if (!hasValidTradeGeometry({ direction, entry: openTrade.entry, stopLoss: openTrade.stopLoss, takeProfit })) return null;
  const riskReward = riskDistance > 0
    ? Math.abs(takeProfit - openTrade.entry) / riskDistance
    : 0;
  const trackedRisks = Array.isArray(tracking.riskReasons)
    ? tracking.riskReasons.filter((reason): reason is string => typeof reason === 'string')
    : [];
  const trackedRiskLevel = tracking.riskLevel;

  return {
    id: typeof tracking.stablePlanLockId === 'string'
      ? tracking.stablePlanLockId
      : `open-trade-${openTrade.id}`,
    sourcePlanId: typeof tracking.sourcePlanId === 'string'
      ? tracking.sourcePlanId
      : undefined,
    type: typeof tracking.planType === 'string'
      ? tracking.planType
      : `${direction}_MARKET`,
    title: typeof tracking.title === 'string'
      ? tracking.title
      : `แผน ${direction} ทองคำที่เข้าแล้ว`,
    reason: typeof tracking.reason === 'string'
      ? tracking.reason
      : 'ราคาถึงจุดเข้าแล้ว ระบบกำลังติดตามผลจนกว่า TP หรือ SL',
    entry: roundPrice(openTrade.entry),
    stopLoss: roundPrice(openTrade.stopLoss),
    takeProfit: roundPrice(takeProfit),
    confidence: normalizePlanConfidence(openTrade.signal?.confidence ?? 70),
    strategyId: typeof tracking.strategyId === 'string' ? tracking.strategyId : undefined,
    strategyMode: tracking.strategyMode === 'SCALP' || tracking.strategyMode === 'SWING' || tracking.strategyMode === 'FOLLOW_TREND'
      ? tracking.strategyMode
      : undefined,
    timeframe: openTrade.signal?.timeframe || 'M15',
    direction,
    riskScore: typeof tracking.riskScore === 'number' ? tracking.riskScore : 55,
    riskLevel: trackedRiskLevel === 'LOW' || trackedRiskLevel === 'MEDIUM' || trackedRiskLevel === 'HIGH'
      ? trackedRiskLevel
      : 'HIGH',
    riskReasons: trackedRisks.length > 0
      ? trackedRisks.slice(0, 4)
      : ['แผนเข้าแล้วและยังมีโอกาสชน Stop Loss ตามโครงสร้างตลาด'],
    riskReward: typeof tracking.riskReward === 'number'
      ? roundNumber(tracking.riskReward)
      : roundNumber(riskReward),
    locked: true,
    lockedAt: typeof tracking.lockedAt === 'string'
      ? tracking.lockedAt
      : openTrade.openedAt.toISOString(),
    currentPriceAtLock: roundPrice(openTrade.entry),
    distanceToEntry: roundPrice(Math.abs(currentPrice - openTrade.entry)),
    updateReason: 'active_trade',
  };
};

const hasPlanFinishedOrFailed = (plan: RecommendationPlan, currentPrice: number) => {
  const direction = getPlanDirection(plan);
  if (direction === 'BUY') {
    return currentPrice <= plan.stopLoss || currentPrice >= plan.takeProfit;
  }
  if (direction === 'SELL') {
    return currentPrice >= plan.stopLoss || currentPrice <= plan.takeProfit;
  }
  return true;
};

const getPlanFinishReason = (plan: RecommendationPlan, currentPrice: number) => {
  const direction = getPlanDirection(plan);
  if (direction === 'BUY') {
    if (currentPrice >= plan.takeProfit) return 'TP_HIT';
    if (currentPrice <= plan.stopLoss) return 'SL_HIT';
  }
  if (direction === 'SELL') {
    if (currentPrice <= plan.takeProfit) return 'TP_HIT';
    if (currentPrice >= plan.stopLoss) return 'SL_HIT';
  }
  return null;
};

const getPlanMaxDistance = (plan: RecommendationPlan) => {
  if (plan.timeframe === 'M5' || plan.strategyMode === 'SCALP') return 4.0; // Max $4.00 deviation for M5 Scalp
  if (plan.timeframe === 'M15') return 6.5; // Max $6.50 deviation for M15 Intraday
  return 10.0; // Max $10.00 deviation for H1/H4 Swing
};

const isPlanStale = (plan: RecommendationPlan, currentPrice: number, now: Date) => {
  if (hasPlanFinishedOrFailed(plan, currentPrice)) return true;

  const isQwenPlan = !!plan.id?.toLowerCase().includes('qwen') || !!plan.title?.toLowerCase().includes('qwen') || !!plan.strategyLabel?.toLowerCase().includes('qwen');

  // Price deviation stale check: if current price is too far away from entry zone, cancel/expire the recommendation
  const maxDist = isQwenPlan ? 10.0 : getPlanMaxDistance(plan);
  if (Math.abs(currentPrice - plan.entry) > maxDist) return true;

  // Lifetime safety stale check (max 90 mins for Qwen plan)
  const lockedAt = plan.lockedAt ? new Date(plan.lockedAt) : null;
  if (lockedAt && Number.isFinite(lockedAt.getTime())) {
    const lockMinutes = isQwenPlan ? 90 : getPlanLockMinutes(plan);
    const maxLifetimeMs = lockMinutes * 60 * 1000;
    if (now.getTime() - lockedAt.getTime() > maxLifetimeMs) return true;
  }

  return false;
};

const shouldReplaceStablePlan = (
  storedPlan: RecommendationPlan,
  candidate: RecommendationPlan,
  currentPrice: number,
  now: Date,
) => {
  const storedDirection = getPlanDirection(storedPlan);
  const candidateDirection = getPlanDirection(candidate);

  if (isPlanStale(storedPlan, currentPrice, now)) return true;

  // Rule: Only replace direction if the new candidate has HIGHER confidence than the stored plan!
  if (storedDirection !== candidateDirection) {
    return candidate.confidence > storedPlan.confidence;
  }

  // Anti-Flicker Rule 2: If direction is same, only replace levels if candidate has significantly higher confidence (+20 points)
  if (candidate.confidence >= storedPlan.confidence + 20) return true;

  return false;
};

const getPlanTrackingReason = (plan: RecommendationPlan) => ({
  stablePlanLockId: plan.id,
  sourcePlanId: plan.sourcePlanId || plan.id,
  lockedAt: plan.lockedAt,
  strategyId: plan.strategyId,
  strategyMode: plan.strategyMode,
  planType: plan.type,
  title: plan.title,
  reason: plan.reason,
  riskScore: plan.riskScore,
  riskLevel: plan.riskLevel,
  riskReasons: plan.riskReasons,
  riskReward: plan.riskReward,
});

const recordShadowPlans = async (symbol: string, plans: RecommendationPlan[]) => {
  if (!isMarketOpen()) return;

  for (const plan of plans.slice(0, 3)) {
    const direction = getPlanDirection(plan);
    if (!direction || !plan.strategyId) continue;

    const shadowMarker = `"shadowStrategyId":"${plan.strategyId}"`;
    const existing = await prisma.paperTrade.findFirst({
      where: {
        symbol: { in: [symbol, ...GOLD_SYMBOL_LIST] },
        result: { in: ['PLAN', 'OPEN', 'TESTING'] },
        signal: { is: { reason: { contains: shadowMarker } } },
      },
      select: { id: true },
    });
    if (existing) continue;

    const reason = JSON.stringify({
      shadowMode: true,
      shadowStrategyId: plan.strategyId,
      strategyId: plan.strategyId,
      regime: plan.reason.match(/^\[([^\]]+)\]/)?.[1] || null,
      planType: plan.type,
      riskScore: plan.riskScore,
      riskReward: plan.riskReward,
    });
    const signal = await prisma.signal.create({
      data: {
        symbol: 'XAUUSD',
        timeframe: plan.timeframe || 'M15',
        direction,
        entry: plan.entry,
        stopLoss: plan.stopLoss,
        takeProfit1: plan.takeProfit,
        takeProfit2: plan.takeProfit,
        riskReward: plan.riskReward || 0,
        confidence: plan.confidence,
        status: 'shadow',
        bias: 'Wait',
        result: 'Pending',
        reason,
      },
    });
    await prisma.paperTrade.create({
      data: {
        signalId: signal.id,
        symbol: 'XAUUSD',
        direction,
        entry: plan.entry,
        stopLoss: plan.stopLoss,
        takeProfit1: plan.takeProfit,
        takeProfit2: plan.takeProfit,
        result: 'PLAN',
        notes: `[SHADOW] ${plan.strategyId} | ${plan.reason}`,
      },
    });
  }
};

const retirePendingStoredPlan = async (plan: RecommendationPlan, reason: string) => {
  const trackingSignals = await prisma.signal.findMany({
    where: { reason: { contains: `"stablePlanLockId":"${plan.id}"` } },
    select: { id: true },
  });
  const signalIds = trackingSignals.map((signal) => signal.id);
  if (signalIds.length === 0) return;
  const openTrades = await prisma.paperTrade.findMany({
    where: {
      signalId: { in: signalIds },
      result: 'OPEN',
    },
    select: { signalId: true },
  });
  const openSignalIds = new Set(openTrades.map((trade) => trade.signalId).filter(Boolean));
  const pendingSignalIds = signalIds.filter((signalId) => !openSignalIds.has(signalId));

  const operations = [
    prisma.paperTrade.updateMany({
      where: {
        signalId: { in: signalIds },
        result: { in: ['PLAN', 'TESTING'] },
      },
      data: {
        result: 'CANCELLED',
        closedAt: new Date(),
        notes: `Plan retired: ${reason}`,
      },
    }),
  ];
  if (pendingSignalIds.length > 0) {
    operations.push(prisma.signal.updateMany({
      where: {
        id: { in: pendingSignalIds },
        status: { in: ['pending', 'active'] },
      },
      data: { status: 'cancelled' },
    }));
  }
  await prisma.$transaction(operations);
};

const reconcileOpenPlanLifecycle = async (symbol: string) => {
  const symbolFilter = { in: [symbol, ...GOLD_SYMBOL_LIST] };
  const [openTrades, pendingTrades] = await Promise.all([
    prisma.paperTrade.findMany({
      where: { symbol: symbolFilter, result: 'OPEN' },
      select: { signalId: true },
    }),
    prisma.paperTrade.findMany({
      where: { symbol: symbolFilter, result: { in: ['PLAN', 'TESTING'] } },
      select: { id: true, signalId: true },
    }),
  ]);
  const openSignalIds = openTrades.map((trade) => trade.signalId).filter((id): id is string => Boolean(id));
  const pendingSignalIds = pendingTrades.map((trade) => trade.signalId).filter((id): id is string => Boolean(id));
  const operations = [];

  if (openSignalIds.length > 0) {
    operations.push(prisma.signal.updateMany({
      where: { id: { in: openSignalIds } },
      data: { status: 'active', result: 'Pending' },
    }));
  }
  if (pendingTrades.length > 0) {
    operations.push(prisma.paperTrade.updateMany({
      where: { id: { in: pendingTrades.map((trade) => trade.id) } },
      data: {
        result: 'CANCELLED',
        closedAt: new Date(),
        notes: 'Plan retired: another gold plan already reached Entry',
      },
    }));
  }
  if (pendingSignalIds.length > 0) {
    operations.push(prisma.signal.updateMany({
      where: { id: { in: pendingSignalIds } },
      data: { status: 'cancelled' },
    }));
  }
  if (operations.length > 0) await prisma.$transaction(operations);
};

const ensureResearchUpkeep = async (symbol: string, existingReport: StrategyResearchReport | null) => {
  const key = researchUpkeepKey(symbol);
  const now = Date.now();
  const lastRun = globalFetchCache.lastResearchUpkeepMap[key] || 0;
  if (now - lastRun < 15 * 60 * 1000) return existingReport;

  const reportAgeMs = existingReport?.generatedAt
    ? now - new Date(existingReport.generatedAt).getTime()
    : Number.POSITIVE_INFINITY;
  const shouldRunFullResearch = !existingReport || reportAgeMs > 6 * 60 * 60 * 1000;

  globalFetchCache.lastResearchUpkeepMap[key] = now;

  try {
    if (shouldRunFullResearch) {
      return await StrategyResearchService.runFromDatabase(symbol);
    }
    return await StrategyResearchService.refreshStoredReportFromPaperTrades(symbol);
  } catch (err) {
    console.error('[Research Bot] Upkeep failed:', err);
    return existingReport;
  }
};

const buildLabHealth = ({
  report,
  openTrades,
  suggestedPlans,
  recentPlanResults,
  latestClosedTrades,
  mt5RealtimeState,
  latestResearchAt,
}: {
  report: StrategyResearchReport | null;
  openTrades: any[];
  suggestedPlans: any[];
  recentPlanResults: any[];
  latestClosedTrades: any[];
  mt5RealtimeState: string;
  latestResearchAt?: string | null;
}) => {
  const now = Date.now();
  const researchAgeMs = latestResearchAt ? now - new Date(latestResearchAt).getTime() : null;
  const closedCount = latestClosedTrades.length;
  const decidedCount = latestClosedTrades.filter((trade) => ['WIN', 'LOSS'].includes(trade.result)).length;
  const wins = latestClosedTrades.filter((trade) => trade.result === 'WIN').length;
  const liveForwardSamples = report?.candidates.reduce((sum, candidate) => sum + (candidate.liveForwardTest?.sampleSize || 0), 0) || 0;
  const issues: string[] = [];

  if (!report) issues.push('ยังไม่มีรายงานวิจัยกลยุทธ์');
  if (researchAgeMs === null || researchAgeMs > 6 * 60 * 60 * 1000) issues.push('รายงานวิจัยเก่าเกิน 6 ชั่วโมง');
  if (openTrades.length === 0 && suggestedPlans.length === 0) issues.push('ไม่มีแผนที่ระบบกำลังวัดผล');
  if (closedCount < 5) issues.push('sample สำหรับวัด win rate ยังน้อย');
  if (mt5RealtimeState === 'OFFLINE') issues.push('MT5 ไม่ส่งข้อมูลสด');

  const status = issues.length === 0
    ? 'HEALTHY'
    : issues.some((issue) => issue.includes('MT5') || issue.includes('รายงานวิจัย'))
      ? 'NEEDS_ADMIN'
      : 'WATCHING';

  return {
    status,
    label: status === 'HEALTHY'
      ? 'Lab เดินต่อเนื่อง'
      : status === 'NEEDS_ADMIN'
        ? 'ควรให้ admin ตรวจ/รัน AI'
        : 'Lab กำลังสะสมผล',
    message: status === 'HEALTHY'
      ? 'ระบบมีแผนที่กำลังวัดผลและอัปเดต research จากผล TP/SL ล่าสุด'
      : issues[0] || 'ระบบยังต้องสะสมผลเพิ่มก่อนสรุปความแม่นยำ',
    issues,
    action: status === 'NEEDS_ADMIN'
      ? 'ให้ admin ตรวจ MT5/EA และรัน AI research ใหม่'
      : status === 'WATCHING'
        ? 'ปล่อยให้ระบบเก็บผลจากแผนที่เปิดและแผนรอเข้าเพิ่ม'
        : 'ติดตามแผนและปล่อยให้ระบบปรับคะแนนต่อ',
    sampleSize: closedCount,
    decidedSampleSize: decidedCount,
    liveForwardSamples,
    winRate: decidedCount > 0 ? Math.round((wins / decidedCount) * 100) : 0,
    lastResearchAt: latestResearchAt || null,
    researchAgeMs,
    openTradesCount: openTrades.length,
    suggestedPlansCount: suggestedPlans.length,
    recentResults: recentPlanResults.slice(0, 5).map(serializeOwnerTrade),
  };
};

const getStableOrderPlan = async (
  symbol: string,
  candidates: RecommendationPlan[],
  currentPrice: number,
  allowM5DependentPlans = true,
  allowStoredPlans = true,
) => {
  const now = new Date();
  const key = stablePlanSettingKey(symbol);
  const storedSetting = await prisma.systemSetting.findUnique({ where: { key } });
  const storedPlan = parseStoredOrderPlan(storedSetting?.value);

  // Once Entry is reached, that plan remains authoritative until TP/SL closes it.
  // Research may pause the strategy for future plans, but must not hide an open plan from customers.
  const openTrackingPlan = await getOpenTrackingPlan(symbol, currentPrice);
  if (openTrackingPlan) {
    await reconcileOpenPlanLifecycle(symbol);
    await prisma.systemSetting.upsert({
      where: { key: stablePlanSettingKey(symbol) },
      update: { value: JSON.stringify(openTrackingPlan) },
      create: { key: stablePlanSettingKey(symbol), value: JSON.stringify(openTrackingPlan) },
    });
    return openTrackingPlan;
  }

  // Portfolio circuit breaker: preserve an already-open trade, but do not
  // create or retain pending entries after a damaging daily sequence.
  const { start: bangkokDayStart, end: bangkokDayEnd } = getBangkokDayRange(now);
  const recentDecisionCandidates = await prisma.paperTrade.findMany({
    where: {
      symbol: { in: ['XAUUSD', 'GOLD', 'GOLD#', 'GOLD.a', 'GOLDm', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
      result: { in: ['WIN', 'LOSS', 'BE'] },
      closedAt: { gte: bangkokDayStart, lt: bangkokDayEnd },
    },
    orderBy: { closedAt: 'desc' },
    take: 30,
    include: { signal: { select: { reason: true } } },
  });
  const recentDecisions = recentDecisionCandidates.filter((trade) => {
    try {
      return JSON.parse(trade.signal?.reason || '{}')?.shadowMode !== true;
    } catch {
      return true;
    }
  }).slice(0, 10);
  const threeConsecutiveLosses = recentDecisions.length >= 3 &&
    recentDecisions.slice(0, 3).every((trade) => trade.result === 'LOSS');
  const dailyNetR = recentDecisions.reduce((sum, trade) => sum + trade.rrResult, 0);
  const circuitBreakerActive = threeConsecutiveLosses || dailyNetR <= -2;

  if (circuitBreakerActive) {
    if (storedPlan) {
      await retirePendingStoredPlan(storedPlan, 'daily portfolio circuit breaker active');
      await prisma.systemSetting.deleteMany({ where: { key } });
    }
    return null;
  }

  // Competing directions must separate clearly before a new plan is allowed.
  const buyCandidates = candidates.filter(
    (p) =>
      p.type !== 'WAIT' &&
      p.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
      (p.direction === 'BUY' || p.type?.includes('BUY')) &&
      (allowM5DependentPlans || !isM5DependentPlan(p)),
  );

  const sellCandidates = candidates.filter(
    (p) =>
      p.type !== 'WAIT' &&
      p.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
      (p.direction === 'SELL' || p.type?.includes('SELL')) &&
      (allowM5DependentPlans || !isM5DependentPlan(p)),
  );

  const strongestBuy = buyCandidates.sort((a, b) => b.confidence - a.confidence)[0];
  const strongestSell = sellCandidates.sort((a, b) => b.confidence - a.confidence)[0];
  const hasUnresolvedConflict = !!strongestBuy && !!strongestSell &&
    Math.abs(strongestBuy.confidence - strongestSell.confidence) < 10;

  const candidate = hasUnresolvedConflict ? undefined : candidates.find((plan) =>
    plan.type !== 'WAIT' &&
    plan.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
    (plan.riskScore ?? 100) <= MAX_RECOMMENDATION_RISK_SCORE &&
    !!getPlanDirection(plan) &&
    (allowM5DependentPlans || !isM5DependentPlan(plan)),
  );

  const storedPlanAllowed = allowStoredPlans && (!storedPlan || allowM5DependentPlans || !isM5DependentPlan(storedPlan));
  const storedPlanResearchRejected = !!storedPlan &&
    (storedPlan.researchSampleSize || 0) >= 15 &&
    typeof storedPlan.researchWinRate === 'number' &&
    storedPlan.researchWinRate < 35;

  if (!candidate) {
    // Keep a valid locked plan, but retire stale plans and strategies with poor measured results.
    if (candidates.length > 0 && storedPlan && storedPlanAllowed && !storedPlanResearchRejected && !isPlanStale(storedPlan, currentPrice, now)) {
      return normalizeOrderPlan(storedPlan, currentPrice, now, 'locked_existing');
    }
    if (storedPlan) {
      await retirePendingStoredPlan(
        storedPlan,
        storedPlanResearchRejected ? 'strategy performance fell below service threshold' : 'plan expired or price invalidated the setup',
      );
      await prisma.systemSetting.deleteMany({ where: { key } });
    }
    return null;
  }

  const shouldKeepStored = storedPlan &&
    storedPlanAllowed &&
    !shouldReplaceStablePlan(storedPlan, candidate, currentPrice, now);

  if (shouldKeepStored) {
    return normalizeOrderPlan(storedPlan, currentPrice, now, 'locked_existing');
  }

  if (storedPlan && storedPlan.id !== candidate.id) {
    await retirePendingStoredPlan(storedPlan, 'replaced by a stronger validated setup');
  }

  const nextPlan = normalizeOrderPlan(candidate, currentPrice, now, storedPlan ? 'replaced' : 'locked_new');
  if (!nextPlan) return null;

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(nextPlan) },
    create: { key, value: JSON.stringify(nextPlan) },
  });

  // Auto-insert locked plans as Signals and PaperTrades for automated research tracking
  // ONLY if the market is open
  if (isMarketOpen()) {
    try {
      const activeTrackingTrade = await prisma.paperTrade.findFirst({
        where: {
          symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
          direction: nextPlan.direction,
          result: { in: ['OPEN', 'PLAN', 'TESTING'] },
          signal: {
            is: {
              reason: { contains: `"stablePlanLockId":"${nextPlan.id}"` },
            },
          },
        },
      });

      if (!activeTrackingTrade) {
        const rr = Math.abs(nextPlan.takeProfit - nextPlan.entry) / Math.max(0.1, Math.abs(nextPlan.entry - nextPlan.stopLoss));
        const timeframeVal = nextPlan.timeframe || 'M15';
        const directionVal = nextPlan.direction || 'BUY';
        const entryVal = nextPlan.entry || currentPrice;
        const slVal = nextPlan.stopLoss || (directionVal === 'BUY' ? entryVal - 3.5 : entryVal + 3.5);
        const tpVal = nextPlan.takeProfit || (directionVal === 'BUY' ? entryVal + 8.5 : entryVal - 8.5);
        const confVal = typeof nextPlan.confidence === 'number' ? nextPlan.confidence : 70;
        const entryReached = nextPlan.type.includes('STOP')
          ? directionVal === 'BUY' ? currentPrice >= entryVal : currentPrice <= entryVal
          : directionVal === 'BUY' ? currentPrice <= entryVal : currentPrice >= entryVal;
        const initialTradeResult = nextPlan.type.includes('MARKET') || entryReached ? 'OPEN' : 'PLAN';

        const newSignal = await prisma.signal.create({
          data: {
            symbol,
            timeframe: timeframeVal,
            direction: directionVal,
            entry: entryVal,
            stopLoss: slVal,
            takeProfit1: tpVal,
            takeProfit2: tpVal,
            riskReward: parseFloat(rr.toFixed(2)) || 2.0,
            confidence: confVal,
            status: initialTradeResult === 'OPEN' ? 'active' : 'pending',
            bias: directionVal === 'BUY' ? 'Buy' : 'Sell',
            entryZone: `$${(entryVal - 1.0).toFixed(2)} - $${(entryVal + 1.0).toFixed(2)}`,
            riskLevel: nextPlan.riskLevel === 'LOW' ? 'Low' : nextPlan.riskLevel === 'HIGH' ? 'High' : 'Medium',
            marketCondition: 'Stable Scanner Run',
            result: 'Pending',
            reason: JSON.stringify(getPlanTrackingReason(nextPlan)),
          }
        });

        await prisma.paperTrade.create({
          data: {
            signalId: newSignal.id,
            symbol,
            direction: directionVal,
            entry: entryVal,
            stopLoss: slVal,
            takeProfit1: tpVal,
            takeProfit2: tpVal,
            result: initialTradeResult,
            rrResult: 0.0,
            notes: initialTradeResult === 'OPEN'
              ? `Auto-executed from active recommendation plan: ${nextPlan.title}`
              : `Waiting for entry from active recommendation plan: ${nextPlan.title}`,
          }
        });
        console.log(
          initialTradeResult === 'OPEN'
            ? `[Research Bot] Auto-entered position for ${nextPlan.title} at $${nextPlan.entry}`
            : `[Research Bot] Saved pending plan for ${nextPlan.title} at $${nextPlan.entry}`,
        );

        // Notify mobile of new auto-scanner plan with rich plan details
        const planTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        const sideIcon = directionVal === 'BUY' ? '🟢 ซื้อ (BUY)' : '🔴 ขาย (SELL)';
        const entryGuide = getPlanEntryGuide(nextPlan);
        const entryStatus = initialTradeResult === 'OPEN' ? 'เข้าแผนแล้ว / กำลังติดตาม' : 'รอราคาแตะ Entry ก่อน ห้ามไล่ราคา';
        const riskReasons = nextPlan.riskReasons?.length
          ? nextPlan.riskReasons.map((risk, index) => `${index + 1}. ${risk}`).join('\n')
          : 'มีความเสี่ยงที่ราคาจะชน Stop Loss ตามโครงสร้างตลาด';

        const msg = `📢 *แผนการเทรดทองคำใหม่*\n\n📅 *เวลาออกแผน*: ${planTime}\n📌 *สินทรัพย์*: XAUUSD (${timeframeVal})\n🎯 *ฝั่ง*: ${sideIcon}\n⏳ *สถานะแผน*: ${entryStatus}\n--------------------------------\n🚪 *Entry*: $${entryVal.toFixed(2)}\n🛑 *Stop Loss*: $${slVal.toFixed(2)}\n💰 *Take Profit*: $${tpVal.toFixed(2)}\n⚖️ *Risk/Reward*: 1:${(nextPlan.riskReward || rr).toFixed(2)}\n📊 *คะแนนเงื่อนไข*: ${confVal}/100 (ไม่ใช่โอกาสชนะ)\n⚠️ *ความเสี่ยงประเมิน*: ${nextPlan.riskScore ?? '-'} / 100\n--------------------------------\n*ความเสี่ยงมาจาก*\n${riskReasons}\n--------------------------------\n*เงื่อนไขเข้าและยกเลิกแผน*\n${entryGuide}`;

        await NotificationService.sendNotification(msg);
      }
    } catch (dbErr) {
      console.error('Failed to auto-save locked plan to DB:', dbErr);
    }
  }

  return nextPlan;
};

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const assetParam = url ? url.searchParams.get('asset') : null;
    if (assetParam && assetParam !== 'XAUUSD') {
      return NextResponse.json(
        { error: 'ระบบให้บริการเฉพาะแผนทองคำ XAUUSD' },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const isPlanAutomation = Boolean(
      url?.searchParams.get('automation') === 'mt5-m15-sync' &&
      request?.headers.get('x-plan-automation') === 'mt5-m15-sync' &&
      request?.headers.get('x-plan-automation-secret') === (process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET')
    );
    const isPublic = Boolean(url?.searchParams.get('public') === 'true' && !isPlanAutomation);
    const baseKey = assetParam || 'XAUUSD';

    // Private metrics require an authenticated account with service access.
    let userRole = isPlanAutomation ? 'automation' : 'public';
    if (!isPublic && !isPlanAutomation) {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        const payload = token ? await verifyToken(token) : null;
        if (!payload?.userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId as string },
          select: { role: true, subscriptionStatus: true, subscriptionEndsAt: true },
        });
        if (!dbUser) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
        }
        const subscriptionExpired = dbUser.subscriptionEndsAt && dbUser.subscriptionEndsAt < new Date();
        if (dbUser.role !== 'admin' && (dbUser.subscriptionStatus !== 'active' || subscriptionExpired)) {
          return NextResponse.json({ error: 'Subscription required' }, { status: 403, headers: noStoreHeaders });
        }
        userRole = dbUser.role;
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
      }
    }

    const runFullQueries = isPlanAutomation || !isPublic;
    const runAdminQueries = isPlanAutomation || userRole === 'admin';

    const now = new Date();
    const todayRange = getBangkokDayRange(now);
    const monthRange = getBangkokMonthRange(now);
    const assets = ['XAUUSD'];

    let totalSignals = 0;
    let totalTrades = 0;
    let openTrades: any[] = [];
    let suggestedPlansRaw: any[] = [];
    let latestSignals: any[] = [];
    let closedTrades: any[] = [];
    let recentPlanResults: any[] = [];
    let zoneCount = 0;

    if (runFullQueries) {
      [
        totalSignals,
        totalTrades,
        openTrades,
        suggestedPlansRaw,
        latestSignals,
        closedTrades,
        recentPlanResults,
        zoneCount,
      ] = await Promise.all([
        prisma.signal.count({ where: { symbol: { in: GOLD_SYMBOL_LIST } } }),
        prisma.paperTrade.count({ where: { symbol: { in: GOLD_SYMBOL_LIST } } }),
        prisma.paperTrade.findMany({
          where: { symbol: { in: GOLD_SYMBOL_LIST }, result: 'OPEN' },
          orderBy: { openedAt: 'desc' },
          include: { signal: true },
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { in: GOLD_SYMBOL_LIST }, result: { in: ['PLAN', 'TESTING'] } },
          orderBy: { openedAt: 'desc' },
          include: { signal: true },
        }),
        prisma.signal.findMany({
          where: { symbol: { in: GOLD_SYMBOL_LIST } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { in: GOLD_SYMBOL_LIST }, result: { in: ['WIN', 'LOSS', 'BE'] } },
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { in: GOLD_SYMBOL_LIST }, result: { in: ['WIN', 'LOSS', 'BE'] } },
          orderBy: { closedAt: 'desc' },
          take: 8,
          include: { signal: true },
        }),
        prisma.zone.count({ where: { symbol: { in: GOLD_SYMBOL_LIST } } }),
      ]);
    }

    let todaySignalsRaw: any[] = [];
    let latestClosedTrades: any[] = [];
    let latestTargetHits: any[] = [];
    let latestStopLosses: any[] = [];
    let activeMembers = 0;
    let cancelledMembers = 0;
    let allRevenue = { _sum: { amount: null }, _count: { _all: 0 } } as any;
    let monthRevenue = { _sum: { amount: null }, _count: { _all: 0 } } as any;
    let todayRevenue = { _sum: { amount: null }, _count: { _all: 0 } } as any;
    let cancelledPayments = 0;

    if (runFullQueries) {
      if (runAdminQueries) {
        [
          todaySignalsRaw,
          latestClosedTrades,
          latestTargetHits,
          latestStopLosses,
          activeMembers,
          cancelledMembers,
          allRevenue,
          monthRevenue,
          todayRevenue,
          cancelledPayments,
        ] = await Promise.all([
          prisma.signal.findMany({
            where: {
              symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
              createdAt: { gte: todayRange.start, lt: todayRange.end },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              symbol: true,
              timeframe: true,
              direction: true,
              status: true,
              confidence: true,
              entry: true,
              createdAt: true,
              bias: true,
              entryZone: true,
              takeProfit1: true,
              takeProfit2: true,
              takeProfit3: true,
              stopLoss: true,
              screenshotUrl: true,
              riskLevel: true,
              marketCondition: true,
              result: true,
              reason: true,
            },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: { in: ['WIN', 'LOSS', 'BE'] } },
            orderBy: { closedAt: 'desc' },
            take: 30,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: 'WIN' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: 'LOSS' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
          prisma.user.count({
            where: {
              role: { not: 'admin' },
              subscriptionStatus: 'active',
              OR: [
                { subscriptionEndsAt: null },
                { subscriptionEndsAt: { gte: now } },
              ],
            },
          }),
          prisma.user.count({
            where: {
              role: { not: 'admin' },
              OR: [
                { subscriptionStatus: { in: ['cancelled', 'expired'] } },
                { subscriptionEndsAt: { lt: now } },
              ],
            },
          }),
          prisma.payment.aggregate({
            where: { status: 'approved' },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.payment.aggregate({
            where: {
              status: 'approved',
              createdAt: { gte: monthRange.start, lt: monthRange.end },
            },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.payment.aggregate({
            where: {
              status: 'approved',
              createdAt: { gte: todayRange.start, lt: todayRange.end },
            },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.payment.count({
            where: { status: { in: ['cancelled', 'rejected'] } },
          }),
        ]) as any;
      } else {
        [
          todaySignalsRaw,
          latestClosedTrades,
          latestTargetHits,
          latestStopLosses,
        ] = await Promise.all([
          prisma.signal.findMany({
            where: {
              symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
              createdAt: { gte: todayRange.start, lt: todayRange.end },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              symbol: true,
              timeframe: true,
              direction: true,
              status: true,
              confidence: true,
              entry: true,
              createdAt: true,
              bias: true,
              entryZone: true,
              takeProfit1: true,
              takeProfit2: true,
              takeProfit3: true,
              stopLoss: true,
              screenshotUrl: true,
              riskLevel: true,
              marketCondition: true,
              result: true,
              reason: true,
            },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: { in: ['WIN', 'LOSS', 'BE'] } },
            orderBy: { closedAt: 'desc' },
            take: 30,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: 'WIN' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, result: 'LOSS' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
        ]) as any;
      }
    }

    const suggestedPlans = suggestedPlansRaw.filter((trade: any) =>
      !trade.signal || trade.signal.confidence >= MIN_RECOMMENDATION_CONFIDENCE,
    );

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

    // 7. NEW: Market Intelligence & Proactive AI Planning
    const marketIntelligence: Record<string, any> = {};

    // Cache webhook event queries to reuse them
    let priceEvents: any[] = [];
    let mt5SyncEvent: any = null;
    let mt5M5SyncEvent: any = null;
    let mt5M15SyncEvent: any = null;

    for (const symbol of assets) {
      const searchSymbol = 'XAU';

      // Both dedicated tick events and frequent MT5 syncs carry a current price.
      // Treat either source as a live tick so the chart stays current even when
      // the installed EA only posts its rolling M5 candle set.
      const [recentPriceEvents, latestAnySyncEvent] = await Promise.all([
        prisma.webhookEvent.findMany({
          where: {
            symbol: { in: [searchSymbol, 'XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
            status: 'processed',
            source: { in: ['tradingview', 'mt5_sync'] },
            receivedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
          orderBy: { receivedAt: 'desc' },
          take: 36,
        }),
        prisma.webhookEvent.findFirst({
          where: { symbol: { in: [searchSymbol, 'XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] }, status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
      ]);
      const latestPriceEvent = recentPriceEvents[0] || null;

      // Cache overall webhook events for connection status at the end
      priceEvents = recentPriceEvents;
      mt5SyncEvent = latestAnySyncEvent;

      const xauSymbolsFilter = {
        in: [
          'XAUUSD',
          'GOLD',
          'GOLD#',
          'GOLD.a',
          'GOLDm',
          'GOLDmicro',
          'GOLD.ecn',
          'XAUUSD#',
          'XAUUSD.iux',
          'XAUUSD.a',
          'XAUUSDm',
          'XAUUSD.raw',
        ],
      };

      const activeSymbol = latestPriceEvent?.symbol || latestAnySyncEvent?.symbol || symbol;
      const [latestM5SyncEvent, latestM15SyncEvent] = await Promise.all([
        prisma.webhookEvent.findFirst({
          where: { symbol: xauSymbolsFilter, timeframe: 'M5', status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
        prisma.webhookEvent.findFirst({
          where: { symbol: xauSymbolsFilter, timeframe: 'M15', status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
      ]);
      const latestM5SyncPayload = parseEventPayload(latestM5SyncEvent);
      const latestM15SyncPayload = parseEventPayload(latestM15SyncEvent);

      // Cache timeframe-specific sync events for connection status at the end
      mt5M5SyncEvent = latestM5SyncEvent;
      mt5M15SyncEvent = latestM15SyncEvent;

      const activeSymbolPriceEvents = recentPriceEvents.filter((event) => xauSymbolsFilter.in.includes(event.symbol));
      const liveTickEvents = activeSymbolPriceEvents.length > 0
        ? activeSymbolPriceEvents
        : recentPriceEvents;
      const liveTicks = liveTickEvents
        .map((event) => eventToLiveTick(event))
        .filter((tick): tick is LiveTick => !!tick)
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      let currentPrice = 0;
      let recentCandles: CandlePoint[] = [];

      const latestLiveTick = liveTicks[liveTicks.length - 1] || null;
      const tickAgeMs = latestPriceEvent ? Date.now() - latestPriceEvent.receivedAt.getTime() : null;
      const m5CandleSyncAgeMs = latestM5SyncEvent ? Date.now() - latestM5SyncEvent.receivedAt.getTime() : null;
      const m15CandleSyncAgeMs = latestM15SyncEvent ? Date.now() - latestM15SyncEvent.receivedAt.getTime() : null;
      const isPriceEventRecent = tickAgeMs !== null && tickAgeMs < 90 * 1000;
      const isM5CandleSyncRecent = m5CandleSyncAgeMs !== null && m5CandleSyncAgeMs < STALE_M5_CANDLE_SYNC_MS;
      const isM15CandleSyncRecent = m15CandleSyncAgeMs !== null && m15CandleSyncAgeMs < STALE_MT5_CANDLE_BASE_MS;
      if (isPriceEventRecent && latestLiveTick) {
        currentPrice = latestLiveTick.price;
      }

      // Try to get from database first (MT5 Sync or previously cached fallback candles)
      let [m5Candles, m15Candles, h1Candles, d1Candles]: CandlePoint[][] = await Promise.all([
        prisma.candle.findMany({
          where: { symbol: xauSymbolsFilter, timeframe: 'M5' },
          orderBy: { time: 'desc' },
          take: M5_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: xauSymbolsFilter, timeframe: 'M15' },
          orderBy: { time: 'desc' },
          take: M15_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: xauSymbolsFilter, timeframe: 'H1' },
          orderBy: { time: 'desc' },
          take: H1_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: xauSymbolsFilter, timeframe: 'D1' },
          orderBy: { time: 'desc' },
          take: D1_CANDLE_FETCH_LIMIT,
        }),
      ]);

      // The installed EA posts M5 every few seconds. Derive the open M15/H1 bars
      // from that canonical feed when their dedicated sync cadence falls behind.
      if (isM5CandleSyncRecent && m5Candles.length > 0) {
        m15Candles = mergeDerivedCandles(m15Candles, m5Candles, 'M15').slice(0, M15_CANDLE_FETCH_LIMIT);
        h1Candles = mergeDerivedCandles(h1Candles, m5Candles, 'H1').slice(0, H1_CANDLE_FETCH_LIMIT);
      }

      if (!isPriceEventRecent) {
        currentPrice = isM5CandleSyncRecent && m5Candles.length > 0
          ? m5Candles[0].close
          : m15Candles[0]?.close ?? h1Candles[0]?.close ?? 0;
      }

      if (m15Candles.length === 0) m15Candles = recentCandles;
      if (h1Candles.length === 0) h1Candles = recentCandles;
      const mt5M5CandleCount = isM5CandleSyncRecent ? m5Candles.length : 0;
      const mt5M15CandleCount = isM15CandleSyncRecent ? m15Candles.length : 0;

      if (isPriceEventRecent && liveTicks.length > 0) {
        m5Candles = mergeLiveTicksIntoCandles(m5Candles, 'M5', liveTicks);
        m15Candles = mergeLiveTicksIntoCandles(m15Candles, 'M15', liveTicks);
        h1Candles = mergeLiveTicksIntoCandles(h1Candles, 'H1', liveTicks);
      }

      const hasM5Mt5Base = m5Candles.length >= 3 || (isM5CandleSyncRecent && mt5M5CandleCount >= 3);
      const hasM15Mt5Base = m15Candles.length >= 3 || (isM15CandleSyncRecent && mt5M15CandleCount >= 3);
      const m5AnalysisCandles = m5Candles.length >= 3 ? m5Candles : (m15Candles.length > 0 ? m15Candles : recentCandles);
      const marketRegime = MarketRegimeService.assess(m5AnalysisCandles, m5Candles.length >= 3 ? 5 : 15);

      const brokerTickM5Candles = symbol !== 'XAUUSD' && isPriceEventRecent && liveTicks.length > 0
        ? mergeLiveTicksIntoCandles([], 'M5', liveTicks)
        : [];

      recentCandles = m15Candles; // legacy variable compatibility

      if (!isPublic && Number.isFinite(currentPrice) && currentPrice > 0) {
        try {
          await PaperTradeService.evaluateOpenTradesWithPrice(symbol, currentPrice, currentPrice, currentPrice);
          await PaperTradeService.evaluatePendingPlansWithPrice(symbol, currentPrice);
        } catch (err) {
          console.error('[Research Bot] Dashboard price evaluation failed:', err);
        }
      }

      // Trigger real-time evaluation of paper trades/plans (only when market is open)
      try {
        if (isMarketOpen()) {
          const latestM15 = m15Candles[0];
          const highPrice = latestM15 ? Math.max(currentPrice, latestM15.high) : currentPrice;
          const lowPrice = latestM15 ? Math.min(currentPrice, latestM15.low) : currentPrice;

          await PaperTradeService.evaluatePendingPlansWithPrice(symbol, currentPrice);
          await PaperTradeService.evaluateOpenTradesWithPrice(symbol, currentPrice, highPrice, lowPrice);
        }
      } catch (evalErr) {
        console.error('Error evaluating trades in dashboard-stats:', evalErr);
      }

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
      let marketSession = 'ตลาดเอเชีย';
      let sessionVolatility = 'LOW';

      if (currentUtcHour >= 23 || currentUtcHour < 8) {
        marketSession = 'ตลาดเอเชีย';
        sessionVolatility = 'LOW';
      } else if (currentUtcHour >= 8 && currentUtcHour < 13) {
        marketSession = 'ตลาดลอนดอน';
        sessionVolatility = 'MEDIUM';
      } else if (currentUtcHour >= 13 && currentUtcHour < 16) {
        marketSession = 'ตลาดลอนดอนและนิวยอร์กซ้อนทับ';
        sessionVolatility = 'EXTREME';
      } else if (currentUtcHour >= 16 && currentUtcHour < 21) {
        marketSession = 'ตลาดนิวยอร์ก';
        sessionVolatility = 'HIGH';
      } else if (currentUtcHour >= 21 && currentUtcHour < 23) {
        marketSession = 'ปลายตลาดนิวยอร์ก';
        sessionVolatility = 'LOW';
      }

      volatility = sessionVolatility;
      let atr14 = 3.0;
      let rsi14 = 50;
      let isOverbought = false;
      let isOversold = false;
      let atr14M5 = 3.0;
      let rsi14M5 = 50;
      let ema20_m5 = currentPrice;
      let ema20_m15 = currentPrice;
      let ema20_h1 = currentPrice;
      let d1Bias = 'NEUTRAL';
      let h1Bias = 'NEUTRAL';
      let m15Bias = 'NEUTRAL';
      let m5Bias = 'NEUTRAL';

      let isSurgingGlobal = false;
      let isCrashingGlobal = false;
      let isM5SurgingGlobal = false;
      let isM5CrashingGlobal = false;
      let isEmaCrossBullish = false;
      let isEmaCrossBearish = false;
      let isHigherLow = false;
      let isDoubleBottom = false;

      if (recentCandles.length >= 20) {
        // --- Calculate MTF Trends ---
        ema20_m5 = m5AnalysisCandles.length >= 20 ? calcEMA(m5AnalysisCandles, 20) : ema20_m15;
        ema20_m15 = calcEMA(m15Candles, 20);
        ema20_h1 = calcEMA(h1Candles, 20);
        const ema20_d1 = d1Candles.length >= 20 ? calcEMA(d1Candles, 20) : (d1Candles.length > 0 ? d1Candles[0].close : currentPrice);

        atr14M5 = m5AnalysisCandles.length >= 15 ? calcATR(m5AnalysisCandles, 14) : atr14;
        rsi14M5 = m5AnalysisCandles.length >= 15 ? calcRSI(m5AnalysisCandles, 14) : rsi14;
        atr14 = calcATR(m15Candles, 14);
        rsi14 = calcRSI(m15Candles, 14);

        isOverbought = rsi14 > 70;
        isOversold = rsi14 < 30;

        const m5Trend = m5AnalysisCandles.length >= 20 ? (currentPrice > ema20_m5 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';
        const m15Trend = currentPrice > ema20_m15 ? 'BULLISH' : 'BEARISH';
        const h1Trend = currentPrice > ema20_h1 ? 'BULLISH' : 'BEARISH';
        const d1Trend = d1Candles.length > 0 ? (currentPrice > ema20_d1 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';

        // EMA 9 & EMA 21 Crossover calculation
        const ema9_m5 = m5AnalysisCandles.length >= 9 ? calcEMA(m5AnalysisCandles, 9) : currentPrice;
        const ema21_m5 = m5AnalysisCandles.length >= 21 ? calcEMA(m5AnalysisCandles, 21) : currentPrice;
        const prevEma9_m5 = m5AnalysisCandles.length >= 10 ? calcEMA(m5AnalysisCandles.slice(1), 9) : currentPrice;
        const prevEma21_m5 = m5AnalysisCandles.length >= 22 ? calcEMA(m5AnalysisCandles.slice(1), 21) : currentPrice;
        isEmaCrossBullish = prevEma9_m5 <= prevEma21_m5 && ema9_m5 > ema21_m5;
        isEmaCrossBearish = prevEma9_m5 >= prevEma21_m5 && ema9_m5 < ema21_m5;

        // Double Bottom & Higher Low Pattern detection
        if (m5AnalysisCandles.length >= 8) {
          const c0 = m5AnalysisCandles[0];
          const c1 = m5AnalysisCandles[1];
          const c2 = m5AnalysisCandles[2];
          const c3 = m5AnalysisCandles[3];
          const c4 = m5AnalysisCandles[4];
          const low1 = Math.min(c0.low, c1.low);
          const low2 = Math.min(c2.low, c3.low, c4.low);

          if (low1 > low2 + (atr14M5 * 0.1) && c0.close > c0.open) {
            isHigherLow = true;
          }
          if (Math.abs(low1 - low2) <= atr14M5 * 0.4 && c0.close > c0.open) {
            isDoubleBottom = true;
          }
        }

        d1Bias = d1Trend;
        h1Bias = h1Trend;
        m15Bias = m15Trend;
        m5Bias = m5Trend;

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

        if (m5AnalysisCandles.length >= 6) {
          let m5Drops = 0;
          let m5Surges = 0;
          for (let i = 0; i < Math.min(m5AnalysisCandles.length, 5); i++) {
            const c = m5AnalysisCandles[i];
            if (c.close < c.open) {
              if (m5Surges > 0) break;
              m5Drops++;
            } else if (c.close > c.open) {
              if (m5Drops > 0) break;
              m5Surges++;
            }
          }

          const prevM5Candle = m5AnalysisCandles[1];
          isM5CrashingGlobal = currentPrice < prevM5Candle.low || m5Drops >= 3;
          isM5SurgingGlobal = currentPrice > prevM5Candle.high || m5Surges >= 3;
        }

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

      // Only use zones calculated from real MT5 candles. Never manufacture levels when data is missing.
      const allZones = await prisma.zone.findMany({
        where: { symbol: activeSymbol },
        orderBy: { priceMin: 'asc' },
      });

      // Filter out zones that are too far from the current price (e.g. old seed data when price was much lower)
      const maxDistance = 150;
      const zones = allZones.filter((z: any) =>
        Math.abs(z.priceMin - currentPrice) <= maxDistance &&
        (hasM5Mt5Base || z.timeframe !== 'M5')
      );

      const nearestSupport = zones.filter((z: any) => z.type === 'SUPPORT' && z.priceMax < currentPrice).sort((a: any, b: any) => b.priceMax - a.priceMax).slice(0, 3);
      const nearestResistance = zones.filter((z: any) => z.type === 'RESISTANCE' && z.priceMin > currentPrice).sort((a: any, b: any) => a.priceMin - b.priceMin).slice(0, 3);
      const dangerZones = zones.filter((z: any) => z.type === 'LIQUIDITY' && Math.abs(z.priceMin - currentPrice) < 5).slice(0, 2);

      // Generate AI Proactive Plans (SaaS Grade MTF + ATR + RSI Logic)
      const proactivePlans: any[] = [];
      const pointValue = 0.01;
      const fixedSupportSl = 500 * pointValue;

      // Dynamic Risk via ATR: Tightened to protect high lot sizes
      const atrSL = Math.min(6.5, Math.max(1.8, atr14 * 0.9)); // Cap M15 SL between 180 - 650 points
      const atrTP = atrSL * 2.5; // 1:2.5 RR ratio

      // 3 Entry offset based on ATR
      const diff = Math.max(2.0, atr14 * 0.8);
      const scalpSL = Math.min(3.5, Math.max(1.2, atr14M5 * 0.7)); // Cap M5 SL between 120 - 350 points
      const scalpTP = scalpSL * 2.5; // 1:2.5 RR ratio

      const decisionZones = zones.filter((z: any) =>
        ['M5', 'M15'].includes(z.timeframe) &&
        (hasM5Mt5Base || z.timeframe !== 'M5')
      );

      const m5Support = decisionZones
        .filter((z: any) => z.type === 'SUPPORT' && z.timeframe === 'M5' && z.priceMax <= currentPrice)
        .sort((a: any, b: any) => b.priceMax - a.priceMax);
      const m15Support = decisionZones
        .filter((z: any) => z.type === 'SUPPORT' && z.timeframe === 'M15' && z.priceMax <= currentPrice)
        .sort((a: any, b: any) => b.priceMax - a.priceMax);
      const m5Resistance = decisionZones
        .filter((z: any) => z.type === 'RESISTANCE' && z.timeframe === 'M5' && z.priceMin >= currentPrice)
        .sort((a: any, b: any) => a.priceMin - b.priceMin);
      const m15Resistance = decisionZones
        .filter((z: any) => z.type === 'RESISTANCE' && z.timeframe === 'M15' && z.priceMin >= currentPrice)
        .sort((a: any, b: any) => a.priceMin - b.priceMin);

      const triggerSupport = m5Support[0] || m15Support[0] || nearestSupport[0] || null;
      const structureSupport = m15Support[0] || triggerSupport;
      const triggerResistance = m5Resistance[0] || m15Resistance[0] || nearestResistance[0] || null;
      const structureResistance = m15Resistance[0] || triggerResistance;
      const supportDecisionDistance = triggerSupport ? currentPrice - triggerSupport.priceMax : Infinity;
      const resistanceDecisionDistance = triggerResistance ? triggerResistance.priceMin - currentPrice : Infinity;
      const decisionDistance = Math.max(1.8, atr14M5 * 0.9);
      const nearTriggerSupport = supportDecisionDistance >= 0 && supportDecisionDistance <= decisionDistance;
      const nearTriggerResistance = resistanceDecisionDistance >= 0 && resistanceDecisionDistance <= decisionDistance;
      const m5EntryConfirmation = M5EntryConfirmationService.analyze({
        candles: m5AnalysisCandles,
        zones: decisionZones,
        currentPrice,
        now,
      });
      const hasM5BullishEngulfing = m5EntryConfirmation.direction === 'BUY';
      const hasM5BearishEngulfing = m5EntryConfirmation.direction === 'SELL';

      let scalpDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
      let scalpTitle = 'รอราคาเข้าโซนตัดสินใจ M5/M15';
      let scalpReason = 'ราคายังไม่อยู่ใกล้แนวรับ/แนวต้าน M5 หรือ M15 มากพอ จึงควรรอแท่ง M5 ปิดยืนยันก่อนเข้าเก็งกำไรสั้น';
      let scalpEntryMin = triggerSupport?.priceMin ?? currentPrice - diff;
      let scalpEntryMax = triggerSupport?.priceMax ?? currentPrice;
      let scalpRecommendedEntry = triggerSupport?.priceMax ?? currentPrice;
      let scalpStopLoss = scalpEntryMin - scalpSL;
      let scalpTakeProfit = triggerResistance?.priceMin ?? scalpRecommendedEntry + scalpTP;
      let scalpConfidence = 35;

      if (hasM5Mt5Base && nearTriggerSupport && m15Bias !== 'BEARISH' && (m5Bias === 'BULLISH' || isM5SurgingGlobal || rsi14M5 < 45)) {
        scalpDirection = 'BUY';
        scalpTitle = 'จุดซื้อสั้น: M5 แตะแนวรับ / M15 ยังพยุงราคา';
        scalpEntryMin = triggerSupport.priceMin;
        scalpEntryMax = triggerSupport.priceMax;
        scalpRecommendedEntry = Math.min(currentPrice, triggerSupport.priceMax);
        scalpStopLoss = triggerSupport.priceMin - scalpSL;
        scalpTakeProfit = triggerResistance?.priceMin ?? scalpRecommendedEntry + scalpTP;
        scalpConfidence = Math.min(95, 72 + (triggerSupport.strength || 1) * 4 + (m15Bias === 'BULLISH' ? 10 : 0) + (isM5SurgingGlobal ? 8 : 0));
        scalpReason = `ราคาเข้าใกล้แนวรับ M5 (${triggerSupport.priceMin.toFixed(2)}-${triggerSupport.priceMax.toFixed(2)}) และ M15 ไม่เป็นขาลงชัดเจน เหมาะรอแท่ง M5 ปิดกลับตัวเพื่อเข้าซื้อสั้น`;
      } else if (hasM5Mt5Base && m5Bias === 'BULLISH' && rsi14M5 < 70) {
        scalpDirection = 'BUY';
        scalpTitle = 'แผนซื้อย่อตัว (Pullback BUY): เทรนด์ M5 ขาขึ้น';

        // Dynamic Distance Guard: If support zone is too far (> 2.2 ATRs), compute relative to currentPrice
        const isSupportTooFar = triggerSupport && (currentPrice - triggerSupport.priceMax > atr14M5 * 2.2);

        const pullTarget = (triggerSupport && !isSupportTooFar) ? triggerSupport.priceMax : currentPrice - (atr14M5 * 0.8);
        scalpEntryMin = (triggerSupport && !isSupportTooFar) ? triggerSupport.priceMin : currentPrice - (atr14M5 * 1.5);
        scalpEntryMax = pullTarget;
        scalpRecommendedEntry = (triggerSupport && !isSupportTooFar) ? (triggerSupport.priceMax + triggerSupport.priceMin) / 2 : currentPrice - atr14M5;
        scalpStopLoss = scalpEntryMin - scalpSL;
        scalpTakeProfit = triggerResistance?.priceMin ?? scalpRecommendedEntry + scalpTP;
        scalpConfidence = Math.min(90, 70 + (m15Bias === 'BULLISH' ? 10 : 0) + (rsi14M5 < 45 ? 8 : 0));
        scalpReason = isSupportTooFar
          ? `เทรนด์ M5 เป็นขาขึ้นเด่นชัด แต่ฐานแนวรับหลักเดิมอยู่ห่างไกลเกินไป ระบบจึงปรับคำนวณจุดย่อรับซื้อแบบใกล้ราคาปัจจุบันตามระยะ ATR ย่อย (${scalpRecommendedEntry.toFixed(2)}) เพื่อความรวดเร็วและคุ้มค่าความเสี่ยง`
          : `เทรนด์ M5 เป็นขาขึ้นเด่นชัด (BULLISH) ระบบคำนวณราคาเข้าซื้อที่เหมาะสมเมื่อราคาย่อตัวลงมาบริเวณแนวรับเพื่อความได้เปรียบทางราคา (Buy on Pullback Zone)`;
      } else if (hasM5Mt5Base && nearTriggerResistance && m15Bias !== 'BULLISH' && (m5Bias === 'BEARISH' || isM5CrashingGlobal || rsi14M5 > 55)) {
        scalpDirection = 'SELL';
        scalpTitle = 'จุดขายสั้น: M5 แตะแนวต้าน / M15 ยังไม่หนุนขึ้น';
        scalpEntryMin = triggerResistance.priceMin;
        scalpEntryMax = triggerResistance.priceMax;
        scalpRecommendedEntry = Math.max(currentPrice, triggerResistance.priceMin);
        scalpStopLoss = triggerResistance.priceMax + scalpSL;
        scalpTakeProfit = triggerSupport?.priceMax ?? scalpRecommendedEntry - scalpTP;
        scalpConfidence = Math.min(95, 72 + (triggerResistance.strength || 1) * 4 + (m15Bias === 'BEARISH' ? 10 : 0) + (isM5CrashingGlobal ? 8 : 0));
        scalpReason = `ราคาเข้าใกล้แนวต้าน M5 (${triggerResistance.priceMin.toFixed(2)}-${triggerResistance.priceMax.toFixed(2)}) และ M15 ไม่เป็นขาขึ้นชัดเจน เหมาะรอแท่ง M5 ปิดปฏิเสธราคาเพื่อขายสั้น`;
      } else if (hasM5Mt5Base && m5Bias === 'BEARISH' && rsi14M5 > 30) {
        scalpDirection = 'SELL';
        scalpTitle = 'แผนขายย่อตัว (Pullback SELL): เทรนด์ M5 ขาลง';

        // Dynamic Distance Guard: If resistance zone is too far (> 2.2 ATRs), compute relative to currentPrice
        const isResistanceTooFar = triggerResistance && (triggerResistance.priceMin - currentPrice > atr14M5 * 2.2);

        const pullTarget = (triggerResistance && !isResistanceTooFar) ? triggerResistance.priceMin : currentPrice + (atr14M5 * 0.8);
        scalpEntryMin = pullTarget;
        scalpEntryMax = (triggerResistance && !isResistanceTooFar) ? triggerResistance.priceMax : currentPrice + (atr14M5 * 1.5);
        scalpRecommendedEntry = (triggerResistance && !isResistanceTooFar) ? (triggerResistance.priceMin + triggerResistance.priceMax) / 2 : currentPrice + atr14M5;
        scalpStopLoss = scalpEntryMax + scalpSL;
        scalpTakeProfit = triggerSupport?.priceMax ?? scalpRecommendedEntry - scalpTP;
        scalpConfidence = Math.min(90, 70 + (m15Bias === 'BEARISH' ? 10 : 0) + (rsi14M5 > 55 ? 8 : 0));
        scalpReason = isResistanceTooFar
          ? `เทรนด์ M5 เป็นขาลงเด่นชัด แต่ฐานแนวต้านหลักเดิมอยู่ห่างไกลเกินไป ระบบจึงปรับคำนวณจุดเด้งขายแบบใกล้ราคาปัจจุบันตามระยะ ATR ย่อย (${scalpRecommendedEntry.toFixed(2)}) เพื่อความรวดเร็วและคุ้มค่าความเสี่ยง`
          : `เทรนด์ M5 เป็นขาลงเด่นชัด (BEARISH) ระบบคำนวณราคาเข้าขายที่เหมาะสมเมื่อราคารีบาวด์ขึ้นไปบริเวณแนวต้านเพื่อความได้เปรียบทางราคา (Sell on Pullback Zone)`;
      }

      if (volatility === 'HIGH' || volatility === 'EXTREME') {
        scalpConfidence = Math.max(10, scalpConfidence - 10);
        scalpReason += ' ช่วงนี้ความผันผวนสูง ควรลดขนาดล็อตและรอแท่งยืนยันให้ชัด';
      }

      if (!hasM5Mt5Base && symbol === 'XAUUSD') {
        scalpDirection = 'WAIT';
        scalpTitle = 'รอแท่ง M5 จาก MT5 ก่อนให้จุดเข้า';
        scalpReason = `ยังไม่มีแท่ง M5 ที่ sync ตรงจาก MT5 สำหรับ ${activeSymbol} ระบบจึงปิดจุดเข้า M5/Scalp ชั่วคราวเพื่อป้องกันการเข้าออเดอร์ผิดตำแหน่ง`;
        scalpEntryMin = currentPrice;
        scalpEntryMax = currentPrice;
        scalpRecommendedEntry = currentPrice;
        scalpStopLoss = currentPrice;
        scalpTakeProfit = currentPrice;
        scalpConfidence = 0;
      }

      const useBrokerTickChart = isPriceEventRecent &&
        !hasM5Mt5Base &&
        !hasM15Mt5Base &&
        brokerTickM5Candles.length > 0;
      const chartSourceCandles = useBrokerTickChart
        ? brokerTickM5Candles
        : hasM5Mt5Base ? m5Candles : m15Candles;
      const chartTimeframe = useBrokerTickChart
        ? 'M5'
        : hasM5Mt5Base ? 'M5' : 'M15';
      const chartPriceSource = useBrokerTickChart
        ? 'MT5_TICK'
        : isPriceEventRecent && (hasM5Mt5Base || hasM15Mt5Base)
          ? 'MT5_SYNC_PLUS_TICK'
          : (hasM5Mt5Base || hasM15Mt5Base)
            ? 'MT5_CANDLE_SYNC'
            : 'DATABASE_CANDLES';
      const chartSyncPayload = chartTimeframe === 'M5' ? latestM5SyncPayload : latestM15SyncPayload;
      const chartSyncFresh = chartTimeframe === 'M5' ? hasM5Mt5Base : hasM15Mt5Base;
      const decisionChartZones = decisionZones
        .filter((z: any) => Math.abs(((z.priceMin + z.priceMax) / 2) - currentPrice) <= 45)
        .sort((a: any, b: any) => a.priceMin - b.priceMin)
        .slice(0, 8);

      const scalpingDecision = {
        direction: scalpDirection,
        title: scalpTitle,
        timeframe: hasM5Mt5Base ? 'M5 + M15' : 'รอ M5 จาก MT5',
        entryMin: roundPrice(scalpEntryMin),
        entryMax: roundPrice(scalpEntryMax),
        recommendedEntry: roundPrice(scalpRecommendedEntry),
        stopLoss: roundPrice(scalpStopLoss),
        takeProfit: roundPrice(scalpTakeProfit),
        confidence: scalpConfidence,
        reason: scalpReason,
        triggerSupport: hasM5Mt5Base ? serializeZone(triggerSupport) : null,
        triggerResistance: hasM5Mt5Base ? serializeZone(triggerResistance) : null,
        structureSupport: serializeZone(structureSupport),
        structureResistance: serializeZone(structureResistance),
        metrics: {
          m5Bias,
          m15Bias,
          atrM5: roundPrice(atr14M5),
          rsiM5: Math.round(rsi14M5),
        },
      };

      const decisionChart: any = {
        timeframe: chartTimeframe,
        candles: serializeCandles(chartSourceCandles),
        zones: decisionChartZones.map((zone: any) => serializeZone(zone)).filter(Boolean),
        currentPrice: roundPrice(currentPrice),
        updatedAt: (isPriceEventRecent && latestPriceEvent ? latestPriceEvent.receivedAt : new Date()).toISOString(),
        latestCandleTime: chartSourceCandles[0]?.time?.toISOString() || null,
        isLive: isPriceEventRecent,
        liveTicks: serializeLiveTicks(liveTicks),
        freshness: {
          activeSymbol,
          priceFeedLive: isPriceEventRecent,
          candleSyncLive: hasM5Mt5Base || hasM15Mt5Base,
          m5CandleSyncLive: hasM5Mt5Base,
          m15CandleSyncLive: hasM15Mt5Base,
          tickAgeMs,
          candleAgeMs: chartSourceCandles[0] ? Date.now() - chartSourceCandles[0].time.getTime() : null,
          m5CandleSyncAgeMs,
          m15CandleSyncAgeMs,
          latestTickAt: latestPriceEvent?.receivedAt.toISOString() || null,
          latestCandleSyncAt: (chartTimeframe === 'M5' ? latestM5SyncEvent : latestM15SyncEvent)?.receivedAt.toISOString() || null,
          latestM5CandleSyncAt: latestM5SyncEvent?.receivedAt.toISOString() || null,
          latestM15CandleSyncAt: latestM15SyncEvent?.receivedAt.toISOString() || null,
          priceSource: chartPriceSource,
          brokerTickChart: useBrokerTickChart,
          chartCandleCount: chartSourceCandles.length,
          chartCandlesStale: chartTimeframe === 'M5' ? !hasM5Mt5Base : !hasM15Mt5Base,
          mt5M5CandleCount,
          mt5M15CandleCount,
          missingM5Candles: !hasM5Mt5Base,
          syncCandleCount: chartSyncFresh && Number.isFinite(Number(chartSyncPayload?.count)) ? Number(chartSyncPayload.count) : null,
          syncOldestCandleAt: chartSyncFresh ? chartSyncPayload?.oldestCandleAt || null : null,
          syncLatestCandleAt: chartSyncFresh ? chartSyncPayload?.latestCandleAt || null : null,
          m5SyncCandleCount: hasM5Mt5Base && Number.isFinite(Number(latestM5SyncPayload?.count)) ? Number(latestM5SyncPayload.count) : null,
          m5SyncOldestCandleAt: hasM5Mt5Base ? latestM5SyncPayload?.oldestCandleAt || null : null,
          m5SyncLatestCandleAt: hasM5Mt5Base ? latestM5SyncPayload?.latestCandleAt || null : null,
        },
        entry: {
          direction: scalpDirection,
          priceMin: roundPrice(scalpEntryMin),
          priceMax: roundPrice(scalpEntryMax),
          recommendedEntry: roundPrice(scalpRecommendedEntry),
          stopLoss: roundPrice(scalpStopLoss),
          takeProfit: roundPrice(scalpTakeProfit),
        },
      };

      if (hasM5Mt5Base && hasM5BullishEngulfing && m5EntryConfirmation.entry && m5EntryConfirmation.stopLoss && m5EntryConfirmation.takeProfit && m15Bias !== 'BEARISH') {
        const entry = m5EntryConfirmation.entry;
        const stopLoss = m5EntryConfirmation.stopLoss;
        const takeProfit = m5EntryConfirmation.takeProfit;
        const confirmedSupport = m5EntryConfirmation.zone!;
        const supportEngulfConfidence = normalizePlanConfidence(
          78 +
          (confirmedSupport.strength || 1) * 3 +
          (m15Bias === 'BULLISH' ? 8 : 0) +
          (h1Bias === 'BULLISH' ? 5 : 0) -
          (volatility === 'EXTREME' ? 10 : volatility === 'HIGH' ? 5 : 0),
        );

        proactivePlans.push({
          id: `ai-plan-support-engulf-buy-${symbol}`,
          type: 'BUY_MARKET',
          title: 'ซื้อแนวรับหลัง M5 ยกตัวและ CHOCH UP',
          entry,
          entry1: entry,
          entry2: roundPrice(confirmedSupport.priceMax),
          entry3: roundPrice(confirmedSupport.priceMin),
          stopLoss,
          takeProfit,
          reason: `${m5EntryConfirmation.reason} โดยแนวรับอยู่ที่ ${confirmedSupport.priceMin.toFixed(2)}-${confirmedSupport.priceMax.toFixed(2)} และใช้เป้าขั้นต่ำ 1:2`,
          confidence: supportEngulfConfidence,
          strategyId: 'support_m5_choch_reclaim',
          strategyMode: 'SWING',
          strategyLabel: 'Swing support bounce',
          confirmation: `Closed M5 support reclaim + CHOCH UP at ${m5EntryConfirmation.structureBreak?.toFixed(2)}`,
          pointStopLoss: Math.round(Math.abs(entry - stopLoss) * 100),
          timeframe: 'M5',
        });
      }

      if (hasM5Mt5Base && nearestSupport.length > 0) {
        const support = nearestSupport[0];

        let planConfidence = support.strength > 3 ? 85 : 75;
        let planTitle = 'โซนเฝ้าระวังดักซื้อจากแนวรับ';
        let planReason = `ราคามีโอกาสย่อตัวลงมาทดสอบแนวรับที่ ${support.priceMax.toFixed(2)} แนะนำให้รอแท่งเทียนกลับตัว เช่น Pinbar หรือ Engulfing เพื่อยืนยันก่อนเข้าซื้อ`;

        // Anti-Falling Knife Logic + Session Volatility Consideration
        const isCounterTrend = bias === 'BEARISH' && trendStrength > 60;
        const isExtremeVol = sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH';

        if (isCounterTrend || isExtremeVol) {
          planConfidence = isExtremeVol ? 30 : 40;
          planTitle = '⚠️ ระวังแนวรับเสี่ยงสูง';
          planReason = isExtremeVol
            ? `ตลาดอเมริกาผันผวนรุนแรง การดักซื้อที่แนวรับมีความเสี่ยงสูงที่จะโดนลากทะลุ แนะนำให้รอพฤเบิกกระบวนราคาและแท่งเทียนกลับตัวก่อนเข้าเสมอ`
            : `ตลาดกำลังดิ่งลงแรง (${Math.round(trendStrength)}%) โซนแนวรับนี้เสี่ยงที่จะรับไม่อยู่ แนะนำให้รอดูการสร้างฐานราคาใหม่`;
        }

        const supportMid = (support.priceMax + support.priceMin) / 2;
        proactivePlans.push({
          id: `ai-plan-buy-${symbol}`,
          type: 'BUY_ZONE',
          title: planTitle,
          entry: supportMid,
          entry1: supportMid,
          entry2: supportMid - diff * 0.5,
          entry3: support.priceMin,
          stopLoss: support.priceMin - fixedSupportSl,
          takeProfit: supportMid + Math.max(atrTP, fixedSupportSl * 2.5),
          reason: `${planReason} โดยตั้งรอราคาย่อลึกถึงจุดกึ่งกลางแนวรับเพื่อให้จุดตัดขาดทุน (SL) แคบลงและได้เปรียบราคามากขึ้น เงื่อนไขยืนยันคือ M5 ต้องปิดแท่งกลับตัวในโซนนี้`,
          confidence: planConfidence,
          strategyId: 'support_m5_bullish_engulfing',
          strategyMode: 'SWING',
          strategyLabel: 'Swing support bounce',
          confirmation: 'Wait for M5 bullish engulfing close',
          pointStopLoss: 500,
          timeframe: 'M5',
        });
      }

      if (hasM5Mt5Base && nearestResistance.length > 0) {
        const res = nearestResistance[0];

        let planConfidence = res.strength > 3 ? 85 : 75;
        let planTitle = 'โซนเฝ้าระวังดักขายจากแนวต้าน';
        let planReason = `ราคามีโอกาสขึ้นไปทดสอบแนวต้านที่ ${res.priceMin.toFixed(2)} แนะนำให้รอแท่งเทียนกลับตัว เช่น Pinbar หรือ Engulfing เพื่อยืนยันก่อนเข้าขาย`;

        // Anti-Rocket Logic + Session Volatility Consideration
        const isCounterTrend = bias === 'BULLISH' && trendStrength > 60;
        const isExtremeVol = sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH';

        if (isCounterTrend || isExtremeVol) {
          planConfidence = isExtremeVol ? 30 : 40;
          planTitle = '⚠️ ระวังแนวต้านเสี่ยงสูง';
          planReason = isExtremeVol
            ? `ตลาดอเมริกาผันผวนรุนแรง การดักขายที่แนวต้านมีความเสี่ยงสูงที่จะโดนลากทะลุ แนะนำให้รอพฤติกรรมราคาและแท่งเทียนกลับตัวก่อนเข้าเสมอ`
            : `ตลาดกำลังพุ่งขึ้นแรง (${Math.round(trendStrength)}%) โซนแนวต้านนี้เสี่ยงที่จะต้านไม่อยู่ แนะนำให้รอดูการสร้างฐานราคาใหม่`;
        }

        const resMid = (res.priceMin + res.priceMax) / 2;
        proactivePlans.push({
          id: `ai-plan-sell-${symbol}`,
          type: 'SELL_ZONE',
          title: planTitle,
          entry: resMid,
          entry1: resMid,
          entry2: resMid + diff * 0.5,
          entry3: res.priceMax,
          stopLoss: res.priceMax + fixedSupportSl,
          takeProfit: resMid - Math.max(atrTP, fixedSupportSl * 2.5),
          reason: `${planReason} โดยตั้งเด้งขายลึกขึ้นที่บริเวณกึ่งกลางแนวต้านเพื่อลดขนาดระยะทนลากและจำกัด SL ให้แคบที่สุดเพื่อความได้เปรียบทางเทคนิค`,
          confidence: planConfidence,
          strategyId: 'resistance_m5_bearish_engulfing',
          strategyMode: 'SWING',
          strategyLabel: 'Swing resistance rejection',
          confirmation: hasM5BearishEngulfing ? 'M5 bearish engulfing close' : 'Wait for M5 bearish engulfing close',
          pointStopLoss: 500,
          timeframe: 'M5',
        });
      }

      // --- Actionable BUY Plans (Pullback / Double Bottom / EMA Cross / Oversold Bounce) ---
      let buyConfidence = bias === 'BULLISH' ? Math.round(trendStrength) : (bias === 'BEARISH' ? 45 : 60);
      if (isHigherLow || isDoubleBottom) buyConfidence += 15;
      if (isEmaCrossBullish) buyConfidence += 15;
      if (rsi14M5 < 40) buyConfidence += 10;
      buyConfidence = Math.min(95, Math.max(55, buyConfidence));

      const buyPullbackTarget = triggerSupport?.priceMax ?? (ema20_m15 - atr14 * 0.3);
      const buyEntry1 = roundPrice(Math.min(currentPrice, buyPullbackTarget));
      const buyEntry2 = roundPrice(buyEntry1 - diff * 0.5);
      const buyEntry3 = roundPrice(buyEntry1 - diff);
      const buyStopLoss = roundPrice(buyEntry3 - atrSL);
      const buyRiskPoints = Math.max(1.5, buyEntry1 - buyStopLoss);
      const buyTakeProfit = roundPrice(buyEntry1 + (buyRiskPoints * 2.5)); // 1:2.5 RR

      if (isDoubleBottom || isHigherLow) {
        proactivePlans.push({
          id: `ai-plan-double-bottom-buy-${symbol}`,
          type: 'BUY_MARKET',
          title: isDoubleBottom ? 'ซื้อกลับตัว: รูปแบบ Double Bottom (ฐานคู่)' : 'ซื้อสะสมพักฐาน: รูปแบบ Higher Low (ย่อยก)',
          entry: currentPrice,
          entry1: currentPrice,
          entry2: buyEntry2,
          entry3: buyEntry3,
          stopLoss: buyStopLoss,
          takeProfit: buyTakeProfit,
          reason: isDoubleBottom
            ? `กราฟ M5/M15 ทำรูปแบบ Double Bottom (ฐานคู่กลับตัว) บริเวณแนวรับ มีแรงซื้อเด้งกลับชัดเจน เหมาะเข้าซื้อสะสมจุดย่อเพื่อเป้าทำกำไร 1:2.5`
            : `กราฟ M5/M15 ยกฐานราคาขึ้น (Higher Low / ย่อยก) บ่งบอกโครงสร้างฝั่งซื้อแข็งแกร่ง เหมาะเข้าซื้อสะสมตามเทรนด์`,
          confidence: Math.min(95, buyConfidence + 10),
          strategyId: 'support_m5_bullish_engulfing',
          strategyMode: 'SWING',
          strategyLabel: 'Double Bottom / Higher Low Bounce',
          confirmation: 'Pattern reversal confirmed on M5/M15',
          pointStopLoss: Math.round(buyRiskPoints * 100),
          timeframe: 'M5',
        });
      }

      if (isEmaCrossBullish) {
        proactivePlans.push({
          id: `ai-plan-ema-cross-buy-${symbol}`,
          type: 'BUY_MARKET',
          title: 'ซื้อตามสัญญาณ: EMA 9 ตัดขึ้น EMA 21 (Bullish Cross)',
          entry: currentPrice,
          entry1: currentPrice,
          entry2: buyEntry2,
          entry3: buyEntry3,
          stopLoss: buyStopLoss,
          takeProfit: buyTakeProfit,
          reason: `เส้นเฉลี่ยระยะสั้น EMA 9 ตัดขึ้นเหนือ EMA 21 บน M5 บ่งชี้โมเมนตัมขาขึ้นเริ่มต้น เหมาะเข้าซื้อสะสมตามสัญญาณ EMA Cross`,
          confidence: Math.min(95, buyConfidence + 12),
          strategyId: 'follow_trend_ema20_pullback',
          strategyMode: 'FOLLOW_TREND',
          strategyLabel: 'EMA Cross Bullish',
          confirmation: 'EMA 9/21 bullish crossover',
          pointStopLoss: Math.round(buyRiskPoints * 100),
          timeframe: 'M5',
        });
      }

      // Standard / Pullback BUY Plan
      proactivePlans.push({
        id: `ai-plan-follow-buy-${symbol}`,
        type: currentPrice <= buyEntry1 + 0.5 ? 'BUY_MARKET' : 'BUY_LIMIT',
        title: bias === 'BULLISH' ? 'แผนย่อซื้อ (Pullback BUY): โซนแนวรับ/EMA20' : 'ดักซื้อสวนกลับ (Counter-BUY) โซนแนวรับ',
        entry: buyEntry1,
        entry1: buyEntry1,
        entry2: buyEntry2,
        entry3: buyEntry3,
        stopLoss: buyStopLoss,
        takeProfit: buyTakeProfit,
        reason: `ราคาย่อตัวลงมาในโซนแนวรับพักฐาน / EMA20 (${ema20_m15.toFixed(2)}) RSI อยู่ในระดับเหมาะสม (${Math.round(rsi14M5)}) ตั้งจุดย่อซื้อที่ได้เปรียบราคาและ R:R ไม่ต่ำกว่า 1:2.5`,
        confidence: buyConfidence,
        strategyId: 'follow_trend_ema20_pullback',
        strategyMode: 'FOLLOW_TREND',
        strategyLabel: 'Follow trend pullback',
        confirmation: 'M15/M5 pullback to support zone',
        pointStopLoss: Math.round(buyRiskPoints * 100),
        timeframe: 'M15',
      });

      // --- Actionable SELL Plans (Pullback / EMA Cross / Overbought Rejection) ---
      let sellConfidence = bias === 'BEARISH' ? Math.round(trendStrength) : (bias === 'BULLISH' ? 45 : 60);
      if (isEmaCrossBearish) sellConfidence += 15;
      if (rsi14M5 > 60) sellConfidence += 10;
      sellConfidence = Math.min(95, Math.max(55, sellConfidence));

      const sellPullbackTarget = triggerResistance?.priceMin ?? (ema20_m15 + atr14 * 0.3);
      const sellEntry1 = roundPrice(Math.max(currentPrice, sellPullbackTarget));
      const sellEntry2 = roundPrice(sellEntry1 + diff * 0.5);
      const sellEntry3 = roundPrice(sellEntry1 + diff);
      const sellStopLoss = roundPrice(sellEntry3 + atrSL);
      const sellRiskPoints = Math.max(1.5, sellStopLoss - sellEntry1);
      const sellTakeProfit = roundPrice(sellEntry1 - (sellRiskPoints * 2.5)); // 1:2.5 RR

      if (isEmaCrossBearish) {
        proactivePlans.push({
          id: `ai-plan-ema-cross-sell-${symbol}`,
          type: 'SELL_MARKET',
          title: 'ขายตามสัญญาณ: EMA 9 ตัดลง EMA 21 (Bearish Cross)',
          entry: currentPrice,
          entry1: currentPrice,
          entry2: sellEntry2,
          entry3: sellEntry3,
          stopLoss: sellStopLoss,
          takeProfit: sellTakeProfit,
          reason: `เส้นเฉลี่ยระยะสั้น EMA 9 ตัดลงใต้ EMA 21 บน M5 บ่งชี้โมเมนตัมขาลงเริ่มต้น เหมาะเข้าขายสะสมตามสัญญาณ EMA Cross`,
          confidence: Math.min(95, sellConfidence + 12),
          strategyId: 'resistance_m5_bearish_engulfing',
          strategyMode: 'FOLLOW_TREND',
          strategyLabel: 'EMA Cross Bearish',
          confirmation: 'EMA 9/21 bearish crossover',
          pointStopLoss: Math.round(sellRiskPoints * 100),
          timeframe: 'M5',
        });
      }

      // Standard / Pullback SELL Plan
      proactivePlans.push({
        id: `ai-plan-follow-sell-${symbol}`,
        type: currentPrice >= sellEntry1 - 0.5 ? 'SELL_MARKET' : 'SELL_LIMIT',
        title: bias === 'BEARISH' ? 'แผนเด้งขาย (Pullback SELL): โซนแนวต้าน/EMA20' : 'ดักขายสวนกลับ (Counter-SELL) โซนแนวต้าน',
        entry: sellEntry1,
        entry1: sellEntry1,
        entry2: sellEntry2,
        entry3: sellEntry3,
        stopLoss: sellStopLoss,
        takeProfit: sellTakeProfit,
        reason: `ราคาฟื้นตัวขึ้นไปในโซนแนวต้านพักฐาน / EMA20 (${ema20_m15.toFixed(2)}) RSI อยู่ในระดับเหมาะสม (${Math.round(rsi14M5)}) ตั้งจุดเด้งขายที่ได้เปรียบราคาและ R:R ไม่ต่ำกว่า 1:2.5`,
        confidence: sellConfidence,
        strategyId: 'resistance_m5_bearish_engulfing',
        strategyMode: 'FOLLOW_TREND',
        strategyLabel: 'Follow trend pullback',
        confirmation: 'M15/M5 pullback to resistance zone',
        pointStopLoss: Math.round(sellRiskPoints * 100),
        timeframe: 'M15',
      });

      // --- Scalping Logic: M5 trigger + M15 support/resistance structure ---
      if (scalpDirection === 'BUY' && rsi14M5 < 75) {
         proactivePlans.push({
           id: `ai-plan-scalp-buy-${symbol}`,
           type: 'BUY_LIMIT',
           title: 'เก็งกำไรสั้นฝั่งซื้อจากแนวรับ M5/M15',
           entry: scalpRecommendedEntry,
           entry1: scalpEntryMax,
           entry2: scalpRecommendedEntry,
           entry3: scalpEntryMin,
           stopLoss: scalpStopLoss,
           takeProfit: scalpTakeProfit,
           reason: scalpReason,
           confidence: scalpConfidence,
           strategyId: 'scalp_m5_zone_reversal',
           strategyMode: 'SCALP',
           strategyLabel: 'M5/M15 scalp reversal',
           confirmation: 'M5 close confirms bounce from zone',
           timeframe: 'M5',
         });
      } else if (scalpDirection === 'SELL' && rsi14M5 > 25) {
         proactivePlans.push({
           id: `ai-plan-scalp-sell-${symbol}`,
           type: 'SELL_LIMIT',
           title: 'เก็งกำไรสั้นฝั่งขายจากแนวต้าน M5/M15',
           entry: scalpRecommendedEntry,
           entry1: scalpEntryMin,
           entry2: scalpRecommendedEntry,
           entry3: scalpEntryMax,
           stopLoss: scalpStopLoss,
           takeProfit: scalpTakeProfit,
           reason: scalpReason,
           confidence: scalpConfidence,
           strategyId: 'scalp_m5_zone_reversal',
           strategyMode: 'SCALP',
           strategyLabel: 'M5/M15 scalp reversal',
           confirmation: 'M5 close confirms rejection from zone',
           timeframe: 'M5',
         });
      }

      const biasSettingKey = 'FUNDAMENTAL_BIAS_XAUUSD';
      const warningSettingKey = 'FUNDAMENTAL_NEWS_WARNING_XAUUSD';
      const researchSettingKey = StrategyResearchService.settingKey(symbol);
      const [fundamentalBiasSetting, fundamentalWarningSetting, strategyResearchSetting] = await Promise.all([
        prisma.systemSetting.findUnique({ where: { key: biasSettingKey } }),
        prisma.systemSetting.findUnique({ where: { key: warningSettingKey } }),
        prisma.systemSetting.findUnique({ where: { key: researchSettingKey } }),
      ]);

      const fundamentalBias = fundamentalBiasSetting?.value || 'NEUTRAL';
      const fundamentalWarning = fundamentalWarningSetting?.value || '';
      let strategyResearch = StrategyResearchService.parseReport(strategyResearchSetting?.value);
      if (!isPublic) {
        strategyResearch = await ensureResearchUpkeep(symbol, strategyResearch);
      }
      const hasFreshTradeStructure = true;
      const eligibleProactivePlans = marketRegime.tradable
        ? proactivePlans
            .filter((plan) => MarketRegimeService.strategyAllowed(marketRegime.regime, plan.strategyId))
            .map((plan) => ({
              ...plan,
              confidence: Math.min(plan.confidence, marketRegime.confidenceCap),
              reason: `[${marketRegime.regime}] ${plan.reason}`,
            }))
        : [];
      const evaluatedPlans: RecommendationPlan[] = (isPublic ? [] : eligibleProactivePlans)
        .map((plan) => {
          const researchCandidate = getResearchCandidate(strategyResearch, plan.strategyId);

          if (researchCandidate && researchCandidate.sampleSize >= 15 && researchCandidate.winRate < 35) {
            console.log(`[AI TUNING] Pruned low-performing strategy: ${plan.strategyId} (${researchCandidate.winRate}% over ${researchCandidate.sampleSize} samples)`);
            return null;
          }

          if (researchCandidate && researchCandidate.liveForwardTest) {
            const { winRate, sampleSize } = researchCandidate.liveForwardTest;
            if (sampleSize >= 15 && winRate < 35) {
              console.log(`[AI TUNING] Pruned low winrate recommendation strategy: ${plan.strategyId} (${winRate}% winrate over ${sampleSize} samples)`);
              return null;
            }
          }

          let confidence = normalizePlanConfidence(plan.confidence);

          // Asian Session Rule: Moderate penalty during low volume hours
          const isAsianSession = currentUtcHour >= 23 || currentUtcHour < 8;
          let planReason = plan.reason;
          if (isAsianSession) {
            confidence = Math.max(10, confidence - 12);
            planReason = `(ช่วงเอเชียวอลุ่มต่ำ - เพิ่มความระมัดระวัง) ${planReason}`;
          }

          // Dynamic Optimization: Auto-calibrate levels based on optimized research parameters
          let stopLoss = plan.stopLoss;
          let takeProfit = plan.takeProfit;
          if (researchCandidate && researchCandidate.status === 'APPROVED') {
            const optParams = researchCandidate.parameters;
            const entry = plan.entry;
            const isBuy = plan.direction === 'BUY' || plan.type?.includes('BUY');

            if (optParams.slPoints) {
              const slDist = optParams.slPoints * 0.01;
              stopLoss = isBuy ? entry - slDist : entry + slDist;

              const tpDist = slDist * (optParams.riskReward || 2.0);
              takeProfit = isBuy ? entry + tpDist : entry - tpDist;
            }
          }

          const candidatePlan: RecommendationPlan = {
            ...plan,
            stopLoss: roundPrice(stopLoss),
            takeProfit: roundPrice(takeProfit),
            confidence,
            reason: planReason,
            researchStatus: researchCandidate?.status || (strategyResearch ? 'RESEARCHING' : 'NOT_RUN'),
            researchWinRate: researchCandidate?.winRate ?? null,
            researchSampleSize: researchCandidate?.sampleSize ?? 0,
          };

          return {
            ...candidatePlan,
            ...buildPlanRiskProfile(candidatePlan, {
              currentPrice,
              volatility,
              h1Bias,
              m15Bias,
              researchSampleSize: candidatePlan.researchSampleSize || 0,
              fundamentalBias,
              fundamentalWarning,
            }),
          };
        })
        .filter((plan): plan is NonNullable<typeof plan> =>
          plan !== null &&
          plan.type !== 'WAIT' &&
          plan.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
          (plan.riskScore ?? 100) <= MAX_RECOMMENDATION_RISK_SCORE &&
          (plan.riskReward ?? 0) >= 1.8
        )
        .sort((a, b) => b.confidence - a.confidence);

      if (!isPublic) {
        await recordShadowPlans(symbol, evaluatedPlans);
      }

      let recommendationPlans = evaluatedPlans
        .filter((plan) => getResearchCandidate(strategyResearch, plan.strategyId)?.status === 'APPROVED')
        .slice(0, 6);

      // No fallback here: if every candidate fails the evidence/risk filters,
      // the correct customer-facing decision is NO_TRADE.

      let activeOrderPlan: RecommendationPlan | null = null;
      const storedSetting = await prisma.systemSetting.findUnique({ where: { key: stablePlanSettingKey(symbol) } });
      let storedPlan = parseStoredOrderPlan(storedSetting?.value, currentPrice);

      // Discard plan if price breached SL or hit TP
      if (storedPlan) {
        const dir = getPlanDirection(storedPlan);
        const isBreached = dir === 'BUY'
          ? (currentPrice <= storedPlan.stopLoss)
          : (currentPrice >= storedPlan.stopLoss);

        if (isBreached) {
          console.log(`[DASHBOARD STATS] Stored plan ${storedPlan.id} breached by price $${currentPrice}. Purging stored plan...`);
          storedPlan = null;
          await prisma.systemSetting.deleteMany({ where: { key: stablePlanSettingKey(symbol) } }).catch(() => {});
        }
      }

      const openTrackingPlan = await getOpenTrackingPlan(symbol, currentPrice);
      if (openTrackingPlan) {
        activeOrderPlan = openTrackingPlan;
      } else {
        activeOrderPlan = await getStableOrderPlan(
          symbol,
          recommendationPlans,
          currentPrice,
          hasM5Mt5Base && marketRegime.tradable,
          hasFreshTradeStructure && marketRegime.tradable,
        );
      }

      if (activeOrderPlan) {
        recommendationPlans = [
          activeOrderPlan,
          ...recommendationPlans.filter((plan) =>
            plan.id !== activeOrderPlan!.id &&
            plan.id !== activeOrderPlan!.sourcePlanId,
          ),
        ].slice(0, 6);
        decisionChart.orderPlan = activeOrderPlan;
      }

      marketIntelligence[symbol] = {
        currentPrice,
        bias,
        trendStrength: Math.round(trendStrength),
        volatility,
        nearestSupport,
        nearestResistance,
        dangerZones,
        proactivePlans: isPublic ? [] : recommendationPlans,
        activeOrderPlan: isPublic ? null : activeOrderPlan,
        hasActivePlan: Boolean(activeOrderPlan),
        recommendationPolicy: {
          minConfidence: MIN_RECOMMENDATION_CONFIDENCE,
          maxRiskScore: MAX_RECOMMENDATION_RISK_SCORE,
          researchRequiredAfterRun: true,
          freshMt5CandlesRequired: true,
          freshTradeStructure: hasFreshTradeStructure,
          hiddenCandidates: proactivePlans.length - recommendationPlans.length,
        },
        strategyResearch: isPublic ? null : strategyResearch,
        scalpingDecision,
        decisionChart: isPublic ? undefined : decisionChart,
        marketSession,
        fundamentalBias,
        fundamentalWarning,
        candles: (m15Candles || []).slice(0, 80).reverse().map((c) => ({
          time: new Date(c.time).toISOString(),
          open: roundPrice(c.open),
          high: roundPrice(c.high),
          low: roundPrice(c.low),
          close: roundPrice(c.close),
          volume: c.volume || 100,
        })),
        m5Candles: (m5Candles || []).slice(0, 80).reverse().map((c) => ({
          time: new Date(c.time).toISOString(),
          open: roundPrice(c.open),
          high: roundPrice(c.high),
          low: roundPrice(c.low),
          close: roundPrice(c.close),
          volume: c.volume || 100,
        })),
        m15Candles: (m15Candles || []).slice(0, 80).reverse().map((c) => ({
          time: new Date(c.time).toISOString(),
          open: roundPrice(c.open),
          high: roundPrice(c.high),
          low: roundPrice(c.low),
          close: roundPrice(c.close),
          volume: c.volume || 100,
        })),
        h1Candles: (h1Candles || []).slice(0, 80).reverse().map((c) => ({
          time: new Date(c.time).toISOString(),
          open: roundPrice(c.open),
          high: roundPrice(c.high),
          low: roundPrice(c.low),
          close: roundPrice(c.close),
          volume: c.volume || 100,
        })),
        timeframeBiases: {
          D1: d1Bias,
          H4: h1Bias,
          H1: h1Bias,
          M15: m15Bias,
          M5: m5Bias,
        }
      };

    }

    // 8. Determine live feed status by reusing cached webhook event queries
    const latestPriceOverall = priceEvents[0] || null;
    const latestCandleSyncOverall = mt5SyncEvent;
    const latestM5CandleSyncOverall = mt5M5SyncEvent;
    const latestM15CandleSyncOverall = mt5M15SyncEvent;

    let latestEventOverall = null;
    if (latestPriceOverall && latestCandleSyncOverall) {
      latestEventOverall = latestPriceOverall.receivedAt.getTime() > latestCandleSyncOverall.receivedAt.getTime()
        ? latestPriceOverall
        : latestCandleSyncOverall;
    } else {
      latestEventOverall = latestPriceOverall || latestCandleSyncOverall;
    }

    const lastSyncTime = latestEventOverall ? latestEventOverall.receivedAt.getTime() : 0;
    const lastPriceTime = latestPriceOverall ? latestPriceOverall.receivedAt.getTime() : 0;
    const lastCandleSyncTime = latestCandleSyncOverall ? latestCandleSyncOverall.receivedAt.getTime() : 0;
    const lastM5CandleSyncTime = latestM5CandleSyncOverall ? latestM5CandleSyncOverall.receivedAt.getTime() : 0;
    const lastM15CandleSyncTime = latestM15CandleSyncOverall ? latestM15CandleSyncOverall.receivedAt.getTime() : 0;
    const nowMs = now.getTime();
    const priceFeedAgeMs = lastPriceTime > 0 ? nowMs - lastPriceTime : null;
    const candleSyncAgeMs = lastCandleSyncTime > 0 ? nowMs - lastCandleSyncTime : null;
    const m5CandleSyncAgeMs = lastM5CandleSyncTime > 0 ? nowMs - lastM5CandleSyncTime : null;
    const m15CandleSyncAgeMs = lastM15CandleSyncTime > 0 ? nowMs - lastM15CandleSyncTime : null;
    const isPriceFeedLive = priceFeedAgeMs !== null && priceFeedAgeMs < 90 * 1000;
    const isM5CandleSyncLive = m5CandleSyncAgeMs !== null && m5CandleSyncAgeMs < STALE_M5_CANDLE_SYNC_MS;
    const isM15CandleSyncLive = m15CandleSyncAgeMs !== null && m15CandleSyncAgeMs < STALE_MT5_CANDLE_BASE_MS;
    const isCandleSyncLive = isM5CandleSyncLive || isM15CandleSyncLive;
    const isMt5Live = isPriceFeedLive || isCandleSyncLive;
    const latestPricePayload = parseEventPayload(latestPriceOverall);
    const latestCandleSyncPayload = parseEventPayload(latestCandleSyncOverall);
    const latestM5CandleSyncPayload = parseEventPayload(latestM5CandleSyncOverall);
    const latestM15CandleSyncPayload = parseEventPayload(latestM15CandleSyncOverall);
    const latestPrice = Number(latestPricePayload?.price);
    const latestCandleCount = Number(latestCandleSyncPayload?.count);
    const latestM5CandleCount = Number(latestM5CandleSyncPayload?.count);
    const latestM15CandleCount = Number(latestM15CandleSyncPayload?.count);
    const mt5RealtimeState =
      isPriceFeedLive && isM5CandleSyncLive
        ? 'LIVE'
        : isPriceFeedLive
          ? 'PRICE_ONLY'
          : isM5CandleSyncLive
            ? 'CANDLE_ONLY'
            : 'OFFLINE';
    const mt5RealtimeStatus = {
      state: mt5RealtimeState,
      label: mt5RealtimeState === 'LIVE'
        ? 'รับค่าปกติ'
        : mt5RealtimeState === 'PRICE_ONLY'
          ? 'รับราคาอยู่ / M5 ยังไม่สด'
          : mt5RealtimeState === 'CANDLE_ONLY'
            ? 'รับแท่ง M5 อยู่ / รอราคาสด'
            : 'ยังไม่รับค่าล่าสุด',
      message: mt5RealtimeState === 'LIVE'
        ? 'MT5 VPS ส่งทั้งราคาสดและแท่ง M5 เข้าระบบตามปกติ'
        : mt5RealtimeState === 'PRICE_ONLY'
          ? 'ราคาสดจาก MT5 ยังเข้าอยู่ แต่แท่ง M5 ยังไม่ sync ล่าสุด ควรตรวจ EA ฝั่ง candle sync'
          : mt5RealtimeState === 'CANDLE_ONLY'
            ? 'แท่ง M5 ยัง sync อยู่ แต่ราคาสดขาดช่วง ควรตรวจ webhook price feed'
            : 'ยังไม่พบข้อมูลสดจาก MT5 ในช่วงล่าสุด ควรตรวจ VPS, MT5, EA และ WebRequest',
      checkedAt: now.toISOString(),
      priceFeed: {
        live: isPriceFeedLive,
        ageMs: priceFeedAgeMs,
        symbol: latestPriceOverall?.symbol || null,
        timeframe: latestPriceOverall?.timeframe || null,
        receivedAt: latestPriceOverall?.receivedAt?.toISOString?.() || null,
        price: Number.isFinite(latestPrice) ? roundPrice(latestPrice) : null,
      },
      m5CandleSync: {
        live: isM5CandleSyncLive,
        ageMs: m5CandleSyncAgeMs,
        symbol: latestM5CandleSyncOverall?.symbol || null,
        timeframe: latestM5CandleSyncOverall?.timeframe || null,
        receivedAt: latestM5CandleSyncOverall?.receivedAt?.toISOString?.() || null,
        count: Number.isFinite(latestM5CandleCount) ? latestM5CandleCount : null,
        oldestCandleAt: latestM5CandleSyncPayload?.oldestCandleAt || null,
        latestCandleAt: latestM5CandleSyncPayload?.latestCandleAt || null,
      },
      m15CandleSync: {
        live: isM15CandleSyncLive,
        ageMs: m15CandleSyncAgeMs,
        symbol: latestM15CandleSyncOverall?.symbol || null,
        timeframe: latestM15CandleSyncOverall?.timeframe || null,
        receivedAt: latestM15CandleSyncOverall?.receivedAt?.toISOString?.() || null,
        count: Number.isFinite(latestM15CandleCount) ? latestM15CandleCount : null,
        oldestCandleAt: latestM15CandleSyncPayload?.oldestCandleAt || null,
        latestCandleAt: latestM15CandleSyncPayload?.latestCandleAt || null,
      },
    };

    // 8.5 Fetch recent webhook events log for diagnostics (skip in public mode)
    let formattedEvents: any[] = [];
    if (!isPublic && userRole === 'admin') {
      const selectedSymbolFilters = assets.map((asset) => ({
        symbol: { in: ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'] },
      }));
      const recentEvents = await prisma.webhookEvent.findMany({
        where: { OR: selectedSymbolFilters },
        orderBy: { receivedAt: 'desc' },
        take: 16,
      });

      formattedEvents = recentEvents.map(event => {
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
    }

    const todaySignalCounts = todaySignalsRaw.reduce(
      (acc, signal) => {
        if (signal.direction === 'BUY') acc.buy += 1;
        else if (signal.direction === 'SELL') acc.sell += 1;
        else acc.wait += 1;
        return acc;
      },
      { buy: 0, sell: 0, wait: 0 },
    );
    const latestWins = latestClosedTrades.filter((trade) => trade.result === 'WIN').length;
    const latestLosses = latestClosedTrades.filter((trade) => trade.result === 'LOSS').length;
    const latestBreakEven = latestClosedTrades.filter((trade) => trade.result === 'BE').length;
    const latestDecided = latestWins + latestLosses;
    const latestAverageRR = latestClosedTrades.length > 0
      ? roundNumber(latestClosedTrades.reduce((sum, trade) => sum + trade.rrResult, 0) / latestClosedTrades.length)
      : 0;
    const latestAveragePoints = latestClosedTrades.length > 0
      ? Math.round(latestClosedTrades.reduce((sum, trade) => {
          const isBuy = trade.direction === 'BUY';
          const diff = isBuy ? ((trade.exitPrice || 0) - trade.entry) : (trade.entry - (trade.exitPrice || 0));
          return sum + Math.round(diff * 100);
        }, 0) / latestClosedTrades.length)
      : 0;
    const latestSignal = latestSignals[0] || null;
    const xauIntelligence = marketIntelligence.XAUUSD || {};
    const latestSourceDataAt = latestEventOverall?.receivedAt?.toISOString?.() || null;
    const storedOrderPlan = parseStoredOrderPlan((await prisma.systemSetting.findUnique({
      where: { key: stablePlanSettingKey('XAUUSD') },
    }))?.value);
    const storedPlanFinishReason = storedOrderPlan && typeof xauIntelligence.currentPrice === 'number'
      ? getPlanFinishReason(storedOrderPlan, xauIntelligence.currentPrice)
      : null;
    const planLifecycle = {
      status: xauIntelligence.activeOrderPlan
        ? 'ACTIVE_PLAN'
        : openTrades.length > 0
          ? 'TRACKING_OPEN_TRADE'
          : suggestedPlans.length > 0
            ? 'WAITING_FOR_ENTRY'
            : recentPlanResults.length > 0
              ? 'WAITING_FOR_NEW_REACTION'
              : 'WAITING_FOR_SETUP',
      label: xauIntelligence.activeOrderPlan
        ? 'มีแผนหลักที่ล็อกไว้'
        : openTrades.length > 0
          ? 'กำลังวัดผลออเดอร์เปิด'
          : suggestedPlans.length > 0
            ? 'มีแผนรอราคาเข้า'
            : storedPlanFinishReason === 'TP_HIT'
              ? 'แผนก่อนหน้าถึง TP แล้ว'
              : storedPlanFinishReason === 'SL_HIT'
                ? 'แผนก่อนหน้าโดน SL แล้ว'
                : 'รอราคากลับเข้าโซนใหม่',
      nextAction: xauIntelligence.activeOrderPlan
        ? 'ตามแผนหลักจนกว่าจะชน TP/SL หรือหมดอายุแผน'
        : storedPlanFinishReason === 'TP_HIT'
          ? 'ปิดผลชนะแล้ว รอราคากลับมาแนวรับ/แนวต้านเดิมเพื่อเปิดรอบใหม่'
          : storedPlanFinishReason === 'SL_HIT'
            ? 'ปิดผลแพ้แล้ว รอ confirmation รอบใหม่ก่อนเปิดแผนใหม่'
            : suggestedPlans.length > 0
              ? 'รอราคาแตะ entry ของแผนที่บันทึกไว้'
              : 'รอ AI สร้างแผนใหม่จากแนวรับ/แนวต้านล่าสุด',
      activePlans: openTrades.slice(0, 5).map(serializeOwnerTrade),
      waitingPlans: suggestedPlans.slice(0, 5).map(serializeOwnerTrade),
      recentResults: recentPlanResults.slice(0, 6).map(serializeOwnerTrade),
      lastStoredPlan: storedOrderPlan ? {
        id: storedOrderPlan.id,
        title: storedOrderPlan.title,
        direction: getPlanDirection(storedOrderPlan),
        entry: roundPrice(storedOrderPlan.entry),
        stopLoss: roundPrice(storedOrderPlan.stopLoss),
        takeProfit: roundPrice(storedOrderPlan.takeProfit),
        lockedAt: storedOrderPlan.lockedAt || null,
        finishReason: storedPlanFinishReason,
      } : null,
    };
    const labHealth = buildLabHealth({
      report: xauIntelligence.strategyResearch || null,
      openTrades,
      suggestedPlans,
      recentPlanResults,
      latestClosedTrades,
      mt5RealtimeState,
      latestResearchAt: xauIntelligence.strategyResearch?.generatedAt || null,
    });
    const ownerMetrics = {
      today: {
        timezone: 'Asia/Bangkok',
        startedAt: todayRange.start.toISOString(),
        totalSignals: todaySignalsRaw.length,
        buySignals: todaySignalCounts.buy,
        sellSignals: todaySignalCounts.sell,
        waitSignals: todaySignalCounts.wait,
        latestSignals: todaySignalsRaw.slice(0, 5).map((signal) => ({
          id: signal.id,
          signalRef: signal.id.slice(0, 8),
          symbol: signal.symbol,
          timeframe: signal.timeframe,
          direction: signal.direction === 'NO_TRADE' ? 'WAIT' : signal.direction,
          status: signal.status,
          confidence: signal.confidence,
          entry: roundPrice(signal.entry),
          stopLoss: roundPrice(signal.stopLoss),
          takeProfit1: roundPrice(signal.takeProfit1),
          takeProfit2: roundPrice(signal.takeProfit2),
          takeProfit3: signal.takeProfit3 ? roundPrice(signal.takeProfit3) : null,
          createdAt: signal.createdAt.toISOString(),
          reason: signal.reason,
        })),
      },
      performance: {
        sampleSize: latestClosedTrades.length,
        decidedSampleSize: latestDecided,
        wins: latestWins,
        losses: latestLosses,
        breakEven: latestBreakEven,
        winRate: latestDecided > 0 ? Math.round((latestWins / latestDecided) * 100) : 0,
        averageRR: latestAverageRR,
        averagePoints: latestAveragePoints,
        latestTargetHits: latestTargetHits.map(serializeOwnerTrade),
        latestStopLosses: latestStopLosses.map(serializeOwnerTrade),
      },
      labHealth,
      planLifecycle,
      subscription: {
        activeMembers,
        cancelledMembers,
        cancelledPayments,
        revenueTotal: roundNumber(allRevenue._sum.amount || 0),
        revenueThisMonth: roundNumber(monthRevenue._sum.amount || 0),
        revenueToday: roundNumber(todayRevenue._sum.amount || 0),
        approvedPayments: allRevenue._count._all,
        approvedPaymentsThisMonth: monthRevenue._count._all,
        approvedPaymentsToday: todayRevenue._count._all,
      },
      freshness: {
        latestSignalSentAt: latestSignal?.createdAt?.toISOString?.() || null,
        latestSignalDirection: latestSignal?.direction === 'NO_TRADE' ? 'WAIT' : latestSignal?.direction || null,
        latestSignalConfidence: latestSignal?.confidence ?? null,
        aiAnalyzedAt: now.toISOString(),
        sourceDataAt: latestSourceDataAt,
        latestPriceAt: lastPriceTime > 0 ? new Date(lastPriceTime).toISOString() : null,
        latestCandleSyncAt: lastCandleSyncTime > 0 ? new Date(lastCandleSyncTime).toISOString() : null,
        latestResearchAt: xauIntelligence.strategyResearch?.generatedAt || null,
        mt5RealtimeStatus,
      },
    };

    // Fetch Qwen AI track record stats safely without MySQL collation errors
    const allRecentPaperTrades = await prisma.paperTrade.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        result: true,
        rrResult: true,
        closedAt: true,
        entry: true,
        stopLoss: true,
        takeProfit1: true,
        direction: true,
        openedAt: true,
        notes: true,
        signal: { select: { reason: true } },
      },
    });

    const qwenTrades = allRecentPaperTrades.filter((t) => t.result !== 'CANCELLED').slice(0, 20);

    const qwenWins = qwenTrades.filter((t) => t.result === 'WIN').length;
    const qwenLosses = qwenTrades.filter((t) => t.result === 'LOSS').length;
    const qwenOpen = qwenTrades.filter((t) => t.result === 'OPEN' || t.result === 'PLAN').length;
    const qwenTotalClosed = qwenWins + qwenLosses;
    const qwenWinRate = qwenTotalClosed > 0 ? Number(((qwenWins / qwenTotalClosed) * 100).toFixed(1)) : 100.0;
    const qwenTotalR = qwenTrades.reduce((acc, t) => acc + (t.rrResult || 0), 0);

    const qwenPerformance = {
      totalRecorded: qwenTrades.length,
      wins: qwenWins,
      losses: qwenLosses,
      open: qwenOpen,
      winRate: qwenWinRate,
      totalRR: Number(qwenTotalR.toFixed(2)),
      trades: qwenTrades,
    };

    const responseData = {
      qwenPerformance,
      totalSignals,
      totalTrades,
      openTradesCount: openTrades.length,
      openTrades,
      suggestedPlansCount: suggestedPlans.length,
      suggestedPlans,
      recentPlanResults,
      planLifecycle,
      labHealth,
      latestSignals,
      winRate,
      netR,
      bestSetup,
      worstSetup,
      zoneCount,
      winCount,
      lossCount,
      ownerMetrics,
      marketIntelligence,
      mt5Connection: {
        isLive: isMt5Live,
        lastSyncAt: lastSyncTime > 0 ? new Date(lastSyncTime).toISOString() : null,
        priceFeedLive: isPriceFeedLive,
        candleSyncLive: isCandleSyncLive,
        m5CandleSyncLive: isM5CandleSyncLive,
        m15CandleSyncLive: isM15CandleSyncLive,
        lastPriceAt: lastPriceTime > 0 ? new Date(lastPriceTime).toISOString() : null,
        lastCandleSyncAt: lastCandleSyncTime > 0 ? new Date(lastCandleSyncTime).toISOString() : null,
        lastM5CandleSyncAt: lastM5CandleSyncTime > 0 ? new Date(lastM5CandleSyncTime).toISOString() : null,
        lastM15CandleSyncAt: lastM15CandleSyncTime > 0 ? new Date(lastM15CandleSyncTime).toISOString() : null,
        priceFeedAgeMs,
        candleSyncAgeMs,
        m5CandleSyncAgeMs,
        m15CandleSyncAgeMs,
        lastPrice: Number.isFinite(latestPrice) ? roundPrice(latestPrice) : null,
        latestCandleCount: Number.isFinite(latestCandleCount) ? latestCandleCount : null,
        latestM5CandleCount: Number.isFinite(latestM5CandleCount) ? latestM5CandleCount : null,
        latestM15CandleCount: Number.isFinite(latestM15CandleCount) ? latestM15CandleCount : null,
        realtimeStatus: mt5RealtimeStatus,
        recentEvents: formattedEvents
      }
    };

    return NextResponse.json(responseData, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics.', details: err.message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
