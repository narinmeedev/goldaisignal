'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Layers, 
  Activity, 
  Zap, 
  RefreshCw,
  Brain,
  Crosshair,
  ShieldAlert,
  Terminal,
  Save,
  FlaskConical,
  PlayCircle,
  CheckCircle2,
  SlidersHorizontal,
  Users,
  DollarSign,
  Clock3,
  Target,
  BarChart3,
  Send,
  Clock,
  Flame
} from 'lucide-react';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';
import UserDashboard from './UserDashboard';

interface Trade {
  id: string;
  signalId?: string;
  signal?: Signal;
  symbol: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  result: string;
  rrResult: number;
  openedAt: string;
  exitPrice?: number | null;
  closedAt?: string | null;
  notes?: string | null;
}

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number;
  status: string;
  fakeoutScore: number;
  reason: string;
  createdAt: string;
}

interface Zone {
  id?: string;
  symbol?: string;
  timeframe: string;
  type: string;
  priceMin: number;
  priceMax: number;
  strength: number;
}

interface ProactivePlan {
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
  direction?: 'BUY' | 'SELL';
  locked?: boolean;
  lockedAt?: string;
  lockedUntil?: string;
  createdAt?: string;
  sourcePlanId?: string;
  distanceToEntry?: number;
  currentPriceAtLock?: number;
  updateReason?: string;
}

interface StrategyResearchCandidate {
  id: string;
  label: string;
  mode: 'SCALP' | 'SWING' | 'FOLLOW_TREND';
  status: 'APPROVED' | 'RESEARCHING';
  winRate: number;
  sampleSize: number;
  wins: number;
  losses: number;
  netR: number;
  liveForwardTest?: {
    winRate: number;
    sampleSize: number;
    wins: number;
    losses: number;
    breakEven: number;
    netR: number;
  };
}

interface StrategyResearchReport {
  symbol: string;
  generatedAt: string;
  targetWinRate: number;
  approvedStrategies: string[];
  candidates: StrategyResearchCandidate[];
}

interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LiveTickPoint {
  time: string;
  receivedAt: string;
  price: number;
}

interface ChartFreshness {
  activeSymbol?: string;
  priceFeedLive?: boolean;
  candleSyncLive?: boolean;
  m5CandleSyncLive?: boolean;
  m15CandleSyncLive?: boolean;
  tickAgeMs?: number | null;
  candleAgeMs?: number | null;
  m5CandleSyncAgeMs?: number | null;
  m15CandleSyncAgeMs?: number | null;
  latestTickAt?: string | null;
  latestCandleSyncAt?: string | null;
  latestM5CandleSyncAt?: string | null;
  latestM15CandleSyncAt?: string | null;
  priceSource?: string;
  brokerTickChart?: boolean;
  chartCandleCount?: number;
  chartCandlesStale?: boolean;
  mt5M5CandleCount?: number;
  mt5M15CandleCount?: number;
  missingM5Candles?: boolean;
  syncCandleCount?: number | null;
  syncOldestCandleAt?: string | null;
  syncLatestCandleAt?: string | null;
  m5SyncCandleCount?: number | null;
  m5SyncOldestCandleAt?: string | null;
  m5SyncLatestCandleAt?: string | null;
}

interface ChartOrderPlan extends ProactivePlan {
  direction: 'BUY' | 'SELL';
}

interface ChartEntry {
  direction: 'BUY' | 'SELL' | 'WAIT';
  priceMin: number;
  priceMax: number;
  recommendedEntry: number;
  stopLoss: number;
  takeProfit: number;
}

interface DecisionChart {
  timeframe: string;
  candles: CandlePoint[];
  zones: Zone[];
  currentPrice: number;
  entry: ChartEntry;
  updatedAt?: string;
  latestCandleTime?: string;
  isLive?: boolean;
  liveTicks?: LiveTickPoint[];
  freshness?: ChartFreshness;
  orderPlan?: ChartOrderPlan | null;
}

interface ScalpingDecision {
  direction: 'BUY' | 'SELL' | 'WAIT';
  title: string;
  timeframe: string;
  entryMin: number;
  entryMax: number;
  recommendedEntry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reason: string;
  triggerSupport?: Zone | null;
  triggerResistance?: Zone | null;
  structureSupport?: Zone | null;
  structureResistance?: Zone | null;
  metrics?: {
    m5Bias: string;
    m15Bias: string;
    atrM5: number;
    rsiM5: number;
  };
}

interface MarketIntelligence {
  currentPrice: number;
  bias: string;
  trendStrength: number;
  volatility: string;
  nearestSupport: Zone[];
  nearestResistance: Zone[];
  dangerZones: Zone[];
  proactivePlans: ProactivePlan[];
  speculativePlans?: ProactivePlan[];
  activeOrderPlan?: ProactivePlan | null;
  recommendationPolicy?: {
    minConfidence: number;
    researchRequiredAfterRun: boolean;
    hiddenCandidates: number;
  };
  strategyResearch?: StrategyResearchReport | null;
  scalpingDecision?: ScalpingDecision;
  decisionChart?: DecisionChart;
  fundamentalBias?: string;
  fundamentalWarning?: string;
  timeframeBiases?: {
    D1: string;
    H1: string;
    M5?: string;
    M15: string;
  };
}

interface OwnerSignalSummary {
  id: string;
  signalRef: string;
  symbol: string;
  timeframe: string;
  direction: string;
  status: string;
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number | null;
  createdAt: string;
  reason: string;
}

interface OwnerTradeSummary {
  id: string;
  signalId?: string | null;
  signalRef: string;
  symbol: string;
  direction: string;
  result: string;
  entry: number;
  exitPrice?: number | null;
  stopLoss: number;
  takeProfit1: number;
  rrResult: number;
  confidence?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
}

type Mt5RealtimeState = 'LIVE' | 'PRICE_ONLY' | 'CANDLE_ONLY' | 'OFFLINE';

interface Mt5RealtimeStatus {
  state: Mt5RealtimeState;
  label: string;
  message: string;
  checkedAt: string;
  priceFeed: {
    live: boolean;
    ageMs?: number | null;
    symbol?: string | null;
    timeframe?: string | null;
    receivedAt?: string | null;
    price?: number | null;
  };
  m5CandleSync: {
    live: boolean;
    ageMs?: number | null;
    symbol?: string | null;
    timeframe?: string | null;
    receivedAt?: string | null;
    count?: number | null;
    oldestCandleAt?: string | null;
    latestCandleAt?: string | null;
  };
  m15CandleSync?: {
    live: boolean;
    ageMs?: number | null;
    symbol?: string | null;
    timeframe?: string | null;
    receivedAt?: string | null;
    count?: number | null;
    oldestCandleAt?: string | null;
    latestCandleAt?: string | null;
  };
}

interface OwnerMetrics {
  today: {
    timezone: string;
    startedAt: string;
    totalSignals: number;
    buySignals: number;
    sellSignals: number;
    waitSignals: number;
    latestSignals: OwnerSignalSummary[];
  };
  performance: {
    sampleSize: number;
    decidedSampleSize: number;
    wins: number;
    losses: number;
    breakEven: number;
    winRate: number;
    averageRR: number;
    averagePoints?: number;
    latestTargetHits: OwnerTradeSummary[];
    latestStopLosses: OwnerTradeSummary[];
  };
  subscription: {
    activeMembers: number;
    cancelledMembers: number;
    cancelledPayments: number;
    revenueTotal: number;
    revenueThisMonth: number;
    revenueToday: number;
    approvedPayments: number;
    approvedPaymentsThisMonth: number;
    approvedPaymentsToday: number;
  };
  freshness: {
    latestSignalSentAt?: string | null;
    latestSignalDirection?: string | null;
    latestSignalConfidence?: number | null;
    aiAnalyzedAt?: string | null;
    sourceDataAt?: string | null;
    latestPriceAt?: string | null;
    latestCandleSyncAt?: string | null;
    latestResearchAt?: string | null;
    mt5RealtimeStatus?: Mt5RealtimeStatus;
  };
}

interface Stats {
  totalSignals: number;
  totalTrades: number;
  openTradesCount: number;
  openTrades: Trade[];
  suggestedPlansCount: number;
  suggestedPlans: Trade[];
  recentPlanResults: Trade[];
  latestSignals: Signal[];
  winRate: number;
  netR: number;
  bestSetup: string;
  worstSetup: string;
  zoneCount: number;
  winCount: number;
  lossCount: number;
  ownerMetrics?: OwnerMetrics;
  marketIntelligence: Record<string, MarketIntelligence>;
  mt5Connection?: {
    isLive: boolean;
    lastSyncAt: string | null;
    priceFeedLive?: boolean;
    candleSyncLive?: boolean;
    m5CandleSyncLive?: boolean;
    m15CandleSyncLive?: boolean;
    lastPriceAt?: string | null;
    lastCandleSyncAt?: string | null;
    lastM5CandleSyncAt?: string | null;
    lastM15CandleSyncAt?: string | null;
    priceFeedAgeMs?: number | null;
    candleSyncAgeMs?: number | null;
    m5CandleSyncAgeMs?: number | null;
    m15CandleSyncAgeMs?: number | null;
    lastPrice?: number | null;
    latestCandleCount?: number | null;
    latestM5CandleCount?: number | null;
    latestM15CandleCount?: number | null;
    realtimeStatus?: Mt5RealtimeStatus;
    recentEvents?: {
      id: string;
      source: string;
      symbol: string;
      timeframe: string;
      receivedAt: string;
      status: string;
      errorMessage: string | null;
      payload: any;
    }[];
  };
}

const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0.00';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatAge = (ageMs?: number | null) => {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs < 0) return '-';
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds} วิ`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} นาที`;
  return `${Math.round(minutes / 60)} ชม.`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'ยังไม่มีข้อมูล';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'ยังไม่มีข้อมูล';
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatBaht = (value?: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(typeof value === 'number' && Number.isFinite(value) ? value : 0);

const formatRiskResultLabel = (trade?: any) => {
  if (!trade) return 'ยังไม่มีผล';
  const entry = Number(trade.entry);
  const exitPrice = Number(trade.exitPrice);
  const direction = String(trade.direction).toUpperCase();
  
  if (!Number.isFinite(entry) || !Number.isFinite(exitPrice) || exitPrice <= 0) {
    if (trade.result === 'WIN') return 'ชนะ';
    if (trade.result === 'LOSS') return 'แพ้';
    return 'เสมอ';
  }
  
  const isBuy = direction === 'BUY';
  const diff = isBuy ? (exitPrice - entry) : (entry - exitPrice);
  const points = Math.round(diff * 100);
  const absPoints = Math.abs(points);
  
  if (points > 0) return `ชนะ ได้กำไร ${absPoints.toLocaleString()} จุด`;
  if (points < 0) return `แพ้ ขาดทุน ${absPoints.toLocaleString()} จุด`;
  return 'เสมอ (0 จุด)';
};

const formatAverageRiskLabel = (points?: number) => {
  if (typeof points !== 'number' || !Number.isFinite(points)) return 'ยังไม่มีผลเฉลี่ย';
  const absPoints = Math.abs(points);
  if (points > 0) return `เฉลี่ยชนะ ${absPoints.toLocaleString()} จุด`;
  if (points < 0) return `เฉลี่ยขาดทุน ${absPoints.toLocaleString()} จุด`;
  return 'เฉลี่ยเสมอ';
};

const getDecisionLabel = (direction: ChartEntry['direction']) => {
  if (direction === 'BUY') return 'จังหวะซื้อสั้น';
  if (direction === 'SELL') return 'จังหวะขายสั้น';
  return 'รอจังหวะ';
};

const getTrendLabel = (trend?: string) => {
  if (trend === 'BULLISH') return 'ขาขึ้น';
  if (trend === 'BEARISH') return 'ขาลง';
  if (trend === 'WAIT_AND_SEE') return 'รอดูจังหวะ';
  return 'เป็นกลาง';
};

const getZoneTypeLabel = (type?: string) => {
  if (type === 'SUPPORT') return 'แนวรับ';
  if (type === 'RESISTANCE') return 'แนวต้าน';
  if (type === 'LIQUIDITY') return 'โซนสภาพคล่อง';
  return 'โซนราคา';
};

const getPlanTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    BUY_ZONE: 'แผนดักซื้อ',
    SELL_ZONE: 'แผนดักขาย',
    BUY_LIMIT: 'รอซื้อที่แนวรับ',
    SELL_LIMIT: 'รอขายที่แนวต้าน',
    BUY_MARKET: 'ซื้อทันทีเมื่อยืนยัน',
    SELL_MARKET: 'ขายทันทีเมื่อยืนยัน',
    WAIT: 'รอจังหวะ',
  };

  return labels[type] || type;
};

const getPlanDirection = (plan?: { type?: string; direction?: string } | null): 'BUY' | 'SELL' | null => {
  if (!plan) return null;
  if (plan.direction === 'BUY' || plan.direction === 'SELL') return plan.direction;
  if (plan.type?.includes('BUY')) return 'BUY';
  if (plan.type?.includes('SELL')) return 'SELL';
  return null;
};

const getChartSourceLabel = (source?: string, brokerTickChart?: boolean, candleSyncLive?: boolean) => {
  if (source === 'MT5_SYNC_PLUS_TICK') return 'MT5 sync + tick ล่าสุด';
  if (source === 'MT5_TICK' || brokerTickChart) return 'MT5 tick ชั่วคราว';
  if (source === 'MT5_CANDLE_SYNC' || candleSyncLive) return 'MT5 candle sync';
  return 'ฐานข้อมูลแท่งเทียน';
};

const getDirectionLabel = (direction?: string) => {
  if (direction === 'BUY') return 'ซื้อ';
  if (direction === 'SELL') return 'ขาย';
  if (direction === 'NO_TRADE') return 'งดเทรด';
  return 'รอสัญญาณ';
};

