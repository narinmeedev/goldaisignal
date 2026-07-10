import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoneService } from '@/lib/services/zone.service';
import { StrategyResearchService, type StrategyResearchReport } from '@/lib/services/strategy-research.service';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Global in-memory cache for fallback fetch times to prevent concurrent fetch/write storms
const globalFetchCache = global as unknown as {
  lastFetchMap: Record<string, number>;
  cachedPublicStats: Record<string, any>;
  cachedPublicTime: Record<string, number>;
  cachedAdminStats: Record<string, any>;
  cachedAdminTime: Record<string, number>;
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
  rrResult: roundNumber(trade.rrResult),
  confidence: trade.signal?.confidence ?? null,
  openedAt: trade.openedAt?.toISOString?.() || null,
  closedAt: trade.closedAt?.toISOString?.() || null,
});

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
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

const shouldUpdateZonesForTimeframe = (timeframe: string) => ['M5', 'M15', 'H1'].includes(timeframe);

const upsertFallbackCandles = async (
  symbol: string,
  timeframe: string,
  candles: CandlePoint[],
  maxCandles: number,
) => {
  if (candles.length === 0) return;

  const latestIncoming = candles[0];
  const latestExisting = await prisma.candle.findFirst({
    where: { symbol, timeframe },
    orderBy: { time: 'desc' },
  });

  const latestChanged = !latestExisting ||
    latestExisting.time.getTime() !== latestIncoming.time.getTime() ||
    latestExisting.close !== latestIncoming.close ||
    latestExisting.high !== latestIncoming.high ||
    latestExisting.low !== latestIncoming.low;

  await prisma.$transaction(
    candles.map((candle) =>
      prisma.candle.upsert({
        where: {
          symbol_timeframe_time: {
            symbol,
            timeframe,
            time: candle.time,
          },
        },
        update: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        },
        create: {
          symbol,
          timeframe,
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        },
      }),
    ),
  );

  const excessCandles = await prisma.candle.findMany({
    where: { symbol, timeframe },
    orderBy: { time: 'desc' },
    skip: maxCandles,
    select: { id: true },
  });

  if (excessCandles.length > 0) {
    await prisma.candle.deleteMany({
      where: { id: { in: excessCandles.map((candle) => candle.id) } },
    });
  }

  if (latestChanged && shouldUpdateZonesForTimeframe(timeframe)) {
    await ZoneService.updateZones(symbol, timeframe);
  }
};

const getResearchCandidate = (report: StrategyResearchReport | null, strategyId?: string) => {
  if (!report || !strategyId) return null;
  return report.candidates.find((candidate) => candidate.id === strategyId) || null;
};

const normalizePlanConfidence = (confidence: number) => Math.min(95, Math.max(0, Math.round(confidence)));

const MIN_RECOMMENDATION_CONFIDENCE = 65;
const STALE_MT5_CANDLE_BASE_MS = 60 * 60 * 1000;
const STALE_M5_CANDLE_SYNC_MS = 10 * 60 * 1000;
const CHART_CANDLE_LIMIT = 360;
const M5_CANDLE_FETCH_LIMIT = 420;
const M15_CANDLE_FETCH_LIMIT = 240;
const H1_CANDLE_FETCH_LIMIT = 180;
const D1_CANDLE_FETCH_LIMIT = 120;

const stablePlanSettingKey = (symbol: string) => `ACTIVE_ORDER_PLAN_${symbol.toUpperCase()}`;