const getTradeResultLabel = (result?: string) => {
  if (result === 'PLAN') return 'รอเริ่มทดสอบ';
  if (result === 'TESTING') return 'กำลังทดสอบ TP/SL';
  if (result === 'OPEN') return 'ใช้จริงอยู่';
  if (result === 'WIN') return 'ชนะ TP';
  if (result === 'LOSS') return 'แพ้ SL';
  if (result === 'BE') return 'เสมอ';
  return result || 'รอผล';
};

const getTradeResultClass = (result?: string) => {
  if (result === 'WIN') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (result === 'LOSS') return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  if (result === 'TESTING') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (result === 'OPEN') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
  return 'bg-neutral-900 text-neutral-400 border-neutral-700';
};

const mt5RealtimeTone: Record<Mt5RealtimeState, {
  panel: string;
  badge: string;
  dot: string;
  text: string;
}> = {
  LIVE: {
    panel: 'border-emerald-500/20 bg-emerald-500/5',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    text: 'text-emerald-200',
  },
  PRICE_ONLY: {
    panel: 'border-amber-500/20 bg-amber-500/5',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    text: 'text-amber-200',
  },
  CANDLE_ONLY: {
    panel: 'border-cyan-500/20 bg-cyan-500/5',
    badge: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
    text: 'text-cyan-200',
  },
  OFFLINE: {
    panel: 'border-rose-500/20 bg-rose-500/5',
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-400',
    text: 'text-rose-200',
  },
};