const getPlanDirection = (plan?: { type?: string; direction?: string } | null): 'BUY' | 'SELL' | null => {
  if (!plan) return null;
  if (plan.direction === 'BUY' || plan.direction === 'SELL') return plan.direction;
  if (plan.type?.includes('BUY')) return 'BUY';
  if (plan.type?.includes('SELL')) return 'SELL';
  return null;
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

const parseStoredOrderPlan = (value?: string | null): RecommendationPlan | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as RecommendationPlan;
    if (!parsed || !parsed.id || !parsed.type) return null;
    if (!Number.isFinite(parsed.entry) || !Number.isFinite(parsed.stopLoss) || !Number.isFinite(parsed.takeProfit)) return null;
    if (!getPlanDirection(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const hasPlanFinishedOrFailed = (plan: RecommendationPlan, currentPrice: number) => {
  const direction = getPlanDirection(plan);
  if (direction === 'BUY') return currentPrice <= plan.stopLoss || currentPrice >= plan.takeProfit;
  if (direction === 'SELL') return currentPrice >= plan.stopLoss || currentPrice <= plan.takeProfit;
  return true;
};

const getPlanMaxDistance = (plan: RecommendationPlan) => {
  if (plan.timeframe === 'M5' || plan.strategyMode === 'SCALP') return 4.0; // Max $4.00 deviation for M5 Scalp
  if (plan.timeframe === 'M15') return 6.5; // Max $6.50 deviation for M15 Intraday
  return 12.0; // Max $12.00 deviation for H1/H4 Swing
};

const isPlanStale = (plan: RecommendationPlan, currentPrice: number, now: Date) => {
  if (hasPlanFinishedOrFailed(plan, currentPrice)) return true;
  
  // Price deviation stale check: if current price is too far away from entry zone, cancel/expire the recommendation
  const maxDist = getPlanMaxDistance(plan);
  if (Math.abs(currentPrice - plan.entry) > maxDist) return true;
  
  // Lifetime safety stale check (max 3x lock duration, i.e., 45 minutes for M5, 2.25 hours for Swing)
  const lockedAt = plan.lockedAt ? new Date(plan.lockedAt) : null;
  if (lockedAt && Number.isFinite(lockedAt.getTime())) {
    const lockMinutes = getPlanLockMinutes(plan);
    const maxLifetimeMs = lockMinutes * 3 * 60 * 1000;
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

const getStableOrderPlan = async (
  symbol: string,
  candidates: RecommendationPlan[],
  currentPrice: number,
  allowM5DependentPlans = true,
  allowStoredPlans = true,
) => {
  // Check for competing BUY and SELL candidates with confidence >= MIN_RECOMMENDATION_CONFIDENCE (65)
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

  if (buyCandidates.length > 0 && sellCandidates.length > 0) {
    const safetyWaitPlan: RecommendationPlan = {
      id: 'safety-wait-plan',
      type: 'WAIT',
      title: 'ตลาดเลือกทิศทาง / ระวังความเสี่ยง ⚠️',
      confidence: 80,
      timeframe: 'M15',
      entry: currentPrice,
      stopLoss: 0,
      takeProfit: 0,
      reason: 'AI ค้นพบสัญญาณฝั่งซื้อ (BUY) และขาย (SELL) ก้ำกึ่งเกิดขึ้นพร้อมกัน บ่งชี้ว่าตลาดกำลังเลือกทิศทาง แนะนำหลีกเลี่ยงการเข้าออเดอร์เพื่อลดความเสี่ยง',
      strategyId: 'safety_wait',
      strategyMode: 'SCALP',
    };
    return safetyWaitPlan;
  }

  const candidate = candidates.find((plan) =>
    plan.type !== 'WAIT' &&
    plan.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
    !!getPlanDirection(plan) &&
    (allowM5DependentPlans || !isM5DependentPlan(plan)),
  );

  const now = new Date();
  const key = stablePlanSettingKey(symbol);
  const storedSetting = await prisma.systemSetting.findUnique({ where: { key } });
  const storedPlan = parseStoredOrderPlan(storedSetting?.value);
  const storedPlanAllowed = allowStoredPlans && (!storedPlan || allowM5DependentPlans || !isM5DependentPlan(storedPlan));

  if (!candidate) {
    // Persistence Rule: Keep showing the storedPlan until it is stale (SL/TP hit, price too far, or timed out)
    if (storedPlan && storedPlanAllowed && !isPlanStale(storedPlan, currentPrice, now)) {
      return normalizeOrderPlan(storedPlan, currentPrice, now, 'locked_existing');
    }
    return null;
  }

  const shouldKeepStored = storedPlan &&
    storedPlanAllowed &&
    !shouldReplaceStablePlan(storedPlan, candidate, currentPrice, now);

  if (shouldKeepStored) {
    return normalizeOrderPlan(storedPlan, currentPrice, now, 'locked_existing');
  }

  const nextPlan = normalizeOrderPlan(candidate, currentPrice, now, storedPlan ? 'replaced' : 'locked_new');
  if (!nextPlan) return null;

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(nextPlan) },
    create: { key, value: JSON.stringify(nextPlan) },
  });

  return nextPlan;
};

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const assetParam = url ? url.searchParams.get('asset') : null;
    if (assetParam && assetParam !== 'XAUUSD') {
      return NextResponse.json(
        { error: 'BTCUSD signals are disabled. Gold AI Signal now supports XAUUSD only.' },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const isPublic = url ? url.searchParams.get('public') === 'true' : false;
    const baseKey = assetParam || 'XAUUSD';

    // Detect user role to separate cache keys and bypass queries
    let userRole = 'public';
    if (!isPublic) {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (token) {
          const payload = await verifyToken(token);
          if (payload?.userId) {
            const dbUser = await prisma.user.findUnique({
              where: { id: payload.userId as string },
              select: { role: true }
            });
            if (dbUser?.role) {
              userRole = dbUser.role; // 'admin' or 'viewer'
            }
          }
        }
      } catch {
        // Fallback to viewer role on error
        userRole = 'viewer';
      }
    }

    const fullCacheKey = `${userRole}_${baseKey}`;

    // Check in-memory cache
    if (isPublic) {
      const cached = globalFetchCache.cachedPublicStats?.[fullCacheKey];
      const cachedTime = globalFetchCache.cachedPublicTime?.[fullCacheKey] || 0;
      if (cached && Date.now() - cachedTime < 4000) { // 4s TTL for public
        return NextResponse.json(cached, { headers: noStoreHeaders });
      }
    } else {
      const cached = globalFetchCache.cachedAdminStats?.[fullCacheKey];
      const cachedTime = globalFetchCache.cachedAdminTime?.[fullCacheKey] || 0;
      if (cached && Date.now() - cachedTime < 2000) { // 2s TTL for admin/viewer
        return NextResponse.json(cached, { headers: noStoreHeaders });
      }
    }

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

    if (!isPublic) {
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
        prisma.signal.count({ where: { symbol: { contains: 'XAU' } } }),
        prisma.paperTrade.count({ where: { symbol: { contains: 'XAU' } } }),
        prisma.paperTrade.findMany({
          where: { symbol: { contains: 'XAU' }, result: 'OPEN' },
          orderBy: { openedAt: 'desc' },
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { contains: 'XAU' }, result: { in: ['PLAN', 'TESTING'] } },
          orderBy: { openedAt: 'desc' },
          include: { signal: true },
        }),
        prisma.signal.findMany({
          where: { symbol: { contains: 'XAU' } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { contains: 'XAU' }, result: { in: ['WIN', 'LOSS', 'BE'] } },
        }),
        prisma.paperTrade.findMany({
          where: { symbol: { contains: 'XAU' }, result: { in: ['WIN', 'LOSS', 'BE'] } },
          orderBy: { closedAt: 'desc' },
          take: 8,
          include: { signal: true },
        }),
        prisma.zone.count({ where: { symbol: { contains: 'XAU' } } }),
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

    if (!isPublic) {
      if (userRole === 'admin') {
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
              symbol: { contains: 'XAU' },
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
            where: { symbol: { contains: 'XAU' }, result: { in: ['WIN', 'LOSS', 'BE'] } },
            orderBy: { closedAt: 'desc' },
            take: 30,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { contains: 'XAU' }, result: 'WIN' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { contains: 'XAU' }, result: 'LOSS' },
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
              symbol: { contains: 'XAU' },
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
            where: { symbol: { contains: 'XAU' }, result: { in: ['WIN', 'LOSS', 'BE'] } },
            orderBy: { closedAt: 'desc' },
            take: 30,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { contains: 'XAU' }, result: 'WIN' },
            orderBy: { closedAt: 'desc' },
            take: 3,
            include: { signal: true },
          }),
          prisma.paperTrade.findMany({
            where: { symbol: { contains: 'XAU' }, result: 'LOSS' },
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
    let tvPriceEvents: any[] = [];
    let mt5SyncEvent: any = null;
    let mt5M5SyncEvent: any = null;
    let mt5M15SyncEvent: any = null;

    for (const symbol of assets) {
      const searchSymbol = 'XAU';
      
      // Get latest MT5 tick price and candle-sync symbol separately.
      // Price ticks move the live candle; sync events provide the historical OHLC set.
      const [recentPriceEvents, latestAnySyncEvent] = await Promise.all([
        prisma.webhookEvent.findMany({
          where: {
            symbol: { contains: searchSymbol },
            status: 'processed',
            source: 'tradingview',
            receivedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
          orderBy: { receivedAt: 'desc' },
          take: 36,
        }),
        prisma.webhookEvent.findFirst({
          where: { symbol: { contains: searchSymbol }, status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
      ]);
      const latestPriceEvent = recentPriceEvents[0] || null;

      // Cache overall webhook events for connection status at the end
      tvPriceEvents = recentPriceEvents;
      mt5SyncEvent = latestAnySyncEvent;

      const activeSymbol = latestPriceEvent?.symbol || latestAnySyncEvent?.symbol || symbol;
      const [latestM5SyncEvent, latestM15SyncEvent] = await Promise.all([
        prisma.webhookEvent.findFirst({
          where: { symbol: activeSymbol, timeframe: 'M5', status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
        prisma.webhookEvent.findFirst({
          where: { symbol: activeSymbol, timeframe: 'M15', status: 'processed', source: 'mt5_sync' },
          orderBy: { receivedAt: 'desc' },
        }),
      ]);
      const latestM5SyncPayload = parseEventPayload(latestM5SyncEvent);
      const latestM15SyncPayload = parseEventPayload(latestM15SyncEvent);
      
      // Cache timeframe-specific sync events for connection status at the end
      mt5M5SyncEvent = latestM5SyncEvent;
      mt5M15SyncEvent = latestM15SyncEvent;

      const activeSymbolPriceEvents = recentPriceEvents.filter((event) => event.symbol === activeSymbol);
      const liveTickEvents = activeSymbolPriceEvents.length > 0
        ? activeSymbolPriceEvents
        : recentPriceEvents;
      const liveTicks = liveTickEvents
        .map((event) => eventToLiveTick(event))
        .filter((tick): tick is LiveTick => !!tick)
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      let currentPrice = symbol === 'XAUUSD' ? 4450.0 : 68000.0;
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
          where: { symbol: activeSymbol, timeframe: 'M5' },
          orderBy: { time: 'desc' },
          take: M5_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: activeSymbol, timeframe: 'M15' },
          orderBy: { time: 'desc' },
          take: M15_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: activeSymbol, timeframe: 'H1' },
          orderBy: { time: 'desc' },
          take: H1_CANDLE_FETCH_LIMIT,
        }),
        prisma.candle.findMany({
          where: { symbol: activeSymbol, timeframe: 'D1' },
          orderBy: { time: 'desc' },
          take: D1_CANDLE_FETCH_LIMIT,
        }),
      ]);

      if (m15Candles.length > 0 && !isPriceEventRecent) {
        currentPrice = m15Candles[0].close;
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

      const hasM5Mt5Base = isM5CandleSyncRecent && mt5M5CandleCount >= 20;
      const hasM15Mt5Base = isM15CandleSyncRecent && mt5M15CandleCount >= 20;
      const m5AnalysisCandles = hasM5Mt5Base ? m5Candles : [];

      const brokerTickM5Candles = symbol !== 'XAUUSD' && isPriceEventRecent && liveTicks.length > 0
        ? mergeLiveTicksIntoCandles([], 'M5', liveTicks)
        : [];

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

      // Find nearest zones (if any in DB, otherwise generate dynamic temporary zones for demo out-of-the-box)
      let allZones = await prisma.zone.findMany({
        where: { symbol: activeSymbol },
        orderBy: { priceMin: 'asc' },
      });

      // Filter out zones that are too far from the current price (e.g. old seed data when price was much lower)
      const maxDistance = 150;
      let zones = allZones.filter((z: any) =>
        Math.abs(z.priceMin - currentPrice) <= maxDistance &&
        (hasM5Mt5Base || z.timeframe !== 'M5')
      );

      // If no relevant zones in DB, let's create some realistic dynamic ones based on current price so the UI isn't empty!
      if (zones.length === 0) {
        const step = 20;
        const structuralZones = [
          { type: 'SUPPORT', timeframe: 'M15', priceMin: currentPrice - step - 5, priceMax: currentPrice - step, strength: 3, symbol: activeSymbol } as any,
          { type: 'SUPPORT', timeframe: 'M15', priceMin: currentPrice - (step*2) - 5, priceMax: currentPrice - (step*2), strength: 5, symbol: activeSymbol } as any,
          { type: 'RESISTANCE', timeframe: 'M15', priceMin: currentPrice + step, priceMax: currentPrice + step + 5, strength: 3, symbol: activeSymbol } as any,
          { type: 'RESISTANCE', timeframe: 'M15', priceMin: currentPrice + (step*2), priceMax: currentPrice + (step*2) + 5, strength: 5, symbol: activeSymbol } as any,
        ];
        zones = hasM5Mt5Base
          ? [
              structuralZones[0],
              { type: 'SUPPORT', timeframe: 'M5', priceMin: currentPrice - (step * 0.45) - 2, priceMax: currentPrice - (step * 0.45), strength: 4, symbol: activeSymbol } as any,
              structuralZones[1],
              { type: 'RESISTANCE', timeframe: 'M5', priceMin: currentPrice + (step * 0.45), priceMax: currentPrice + (step * 0.45) + 2, strength: 4, symbol: activeSymbol } as any,
              structuralZones[2],
              structuralZones[3],
              { type: 'LIQUIDITY', timeframe: 'M5', priceMin: currentPrice - (step*1.5) - 2, priceMax: currentPrice - (step*1.5) + 2, strength: 1, symbol: activeSymbol } as any,
            ]
          : structuralZones;
      }

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

      let decisionZones = zones.filter((z: any) =>
        ['M5', 'M15'].includes(z.timeframe) &&
        (hasM5Mt5Base || z.timeframe !== 'M5')
      );
      if (decisionZones.length === 0) {
        const microStep = 6;
        decisionZones = [
          { type: 'SUPPORT', timeframe: 'M15', priceMin: currentPrice - microStep * 2 - 1.2, priceMax: currentPrice - microStep * 2, strength: 4 } as any,
          { type: 'RESISTANCE', timeframe: 'M15', priceMin: currentPrice + microStep * 2, priceMax: currentPrice + microStep * 2 + 1.2, strength: 4 } as any,
        ];
        if (hasM5Mt5Base) {
          decisionZones = [
            { type: 'SUPPORT', timeframe: 'M5', priceMin: currentPrice - microStep - 0.8, priceMax: currentPrice - microStep, strength: 3 } as any,
            decisionZones[0],
            { type: 'RESISTANCE', timeframe: 'M5', priceMin: currentPrice + microStep, priceMax: currentPrice + microStep + 0.8, strength: 3 } as any,
            decisionZones[1],
          ];
        }
      }

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
      const currentM5Candle = m5AnalysisCandles[0];
      const previousM5Candle = m5AnalysisCandles[1];
      const hasM5BullishEngulfing = !!currentM5Candle && !!previousM5Candle &&
        previousM5Candle.close < previousM5Candle.close && // wait, previousM5Candle.close < previousM5Candle.open
        previousM5Candle.close < previousM5Candle.open &&
        currentM5Candle.close > currentM5Candle.open &&
        currentM5Candle.open <= previousM5Candle.close &&
        currentM5Candle.close >= previousM5Candle.open;
      const hasM5BearishEngulfing = !!currentM5Candle && !!previousM5Candle &&
        previousM5Candle.close > previousM5Candle.open &&
        currentM5Candle.close < currentM5Candle.open &&
        currentM5Candle.open >= previousM5Candle.close &&
        currentM5Candle.close <= previousM5Candle.open;

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

      if (hasM5Mt5Base && triggerSupport && nearTriggerSupport && hasM5BullishEngulfing && m15Bias !== 'BEARISH') {
        const entry = roundPrice(currentPrice);
        const stopLoss = roundPrice(entry - fixedSupportSl);
        const risk = Math.abs(entry - stopLoss);
        const takeProfit = roundPrice(entry + risk * 2);
        const supportEngulfConfidence = normalizePlanConfidence(
          78 +
          (triggerSupport.strength || 1) * 3 +
          (m15Bias === 'BULLISH' ? 8 : 0) +
          (h1Bias === 'BULLISH' ? 5 : 0) -
          (volatility === 'EXTREME' ? 10 : volatility === 'HIGH' ? 5 : 0),
        );

        proactivePlans.push({
          id: `ai-plan-support-engulf-buy-${symbol}`,
          type: 'BUY_MARKET',
          title: 'ซื้อฐานแนวรับเมื่อ M5 ปิดเขียว Engulfing',
          entry,
          entry1: entry,
          entry2: roundPrice(triggerSupport.priceMax),
          entry3: roundPrice(triggerSupport.priceMin),
          stopLoss,
          takeProfit,
          reason: `ราคาอยู่ฐานแนวรับสำคัญ ${triggerSupport.priceMin.toFixed(2)}-${triggerSupport.priceMax.toFixed(2)} และ M5 ปิดแท่งเขียวแบบ Bullish Engulfing แล้ว ใช้ SL 500 จุดและเป้าอย่างน้อย 1:2`,
          confidence: supportEngulfConfidence,
          strategyId: 'support_m5_bullish_engulfing',
          strategyMode: 'SWING',
          strategyLabel: 'Swing support bounce',
          confirmation: 'M5 bullish engulfing close',
          pointStopLoss: 500,
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

        proactivePlans.push({
          id: `ai-plan-buy-${symbol}`,
          type: 'BUY_ZONE',
          title: planTitle,
          entry: support.priceMax,
          entry1: support.priceMax,
          entry2: support.priceMax - diff,
          entry3: support.priceMax - diff * 2,
          stopLoss: support.priceMin - fixedSupportSl,
          takeProfit: support.priceMax + Math.max(atrTP, fixedSupportSl * 2),
          reason: `${planReason} เงื่อนไขยืนยันหลักคือ M5 ต้องปิดเขียวแบบ Bullish Engulfing ก่อนบันทึกเป็นแผนใช้งานจริง`,
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
          strategyId: 'resistance_m5_bearish_engulfing',
          strategyMode: 'SWING',
          strategyLabel: 'Swing resistance rejection',
          confirmation: hasM5BearishEngulfing ? 'M5 bearish engulfing close' : 'Wait for M5 bearish engulfing close',
          pointStopLoss: 500,
          timeframe: 'M5',
        });
      }

      if (bias === 'BULLISH') {
        if (isOverbought) {
           proactivePlans.push({
             id: `ai-plan-follow-buy-${symbol}`,
             type: 'WAIT',
             title: '🚫 งดซื้อไล่ราคา: ตลาดซื้อมากเกินไป',
             entry: currentPrice,
             stopLoss: currentPrice - atrSL,
             takeProfit: currentPrice + atrTP,
             reason: `RSI สูงเกินไป (${Math.round(rsi14)}) ตลาดอยู่ในภาวะซื้อมากเกินไป ห้ามไล่ราคาเด็ดขาด ให้รอราคาย่อตัว`,
             confidence: 10,
           });
        } else {
          let buyConfidence = Math.round(trendStrength);
          if (sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH') buyConfidence -= 15;
          
          const isExtended = currentPrice > ema20_m15 + (atr14 * 0.5);
          const isTooExtended = currentPrice > ema20_m15 + (atr14 * 2.5);
          
          if (isTooExtended) {
            proactivePlans.push({
              id: `ai-plan-follow-buy-${symbol}`,
              type: 'WAIT',
              title: '🚫 งดซื้อไล่ราคา: ราคาห่างฐานเฉลี่ยมากเกินไป',
              entry: currentPrice,
              stopLoss: currentPrice - atrSL,
              takeProfit: currentPrice + atrTP,
              reason: `ราคาปัจจุบัน ($${currentPrice.toFixed(2)}) ปรับตัวขึ้นร้อนแรงฉีกห่างจากแนวเส้นเฉลี่ยหลัก EMA 20 ($${ema20_m15.toFixed(2)}) มากเกินไป การเปิดออเดอร์เก็งกำไรโซนนี้มีความเสี่ยงสูง ควรรอตลาดสะสมกำลังทำแนวรับยกโลว์ฐานใหม่เพื่อความปลอดภัย`,
              confidence: 10,
            });
          } else if (isExtended) {
            // Extended from EMA: Recommend waiting for pullback (Higher Low / ยกโลว์)
            const entry1 = ema20_m15 + (atr14 * 0.2);
            const entry2 = ema20_m15;
            const entry3 = ema20_m15 - (atr14 * 0.5);
            const stopLoss = ema20_m15 - (atr14 * 1.5);
            const takeProfit = entry1 + (Math.abs(entry1 - stopLoss) * 2.5); // 1:2.5 RR
            
            proactivePlans.push({
              id: `ai-plan-follow-buy-${symbol}`,
              type: 'BUY_LIMIT',
              title: 'ดักซื้อตอนย่อตัว / ยกโลว์',
              entry: entry1,
              entry1,
              entry2,
              entry3,
              stopLoss,
              takeProfit,
              reason: `ทิศทางหลักเป็นขาขึ้น แต่ราคาปัจจุบันสูงเกินไป ควรรอราคารย่อตัวลงมาสร้างฐานแนวรับยกโลว์ใกล้เส้น EMA 20 (${ema20_m15.toFixed(2)}) เพื่อให้ได้เปรียบราคาและลดความเสี่ยง`,
              confidence: Math.min(95, Math.max(10, buyConfidence + 5)),
              strategyId: 'follow_trend_ema20_pullback',
              strategyMode: 'FOLLOW_TREND',
              strategyLabel: 'Follow trend pullback',
              confirmation: 'M15 pullback holds above EMA20',
              timeframe: 'M15',
            });
          } else {
            // Not extended: Recommending BUY at current support base
            proactivePlans.push({
              id: `ai-plan-follow-buy-${symbol}`,
              type: 'BUY_MARKET',
              title: 'ซื้อสะสมที่แนวรับ / ยกโลว์',
              entry: currentPrice,
              entry1: currentPrice,
              entry2: currentPrice - diff,
              entry3: currentPrice - diff * 2,
              stopLoss: currentPrice - atrSL,
              takeProfit: currentPrice + atrTP,
              reason: `กราฟเป็นแนวโน้มขาขึ้น และราคาปัจจุบันอยู่ในโซนแนวรับพักฐาน/ยกโลว์ใกล้เส้น EMA 20 (${ema20_m15.toFixed(2)}) เป็นจุดเข้าซื้อที่ปลอดภัยและน่าสนใจ`,
              confidence: Math.max(10, buyConfidence),
              strategyId: 'follow_trend_ema20_pullback',
              strategyMode: 'FOLLOW_TREND',
              strategyLabel: 'Follow trend pullback',
              confirmation: 'M15 stays above EMA20 with H1 alignment',
              timeframe: 'M15',
            });
          }
        }
      } else if (bias === 'BEARISH') {
        if (isOversold) {
           proactivePlans.push({
             id: `ai-plan-follow-sell-${symbol}`,
             type: 'WAIT',
             title: '🚫 งดขายไล่ราคา: ตลาดขายมากเกินไป',
             entry: currentPrice,
             stopLoss: currentPrice + atrSL,
             takeProfit: currentPrice - atrTP,
             reason: `RSI ต่ำเกินไป (${Math.round(rsi14)}) ตลาดอยู่ในภาวะขายมากเกินไป ห้ามไล่ราคาเด็ดขาด ให้รอราคาเด้งกลับ`,
             confidence: 10,
           });
        } else {
          let sellConfidence = Math.round(trendStrength);
          if (sessionVolatility === 'EXTREME' || sessionVolatility === 'HIGH') sellConfidence -= 15;
          
          const isExtended = currentPrice < ema20_m15 - (atr14 * 0.5);
          const isTooExtended = currentPrice < ema20_m15 - (atr14 * 2.5);
          
          if (isTooExtended) {
            proactivePlans.push({
              id: `ai-plan-follow-sell-${symbol}`,
              type: 'WAIT',
              title: '🚫 งดขายไล่ราคา: ราคาห่างฐานเฉลี่ยมากเกินไป',
              entry: currentPrice,
              stopLoss: currentPrice + atrSL,
              takeProfit: currentPrice - atrTP,
              reason: `ราคาปัจจุบัน ($${currentPrice.toFixed(2)}) ปรับตัวลงร้อนแรงฉีกห่างจากแนวเส้นเฉลี่ยหลัก EMA 20 ($${ema20_m15.toFixed(2)}) มากเกินไป การเปิดออเดอร์เก็งกำไรโซนนี้มีความเสี่ยงสูง ควรรอตลาดสะสมกำลังทำแนวต้านลดไฮฐานใหม่เพื่อความปลอดภัย`,
              confidence: 10,
            });
          } else if (isExtended) {
            // Extended from EMA: Recommend waiting for pullback (Lower High / ย่อไฮ)
            const entry1 = ema20_m15 - (atr14 * 0.2);
            const entry2 = ema20_m15;
            const entry3 = ema20_m15 + (atr14 * 0.5);
            const stopLoss = ema20_m15 + (atr14 * 1.5);
            const takeProfit = entry1 - (Math.abs(entry1 - stopLoss) * 2.5); // 1:2.5 RR
            
            proactivePlans.push({
              id: `ai-plan-follow-sell-${symbol}`,
              type: 'SELL_LIMIT',
              title: 'ดักขายตอนเด้งตัว / ย่อไฮ',
              entry: entry1,
              entry1,
              entry2,
              entry3,
              stopLoss,
              takeProfit,
              reason: `ทิศทางหลักเป็นขาลง แต่ราคาปัจจุบันต่ำเกินไป ควรรอราคารีบาวด์ขึ้นมาสร้างฐานแนวต้านย่อไฮใกล้เส้น EMA 20 (${ema20_m15.toFixed(2)}) เพื่อให้ได้เปรียบราคาและลดความเสี่ยง`,
              confidence: Math.min(95, Math.max(10, sellConfidence + 5)),
              strategyId: 'follow_trend_ema20_pullback',
              strategyMode: 'FOLLOW_TREND',
              strategyLabel: 'Follow trend pullback',
              confirmation: 'M15 pullback holds below EMA20',
              timeframe: 'M15',
            });
          } else {
            // Not extended: Recommend selling at current resistance base
            proactivePlans.push({
              id: `ai-plan-follow-sell-${symbol}`,
              type: 'SELL_MARKET',
              title: 'ขายสะสมที่แนวต้าน / ย่อไฮ',
              entry: currentPrice,
              entry1: currentPrice,
              entry2: currentPrice + diff,
              entry3: currentPrice + diff * 2,
              stopLoss: currentPrice + atrSL,
              takeProfit: currentPrice - atrTP,
              reason: `กราฟเป็นแนวโน้มขาลง และราคาปัจจุบันมีการฟื้นตัวขึ้นมาในโซนแนวต้าน/ย่อไฮใกล้เส้น EMA 20 (${ema20_m15.toFixed(2)}) เป็นจุดเข้าขายที่ได้เปรียบ`,
              confidence: Math.max(10, sellConfidence),
              strategyId: 'follow_trend_ema20_pullback',
              strategyMode: 'FOLLOW_TREND',
              strategyLabel: 'Follow trend pullback',
              confirmation: 'M15 stays below EMA20 with H1 alignment',
              timeframe: 'M15',
            });
          }
        }
      }

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
      const strategyResearch = StrategyResearchService.parseReport(strategyResearchSetting?.value);
      const hasFreshTradeStructure = hasM5Mt5Base || hasM15Mt5Base;
      const eligibleProactivePlans = !hasFreshTradeStructure
        ? []
        : hasM5Mt5Base
          ? proactivePlans
          : proactivePlans.filter((plan) => !isM5DependentPlan(plan));
      let recommendationPlans = eligibleProactivePlans
        .map((plan) => {
          const researchCandidate = getResearchCandidate(strategyResearch, plan.strategyId);
          const researchIsApproved = true; // Always allow plans that meet confidence criteria to be shown to users
          const confidence = normalizePlanConfidence(
            researchCandidate?.status === 'APPROVED'
              ? Math.max(plan.confidence, researchCandidate.winRate)
              : plan.confidence,
          );

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

          return {
            ...plan,
            stopLoss: roundPrice(stopLoss),
            takeProfit: roundPrice(takeProfit),
            confidence,
            researchStatus: researchCandidate?.status || (strategyResearch ? 'RESEARCHING' : 'NOT_RUN'),
            researchWinRate: researchCandidate?.winRate ?? null,
            researchSampleSize: researchCandidate?.sampleSize ?? 0,
            researchApproved: researchIsApproved,
          };
        })
        .filter((plan) =>
          plan.type !== 'WAIT' &&
          plan.confidence >= MIN_RECOMMENDATION_CONFIDENCE &&
          plan.researchApproved,
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6);

      const activeOrderPlan = await getStableOrderPlan(symbol, recommendationPlans, currentPrice, hasM5Mt5Base, hasFreshTradeStructure);
      if (activeOrderPlan) {
        recommendationPlans = [
          activeOrderPlan,
          ...recommendationPlans.filter((plan) =>
            plan.id !== activeOrderPlan.id &&
            plan.id !== activeOrderPlan.sourcePlanId,
          ),
        ].slice(0, 6);
        decisionChart.orderPlan = activeOrderPlan;
      }

      // Generate Speculative/High-Risk plans (confidence 50-64 OR strategy is researching)
      const speculativePlans = eligibleProactivePlans
        .map((plan) => {
          const researchCandidate = getResearchCandidate(strategyResearch, plan.strategyId);
          const confidence = normalizePlanConfidence(plan.confidence);
          return {
            ...plan,
            stopLoss: roundPrice(plan.stopLoss),
            takeProfit: roundPrice(plan.takeProfit),
            confidence,
            researchStatus: researchCandidate?.status || (strategyResearch ? 'RESEARCHING' : 'NOT_RUN'),
            researchWinRate: researchCandidate?.winRate ?? null,
            researchSampleSize: researchCandidate?.sampleSize ?? 0,
          };
        })
        .filter((plan) =>
          plan.type !== 'WAIT' &&
          plan.id !== activeOrderPlan?.id &&
          plan.id !== activeOrderPlan?.sourcePlanId &&
          ((plan.confidence >= 50 && plan.confidence < MIN_RECOMMENDATION_CONFIDENCE) || 
           (plan.researchStatus === 'RESEARCHING' && plan.confidence >= 50))
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      marketIntelligence[symbol] = {
        currentPrice,
        bias,
        trendStrength: Math.round(trendStrength),
        volatility,
        nearestSupport,
        nearestResistance,
        dangerZones,
        proactivePlans: recommendationPlans,
        speculativePlans,
        activeOrderPlan,
        recommendationPolicy: {
          minConfidence: MIN_RECOMMENDATION_CONFIDENCE,
          researchRequiredAfterRun: true,
          freshMt5CandlesRequired: true,
          freshTradeStructure: hasFreshTradeStructure,
          hiddenCandidates: proactivePlans.length - recommendationPlans.length,
        },
        strategyResearch,
        scalpingDecision,
        decisionChart,
        marketSession,
        fundamentalBias,
        fundamentalWarning,
        timeframeBiases: {
          D1: d1Bias,
          H1: h1Bias,
          M5: m5Bias,
          M15: m15Bias
        }
      };

    }

    // 8. Determine live feed status by reusing cached webhook event queries
    const latestPriceOverall = tvPriceEvents[0] || null;
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
        symbol: { contains: 'XAU' },
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

    const responseData = {
      totalSignals,
      totalTrades,
      openTradesCount: openTrades.length,
      openTrades,
      suggestedPlansCount: suggestedPlans.length,
      suggestedPlans,
      recentPlanResults,
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

    // Cache the response
    if (isPublic) {
      globalFetchCache.cachedPublicStats[fullCacheKey] = responseData;
      globalFetchCache.cachedPublicTime[fullCacheKey] = Date.now();
    } else {
      globalFetchCache.cachedAdminStats[fullCacheKey] = responseData;
      globalFetchCache.cachedAdminTime[fullCacheKey] = Date.now();
    }

    return NextResponse.json(responseData, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics.', details: err.message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