function OwnerDashboardSummary({
  stats,
  userRole,
  isResettingStats,
  onResetStats,
}: {
  stats: Stats | null;
  userRole: string;
  isResettingStats: boolean;
  onResetStats: () => void;
}) {
  const owner = stats?.ownerMetrics;
  const latestHit = owner?.performance.latestTargetHits?.[0];
  const latestStop = owner?.performance.latestStopLosses?.[0];
  const latestSignals = owner?.today.latestSignals || [];
  const mt5Connection = stats?.mt5Connection;
  const mt5Realtime = mt5Connection?.realtimeStatus || owner?.freshness.mt5RealtimeStatus;
  const mt5State: Mt5RealtimeState = mt5Realtime?.state || (
    mt5Connection?.priceFeedLive && mt5Connection?.m5CandleSyncLive
      ? 'LIVE'
      : mt5Connection?.priceFeedLive
        ? 'PRICE_ONLY'
        : mt5Connection?.m5CandleSyncLive
          ? 'CANDLE_ONLY'
          : 'OFFLINE'
  );
  const mt5Tone = mt5RealtimeTone[mt5State];
  const mt5PriceFeed = {
    live: mt5Realtime?.priceFeed?.live ?? !!mt5Connection?.priceFeedLive,
    ageMs: mt5Realtime?.priceFeed?.ageMs ?? mt5Connection?.priceFeedAgeMs ?? null,
    receivedAt: mt5Realtime?.priceFeed?.receivedAt ?? mt5Connection?.lastPriceAt ?? null,
    price: mt5Realtime?.priceFeed?.price ?? mt5Connection?.lastPrice ?? null,
  };
  const mt5M5Sync = {
    live: mt5Realtime?.m5CandleSync?.live ?? !!mt5Connection?.m5CandleSyncLive,
    ageMs: mt5Realtime?.m5CandleSync?.ageMs ?? mt5Connection?.m5CandleSyncAgeMs ?? null,
    receivedAt: mt5Realtime?.m5CandleSync?.receivedAt ?? mt5Connection?.lastM5CandleSyncAt ?? null,
    count: mt5Realtime?.m5CandleSync?.count ?? mt5Connection?.latestM5CandleCount ?? null,
    latestCandleAt: mt5Realtime?.m5CandleSync?.latestCandleAt ?? null,
  };
  const mt5M15Sync = {
    live: mt5Realtime?.m15CandleSync?.live ?? !!mt5Connection?.m15CandleSyncLive,
    ageMs: mt5Realtime?.m15CandleSync?.ageMs ?? mt5Connection?.m15CandleSyncAgeMs ?? null,
    receivedAt: mt5Realtime?.m15CandleSync?.receivedAt ?? mt5Connection?.lastM15CandleSyncAt ?? null,
    count: mt5Realtime?.m15CandleSync?.count ?? mt5Connection?.latestM15CandleCount ?? null,
  };
  const mt5Label = mt5Realtime?.label || (
    mt5State === 'LIVE'
      ? 'รับค่าปกติ'
      : mt5State === 'PRICE_ONLY'
        ? 'รับราคาอยู่ / M5 ยังไม่สด'
        : mt5State === 'CANDLE_ONLY'
          ? 'รับแท่ง M5 อยู่ / รอราคาสด'
          : 'ยังไม่รับค่าล่าสุด'
  );
  const mt5Message = mt5Realtime?.message || 'กำลังตรวจสถานะจาก webhook ล่าสุดของ MT5';

  const summaryCards = [
    {
      title: 'Signal วันนี้',
      value: `${owner?.today.totalSignals ?? 0}`,
      icon: Send,
      accent: 'text-cyan-300 border-cyan-500/15 bg-cyan-500/5',
      detail: (
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
          <span className="rounded border border-emerald-500/15 bg-emerald-500/10 px-2 py-1 text-emerald-300">BUY {owner?.today.buySignals ?? 0}</span>
          <span className="rounded border border-rose-500/15 bg-rose-500/10 px-2 py-1 text-rose-300">SELL {owner?.today.sellSignals ?? 0}</span>
          <span className="rounded border border-amber-500/15 bg-amber-500/10 px-2 py-1 text-amber-300">WAIT {owner?.today.waitSignals ?? 0}</span>
        </div>
      ),
    },
    {
      title: 'Win rate ล่าสุด',
      value: `${owner?.performance.winRate ?? 0}%`,
      icon: BarChart3,
      accent: 'text-emerald-300 border-emerald-500/15 bg-emerald-500/5',
      detail: (
        <div className="space-y-1 text-[10px] font-mono text-neutral-400">
          <div><strong className="text-neutral-100">{formatAverageRiskLabel(owner?.performance.averagePoints)}</strong></div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded border border-emerald-500/15 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">ชนะ {owner?.performance.wins ?? 0}</span>
            <span className="rounded border border-rose-500/15 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">แพ้ {owner?.performance.losses ?? 0}</span>
            <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-neutral-400">เสมอ {owner?.performance.breakEven ?? 0}</span>
          </div>
        </div>
      ),
    },
    ...(userRole === 'admin' ? [{
      title: 'สมาชิก / รายได้',
      value: `${owner?.subscription.activeMembers ?? 0} active`,
      icon: Users,
      accent: 'text-amber-300 border-amber-500/15 bg-amber-500/5',
      detail: (
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <span className="rounded border border-white/5 bg-black/20 px-2 py-1 text-neutral-300">เดือนนี้ {formatBaht(owner?.subscription.revenueThisMonth)}</span>
          <span className="rounded border border-rose-500/15 bg-rose-500/10 px-2 py-1 text-rose-300">ยกเลิก {owner?.subscription.cancelledMembers ?? 0}</span>
        </div>
      ),
    }] : []),
    {
      title: 'ความสดข้อมูล',
      value: formatTime(owner?.freshness.latestSignalSentAt),
      icon: Clock3,
      accent: 'text-indigo-300 border-indigo-500/15 bg-indigo-500/5',
      detail: (
        <div className="space-y-1 text-[10px] font-mono text-neutral-400">
          <div className="flex justify-between gap-2"><span>AI วิเคราะห์</span><strong className="text-neutral-100">{formatTime(owner?.freshness.aiAnalyzedAt)}</strong></div>
          <div className="flex justify-between gap-2"><span>ข้อมูลรอบล่าสุด</span><strong className="text-neutral-100">{formatTime(owner?.freshness.sourceDataAt)}</strong></div>
        </div>
      ),
    },
  ];

  const outcomeTile = (
    title: string,
    trade: OwnerTradeSummary | undefined,
    tone: 'win' | 'loss',
  ) => (
    <div className={`rounded-lg border p-3 ${
      tone === 'win'
        ? 'border-emerald-500/15 bg-emerald-500/5'
        : 'border-rose-500/15 bg-rose-500/5'
    }`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${tone === 'win' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {title}
        </span>
        <span className="font-mono text-[9px] text-neutral-500">{trade ? `#${trade.signalRef}` : '-'}</span>
      </div>
      {trade ? (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
            <span className={`rounded border px-1.5 py-0.5 ${
              trade.direction === 'BUY' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}>
              {getDirectionLabel(trade.direction)}
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${getTradeResultClass(trade.result)}`}>
              {getTradeResultLabel(trade.result)}
            </span>
            {typeof trade.confidence === 'number' && (
              <span className="rounded border border-indigo-500/15 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300">
                {trade.confidence}%
              </span>
            )}
          </div>
          <div className={`rounded-md border px-2 py-1.5 text-xs font-semibold leading-relaxed ${
            tone === 'win'
              ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/15 bg-rose-500/10 text-rose-200'
          }`}>
            ผลสรุป: {formatRiskResultLabel(trade)}
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <span className="text-neutral-400">เข้า <strong className="text-neutral-100">${formatPrice(trade.entry)}</strong></span>
            <span className={tone === 'win' ? 'text-emerald-300' : 'text-rose-300'}>{trade.result === 'WIN' ? 'เข้าเป้า TP' : trade.result === 'LOSS' ? 'โดน SL' : getTradeResultLabel(trade.result)}</span>
            <span className="text-neutral-500">TP ${formatPrice(trade.takeProfit1)}</span>
            <span className="text-neutral-500">SL ${formatPrice(trade.stopLoss)}</span>
          </div>
          <div className="font-mono text-[9px] text-neutral-500">
            คำนวณกำไรขาดทุนเป็นจุด (1 USD Move = 100 จุด)
          </div>
          <div className="font-mono text-[9px] text-neutral-500">{formatDateTime(trade.closedAt)}</div>
        </div>
      ) : (
        <div className="rounded border border-white/5 bg-neutral-950/60 p-3 text-center text-[10px] text-neutral-500">
          ยังไม่มีรายการล่าสุด
        </div>
      )}
    </div>
  );

  return (
    <section className="rounded-xl sm:rounded-2xl border border-white/10 bg-neutral-950/85 p-3 sm:p-5 shadow-[0_0_32px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">
            <DollarSign className="h-3.5 w-3.5" />
            Owner Dashboard
          </div>
          <h1 className="text-lg font-black tracking-tight text-neutral-100 sm:text-2xl">
            ภาพรวมระบบวันนี้
          </h1>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="font-mono text-[10px] text-neutral-500">
            วันใหม่เริ่มตามเวลาไทย: {formatDateTime(owner?.today.startedAt)}
          </div>
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={onResetStats}
              disabled={isResettingStats}
              className="min-h-10 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 text-[10px] font-bold text-rose-200 transition-all hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
              title="ล้างเฉพาะสถิติ signal, แผนเทรด, ผลทดสอบ และ bot research โดยไม่ล้างกราฟ/สมาชิก/รายได้"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResettingStats ? 'animate-spin' : ''}`} />
              {isResettingStats ? 'กำลังเริ่มรอบใหม่...' : 'รีเซ็ตสถิติรอบใหม่'}
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${userRole === 'admin' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`rounded-lg border p-3 ${card.accent}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{card.title}</span>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mb-3 font-mono text-2xl font-black text-neutral-100">{card.value}</div>
              {card.detail}
            </div>
          );
        })}
      </div>

      <div className={`mt-3 rounded-lg border p-3 ${mt5Tone.panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <Terminal className="h-3.5 w-3.5 text-amber-300" />
                สถานะรับค่าจาก MT5
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${mt5Tone.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${mt5Tone.dot} ${mt5State !== 'OFFLINE' ? 'animate-pulse' : ''}`} />
                {mt5Label}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${mt5Tone.text}`}>
              {mt5Message}
            </p>
          </div>
          <div className="font-mono text-[10px] text-neutral-500 lg:text-right">
            ตรวจล่าสุด {formatTime(mt5Realtime?.checkedAt)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">ราคาสด MT5</span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                mt5PriceFeed.live
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
              }`}>
                {mt5PriceFeed.live ? 'สด' : 'ขาดช่วง'}
              </span>
            </div>
            <div className="mt-2 font-mono text-lg font-black text-neutral-100">
              {typeof mt5PriceFeed.price === 'number' ? `$${formatPrice(mt5PriceFeed.price)}` : '-'}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-neutral-500">
              <span>อายุ {formatAge(mt5PriceFeed.ageMs)}</span>
              <span>{formatTime(mt5PriceFeed.receivedAt)}</span>
            </div>
          </div>

          <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">แท่ง M5 จาก MT5</span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                mt5M5Sync.live
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
              }`}>
                {mt5M5Sync.live ? 'sync ปกติ' : 'M5 ไม่สด'}
              </span>
            </div>
            <div className="mt-2 font-mono text-lg font-black text-neutral-100">
              {typeof mt5M5Sync.count === 'number' ? `${mt5M5Sync.count.toLocaleString()} แท่ง` : '-'}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-neutral-500">
              <span>อายุ {formatAge(mt5M5Sync.ageMs)}</span>
              <span>แท่งล่าสุด {formatTime(mt5M5Sync.latestCandleAt || mt5M5Sync.receivedAt)}</span>
            </div>
          </div>

          <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">แท่ง M15 โครงสร้าง</span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                mt5M15Sync.live
                  ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-400'
              }`}>
                {mt5M15Sync.live ? 'พร้อมใช้' : 'รอ sync'}
              </span>
            </div>
            <div className="mt-2 font-mono text-lg font-black text-neutral-100">
              {typeof mt5M15Sync.count === 'number' ? `${mt5M15Sync.count.toLocaleString()} แท่ง` : '-'}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-neutral-500">
              <span>อายุ {formatAge(mt5M15Sync.ageMs)}</span>
              <span>{formatTime(mt5M15Sync.receivedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {outcomeTile('Signal เข้าเป้า TP ล่าสุด', latestHit, 'win')}
          {outcomeTile('Signal โดน SL ล่าสุด', latestStop, 'loss')}
        </div>

        <div className="rounded-lg border border-white/5 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              <Target className="h-3.5 w-3.5 text-cyan-300" />
              Signal ล่าสุดวันนี้
            </span>
            {userRole === 'admin' && (
              <span className="font-mono text-[9px] text-neutral-500">
                รายได้รวม {formatBaht(owner?.subscription.revenueTotal)}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {latestSignals.length > 0 ? latestSignals.map((signal) => (
              <div key={signal.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded border border-white/5 bg-neutral-950/70 px-2 py-1.5 text-[10px]">
                <span className={`rounded border px-1.5 py-0.5 font-mono ${
                  signal.direction === 'BUY'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : signal.direction === 'SELL'
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                }`}>
                  {getDirectionLabel(signal.direction)}
                </span>
                <div className="min-w-0 truncate font-mono text-neutral-300">
                  #{signal.signalRef} {signal.timeframe} @ ${formatPrice(signal.entry)}
                </div>
                <div className="text-right font-mono text-neutral-500">
                  {signal.confidence}% · {formatTime(signal.createdAt)}
                </div>
              </div>
            )) : (
              <div className="rounded border border-white/5 bg-neutral-950/60 p-3 text-center text-[10px] text-neutral-500">
                วันนี้ยังไม่มี signal
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScalpingDecisionChart({
  intelligence,
  activeAsset,
}: {
  intelligence?: MarketIntelligence;
  activeAsset: 'XAUUSD';
}) {
  const chart = intelligence?.decisionChart;
  const decision = intelligence?.scalpingDecision;
  const liveTickStats = useMemo(() => {
    const ticks = chart?.liveTicks || [];
    const lastTick = ticks[ticks.length - 1];
    const previousTick = ticks[ticks.length - 2];
    const priceDelta = lastTick && previousTick ? lastTick.price - previousTick.price : 0;

    return {
      ticks,
      lastTick,
      previousTick,
      priceDelta,
    };
  }, [chart?.liveTicks]);

  if (!chart || !chart.candles?.length || !decision) {
    return (
      <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 min-h-[360px] flex items-center justify-center">
        <div className="text-center font-mono text-xs text-neutral-500">
          รอข้อมูล M5/M15 เพื่อสร้างกราฟตัดสินใจเก็งกำไรสั้น...
        </div>
      </div>
    );
  }

  const width = 920;
  const height = 390;
  const pad = { top: 22, right: 82, bottom: 42, left: 54 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const candles = chart.candles;
  const activeOrderPlan = chart.orderPlan || intelligence?.activeOrderPlan || null;
  const orderPlanDirection = getPlanDirection(activeOrderPlan);
  const orderPlanColor = orderPlanDirection === 'BUY' ? '#34d399' : '#fb7185';
  const orderPlanEntries = activeOrderPlan
    ? [activeOrderPlan.entry1, activeOrderPlan.entry2, activeOrderPlan.entry3, activeOrderPlan.entry]
        .filter((price): price is number => typeof price === 'number' && Number.isFinite(price))
    : [];
  const orderPlanEntryMin = orderPlanEntries.length ? Math.min(...orderPlanEntries) : chart.entry.priceMin;
  const orderPlanEntryMax = orderPlanEntries.length ? Math.max(...orderPlanEntries) : chart.entry.priceMax;
  const prices = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...chart.zones.flatMap((zone) => [zone.priceMin, zone.priceMax]),
    ...orderPlanEntries,
    activeOrderPlan?.stopLoss,
    activeOrderPlan?.takeProfit,
    chart.currentPrice,
    chart.entry.priceMin,
    chart.entry.priceMax,
    chart.entry.recommendedEntry,
    chart.entry.stopLoss,
    chart.entry.takeProfit,
  ].filter((price): price is number => typeof price === 'number' && Number.isFinite(price));

  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const span = Math.max(rawMax - rawMin, 4);
  const minPrice = rawMin - span * 0.08;
  const maxPrice = rawMax + span * 0.08;
  const priceSpan = maxPrice - minPrice || 1;
  const candleWidth = Math.max(4, Math.min(10, (plotWidth / Math.max(candles.length, 1)) * 0.55));

  const yForPrice = (price: number) => pad.top + ((maxPrice - price) / priceSpan) * plotHeight;
  const xForIndex = (index: number) => pad.left + (index / Math.max(candles.length - 1, 1)) * plotWidth;
  const candleTimes = candles.map((candle) => new Date(candle.time).getTime()).filter((time) => Number.isFinite(time));
  const chartStartMs = candleTimes[0] || 0;
  const chartEndMs = candleTimes[candleTimes.length - 1] || chartStartMs + 1;
  const chartTimeSpan = Math.max(1, chartEndMs - chartStartMs);
  const xForTime = (timeMs: number) => {
    const normalized = Math.min(1, Math.max(0, (timeMs - chartStartMs) / chartTimeSpan));
    return pad.left + normalized * plotWidth;
  };
  const gridPrices = Array.from({ length: 5 }, (_, index) => minPrice + (priceSpan / 4) * index);
  const decisionColor = decision.direction === 'BUY' ? '#34d399' : decision.direction === 'SELL' ? '#fb7185' : '#f59e0b';
  const decisionBg = decision.direction === 'BUY'
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : decision.direction === 'SELL'
      ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  const liveTicks = liveTickStats.ticks;
  const latestTick = liveTickStats.lastTick;
  const visibleLiveTicks = liveTicks.filter((tick) => {
    const tickTime = new Date(tick.time).getTime();
    return Number.isFinite(tickTime) && tickTime >= chartStartMs && tickTime <= chartEndMs + 5 * 60 * 1000;
  });
  const liveTickPath = visibleLiveTicks.length > 1
    ? visibleLiveTicks
        .map((tick) => `${xForTime(new Date(tick.time).getTime())},${yForPrice(tick.price)}`)
        .join(' ')
    : '';
  const latestTickX = latestTick ? xForTime(new Date(latestTick.time).getTime()) : null;
  const latestTickY = latestTick ? yForPrice(latestTick.price) : null;
  const priceFeedLive = chart.freshness?.priceFeedLive ?? chart.isLive;
  const candleSyncLive = chart.freshness?.candleSyncLive ?? false;
  const brokerTickChart = chart.freshness?.brokerTickChart ?? false;
  const missingM5Candles = chart.freshness?.missingM5Candles ?? false;
  const isHybridMt5Chart = chart.freshness?.priceSource === 'MT5_SYNC_PLUS_TICK';
  const timeframeBadgeText = missingM5Candles
    ? 'M5 ยังไม่ sync / แสดง M15 เท่านั้น'
    : `${chart.timeframe} เป็นจุดเข้า / M15 เป็นโครงสร้าง`;
  const supportZoneForDisplay = decision.triggerSupport || decision.structureSupport;
  const resistanceZoneForDisplay = decision.triggerResistance || decision.structureResistance;
  const supportLabel = missingM5Candles ? 'โครงสร้างแนวรับ M15' : 'แนวรับ M5';
  const resistanceLabel = missingM5Candles ? 'โครงสร้างแนวต้าน M15' : 'แนวต้าน M5';
  const tickDeltaColor = liveTickStats.priceDelta > 0 ? 'text-emerald-300' : liveTickStats.priceDelta < 0 ? 'text-rose-300' : 'text-neutral-400';
  const lastCandleIndex = candles.length - 1;
  const lastCandleX = xForIndex(lastCandleIndex);
  const orderLines = activeOrderPlan && orderPlanDirection
    ? [
        { label: 'ราคาปัจจุบัน', price: chart.currentPrice, color: '#22d3ee', dash: '5 5' },
        { label: 'จุดเข้าออเดอร์', price: activeOrderPlan.entry, color: orderPlanColor, dash: '0' },
        { label: 'TP แผนหลัก', price: activeOrderPlan.takeProfit, color: '#34d399', dash: '3 5' },
        { label: 'SL แผนหลัก', price: activeOrderPlan.stopLoss, color: '#fb7185', dash: '3 5' },
      ]
    : [
        { label: 'ราคาปัจจุบัน', price: chart.currentPrice, color: '#22d3ee', dash: '5 5' },
        { label: 'จุดเข้า', price: chart.entry.recommendedEntry, color: decisionColor, dash: '0' },
        { label: 'ตัดขาดทุน', price: chart.entry.stopLoss, color: '#fb7185', dash: '3 5' },
        { label: 'ทำกำไร', price: chart.entry.takeProfit, color: '#34d399', dash: '3 5' },
      ];

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 relative overflow-hidden shadow-[0_0_36px_rgba(6,182,212,0.06)]">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500" />

      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-5">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${decisionBg}`}>
              {getDecisionLabel(decision.direction)}
            </span>
            <span className="px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-[9px] font-mono font-bold">
              {timeframeBadgeText}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {activeAsset} ${formatPrice(chart.currentPrice)}
            </span>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${
              priceFeedLive ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-neutral-700 bg-neutral-900 text-neutral-500'
            }`}>
              {priceFeedLive ? 'tick สด' : 'รอ tick'}
            </span>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${
              candleSyncLive || isHybridMt5Chart
                ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}>
              {isHybridMt5Chart ? 'MT5 sync + tick' : candleSyncLive ? 'แท่งซิงค์สด' : brokerTickChart ? 'แท่งจาก tick' : 'แท่งฐานข้อมูล'}
            </span>
            {priceFeedLive && (
              <span className="px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[9px] font-mono font-bold">
                tick MT5 สด
              </span>
            )}
            <span className="text-[10px] text-neutral-600 font-mono">
              อัปเดต {chart.updatedAt ? new Date(chart.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-cyan-400" />
            {activeOrderPlan ? `จุดเข้าออเดอร์: ${activeOrderPlan.title}` : decision.title}
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl">
            {activeOrderPlan ? activeOrderPlan.reason : decision.reason}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2 xl:w-[320px] shrink-0 font-mono">
          <div className="rounded-lg border border-white/5 bg-white/5 p-2">
            <span className="block text-[8px] text-neutral-500 uppercase">{activeOrderPlan ? 'แผนหลัก' : 'โซนจุดเข้า'}</span>
            <span className="text-xs font-bold text-neutral-100">
              {activeOrderPlan ? getPlanTypeLabel(activeOrderPlan.type) : `$${formatPrice(decision.entryMin)} - $${formatPrice(decision.entryMax)}`}
            </span>
          </div>
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-2">
            <span className="block text-[8px] text-amber-400 uppercase">จุดเข้าออเดอร์</span>
            <span className="text-xs font-black text-amber-300">${formatPrice(activeOrderPlan?.entry ?? decision.recommendedEntry)}</span>
          </div>
          <div className="rounded-lg border border-rose-500/15 bg-rose-500/5 p-2">
            <span className="block text-[8px] text-rose-400 uppercase">จุดตัดขาดทุน</span>
            <span className="text-xs font-bold text-rose-300">${formatPrice(activeOrderPlan?.stopLoss ?? decision.stopLoss)}</span>
          </div>
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2">
            <span className="block text-[8px] text-emerald-400 uppercase">จุดทำกำไร</span>
            <span className="text-xs font-bold text-emerald-300">${formatPrice(activeOrderPlan?.takeProfit ?? decision.takeProfit)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_190px] gap-4">
        <div className="rounded-xl border border-white/5 bg-neutral-950/70 overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="block w-full h-[300px] sm:h-[360px]" role="img" aria-label="กราฟแท่งเทียนสำหรับตัดสินใจเก็งกำไรสั้น">
            <rect x="0" y="0" width={width} height={height} fill="#050505" />
            {priceFeedLive && (
              <rect
                x={Math.max(pad.left, lastCandleX - candleWidth * 1.8)}
                y={pad.top}
                width={Math.min(width - pad.right - pad.left, candleWidth * 3.6)}
                height={plotHeight}
                fill="rgba(34,211,238,0.05)"
                stroke="rgba(34,211,238,0.16)"
              />
            )}

            {gridPrices.map((price) => {
              const y = yForPrice(price);
              return (
                <g key={`grid-${price}`}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={width - pad.right + 10} y={y + 4} fill="#737373" fontSize="11" fontFamily="monospace">
                    {formatPrice(price)}
                  </text>
                </g>
              );
            })}

            {chart.zones.map((zone, index) => {
              const top = yForPrice(zone.priceMax);
              const bottom = yForPrice(zone.priceMin);
              const fill = zone.type === 'SUPPORT' ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)';
              const stroke = zone.type === 'SUPPORT' ? 'rgba(52,211,153,0.38)' : 'rgba(251,113,133,0.38)';
              return (
                <g key={`${zone.timeframe}-${zone.type}-${index}`}>
                  <rect
                    x={pad.left}
                    y={Math.min(top, bottom)}
                    width={plotWidth}
                    height={Math.max(3, Math.abs(bottom - top))}
                    fill={fill}
                    stroke={stroke}
                    strokeDasharray={zone.timeframe === 'M5' ? '0' : '6 5'}
                  />
                  <text x={pad.left + 10} y={Math.min(top, bottom) + 14} fill={stroke} fontSize="11" fontFamily="monospace" fontWeight="700">
                    {zone.timeframe} {getZoneTypeLabel(zone.type)}
                  </text>
                </g>
              );
            })}

            <rect
              x={pad.left}
              y={Math.min(
                yForPrice(activeOrderPlan ? orderPlanEntryMax : chart.entry.priceMax),
                yForPrice(activeOrderPlan ? orderPlanEntryMin : chart.entry.priceMin),
              )}
              width={plotWidth}
              height={Math.max(4, Math.abs(
                yForPrice(activeOrderPlan ? orderPlanEntryMin : chart.entry.priceMin) -
                yForPrice(activeOrderPlan ? orderPlanEntryMax : chart.entry.priceMax),
              ))}
              fill={`${activeOrderPlan ? orderPlanColor : decisionColor}20`}
              stroke={activeOrderPlan ? orderPlanColor : decisionColor}
              strokeWidth="1.5"
            />

            {candles.map((candle, index) => {
              const x = xForIndex(index);
              const openY = yForPrice(candle.open);
              const closeY = yForPrice(candle.close);
              const highY = yForPrice(candle.high);
              const lowY = yForPrice(candle.low);
              const bullish = candle.close >= candle.open;
              const color = bullish ? '#34d399' : '#fb7185';
              return (
                <g key={`${candle.time}-${index}`}>
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
                  <rect
                    x={x - candleWidth / 2}
                    y={Math.min(openY, closeY)}
                    width={candleWidth}
                    height={Math.max(2, Math.abs(closeY - openY))}
                    rx="1.5"
                    fill={bullish ? 'rgba(52,211,153,0.88)' : 'rgba(251,113,133,0.88)'}
                  />
                </g>
              );
            })}

            {liveTickPath && (
              <polyline
                points={liveTickPath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.92"
              />
            )}

            {latestTickX !== null && latestTickY !== null && (
              <g>
                <circle cx={latestTickX} cy={latestTickY} r="8" fill="rgba(34,211,238,0.16)" stroke="rgba(34,211,238,0.35)" />
                <circle cx={latestTickX} cy={latestTickY} r="3.2" fill="#22d3ee" />
                <text x={Math.min(width - pad.right - 8, latestTickX + 12)} y={latestTickY - 10} fill="#22d3ee" fontSize="11" fontFamily="monospace" fontWeight="700">
                  live ${formatPrice(latestTick.price)}
                </text>
              </g>
            )}

            {orderLines.map((line) => {
              const y = yForPrice(line.price);
              return (
                <g key={line.label}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={line.color} strokeWidth="1.5" strokeDasharray={line.dash} />
                  <text x={width - pad.right + 10} y={y - 5} fill={line.color} fontSize="11" fontFamily="monospace" fontWeight="700">
                    {line.label}
                  </text>
                </g>
              );
            })}

            <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="rgba(255,255,255,0.12)" />
            <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="rgba(255,255,255,0.12)" />
          </svg>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {activeOrderPlan && orderPlanDirection && (
            <div className={`rounded-xl border p-3 ${
              orderPlanDirection === 'BUY'
                ? 'border-emerald-500/15 bg-emerald-500/5'
                : 'border-rose-500/15 bg-rose-500/5'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className={`text-[9px] uppercase font-bold ${
                  orderPlanDirection === 'BUY' ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  แผนหลักที่ล็อกไว้
                </div>
                <span className="text-[9px] text-neutral-400">
                  {activeOrderPlan.confidence}%+
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500">จุดเข้า</span>
                  <span className="font-black text-amber-300">${formatPrice(activeOrderPlan.entry)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500">TP</span>
                  <span className="font-bold text-emerald-300">${formatPrice(activeOrderPlan.takeProfit)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500">SL</span>
                  <span className="font-bold text-rose-300">${formatPrice(activeOrderPlan.stopLoss)}</span>
                </div>
                <div className="border-t border-white/5 pt-2 text-[9px] text-neutral-500 leading-relaxed">
                  ล็อกถึง {activeOrderPlan.lockedUntil ? new Date(activeOrderPlan.lockedUntil).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} หรือจนกว่าแตะ TP/SL
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3">
            <div className="text-[9px] text-cyan-400 uppercase mb-2">สัญญาณกราฟสด</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="block text-neutral-500">tick ล่าสุด</span>
                <span className="font-bold text-neutral-100">{formatAge(chart.freshness?.tickAgeMs)}</span>
              </div>
              <div>
                <span className="block text-neutral-500">แท่งล่าสุด</span>
                <span className="font-bold text-neutral-100">{formatAge(chart.freshness?.candleAgeMs)}</span>
              </div>
              <div>
                <span className="block text-neutral-500">tick ในกราฟ</span>
                <span className="font-bold text-neutral-100">{liveTicks.length}</span>
              </div>
              <div>
                <span className="block text-neutral-500">แท่ง {chart.timeframe} ที่แสดง</span>
                <span className="font-bold text-neutral-100">{chart.candles.length}</span>
              </div>
              <div>
                <span className="block text-neutral-500">M5 จาก MT5</span>
                <span className={`font-bold ${missingM5Candles ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {chart.freshness?.mt5M5CandleCount ?? 0}
                </span>
              </div>
              <div>
                <span className="block text-neutral-500">เปลี่ยนล่าสุด</span>
                <span className={`font-bold ${tickDeltaColor}`}>
                  {liveTickStats.priceDelta > 0 ? '+' : ''}{liveTickStats.priceDelta.toFixed(2)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-neutral-500">แหล่งราคากราฟ</span>
                <span className="font-bold text-emerald-300">
                  {getChartSourceLabel(chart.freshness?.priceSource, brokerTickChart, candleSyncLive)}
                </span>
              </div>
              {missingM5Candles && (
                <div className="col-span-2 rounded-lg border border-amber-500/15 bg-amber-500/10 px-2 py-1.5 text-amber-300">
                  ยังไม่มีแท่ง M5 จาก MT5 สำหรับ {chart.freshness?.activeSymbol || activeAsset}; ปิดจุดเข้า M5 และแสดง {chart.timeframe} เป็นโครงสร้างชั่วคราว
                </div>
              )}
              {chart.freshness?.chartCandlesStale && (
                <div className="col-span-2 rounded-lg border border-rose-500/15 bg-rose-500/10 px-2 py-1.5 text-rose-200">
                  แท่ง {chart.timeframe} ยังไม่ sync สดจาก MT5; ใช้ดูโครงสร้างเท่านั้นจนกว่า VPS จะส่งแท่งล่าสุดเข้ามา
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-neutral-950/70 p-3">
            <div className="text-[9px] text-neutral-500 uppercase mb-2">ความมั่นใจของจังหวะนี้</div>
            <div className="flex items-end justify-between gap-3">
              <span className="text-2xl font-black" style={{ color: decisionColor }}>{decision.confidence}%</span>
              <span className="text-[10px] text-neutral-500 text-right">
                {missingM5Candles ? 'RSI M5 รอ sync' : `RSI M5 ${decision.metrics?.rsiM5 ?? 50}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${decision.confidence}%`, backgroundColor: decisionColor }} />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
            <div className="text-[9px] text-emerald-400 uppercase mb-1">{supportLabel}</div>
            <div className="text-neutral-200 font-bold">
              {supportZoneForDisplay ? `$${formatPrice(supportZoneForDisplay.priceMin)} - $${formatPrice(supportZoneForDisplay.priceMax)}` : 'รอโซนใหม่'}
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3">
            <div className="text-[9px] text-rose-400 uppercase mb-1">{resistanceLabel}</div>
            <div className="text-neutral-200 font-bold">
              {resistanceZoneForDisplay ? `$${formatPrice(resistanceZoneForDisplay.priceMin)} - $${formatPrice(resistanceZoneForDisplay.priceMax)}` : 'รอโซนใหม่'}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3">
            <div className="text-[9px] text-cyan-400 uppercase mb-1">ทิศทาง M5 / M15</div>
            <div className="text-neutral-200 font-bold">
              {missingM5Candles ? 'รอ sync' : getTrendLabel(decision.metrics?.m5Bias)} / {getTrendLabel(decision.metrics?.m15Bias)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const playAlertSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playTone(523.25, 0, 0.4); // C5
    playTone(659.25, 0.15, 0.5); // E5
    playTone(783.99, 0.3, 0.6); // G5
  } catch (err) {
    console.error('AudioContext alert failed:', err);
  }
};

const parseTechnicalReasons = (reasonStr: string, direction: string, timeframe: string): string[] => {
  if (!reasonStr) return ['ผ่านเกณฑ์มาตรฐานของระบบ'];
  try {
    const reason = JSON.parse(reasonStr);
    if (reason.proactiveReason) {
      if (typeof reason.proactiveReason === 'string') {
        const lines = reason.proactiveReason
          .split('\n')
          .map((l: string) => l.trim().replace(/^-\s*/, '').replace(/^•\s*/, ''))
          .filter(Boolean);
        if (lines.length > 0) return lines;
      }
    }

    const points: string[] = [];

    // 1. Zone/Supply/Demand hits
    if (reason.zoneHit) {
      const zoneType = reason.zoneHit.type === 'SUPPORT' ? 'demand zone' : 'supply zone';
      points.push(`ราคาชน ${zoneType} บริเวณ ${timeframe}`);
    } else if (reason.fallbackSeeding) {
      points.push('ระบบเริ่มต้นใหม่ (Cold-start): รอสะสมกำลังสร้างฐานราคา');
    } else {
      const zoneName = direction === 'BUY' ? 'demand zone' : 'supply zone';
      points.push(`ราคาเคลื่อนไหวเข้าใกล้ ${zoneName} สำคัญ`);
    }

    // 2. Trend alignment
    if (reason.trendAligned === true) {
      points.push(`แนวโน้มสอดคล้องกับเทรนด์หลัก H4 (${direction === 'BUY' ? 'ขาขึ้น BULLISH' : 'ขาลง BEARISH'})`);
    } else if (reason.trendAligned === false) {
      points.push(`สัญญาณสวนเทรนด์หลัก H4 (${direction === 'BUY' ? 'เทรนด์หลักยังเป็นขาลง' : 'เทรนด์หลักยังเป็นขาขึ้น'})`);
    }

    // 3. RSI Status
    if (reason.overboughtAlert || (reason.rsi14 && reason.rsi14 > 70)) {
      points.push(`RSI เริ่มอ่อนแรง (${Math.round(reason.rsi14 || 70)} > 70)`);
    } else if (reason.oversoldAlert || (reason.rsi14 && reason.rsi14 < 30)) {
      points.push(`RSI เริ่มพยุงตัวกลับขึ้น (${Math.round(reason.rsi14 || 30)} < 30)`);
    } else if (reason.rsi14) {
      points.push(`RSI พร้อมกลับตัว (ค่าปัจจุบัน ${Math.round(reason.rsi14)})`);
    }

    // 4. Structure changes
    if (direction === 'SELL' || direction === 'Wait') {
      points.push(`โครงสร้าง ${timeframe} ทำ lower high`);
    } else {
      points.push(`โครงสร้าง ${timeframe} ทำ higher low`);
    }

    // 5. Entry strategy warning
    if (reason.fakeBreakout) {
      points.push('เกิดสัญญาณเบรคหลอก (Fakeout Trap) ให้ตั้ง SL เคร่งครัด');
    }
    
    points.push('รอราคากลับเข้าโซนก่อนเข้า ไม่ไล่ราคา');

    return points;
  } catch {
    if (typeof reasonStr === 'string' && reasonStr.trim().length > 0) {
      return reasonStr
        .split('\n')
        .map((l: string) => l.trim().replace(/^-\s*/, '').replace(/^•\s*/, ''))
        .filter(Boolean);
    }
    return ['ผ่านเกณฑ์มาตรฐานของระบบ'];
  }
};

function SignalGraphPlotter({ entry, stopLoss, takeProfit1, takeProfit2, direction }: { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; direction: string }) {
  const isBuy = direction === 'BUY';
  const minVal = isBuy ? stopLoss : takeProfit2;
  const maxVal = isBuy ? takeProfit2 : stopLoss;
  const range = maxVal - minVal;
  
  const getPercent = (val: number) => {
    if (range === 0) return 50;
    const pct = ((val - minVal) / range) * 80 + 10;
    return 100 - pct;
  };

  const slY = getPercent(stopLoss);
  const entryY = getPercent(entry);
  const tp1Y = getPercent(takeProfit1);
  const tp2Y = getPercent(takeProfit2);

  return (
    <div className="w-full bg-neutral-950/80 rounded-2xl border border-neutral-900 p-4 font-mono text-[10px] my-3">
      <div className="text-center text-[9px] text-neutral-500 mb-3 uppercase tracking-wider">ผังกราฟจำลองเป้าหมาย TP / SL</div>
      <div className="relative h-36 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 300 120">
          <line x1="120" y1="5" x2="120" y2="115" stroke="#333" strokeWidth="1.5" strokeDasharray="3 3" />
          
          {/* Stop Loss Line */}
          <line x1="50" y1={slY} x2="250" y2={slY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="120" cy={slY} r="3.5" fill="#f43f5e" />
          <text x="15" y={slY + 3.5} fill="#f43f5e" className="font-bold">SL</text>
          <text x="255" y={slY + 3.5} fill="#999">${stopLoss.toFixed(2)}</text>

          {/* Entry Line */}
          <line x1="50" y1={entryY} x2="250" y2={entryY} stroke="#06b6d4" strokeWidth="2" />
          <circle cx="120" cy={entryY} r="5" fill="#06b6d4" className="animate-ping" />
          <circle cx="120" cy={entryY} r="3.5" fill="#06b6d4" />
          <text x="15" y={entryY + 3.5} fill="#06b6d4" className="font-bold">ENTRY</text>
          <text x="255" y={entryY + 3.5} fill="#fff">${entry.toFixed(2)}</text>

          {/* TP1 Line */}
          <line x1="50" y1={tp1Y} x2="250" y2={tp1Y} stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="120" cy={tp1Y} r="3.5" fill="#10b981" />
          <text x="15" y={tp1Y + 3.5} fill="#10b981" className="font-bold">TP1</text>
          <text x="255" y={tp1Y + 3.5} fill="#999">${takeProfit1.toFixed(2)}</text>

          {/* TP2 Line */}
          <line x1="50" y1={tp2Y} x2="250" y2={tp2Y} stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="120" cy={tp2Y} r="3.5" fill="#10b981" />
          <text x="15" y={tp2Y + 3.5} fill="#10b981" className="font-bold">TP2</text>
          <text x="255" y={tp2Y + 3.5} fill="#999">${takeProfit2.toFixed(2)}</text>
        </svg>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [userRole, setUserRole] = useState<string>('viewer');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUserRole(data.user.role || 'viewer');
          }
        }
      } catch {
        // silent fail
      }
    };
    fetchUserRole();
  }, []);

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<'XAUUSD'>('XAUUSD');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simDirection, setSimDirection] = useState<'BUY'|'SELL'>('BUY');
  const [simPrice, setSimPrice] = useState<number>(4450.0);
  const [simStrategy, setSimStrategy] = useState('support_bounce');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [planFilter, setPlanFilter] = useState<'ALL' | 'SCALP' | 'SWING' | 'FOLLOW_TREND'>('ALL');
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [isResettingStats, setIsResettingStats] = useState(false);

  const [activeAlertSignal, setActiveAlertSignal] = useState<OwnerSignalSummary | null>(null);
  const [alertedSignalIds, setAlertedSignalIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ids = JSON.parse(sessionStorage.getItem('alerted_signals') || '[]');
      setAlertedSignalIds(ids);
    }
  }, []);

  useEffect(() => {
    const latestSignals = stats?.ownerMetrics?.today.latestSignals;
    if (latestSignals && latestSignals.length > 0) {
      const latest = latestSignals[0];
      if (
        (latest.direction === 'BUY' || latest.direction === 'SELL') &&
        latest.confidence >= 80
      ) {
        const ageMs = Date.now() - new Date(latest.createdAt).getTime();
        if (ageMs < 1000 * 60 * 5) {
          if (!alertedSignalIds.includes(latest.id) && activeAlertSignal?.id !== latest.id) {
            setActiveAlertSignal(latest);
            playAlertSound();
            
            const updatedIds = [...alertedSignalIds, latest.id];
            setAlertedSignalIds(updatedIds);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('alerted_signals', JSON.stringify(updatedIds));
            }
          }
        }
      }
    }
  }, [stats, alertedSignalIds, activeAlertSignal]);

  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [manualExitPrice, setManualExitPrice] = useState(0);
  const isFetchingStatsRef = useRef(false);
  const lastGoodStatsRef = useRef<Stats | null>(null);

  // Market Session State (Moved above conditional returns to fix React Hook violation)
  const [currentSessions, setCurrentSessions] = useState<{name: string, active: boolean, color: string, time: string}[]>([]);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

	  const fetchStats = async () => {
    if (isFetchingStatsRef.current) return;
    isFetchingStatsRef.current = true;
    try {
      const data = await fetchDashboardStats(activeAsset, { retries: 1, timeoutMs: 12000, cacheBust: true });
      setStats(data);
      lastGoodStatsRef.current = data;
      setError(null);
      if (data.marketIntelligence && data.marketIntelligence[activeAsset]) {
         setSimPrice(data.marketIntelligence[activeAsset].currentPrice);
      }
    } catch {
      setError(
        lastGoodStatsRef.current
          ? 'อัปเดตข้อมูลสดสะดุดชั่วคราว ระบบยังแสดงข้อมูลล่าสุดที่โหลดสำเร็จไว้ให้'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล'
      );
    } finally {
      isFetchingStatsRef.current = false;
      setIsLoading(false);
    }
	  };

	  const handleResetStatistics = async () => {
	    if (userRole !== 'admin' || isResettingStats) return;

	    const confirmed = window.confirm(
	      'ยืนยันรีเซ็ตสถิติรอบใหม่?\n\nระบบจะล้างเฉพาะ Signal, แผนเทรด, ผลทดสอบ, AI review และ Bot research ของ XAUUSD\nแต่จะไม่ล้างกราฟ MT5, โซนราคา, สมาชิก, รายได้ หรือการชำระเงิน',
	    );
	    if (!confirmed) return;

	    setIsResettingStats(true);
	    try {
	      const res = await fetch('/api/admin/reset-statistics', {
	        method: 'POST',
	        headers: { 'Content-Type': 'application/json' },
	        body: JSON.stringify({ confirm: 'RESET_XAU_STATS' }),
	      });
	      const data = await res.json();

	      if (!res.ok) {
	        throw new Error(data.error || 'รีเซ็ตสถิติล้มเหลว');
	      }

	      if (typeof window !== 'undefined') {
	        sessionStorage.removeItem('alerted_signals');
	      }
	      setAlertedSignalIds([]);
	      setActiveAlertSignal(null);
	      setSimResult({
	        status: 'accepted',
	        decision: 'STATS_RESET',
	        message: data.message || 'รีเซ็ตสถิติรอบใหม่สำเร็จ',
	      });
	      await fetchStats();
	    } catch (error: any) {
	      setSimResult({
	        status: 'error',
	        decision: 'STATS_RESET_FAILED',
	        error_message: error?.message || 'รีเซ็ตสถิติล้มเหลว',
	      });
	    } finally {
	      setIsResettingStats(false);
	    }
	  };

  useEffect(() => {
    const checkSessions = () => {
      const now = new Date();
      // Get current hour in UTC
      const h = now.getUTCHours();
      
      const sydneyActive = h >= 21 || h < 6;
      const tokyoActive = h >= 0 && h < 9;
      const londonActive = h >= 8 && h < 17;
      const newyorkActive = h >= 13 && h < 22;

      const sessions = [
        { name: 'ซิดนีย์', active: sydneyActive, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30', time: '04:00 - 13:00 (ไทย)' },
        { name: 'โตเกียว', active: tokyoActive, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30', time: '07:00 - 16:00 (ไทย)' },
        { name: 'ลอนดอน', active: londonActive, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', time: '15:00 - 00:00 (ไทย)' },
        { name: 'นิวยอร์ก', active: newyorkActive, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30', time: '20:00 - 05:00 (ไทย)' }
      ];
      
      setCurrentSessions(sessions);

      if (londonActive && newyorkActive) {
        setOverlapWarning('🔥 ตลาดลอนดอนและนิวยอร์กซ้อนทับกัน (13:00-17:00 UTC) ความผันผวนสูงมาก ควรลดขนาดล็อต!');
      } else if (tokyoActive && londonActive) {
        setOverlapWarning('⚠️ ตลาดโตเกียวและลอนดอนซ้อนทับกัน ความผันผวนเริ่มสูงขึ้น');
      } else {
        setOverlapWarning(null);
      }
    };
    
    checkSessions();
    const interval = setInterval(checkSessions, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto refresh for Real-Time MT5 tick/candle sync
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [activeAsset]);

  const handleMockWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/webhooks/tradingview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'GOLD_AI_SECRET',
          symbol: activeAsset,
          timeframe: 'M15',
          direction: simDirection,
          price: simPrice,
          strategy: simStrategy,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      setSimResult(data);
      fetchStats();
    } catch {
      setSimResult({ status: 'error', decision: 'NETWORK_FAILURE', error_message: 'ยิงสัญญาณทดสอบล้มเหลว' });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApprovePlan = async (id: string) => {
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_plan', tradeId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResult({ status: 'accepted', decision: 'PLAN_APPROVED', message: data.message || 'เริ่มติดตามแผนแล้ว' });
        fetchStats();
      } else {
        setSimResult({ status: 'rejected', decision: 'PLAN_APPROVE_REJECTED', error_message: data.error || 'อนุมัติแผนล้มเหลว' });
      }
    } catch {
      setSimResult({ status: 'error', decision: 'PLAN_APPROVE_FAILED', error_message: 'อนุมัติแผนล้มเหลว' });
    }
  };

  const handleStartPlanTest = async (id: string) => {
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_plan_test', tradeId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResult({ status: 'accepted', decision: 'PLAN_TESTING', message: data.message || 'เริ่มทดสอบ TP/SL แล้ว' });
        fetchStats();
      } else {
        setSimResult({ status: 'rejected', decision: 'PLAN_TEST_REJECTED', error_message: data.error || 'เริ่มทดสอบแผนล้มเหลว' });
      }
    } catch {
      setSimResult({ status: 'error', decision: 'PLAN_TEST_FAILED', error_message: 'เริ่มทดสอบแผนล้มเหลว' });
    }
  };

  const handleCreateProactivePlan = async (plan: ProactivePlan) => {
    setSavingPlanId(plan.id);
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_proactive_plan', 
          plan: { ...plan, symbol: activeAsset } 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResult({ status: 'accepted', decision: 'PLAN_SAVED_AND_TESTING', message: data.message || 'บันทึกแผนและเริ่มทดสอบแล้ว' });
        fetchStats();
      } else {
        setSimResult({ status: 'rejected', decision: 'PLAN_SAVE_REJECTED', error_message: data.error || 'บันทึกแผนล้มเหลว' });
      }
    } catch {
      setSimResult({ status: 'error', decision: 'PLAN_SAVE_FAILED', error_message: 'บันทึกแผนล้มเหลว' });
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleRunStrategyResearch = async () => {
    setResearchStatus('running');
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_strategy_research', symbol: activeAsset }),
      });
      const data = await res.json();
      if (res.ok) {
        setResearchStatus('done');
        setSimResult({ status: 'accepted', decision: 'RESEARCH_FINISHED', message: data.message });
        fetchStats();
      } else {
        setResearchStatus('error');
        setSimResult({ status: 'error', decision: 'RESEARCH_FAILED', error_message: data.error || 'วิจัยกลยุทธ์ล้มเหลว' });
      }
    } catch {
      setResearchStatus('error');
      setSimResult({ status: 'error', decision: 'RESEARCH_FAILED', error_message: 'วิจัยกลยุทธ์ล้มเหลว' });
    }
  };

  const handleCloseTrade = async (id: string, exitPrice: number) => {
    setClosingTradeId(id);
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_trade', tradeId: id, exitPrice }),
      });
      if (res.ok) {
        setClosingTradeId(null);
        setSimResult({ status: 'accepted', decision: 'TRADE_CLOSED', message: 'ปิดแผนที่กำลังติดตามแล้ว' });
        fetchStats();
      }
    } catch {
      setSimResult({ status: 'error', decision: 'TRADE_CLOSE_FAILED', error_message: 'ปิดออเดอร์ล้มเหลว' });
    } finally {
      setClosingTradeId(null);
    }
  };

  // Route viewer users to the new AI Assistant dashboard
  if (userRole === 'viewer') {
    return <UserDashboard />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-cyan-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        กำลังเปิดศูนย์ควบคุม...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm shadow-[0_0_15px_rgba(244,63,94,0.2)]">
        {error}
      </div>
    );
  }

  const intelligence = stats?.marketIntelligence?.[activeAsset];
  const mainChartSource = intelligence?.decisionChart?.freshness?.priceSource;
  const mainChartUsesHybridMt5 = mainChartSource === 'MT5_SYNC_PLUS_TICK';
  const planFilters: Array<{ value: 'ALL' | 'SCALP' | 'SWING' | 'FOLLOW_TREND'; label: string }> = [
    { value: 'ALL', label: 'ทั้งหมด' },
    { value: 'SCALP', label: 'Scalp' },
    { value: 'SWING', label: 'Swing' },
    { value: 'FOLLOW_TREND', label: 'Follow Trend' },
  ];
  const visibleProactivePlans = (intelligence?.proactivePlans || []).filter((plan) =>
    planFilter === 'ALL' ? true : plan.strategyMode === planFilter,
  );
  const visibleSpeculativePlans = (intelligence?.speculativePlans || []).filter((plan) =>
    planFilter === 'ALL' ? true : plan.strategyMode === planFilter,
  );
  const approvedResearchCount = intelligence?.strategyResearch?.approvedStrategies?.length || 0;
  const latestResearchAt = intelligence?.strategyResearch?.generatedAt
    ? new Date(intelligence.strategyResearch.generatedAt).toLocaleString('th-TH')
    : null;

	  return (
	    <div className="space-y-6 font-sans text-neutral-200">
	      <OwnerDashboardSummary
	        stats={stats}
	        userRole={userRole}
	        isResettingStats={isResettingStats}
	        onResetStats={handleResetStatistics}
	      />
	      
	      {/* Fundamental News Sentiment Override Banner */}
      {intelligence?.fundamentalBias && intelligence.fundamentalBias !== 'NEUTRAL' && (
        <div className={`border rounded-xl sm:rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg ${
          intelligence.fundamentalBias === 'BULLISH'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
        }`}>
          {/* Subtle side glowing line */}
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            intelligence.fundamentalBias === 'BULLISH' ? 'bg-emerald-500' : 'bg-rose-500'
          }`} />
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 p-2 rounded-xl flex items-center justify-center shrink-0 border ${
              intelligence.fundamentalBias === 'BULLISH'
                ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/20 text-rose-400'
            }`}>
              <ShieldAlert className="h-5 w-5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wider ${
                  intelligence.fundamentalBias === 'BULLISH'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {activeAsset} ปัจจัยข่าว: {getTrendLabel(intelligence.fundamentalBias)}
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    intelligence.fundamentalBias === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}></span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-semibold">
                  แอดมินแจ้งเตือนปัจจัยทางข่าวพิเศษ
                </span>
              </div>
              <h4 className={`text-base font-extrabold tracking-tight mt-1 ${
                intelligence.fundamentalBias === 'BULLISH' ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {intelligence.fundamentalBias === 'BULLISH' ? '🚨 ข่าวสารตลาดหนุนแรงฝั่งขาขึ้น' : '🚨 ข่าวสารตลาดกดดันแรงฝั่งขาลง'}
              </h4>
              <p className="text-sm text-neutral-200 mt-2 leading-relaxed font-medium">
                {intelligence.fundamentalWarning || 'กรุณาเทรดด้วยความระมัดระวังเป็นพิเศษ เนื่องจากความผันผวนทางข่าวสูง'}
              </p>
              <p className="text-[10px] text-neutral-450 mt-2 font-mono leading-relaxed">
                *ระบบประมวลผลสัญญาณได้ทำการบล็อกสัญญาณฝั่งตรงข้ามโดยอัตโนมัติแล้ว เพื่อความปลอดภัยสูงสุดของสมาชิก
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Risk Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-400">คำเตือนความเสี่ยงและข้อควรระวัง</h4>
          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
            ระวังเทรนด์เปลี่ยนเสมอ! ควรควบคุมขนาดไม้ และตั้งจุดตัดขาดทุนที่รับได้อย่างเคร่งครัด ยิ่งราคาเข้าใกล้แนวรับ-แนวต้านสำคัญ ยิ่งต้องระวังเป็นพิเศษ และควรเปิดกราฟดูพฤติกรรมราคา หรือแพทเทิร์นประกอบการตัดสินใจด้วยเสมอ
          </p>
        </div>
      </div>

      {simResult && (
        <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 border flex items-start gap-3 ${
          simResult.status === 'accepted'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
        }`}>
          {simResult.status === 'accepted' ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" /> : <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className="text-xs font-bold font-mono">{simResult.decision || 'SYSTEM_UPDATE'}</div>
            <p className="text-xs mt-1 leading-relaxed text-neutral-200">
              {simResult.message || simResult.error_message || simResult.error || 'ระบบอัปเดตคำสั่งล่าสุดแล้ว'}
            </p>
          </div>
        </div>
      )}

      {/* Market Sessions Widget */}
      <div className="bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-4 text-center md:text-left w-full">
          <div className="w-full flex flex-col items-center md:items-start">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mb-2 w-full text-center md:text-left">
              <Activity className="h-4 w-4 text-cyan-500" />
              สถานะตลาดโลก
            </h4>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 w-full">
              {currentSessions.map(s => (
                <div key={s.name} className={`flex-1 min-w-[80px] md:flex-initial px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center ${s.active ? s.color + ' shadow-lg animate-pulse' : 'bg-neutral-900 border-neutral-800 text-neutral-600'}`}>
                  <div className="flex items-center gap-1.5 justify-center">
                    {s.active && <span className="h-1.5 w-1.5 rounded-full bg-current"></span>}
                    {s.name}
                  </div>
                  <span className="text-[9px] font-normal opacity-80 mt-0.5 font-mono">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
          
          {overlapWarning && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl max-w-sm w-full text-center">
              <p className="text-xs text-rose-400 font-bold leading-relaxed">
                {overlapWarning}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Top Navigation & Live Price */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
        <div className="flex gap-2 bg-neutral-900/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveAsset('XAUUSD')}
            className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg font-bold font-mono transition-all ${activeAsset === 'XAUUSD' ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] border border-amber-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            XAUUSD เท่านั้น
          </button>
        </div>

        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <div className="text-right flex flex-col items-end w-full md:w-auto mt-4 md:mt-0">
            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 mb-1">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">ราคาตลาดล่าสุด</span>
              {stats?.mt5Connection?.priceFeedLive ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ราคาสดเข้าอยู่
                </span>
              ) : stats?.mt5Connection?.m5CandleSyncLive ? (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[8px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span> แท่ง M5 ซิงค์อยู่
                </span>
              ) : stats?.mt5Connection?.m15CandleSyncLive ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[8px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> M15 เข้าอยู่ / รอ M5
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[8px] font-bold flex items-center gap-1" title="ใช้ข้อมูลราคาสำรองจากตลาดสาธารณะ">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> MT5 ขาดการเชื่อมต่อ / ใช้ราคาสำรอง
                </span>
              )}
            </div>
            <div className="text-3xl font-black font-mono tracking-tight flex items-center gap-3">
              <span className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">${intelligence?.currentPrice?.toFixed(2) ?? '0.00'}</span>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Column: Market Intelligence & Zones (Cyberpunk Glassmorphism) */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          
          {/* Bias Radar */}
          <div className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              ศูนย์วิเคราะห์ตลาด
            </h2>
            
            <div className="space-y-5">
              <div>
                <span className="text-[10px] text-neutral-500 font-mono">ทิศทางตลาด</span>
                <div className={`text-2xl font-black tracking-widest mt-1 ${
                  intelligence?.bias === 'BULLISH' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                  intelligence?.bias === 'BEARISH' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
                  'text-neutral-400'
                }`}>
                  {intelligence?.bias === 'BULLISH' ? 'มองขึ้น' : 
                   intelligence?.bias === 'BEARISH' ? 'มองลง' : 
                   getTrendLabel(intelligence?.bias)}
                </div>
              </div>
              
              {/* Timeframe Biases (Sub-Biases) */}
              <div className="border-t border-white/5 pt-3">
                <span className="text-[9px] text-neutral-500 font-mono block mb-2">เทรนด์ย่อยแยกกรอบเวลา</span>
                <div className="grid grid-cols-4 gap-2">
                  {/* Day (D1) Trend */}
                  <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-2 text-center font-mono">
                    <span className="text-[7.5px] text-neutral-400 block mb-1 font-bold">D1 (หลัก)</span>
                    <span className={`text-[10px] font-black tracking-wider ${
                      intelligence?.timeframeBiases?.D1 === 'BULLISH' ? 'text-emerald-400 font-bold' :
                      intelligence?.timeframeBiases?.D1 === 'BEARISH' ? 'text-rose-400 font-bold' :
                      'text-neutral-500'
                    }`}>
                      {getTrendLabel(intelligence?.timeframeBiases?.D1)}
                    </span>
                  </div>
                  {/* H1 Trend */}
                  <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-2 text-center font-mono">
                    <span className="text-[7.5px] text-neutral-400 block mb-1 font-bold">H1 (กลาง)</span>
                    <span className={`text-[10px] font-black tracking-wider ${
                      intelligence?.timeframeBiases?.H1 === 'BULLISH' ? 'text-emerald-400 font-bold' :
                      intelligence?.timeframeBiases?.H1 === 'BEARISH' ? 'text-rose-400 font-bold' :
                      'text-neutral-500'
                    }`}>
                      {getTrendLabel(intelligence?.timeframeBiases?.H1)}
                    </span>
                  </div>
                  {/* M5 Trend */}
                  <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-2 text-center font-mono">
                    <span className="text-[7.5px] text-neutral-400 block mb-1 font-bold">M5 (เข้า)</span>
                    <span className={`text-[10px] font-black tracking-wider ${
                      intelligence?.timeframeBiases?.M5 === 'BULLISH' ? 'text-emerald-400 font-bold' :
                      intelligence?.timeframeBiases?.M5 === 'BEARISH' ? 'text-rose-400 font-bold' :
                      'text-neutral-500'
                    }`}>
                      {getTrendLabel(intelligence?.timeframeBiases?.M5)}
                    </span>
                  </div>
                  {/* M15 Trend */}
                  <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-2 text-center font-mono">
                    <span className="text-[7.5px] text-neutral-400 block mb-1 font-bold">M15 (ย่อย)</span>
                    <span className={`text-[10px] font-black tracking-wider ${
                      intelligence?.timeframeBiases?.M15 === 'BULLISH' ? 'text-emerald-400 font-bold' :
                      intelligence?.timeframeBiases?.M15 === 'BEARISH' ? 'text-rose-400 font-bold' :
                      'text-neutral-500'
                    }`}>
                      {getTrendLabel(intelligence?.timeframeBiases?.M15)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
                  <span>ความแรงเทรนด์</span>
                  <span className="text-indigo-400 font-bold">{intelligence?.trendStrength}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
                    style={{ width: `${intelligence?.trendStrength}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-neutral-500 font-mono">ความผันผวน</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  intelligence?.volatility === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 
                  intelligence?.volatility === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {intelligence?.volatility === 'HIGH' ? 'สูงมาก' : 
                   intelligence?.volatility === 'MEDIUM' ? 'ปานกลาง' : 
                   'ต่ำ'}
                </span>
              </div>
            </div>
          </div>

          {/* MT5 Sync Diagnostics Card */}
          <div className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-amber-500" />
                การเชื่อมต่อ METATRADER 5
              </h2>
              <button 
                onClick={fetchStats}
                disabled={isLoading}
                className="p-1 hover:bg-white/10 rounded transition-all text-neutral-400 hover:text-white disabled:opacity-50"
                title="รีเฟรชข้อมูลสถานะ"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 font-mono">ราคาสดจาก EA</span>
                {stats?.mt5Connection?.priceFeedLive ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> สด
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-450 animate-ping"></span> ขาด
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 font-mono">แท่งเทียน M5/M15</span>
                {stats?.mt5Connection?.m5CandleSyncLive ? (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span> M5 ซิงค์อยู่
                  </span>
                ) : stats?.mt5Connection?.m15CandleSyncLive ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> M15 เข้า / M5 ขาด
                  </span>
                ) : mainChartUsesHybridMt5 ? (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300"></span> MT5 + tick
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> ใช้ tick วาดแท่ง
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 font-mono">
                <span className="text-[10px] text-neutral-500">ซิงค์ราคาล่าสุด</span>
                <span className="text-neutral-300 font-medium">${intelligence?.currentPrice?.toFixed(2) ?? 'N/A'}</span>
              </div>

              <div className="flex justify-between items-start text-xs border-t border-white/5 pt-2 font-mono">
                <span className="text-[10px] text-neutral-500">ราคาสดล่าสุด</span>
                <span className="text-neutral-300 font-medium text-right leading-relaxed max-w-[150px]">
                  {stats?.mt5Connection?.lastPriceAt
                    ? new Date(stats.mt5Connection.lastPriceAt).toLocaleString('th-TH')
                    : 'ยังไม่มีราคาสด'}
                </span>
              </div>

              <div className="flex justify-between items-start text-xs border-t border-white/5 pt-2 font-mono">
                <span className="text-[10px] text-neutral-500">ซิงค์แท่งล่าสุด</span>
                <span className="text-neutral-300 font-medium text-right leading-relaxed max-w-[150px]">
                  {stats?.mt5Connection?.lastCandleSyncAt
                    ? new Date(stats.mt5Connection.lastCandleSyncAt).toLocaleString('th-TH')
                    : 'ยังไม่มีแท่งจาก MT5'}
                </span>
              </div>

              <div className="text-[10px] leading-relaxed text-neutral-400 border-t border-white/5 pt-3 space-y-2">
                {stats?.mt5Connection?.priceFeedLive && stats?.mt5Connection?.m5CandleSyncLive ? (
                  <p className="text-emerald-450 text-emerald-400 font-bold">
                    ✓ ระบบกำลังรับทั้งราคาสดและแท่ง M5 จาก MT5 แบบพร้อมใช้งาน
                  </p>
                ) : stats?.mt5Connection?.priceFeedLive && stats?.mt5Connection?.m15CandleSyncLive ? (
                  <p className="text-amber-400 font-bold">
                    ราคาสดเข้าอยู่ และ M15 ยัง sync อยู่ แต่แท่ง M5 ยังไม่สดพอสำหรับจุดเข้าออเดอร์
                  </p>
                ) : stats?.mt5Connection?.priceFeedLive && mainChartUsesHybridMt5 ? (
                  <p className="text-cyan-300 font-bold">
                    ราคาสดเข้าอยู่ กราฟใช้แท่ง MT5 ล่าสุดเป็นฐานและอัปเดตแท่งปัจจุบันด้วย tick จาก VPS
                  </p>
                ) : stats?.mt5Connection?.priceFeedLive ? (
                  <p className="text-amber-400 font-bold">
                    ราคาสดเข้าอยู่ แต่แท่งเทียนจาก MT5 ยังไม่ซิงค์ ระบบจึงวาดแท่งล่าสุดจาก tick ชั่วคราว
                  </p>
                ) : (
                  <>
                    <p className="text-rose-450 text-rose-400 font-bold">
                      ⚠️ สัญญาณขาดการซิงค์! ระบบกำลังใช้ราคาอ้างอิงสำรองชั่วคราว วิธีตรวจสอบแก้ไข:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-neutral-400 font-mono text-[9px]">
                      <li>ตรวจสอบว่าโปรแกรม MT5 บนคอมพิวเตอร์และกราฟทองคำเปิดอยู่</li>
                      <li>ตรวจสอบว่าใส่ EA <code className="text-amber-500 font-bold">MT5_Webhook_Sender</code> บนกราฟเรียบร้อย</li>
                      <li>ไปที่เมนู <code className="text-neutral-300">Tools &gt; Options &gt; Expert Advisors</code> ใน MT5</li>
                      <li>ติ๊กเลือก <code className="text-neutral-300">Allow WebRequest</code> และเพิ่ม URL: <br />
                        <code className="text-amber-400 select-all block bg-neutral-900 px-1 py-0.5 rounded border border-white/5 mt-1">https://goldaisig.com</code>
                      </li>
                      <li>ดูแถบ <code className="text-neutral-300">Journal / Experts</code> ใน MT5 ว่ารายงาน Error Code หรือไม่</li>
                    </ol>
                  </>
                )}
              </div>

              {/* Webhook Connection Log */}
              <div className="border-t border-white/5 pt-3 space-y-2">
                <span className="text-[10px] text-neutral-500 font-mono block">ประวัติการเชื่อมต่อล่าสุด</span>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {stats?.mt5Connection?.recentEvents && stats.mt5Connection.recentEvents.length > 0 ? (
                    stats.mt5Connection.recentEvents.map((event, idx) => {
                      let typeLabel = 'เว็บฮุก';
                      let typeColor = 'text-neutral-400 bg-neutral-900 border-white/5';
                      let detailText = '';

                      if (event.source === 'mt5_sync') {
                        typeLabel = 'ซิงค์แท่งเทียน';
                        typeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                        detailText = `ซิงค์ ${event.payload?.count ?? 0} แท่งเทียน`;
                      } else if (event.source === 'mt5_sync_error') {
                        typeLabel = 'ซิงค์ผิดพลาด';
                        typeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                        detailText = event.errorMessage || 'ซิงค์แท่งเทียนล้มเหลว';
                      } else if (event.source === 'tradingview') {
                        if (event.payload?.strategy === 'price_feed' || event.payload?.strategy === 'tick') {
                          typeLabel = 'ราคาสด';
                          typeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                          detailText = `${event.symbol} $${event.payload?.price?.toFixed(2) ?? 'N/A'}`;
                        } else {
                          const direction = event.payload?.direction || 'NONE';
                          typeLabel = `สัญญาณ: ${getDirectionLabel(direction)}`;
                          typeColor = direction === 'BUY'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold'
                            : direction === 'SELL'
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold'
                              : 'text-neutral-400 bg-neutral-900 border-white/5';
                          detailText = `${event.symbol} @ $${event.payload?.price?.toFixed(2) ?? 'N/A'}`;
                        }
                      }

                      const eventTime = new Date(event.receivedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      return (
                        <div key={event.id || idx} className="flex items-center justify-between text-[9px] font-mono bg-white/5 rounded border border-white/5 px-2 py-1.5 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-1 rounded border text-[8px] whitespace-nowrap ${typeColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-neutral-300 truncate font-semibold">
                              {detailText}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-neutral-500 text-[8px]">
                              {eventTime}
                            </span>
                            {event.status === 'processed' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="สำเร็จ" />
                            ) : event.status === 'rejected' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" title={`ถูกปฏิเสธ: ${event.errorMessage || ''}`} />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" title={`ล้มเหลว: ${event.errorMessage || ''}`} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[9px] text-neutral-600 block py-2 text-center font-mono">ไม่มีประวัติการเชื่อมต่อข้อมูล</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Zone Radar */}
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl">
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
              เรดาร์สแกนโซน
            </h2>
            
            <div className="space-y-4">
              {/* Resistances */}
              <div>
                <span className="text-[9px] text-rose-500 font-mono uppercase tracking-widest block mb-2">แนวต้านที่ใกล้ที่สุด / โซนรอขาย</span>
                {intelligence?.nearestResistance?.length ? intelligence.nearestResistance.map((z, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-mono bg-rose-500/5 border border-rose-500/10 rounded px-3 py-1.5 mb-1.5">
                    <span className="text-neutral-300">${z.priceMin?.toFixed(2) ?? '0.00'} - ${z.priceMax?.toFixed(2) ?? '0.00'}</span>
                    <span className="text-rose-400">ระยะ: +${(z.priceMin - (intelligence?.currentPrice || 0)).toFixed(2)}</span>
                  </div>
                )) : <span className="text-[10px] text-neutral-600">ไม่มีแนวต้านในระยะใกล้</span>}
              </div>

              {/* Current Price Line */}
              <div className="relative h-px bg-white/10 my-4">
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 bg-neutral-900 px-2 text-[10px] text-cyan-500 font-mono flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  ราคาปัจจุบัน
                </div>
              </div>

              {/* Supports */}
              <div>
                <span className="text-[9px] text-emerald-500 font-mono uppercase tracking-widest block mb-2 text-right">แนวรับที่ใกล้ที่สุด / โซนรอซื้อ</span>
                {intelligence?.nearestSupport?.length ? intelligence.nearestSupport.map((z, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-mono bg-emerald-500/5 border border-emerald-500/10 rounded px-3 py-1.5 mb-1.5">
                    <span className="text-neutral-300">${z.priceMin?.toFixed(2) ?? '0.00'} - ${z.priceMax?.toFixed(2) ?? '0.00'}</span>
                    <span className="text-emerald-400">ระยะ: -${((intelligence?.currentPrice || 0) - z.priceMax).toFixed(2)}</span>
                  </div>
                )) : <span className="text-[10px] text-neutral-600 text-right block">ไม่มีแนวรับในระยะใกล้</span>}
              </div>

              {/* Danger Zones */}
              {intelligence?.dangerZones && intelligence.dangerZones.length > 0 && (
                <div className="pt-3 border-t border-white/5 mt-3">
                  <span className="text-[9px] text-amber-500 font-mono uppercase tracking-widest flex items-center gap-1 mb-2">
                    <ShieldAlert className="h-3 w-3" /> โซนอันตราย (ระวังสวิงกิน Stoploss)
                  </span>
                  <div className="text-xs font-mono bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 text-amber-400">
                    ${intelligence.dangerZones[0]?.priceMin?.toFixed(2) ?? '0.00'} - ${intelligence.dangerZones[0]?.priceMax?.toFixed(2) ?? '0.00'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Proactive Plans & Active Trades */}
        <div className="lg:col-span-8 space-y-6">
          <ScalpingDecisionChart intelligence={intelligence} activeAsset={activeAsset} />
          
          {/* AI Proactive Planner */}
          <div className="bg-black/60 backdrop-blur-xl border border-indigo-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 relative overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.05)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
              <div className="space-y-2 min-w-0">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400 animate-pulse" />
                  Trade Assistant Plans
                </h2>
                <div className="flex flex-wrap gap-2 text-[9px] font-mono">
                  <span className="px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-bold">
                    แนะนำเฉพาะ {intelligence?.recommendationPolicy?.minConfidence || 70}%+
                  </span>
                  <span className="px-2 py-1 rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                    {latestResearchAt ? `Bot research: ${approvedResearchCount} ผ่าน` : 'Bot research ยังไม่รัน'}
                  </span>
                  {intelligence?.recommendationPolicy?.hiddenCandidates ? (
                    <span className="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-neutral-500">
                      ซ่อนแผนไม่ผ่านเกณฑ์ {intelligence.recommendationPolicy.hiddenCandidates}
                    </span>
                  ) : null}
                </div>
                {latestResearchAt && (
                  <p className="text-[10px] text-neutral-500 font-mono">วิจัยล่าสุด {latestResearchAt}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row xl:flex-col gap-2 xl:w-[260px]">
                <button
                  onClick={handleRunStrategyResearch}
                  disabled={researchStatus === 'running'}
                  className="min-h-11 px-3 py-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-cyan-500/15 disabled:opacity-60"
                >
                  <FlaskConical className={`h-4 w-4 ${researchStatus === 'running' ? 'animate-pulse' : ''}`} />
                  {researchStatus === 'running' ? 'กำลังวิจัย...' : 'ให้บอทวิจัยกลยุทธ์'}
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-1 rounded-lg bg-neutral-950/80 border border-white/5 p-1">
                  {planFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setPlanFilter(filter.value)}
                      className={`min-h-10 rounded-md px-2 text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                        planFilter === filter.value
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {filter.value === 'ALL' && <SlidersHorizontal className="h-3 w-3" />}
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleProactivePlans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {visibleProactivePlans.map((plan) => {
                  const isScalp = plan.strategyMode === 'SCALP' || plan.id.includes('scalp');
                  
                  // Check proximity to entry (within $1.50)
                  const isNearEntry = (intelligence?.currentPrice || 0) > 0 && Math.abs((intelligence?.currentPrice || 0) - plan.entry) <= 1.50;

                  const planTime = plan.lockedAt || plan.createdAt;
                  const timeText = planTime ? new Date(planTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';

                  return (
                    <div 
                      key={plan.id} 
                      className={`group rounded-xl p-3.5 sm:p-5 transition-all duration-300 border relative overflow-hidden ${
                        isNearEntry
                          ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)] hover:border-emerald-400'
                          : isScalp 
                            ? 'bg-gradient-to-br from-amber-500/15 via-neutral-950/95 to-orange-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                            : 'bg-neutral-900/50 border-white/5 hover:border-purple-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        {isScalp ? (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse">
                            เก็งกำไรสั้น
                          </span>
                        ) : (
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                            plan.type.includes('BUY') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {getPlanTypeLabel(plan.type)}
                          </span>
                        )}
                        <div className="text-right flex items-center gap-1.5">
                          {timeText && (
                            <span className="text-[9px] text-neutral-500 font-mono flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {timeText}
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isScalp ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20' : 'text-indigo-300 bg-indigo-500/10'
                          }`}>
                            ความมั่นใจ {plan.confidence}%
                          </span>
                        </div>
                      </div>

                      <h3 className={`text-sm font-bold mb-2 ${isScalp ? 'text-amber-400 font-extrabold' : 'text-neutral-100'} flex items-center gap-2`}>
                        {plan.title}
                        {isNearEntry && (
                          <span className="animate-pulse bg-emerald-500/20 text-emerald-400 text-[8.5px] px-1.5 py-0.5 rounded font-black font-mono border border-emerald-500/30 uppercase">
                            Entry 🎯
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[8.5px] font-mono">
                        {plan.strategyLabel && (
                          <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-neutral-300">
                            {plan.strategyLabel}
                          </span>
                        )}
                        {plan.locked && (
                          <span className="px-2 py-0.5 rounded border border-emerald-500/15 bg-emerald-500/10 text-emerald-300">
                            แผนหลักล็อกไว้
                          </span>
                        )}
                        {plan.confirmation && (
                          <span className="px-2 py-0.5 rounded border border-cyan-500/15 bg-cyan-500/10 text-cyan-300">
                            {plan.confirmation}
                          </span>
                        )}
                        {typeof plan.researchWinRate === 'number' && (
                          <span className="px-2 py-0.5 rounded border border-emerald-500/15 bg-emerald-500/10 text-emerald-300">
                            Bot WR {plan.researchWinRate}%
                          </span>
                        )}
                        {plan.pointStopLoss && (
                          <span className="px-2 py-0.5 rounded border border-rose-500/15 bg-rose-500/10 text-rose-300">
                            SL {plan.pointStopLoss} จุด
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mb-4 leading-relaxed ${isScalp ? 'text-neutral-200' : 'text-neutral-400'}`}>
                        {plan.reason}
                      </p>
                      
                      {plan.type !== 'WAIT' ? (
                        <div className="space-y-2 mb-4 font-mono text-xs">
                          {/* 3 Entry Points */}
                          <div className={`rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 border ${isScalp ? 'bg-amber-500/10 border-amber-500/20' : 'bg-black/40 border-white/5'} space-y-1 sm:space-y-1.5`}>
                            <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider block">แนวจุดเข้าแนะนำ 3 ระดับ</span>
                            <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px]">
                              <div className="bg-black/25 rounded p-1 sm:p-1.5">
                                <span className="text-[7.5px] sm:text-[8px] text-neutral-500 block mb-0.5">จุดเข้า 1</span>
                                <span className="text-neutral-200 font-bold">${plan.entry1?.toFixed(2) ?? plan.entry?.toFixed(2) ?? '0.00'}</span>
                              </div>
                              <div className="bg-amber-500/5 rounded p-1 sm:p-1.5 border border-amber-500/15">
                                <span className="text-[7.5px] sm:text-[8px] text-amber-400/80 block mb-0.5">จุดเข้า 2 แนะนำ</span>
                                <span className="text-amber-400 font-black">${plan.entry2?.toFixed(2) ?? '0.00'}</span>
                              </div>
                              <div className="bg-emerald-500/5 rounded p-1 sm:p-1.5 border border-emerald-500/15">
                                <span className="text-[7.5px] sm:text-[8px] text-emerald-400/80 block mb-0.5">จุดเข้า 3 ดีสุด</span>
                                <span className="text-emerald-400 font-black">${plan.entry3?.toFixed(2) ?? '0.00'}</span>
                              </div>
                            </div>
                          </div>

                          {/* SL / TP Row */}
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-center">
                            <div className="bg-rose-950/20 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 border border-rose-500/10">
                              <span className="text-[7.5px] sm:text-[8px] text-rose-500 block mb-0.5">จุดตัดขาดทุน</span>
                              <span className="text-rose-400 font-bold">${plan.stopLoss?.toFixed(2) ?? '0.00'}</span>
                            </div>
                            <div className="bg-emerald-950/20 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 border border-emerald-500/10">
                              <span className="text-[7.5px] sm:text-[8px] text-emerald-500 block mb-0.5">จุดทำกำไร</span>
                              <span className="text-emerald-400 font-bold">${plan.takeProfit?.toFixed(2) ?? '0.00'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 text-center text-xs font-medium text-neutral-400 mb-4">
                          ⚠️ โปรดรอจังหวะราคาย่อตัวและเฝ้าสังเกตการณ์แนวรับถัดไป
                        </div>
                      )}
                      {plan.type !== 'WAIT' && (
                        <button
                          onClick={() => handleCreateProactivePlan(plan)}
                          disabled={savingPlanId === plan.id}
                          className="min-h-11 w-full rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {savingPlanId === plan.id ? 'กำลังบันทึก...' : 'บันทึกแผนนี้ไว้ใช้'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-[10px] font-mono text-neutral-500 border border-white/5 rounded-xl bg-neutral-950/50">
                ไม่มีแผนที่ผ่านตัวกรอง {planFilter === 'ALL' ? '70%+' : planFilters.find((filter) => filter.value === planFilter)?.label} ตอนนี้
              </div>
            )}

            {/* Speculative High-Risk Plans */}
            {visibleSpeculativePlans.length > 0 && (
              <div className="mt-8 border-t border-neutral-900/50 pt-6 space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Flame className="h-4.5 w-4.5 text-amber-500/80 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      ⚡ แผนทางเลือกความเสี่ยงสูง (Speculative High-Risk Candidates)
                    </h3>
                    <p className="text-[9px] text-neutral-500 leading-relaxed font-sans mt-0.5">
                      แผนเก็งกำไรความมั่นใจปานกลาง (50%-64%) หรือระบบที่กำลังวิจัยเก็บสถิติย้อนหลัง
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {visibleSpeculativePlans.map((plan) => {
                    const isScalp = plan.strategyMode === 'SCALP' || plan.id.includes('scalp');
                    const isBuy = plan.type.includes('BUY') || plan.direction === 'BUY';
                    const isNearEntry = (intelligence?.currentPrice || 0) > 0 && Math.abs((intelligence?.currentPrice || 0) - plan.entry) <= 1.50;
                    
                    const planTime = plan.lockedAt || plan.createdAt;
                    const timeText = planTime ? new Date(planTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';

                    return (
                      <div 
                        key={plan.id} 
                        className={`group rounded-xl p-3.5 sm:p-5 transition-all duration-300 border relative overflow-hidden ${
                          isNearEntry 
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.08)] hover:border-emerald-400' 
                            : 'bg-neutral-900/30 border-white/5 hover:border-purple-500/20'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isBuy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {getPlanTypeLabel(plan.type)}
                          </span>
                          <div className="text-right flex items-center gap-1.5">
                            {timeText && (
                              <span className="text-[9px] text-neutral-500 font-mono flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {timeText}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/5 border border-amber-500/15">
                              มั่นใจ {plan.confidence}%
                            </span>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold mb-2 text-neutral-100 flex items-center gap-2">
                          {plan.title}
                          {isNearEntry && (
                            <span className="animate-pulse bg-emerald-500/20 text-emerald-400 text-[8.5px] px-1.5 py-0.5 rounded font-black font-mono border border-emerald-500/30 uppercase">
                              Entry 🎯
                            </span>
                          )}
                        </h3>
                        
                        <p className="text-xs mb-4 leading-relaxed text-neutral-400">
                          {plan.reason}
                        </p>
                        
                        {plan.type !== 'WAIT' ? (
                          <div className="space-y-2 mb-4 font-mono text-xs">
                            <div className="rounded-xl px-2 py-1.5 border bg-black/40 border-white/5 space-y-1">
                              <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider block">แนวจุดเข้าแนะนำ 3 ระดับ</span>
                              <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                                <div className="bg-black/25 rounded p-1">
                                  <span className="text-[7.5px] text-neutral-500 block mb-0.5">จุดเข้า 1</span>
                                  <span className="text-neutral-200 font-bold">${plan.entry1?.toFixed(2) ?? plan.entry?.toFixed(2) ?? '0.00'}</span>
                                </div>
                                <div className="bg-amber-500/5 rounded p-1 border border-amber-500/15">
                                  <span className="text-[7.5px] text-amber-400/80 block mb-0.5">จุดเข้า 2 แนะนำ</span>
                                  <span className="text-amber-400 font-black">${plan.entry2?.toFixed(2) ?? '0.00'}</span>
                                </div>
                                <div className="bg-emerald-500/5 rounded p-1 border border-emerald-500/15">
                                  <span className="text-[7.5px] text-emerald-400/80 block mb-0.5">จุดเข้า 3 ดีสุด</span>
                                  <span className="text-emerald-400 font-black">${plan.entry3?.toFixed(2) ?? '0.00'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="bg-rose-950/20 rounded-xl px-2 py-1.5 border border-rose-500/10">
                                <span className="text-[7.5px] text-rose-500 block mb-0.5">จุดตัดขาดทุน</span>
                                <span className="text-rose-400 font-bold">${plan.stopLoss?.toFixed(2) ?? '0.00'}</span>
                              </div>
                              <div className="bg-emerald-950/20 rounded-xl px-2 py-1.5 border border-emerald-500/10">
                                <span className="text-[7.5px] text-emerald-500 block mb-0.5">จุดทำกำไร</span>
                                <span className="text-emerald-400 font-bold">${plan.takeProfit?.toFixed(2) ?? '0.00'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 text-center text-xs font-medium text-neutral-400 mb-4">
                            ⚠️ โปรดรอจังหวะราคาย่อตัวและเฝ้าสังเกตการณ์แนวรับถัดไป
                          </div>
                        )}
                        
                        {plan.type !== 'WAIT' && (
                          <button
                            onClick={() => handleCreateProactivePlan(plan)}
                            disabled={savingPlanId === plan.id}
                            className={`min-h-11 w-full rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 border transition-all ${
                              isNearEntry 
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-md' 
                                : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Save className="h-4 w-4" />
                            {savingPlanId === plan.id ? 'กำลังบันทึก...' : 'บันทึกแผนนี้ไว้ใช้'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-black/50 border border-emerald-500/15 rounded-xl sm:rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  แผนที่บันทึกไว้
                </h2>
                <span className="text-[10px] text-neutral-500 font-mono">{stats?.suggestedPlansCount || 0} แผน</span>
              </div>

              <div className="space-y-2">
                {stats?.suggestedPlans?.length ? stats.suggestedPlans.slice(0, 4).map((trade) => (
                  <div key={trade.id} className="rounded-lg border border-white/5 bg-neutral-950/70 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded border ${
                            trade.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          }`}>
                            {getDirectionLabel(trade.direction)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400">{trade.symbol}</span>
                          <span className="px-1.5 py-0.5 rounded border border-indigo-500/20 text-indigo-300">
                            {trade.signal?.confidence ?? 0}%
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border ${getTradeResultClass(trade.result)}`}>
                            {getTradeResultLabel(trade.result)}
                          </span>
                        </div>
                        <div className="font-mono text-neutral-200">
                          เข้า ${formatPrice(trade.entry)} / SL ${formatPrice(trade.stopLoss)}
                        </div>
                        <div className="font-mono text-emerald-300">TP ${formatPrice(trade.takeProfit1)}</div>
                        <div className="text-[9px] text-neutral-500 font-mono">
                          {trade.result === 'TESTING' ? 'ระบบจะปิดผลเองเมื่อชน TP/SL และส่งผลกลับไปปรับ bot' : 'กดเริ่มทดสอบเพื่อเก็บผล TP/SL'}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {trade.result === 'PLAN' && (
                          <button
                            onClick={() => handleStartPlanTest(trade.id)}
                            className="min-h-10 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-[10px] font-bold text-amber-300 hover:bg-amber-500/15 flex items-center justify-center gap-1.5"
                          >
                            <FlaskConical className="h-3.5 w-3.5" />
                            ทดสอบ
                          </button>
                        )}
                        {trade.result === 'TESTING' && (
                          <button
                            onClick={() => handleApprovePlan(trade.id)}
                            className="min-h-10 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/15 flex items-center justify-center gap-1.5"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            ใช้จริง
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-white/5 bg-neutral-950/60 p-4 text-center text-[10px] text-neutral-500 font-mono">
                    ยังไม่มีแผนที่บันทึกไว้
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/50 border border-cyan-500/15 rounded-xl sm:rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  กำลังติดตาม
                </h2>
                <span className="text-[10px] text-neutral-500 font-mono">{stats?.openTradesCount || 0} ไม้</span>
              </div>

              <div className="space-y-2">
                {stats?.openTrades?.length ? stats.openTrades.slice(0, 4).map((trade) => (
                  <div key={trade.id} className="rounded-lg border border-white/5 bg-neutral-950/70 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded border ${
                            trade.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          }`}>
                            {getDirectionLabel(trade.direction)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300">OPEN</span>
                        </div>
                        <div className="font-mono text-neutral-200">เข้า ${formatPrice(trade.entry)}</div>
                        <div className="font-mono text-neutral-500">SL ${formatPrice(trade.stopLoss)} / TP ${formatPrice(trade.takeProfit1)}</div>
                      </div>
                      <button
                        onClick={() => handleCloseTrade(trade.id, intelligence?.currentPrice || trade.entry)}
                        disabled={closingTradeId === trade.id}
                        className="min-h-10 shrink-0 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 text-[10px] font-bold text-rose-300 hover:bg-rose-500/15 disabled:opacity-60"
                      >
                        ปิดที่ราคานี้
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-white/5 bg-neutral-950/60 p-4 text-center text-[10px] text-neutral-500 font-mono">
                    ยังไม่มีไม้ที่กำลังติดตาม
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/50 border border-purple-500/15 rounded-xl sm:rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  ผลทดสอบ TP/SL ล่าสุด
                </h2>
                <span className="text-[10px] text-neutral-500 font-mono">{stats?.recentPlanResults?.length || 0} ผล</span>
              </div>

              <div className="space-y-2">
                {stats?.recentPlanResults?.length ? stats.recentPlanResults.slice(0, 5).map((trade) => (
                  <div key={trade.id} className="rounded-lg border border-white/5 bg-neutral-950/70 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded border ${getTradeResultClass(trade.result)}`}>
                            {getTradeResultLabel(trade.result)}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border ${
                            trade.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          }`}>
                            {getDirectionLabel(trade.direction)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400">{trade.symbol}</span>
                        </div>
                        <div className="font-mono text-neutral-200">
                          เข้า ${formatPrice(trade.entry)} / ออก ${formatPrice(trade.exitPrice || trade.entry)}
                        </div>
	                        <div className={`${(trade.exitPrice ? (trade.direction === 'BUY' ? trade.exitPrice - trade.entry : trade.entry - trade.exitPrice) : 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold leading-relaxed`}>
	                          {formatRiskResultLabel(trade)}
	                        </div>
	                        <div className="font-mono text-[9px] text-neutral-500">
	                          คำนวณระยะกำไรขาดทุนเป็นจุดทองคำ
	                        </div>
	                      </div>
                      <div className="text-right text-[9px] text-neutral-500 font-mono shrink-0">
                        {trade.closedAt ? new Date(trade.closedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-white/5 bg-neutral-950/60 p-4 text-center text-[10px] text-neutral-500 font-mono">
                    ยังไม่มีผลทดสอบ TP/SL
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time High Confidence Alert Dialog */}
      {activeAlertSignal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className={`relative max-w-sm w-full bg-neutral-900/95 border rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden ${
            activeAlertSignal.direction === 'BUY'
              ? 'border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
              : 'border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.25)]'
          }`}>
            <div className={`absolute -inset-10 opacity-10 blur-[40px] pointer-events-none rounded-full ${
              activeAlertSignal.direction === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
            
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  activeAlertSignal.direction === 'BUY' ? 'bg-emerald-400' : 'bg-rose-550'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  activeAlertSignal.direction === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-amber-400">
                🚨 สัญญาณเข้าเทรดความมั่นใจสูง!
              </span>
            </div>

            <div className="flex justify-between items-baseline mb-2">
              <h3 className="text-xl font-black text-white font-mono tracking-wide flex items-center gap-2">
                XAUUSD <span className="text-neutral-500 text-xs font-normal">({activeAlertSignal.timeframe})</span>
              </h3>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                activeAlertSignal.direction === 'BUY'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}>
                CONFIDENCE: {activeAlertSignal.confidence}%
              </span>
            </div>

            <div className="text-center py-2">
              <div className={`text-6xl font-black tracking-wider uppercase font-mono drop-shadow-lg ${
                activeAlertSignal.direction === 'BUY'
                  ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              }`}>
                {activeAlertSignal.direction}
              </div>
            </div>

            <div className="space-y-1.5 font-mono text-xs text-neutral-300 mt-2 bg-neutral-950/40 border border-neutral-900 rounded-2xl p-4">
              <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">จุดเข้าเทรด (Entry)</span>
                <span className="font-bold text-neutral-100">${activeAlertSignal.entry.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-900 py-1.5">
                <span className="text-neutral-500">Stop Loss (SL)</span>
                <span className="font-bold text-rose-450">
                  ${activeAlertSignal.stopLoss.toFixed(2)} ({Math.round(Math.abs(activeAlertSignal.entry - activeAlertSignal.stopLoss) * 100)} จุด)
                </span>
              </div>
              <div className="flex justify-between border-b border-neutral-900 py-1.5">
                <span className="text-neutral-500">Take Profit 1 (TP1)</span>
                <span className="font-bold text-emerald-400">
                  ${activeAlertSignal.takeProfit1.toFixed(2)} ({Math.round(Math.abs(activeAlertSignal.takeProfit1 - activeAlertSignal.entry) * 100)} จุด)
                </span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-neutral-500">Take Profit 2 (TP2)</span>
                <span className="font-bold text-emerald-400">
                  ${activeAlertSignal.takeProfit2.toFixed(2)} ({Math.round(Math.abs(activeAlertSignal.takeProfit2 - activeAlertSignal.entry) * 100)} จุด)
                </span>
              </div>
            </div>

            {/* Trade Reasons */}
            <div className="mt-3 bg-neutral-950/20 border border-neutral-900/50 rounded-2xl p-4 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2 font-mono">
                เหตุผลการเข้าเทรด:
              </span>
              <ul className="space-y-1.5 list-none pl-0">
                {parseTechnicalReasons(
                  activeAlertSignal.reason,
                  activeAlertSignal.direction,
                  activeAlertSignal.timeframe
                ).map((r, idx) => (
                  <li key={idx} className="text-[10.5px] text-neutral-200 leading-relaxed flex items-start gap-1.5 font-sans">
                    <span className={`shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full ${
                      activeAlertSignal.direction === 'BUY' ? 'bg-emerald-400' : 'bg-rose-450'
                    }`}></span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <SignalGraphPlotter 
              entry={activeAlertSignal.entry}
              stopLoss={activeAlertSignal.stopLoss}
              takeProfit1={activeAlertSignal.takeProfit1}
              takeProfit2={activeAlertSignal.takeProfit2}
              direction={activeAlertSignal.direction}
            />

            <button
              onClick={() => setActiveAlertSignal(null)}
              className={`w-full py-3 rounded-2xl font-bold text-xs uppercase cursor-pointer transition-all border mt-4 ${
                activeAlertSignal.direction === 'BUY'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
              }`}
            >
              รับทราบสัญญาณซื้อขาย
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
