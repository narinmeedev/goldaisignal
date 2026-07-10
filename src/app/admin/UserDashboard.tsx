'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  ChevronRight,
  Trophy,
  BarChart3,
  Clock,
  Flame,
  Eye,
  Minus,
  MessageCircle,
} from 'lucide-react';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';

/* ─── Shared Types ──────────────────────────────────────────────────────────── */

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
  direction?: 'BUY' | 'SELL';
  locked?: boolean;
  lockedAt?: string;
  lockedUntil?: string;
  researchStatus?: string;
  researchWinRate?: number | null;
  researchSampleSize?: number;
  createdAt?: string;
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
  fundamentalBias?: string;
  fundamentalWarning?: string;
  timeframeBiases?: {
    D1: string;
    H1: string;
    M5?: string;
    M15: string;
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
    latestTargetHits: any[];
    latestStopLosses: any[];
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
  };
}

type Mt5RealtimeState = 'LIVE' | 'PRICE_ONLY' | 'CANDLE_ONLY' | 'OFFLINE';

interface Mt5RealtimeStatus {
  state: Mt5RealtimeState;
  label: string;
  message: string;
  checkedAt: string;
  priceFeed?: {
    live: boolean;
    ageMs?: number | null;
    receivedAt?: string | null;
    price?: number | null;
  };
  m5CandleSync?: {
    live: boolean;
    ageMs?: number | null;
    receivedAt?: string | null;
    count?: number | null;
    latestCandleAt?: string | null;
  };
  m15CandleSync?: {
    live: boolean;
    ageMs?: number | null;
    receivedAt?: string | null;
    count?: number | null;
  };
}

interface Stats {
  ownerMetrics?: OwnerMetrics;
  marketIntelligence: Record<string, MarketIntelligence>;
  mt5Connection?: {
    isLive: boolean;
    priceFeedLive?: boolean;
    candleSyncLive?: boolean;
    m5CandleSyncLive?: boolean;
    m15CandleSyncLive?: boolean;
    lastPriceAt?: string | null;
    lastM5CandleSyncAt?: string | null;
    lastM15CandleSyncAt?: string | null;
    priceFeedAgeMs?: number | null;
    m5CandleSyncAgeMs?: number | null;
    m15CandleSyncAgeMs?: number | null;
    lastPrice?: number | null;
    latestM5CandleCount?: number | null;
    latestM15CandleCount?: number | null;
    realtimeStatus?: Mt5RealtimeStatus;
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

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

const getTrendLabel = (trend?: string) => {
  if (trend === 'BULLISH') return 'ขาขึ้น';
  if (trend === 'BEARISH') return 'ขาลง';
  if (trend === 'WAIT_AND_SEE') return 'รอดูจังหวะ';
  return 'เป็นกลาง';
};

const getTrendIcon = (trend?: string) => {
  if (trend === 'BULLISH') return <TrendingUp className="h-4 w-4" />;
  if (trend === 'BEARISH') return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
};

const getTrendColor = (trend?: string) => {
  if (trend === 'BULLISH') return 'text-emerald-400';
  if (trend === 'BEARISH') return 'text-rose-400';
  return 'text-neutral-400';
};

const getDirectionLabel = (direction?: string) => {
  if (direction === 'BUY') return 'ซื้อ';
  if (direction === 'SELL') return 'ขาย';
  if (direction === 'NO_TRADE' || direction === 'WAIT') return 'รอจังหวะ';
  return 'รอสัญญาณ';
};

const getSignalTone = (direction?: string) => {
  if (direction === 'BUY') return {
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/8',
    badge: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
    text: 'text-emerald-300',
  };
  if (direction === 'SELL') return {
    border: 'border-rose-500/25',
    bg: 'bg-rose-500/8',
    badge: 'border-rose-500/25 bg-rose-500/15 text-rose-300',
    text: 'text-rose-300',
  };
  return {
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/8',
    badge: 'border-amber-500/25 bg-amber-500/15 text-amber-300',
    text: 'text-amber-300',
  };
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

    if (reason.zoneHit) {
      const zoneType = reason.zoneHit.type === 'SUPPORT' ? 'demand zone' : 'supply zone';
      points.push(`ราคาชน ${zoneType} บริเวณ ${timeframe}`);
    } else if (reason.fallbackSeeding) {
      points.push('ระบบเริ่มต้นใหม่ (Cold-start): รอสะสมกำลังสร้างฐานราคา');
    } else {
      const zoneName = direction === 'BUY' ? 'demand zone' : 'supply zone';
      points.push(`ราคาเคลื่อนไหวเข้าใกล้ ${zoneName} สำคัญ`);
    }

    if (reason.trendAligned === true) {
      points.push(`แนวโน้มสอดคล้องกับเทรนด์หลัก H4 (${direction === 'BUY' ? 'ขาขึ้น BULLISH' : 'ขาลง BEARISH'})`);
    } else if (reason.trendAligned === false) {
      points.push(`สัญญาณสวนเทรนด์หลัก H4 (${direction === 'BUY' ? 'เทรนด์หลักยังเป็นขาลง' : 'เทรนด์หลักยังเป็นขาขึ้น'})`);
    }

    if (reason.overboughtAlert || (reason.rsi14 && reason.rsi14 > 70)) {
      points.push(`RSI เริ่มอ่อนแรง (${Math.round(reason.rsi14 || 70)} > 70)`);
    } else if (reason.oversoldAlert || (reason.rsi14 && reason.rsi14 < 30)) {
      points.push(`RSI เริ่มพยุงตัวกลับขึ้น (${Math.round(reason.rsi14 || 30)} < 30)`);
    } else if (reason.rsi14) {
      points.push(`RSI พร้อมกลับตัว (ค่าปัจจุบัน ${Math.round(reason.rsi14)})`);
    }

    if (direction === 'SELL' || direction === 'Wait') {
      points.push(`โครงสร้าง ${timeframe} ทำ lower high`);
    } else {
      points.push(`โครงสร้าง ${timeframe} ทำ higher low`);
    }

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
    playTone(523.25, 0, 0.4);
    playTone(659.25, 0.15, 0.5);
    playTone(783.99, 0.3, 0.6);
  } catch (err) {
    console.error('AudioContext alert failed:', err);
  }
};

/* ─── Confidence Ring SVG ───────────────────────────────────────────────────── */

function ConfidenceRing({ value, size = 72, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#262626" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black font-mono text-white leading-none">{value}%</span>
      </div>
    </div>
  );
}

/* ─── Signal Graph Plotter (mini version) ───────────────────────────────────── */

function MiniSignalGraph({ entry, stopLoss, takeProfit1, takeProfit2, direction }: {
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null; direction: string;
}) {
  const hasTP2 = typeof takeProfit2 === 'number' && Number.isFinite(takeProfit2) && takeProfit2 > 0;
  const values = [entry, stopLoss, takeProfit1];
  const hasValidLevels = values.every((value) => Number.isFinite(value) && value > 0);

  if (!hasValidLevels) {
    return (
      <div className="w-full rounded-xl border border-neutral-800/50 bg-neutral-950/60 p-3 font-mono text-[10px]">
        <div className="text-center text-[9px] uppercase tracking-wider text-neutral-500">ผังเป้าหมาย TP / SL</div>
        <div className="mt-3 rounded-lg border border-dashed border-neutral-700/70 bg-neutral-900/40 px-3 py-6 text-center">
          <div className="text-xs font-bold text-neutral-300">รอแผนที่พร้อม plot จุดเข้า</div>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
            เมื่อมี Entry, TP และ SL ที่ผ่านเกณฑ์ ระบบจะแสดงผังเป้าหมายตรงนี้ทันที
          </p>
        </div>
      </div>
    );
  }

  const isBuy = direction === 'BUY';
  const extremeTarget = hasTP2 ? takeProfit2! : takeProfit1;
  const minVal = isBuy ? stopLoss : extremeTarget;
  const maxVal = isBuy ? extremeTarget : stopLoss;
  const range = maxVal - minVal;
  
  const getY = (val: number) => {
    if (range === 0) return 50;
    const pct = ((val - minVal) / range) * 80 + 10;
    return 100 - pct;
  };

  const levels = [
    { key: 'sl', label: 'SL', value: stopLoss, y: getY(stopLoss), color: '#f43f5e', dash: '3 3', weight: 1.5 },
    { key: 'entry', label: 'ENTRY', value: entry, y: getY(entry), color: '#06b6d4', dash: '', weight: 2.5 },
    { key: 'tp1', label: 'TP1', value: takeProfit1, y: getY(takeProfit1), color: '#10b981', dash: '3 3', weight: 1.5 },
  ];

  if (hasTP2) {
    levels.push({ key: 'tp2', label: 'TP2', value: takeProfit2!, y: getY(takeProfit2!), color: '#22c55e', dash: '3 3', weight: 1.5 });
  }

  return (
    <div className="w-full rounded-xl border border-neutral-800/50 bg-neutral-950/60 p-3 font-mono text-[10px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[9px] uppercase tracking-wider text-neutral-500">ผังเป้าหมาย TP / SL</div>
        <div className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[9px] text-neutral-400">
          {direction === 'SELL' ? 'Sell setup' : 'Buy setup'}
        </div>
      </div>
      <div className="relative h-36 rounded-lg border border-white/5 bg-black/25">
        <svg className="h-full w-full" viewBox="0 0 320 130" preserveAspectRatio="none" aria-label="ผังเป้าหมาย TP SL">
          <line x1="140" y1="8" x2="140" y2="122" stroke="#262626" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="58" y1="65" x2="262" y2="65" stroke="#171717" strokeWidth="1" strokeDasharray="4 4" />
          {levels.map((level) => (
            <g key={level.key}>
              <line
                x1="70"
                y1={level.y}
                x2="250"
                y2={level.y}
                stroke={level.color}
                strokeWidth={level.weight}
                strokeDasharray={level.dash}
              />
              <circle cx="140" cy={level.y} r={level.key === 'entry' ? '4' : '3'} fill={level.color} />
              <text x="18" y={level.y + 3} fill={level.color} fontSize="9" fontWeight="700">
                {level.label}
              </text>
              <text x="260" y={level.y + 3} fill={level.key === 'entry' ? '#f5f5f5' : '#a3a3a3'} fontSize="8">
                {level.value.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className={`mt-2 grid ${hasTP2 ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 text-[9px]`}>
        <div className="rounded border border-cyan-500/15 bg-cyan-500/10 px-2 py-1 text-cyan-300">Entry ${formatPrice(entry)}</div>
        <div className="rounded border border-rose-500/15 bg-rose-500/10 px-2 py-1 text-rose-300">SL ${formatPrice(stopLoss)}</div>
        <div className="rounded border border-emerald-500/15 bg-emerald-500/10 px-2 py-1 text-emerald-300">TP1 ${formatPrice(takeProfit1)}</div>
        {hasTP2 && (
          <div className="rounded border border-emerald-500/15 bg-emerald-500/10 px-2 py-1 text-emerald-300">TP2 ${formatPrice(takeProfit2)}</div>
        )}
      </div>
    </div>
  );
}

/* ─── MT5 + Signal Status Cards ─────────────────────────────────────────────── */

function Mt5RealtimeStatusCard({ stats, currentPrice }: {
  stats: Stats | null;
  currentPrice: number;
}) {
  const connection = stats?.mt5Connection;
  const realtime = connection?.realtimeStatus;
  const state: Mt5RealtimeState = realtime?.state || (
    connection?.priceFeedLive && connection?.m5CandleSyncLive
      ? 'LIVE'
      : connection?.priceFeedLive
        ? 'PRICE_ONLY'
        : connection?.m5CandleSyncLive
          ? 'CANDLE_ONLY'
          : 'OFFLINE'
  );
  const tone = state === 'LIVE'
    ? {
        panel: 'border-emerald-500/25 bg-emerald-500/8',
        badge: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
        dot: 'bg-emerald-400',
        text: 'text-emerald-200',
      }
    : state === 'PRICE_ONLY'
      ? {
          panel: 'border-amber-500/25 bg-amber-500/8',
          badge: 'border-amber-500/25 bg-amber-500/15 text-amber-300',
          dot: 'bg-amber-400',
          text: 'text-amber-200',
        }
      : state === 'CANDLE_ONLY'
        ? {
            panel: 'border-cyan-500/25 bg-cyan-500/8',
            badge: 'border-cyan-500/25 bg-cyan-500/15 text-cyan-300',
            dot: 'bg-cyan-400',
            text: 'text-cyan-200',
          }
        : {
            panel: 'border-rose-500/25 bg-rose-500/8',
            badge: 'border-rose-500/25 bg-rose-500/15 text-rose-300',
            dot: 'bg-rose-400',
            text: 'text-rose-200',
          };

  const priceFeed = {
    live: realtime?.priceFeed?.live ?? !!connection?.priceFeedLive,
    ageMs: realtime?.priceFeed?.ageMs ?? connection?.priceFeedAgeMs ?? null,
    receivedAt: realtime?.priceFeed?.receivedAt ?? connection?.lastPriceAt ?? null,
    price: realtime?.priceFeed?.price ?? connection?.lastPrice ?? currentPrice,
  };
  const m5Sync = {
    live: realtime?.m5CandleSync?.live ?? !!connection?.m5CandleSyncLive,
    ageMs: realtime?.m5CandleSync?.ageMs ?? connection?.m5CandleSyncAgeMs ?? null,
    receivedAt: realtime?.m5CandleSync?.receivedAt ?? connection?.lastM5CandleSyncAt ?? null,
    count: realtime?.m5CandleSync?.count ?? connection?.latestM5CandleCount ?? null,
    latestCandleAt: realtime?.m5CandleSync?.latestCandleAt ?? null,
  };
  const m15Sync = {
    live: realtime?.m15CandleSync?.live ?? !!connection?.m15CandleSyncLive,
    ageMs: realtime?.m15CandleSync?.ageMs ?? connection?.m15CandleSyncAgeMs ?? null,
    receivedAt: realtime?.m15CandleSync?.receivedAt ?? connection?.lastM15CandleSyncAt ?? null,
    count: realtime?.m15CandleSync?.count ?? connection?.latestM15CandleCount ?? null,
  };
  const label = realtime?.label || (
    state === 'LIVE'
      ? 'รับค่าปกติ'
      : state === 'PRICE_ONLY'
        ? 'รับราคาอยู่ / M5 ยังไม่สด'
        : state === 'CANDLE_ONLY'
          ? 'รับแท่ง M5 อยู่ / รอราคาสด'
          : 'ยังไม่รับค่าล่าสุด'
  );

  return (
    <div className={`rounded-2xl border p-4 ${tone.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            สถานะรับค่าจาก MT5
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold ${tone.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${state !== 'OFFLINE' ? 'animate-pulse' : ''}`} />
              {label}
            </span>
            <span className="font-mono text-[10px] text-neutral-500">
              ตรวจล่าสุด {formatTime(realtime?.checkedAt)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-500">ราคาสด</div>
          <div className="text-lg font-black font-mono text-amber-400">${formatPrice(priceFeed.price)}</div>
        </div>
      </div>

      <p className={`mt-3 text-xs leading-relaxed ${tone.text}`}>
        {realtime?.message || 'กำลังตรวจสถานะจาก webhook ล่าสุดของ MT5'}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/5 bg-black/20 p-2">
          <div className="text-[9px] font-mono text-neutral-500">ราคา</div>
          <div className={priceFeed.live ? 'text-[10px] font-bold text-emerald-300' : 'text-[10px] font-bold text-rose-300'}>
            {priceFeed.live ? 'สด' : 'ขาดช่วง'}
          </div>
          <div className="mt-1 text-[9px] font-mono text-neutral-500">{formatAge(priceFeed.ageMs)}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/20 p-2">
          <div className="text-[9px] font-mono text-neutral-500">M5</div>
          <div className={m5Sync.live ? 'text-[10px] font-bold text-emerald-300' : 'text-[10px] font-bold text-amber-300'}>
            {m5Sync.live ? 'sync' : 'ไม่สด'}
          </div>
          <div className="mt-1 text-[9px] font-mono text-neutral-500">{formatAge(m5Sync.ageMs)}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/20 p-2">
          <div className="text-[9px] font-mono text-neutral-500">M15</div>
          <div className={m15Sync.live ? 'text-[10px] font-bold text-cyan-300' : 'text-[10px] font-bold text-neutral-400'}>
            {m15Sync.live ? 'พร้อมใช้' : 'รอ sync'}
          </div>
          <div className="mt-1 text-[9px] font-mono text-neutral-500">{formatAge(m15Sync.ageMs)}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-neutral-500">
        <span>ราคา {formatTime(priceFeed.receivedAt)}</span>
        <span>M5 {typeof m5Sync.count === 'number' ? `${m5Sync.count} แท่ง` : formatTime(m5Sync.latestCandleAt || m5Sync.receivedAt)}</span>
        <span>M15 {typeof m15Sync.count === 'number' ? `${m15Sync.count} แท่ง` : formatTime(m15Sync.receivedAt)}</span>
      </div>
    </div>
  );
}

function LatestSignalStatusCard({ signal, totalToday }: {
  signal: OwnerSignalSummary | null;
  totalToday: number;
}) {
  const direction = signal?.direction === 'NO_TRADE' ? 'WAIT' : signal?.direction;
  const tone = getSignalTone(direction);
  const isTradeSignal = direction === 'BUY' || direction === 'SELL';
  const reasons = signal
    ? parseTechnicalReasons(signal.reason, direction || 'WAIT', signal.timeframe).slice(0, 2)
    : [];

  return (
    <div className={`rounded-2xl border p-4 ${tone.border} ${tone.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            สัญญาณเทรดล่าสุด
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-2 py-1 text-[11px] font-black font-mono ${tone.badge}`}>
              {signal ? getDirectionLabel(direction) : 'ยังไม่มีสัญญาณวันนี้'}
            </span>
            {signal && (
              <span className="rounded-lg border border-neutral-700 bg-neutral-900/70 px-2 py-1 text-[10px] font-mono text-neutral-300">
                {signal.timeframe} · {signal.confidence}%
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-neutral-500">
          วันนี้ {totalToday} ครั้ง
          <div>{formatTime(signal?.createdAt)}</div>
        </div>
      </div>

      {signal ? (
        <div className="mt-3 space-y-3">
          {isTradeSignal ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-2">
                <div className="text-[9px] font-mono text-cyan-300/70">Entry</div>
                <div className="text-sm font-black font-mono text-cyan-300">${formatPrice(signal.entry)}</div>
              </div>
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-2">
                <div className="text-[9px] font-mono text-emerald-300/70">TP</div>
                <div className="text-sm font-black font-mono text-emerald-300">${formatPrice(signal.takeProfit1)}</div>
              </div>
              <div className="rounded-xl border border-rose-500/15 bg-rose-500/8 p-2">
                <div className="text-[9px] font-mono text-rose-300/70">SL</div>
                <div className="text-sm font-black font-mono text-rose-300">${formatPrice(signal.stopLoss)}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/15 bg-black/20 p-3 text-xs leading-relaxed text-amber-200">
              ยังไม่มีจุดเข้าออเดอร์ที่ผ่านเกณฑ์ ระบบจึงให้รอจังหวะก่อน
            </div>
          )}

          {reasons.length > 0 && (
            <div className="space-y-1.5">
              {reasons.map((reason, index) => (
                <div key={`${signal.id}-${index}`} className="text-[10px] leading-relaxed text-neutral-400">
                  {reason}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          วันนี้ยังไม่มีสัญญาณใหม่ ระบบจะแสดงจุดเข้า, TP และ SL ทันทีเมื่อ AI ส่งสัญญาณที่ผ่านเกณฑ์
        </p>
      )}
    </div>
  );
}

/* ─── Section 1: Trade Plan Hero ────────────────────────────────────────────── */

function TradePlanHero({ intelligence, latestSignal, currentPrice, onSimulateOrder }: {
  intelligence: MarketIntelligence | null;
  latestSignal: OwnerSignalSummary | null;
  currentPrice: number;
  onSimulateOrder?: (order: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    timeframe: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    lotSize: number;
    confidence: number;
  }) => void;
}) {
  // Use the active order plan or the latest signal for the trade plan
  const plan = intelligence?.activeOrderPlan;
  const signal = latestSignal;
  
  // Determine the primary trade plan source
  const hasPlan = plan && plan.locked;
  const hasSignal = signal && (signal.direction === 'BUY' || signal.direction === 'SELL');
  
  const direction = hasPlan ? (plan.direction || (plan.type?.includes('BUY') ? 'BUY' : 'SELL')) : signal?.direction;
  const isBuy = direction === 'BUY';
  const isSell = direction === 'SELL';
  const isActive = hasPlan || hasSignal;

  // Price levels
  const entry = hasPlan ? plan.entry : signal?.entry || 0;
  const stopLoss = hasPlan ? plan.stopLoss : signal?.stopLoss || 0;
  const tp1 = hasPlan ? plan.takeProfit : signal?.takeProfit1 || 0;
  const riskDistance = Math.abs(entry - stopLoss);
  const targetDistance = Math.abs(tp1 - entry);
  const projectedPlanTp2 = hasPlan && riskDistance > 0
    ? isBuy
      ? entry + Math.max(riskDistance * 2, targetDistance + riskDistance)
      : entry - Math.max(riskDistance * 2, targetDistance + riskDistance)
    : 0;
  const tp2 = signal?.takeProfit2 || projectedPlanTp2;
  const confidence = hasPlan ? plan.confidence : signal?.confidence || 0;
  const timeframe = hasPlan ? (plan.timeframe || 'M15') : signal?.timeframe || 'M15';
  const reason = hasPlan ? plan.reason : signal?.reason || '';

  // Calculate point distances
  const slPoints = Math.round(Math.abs(entry - stopLoss) * 100);
  const tp1Points = Math.round(Math.abs(tp1 - entry) * 100);
  const tp2Points = Math.round(Math.abs(tp2 - entry) * 100);

  // Freshness
  const planTime = hasPlan ? (plan.lockedAt || plan.createdAt) : signal?.createdAt;
  const signalAge = planTime ? Date.now() - new Date(planTime).getTime() : null;
  const freshnessText = signalAge !== null
    ? signalAge < 60000
      ? 'เมื่อไม่กี่วินาทีที่แล้ว'
      : signalAge < 3600000
        ? `${Math.floor(signalAge / 60000)} นาทีที่แล้ว`
        : `${Math.floor(signalAge / 3600000)} ชม. ที่แล้ว`
    : null;
  const exactTimeText = planTime ? new Date(planTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';

  // Risk level from confidence
  const riskLevel = confidence >= 85 ? 'ต่ำ' : confidence >= 70 ? 'ปานกลาง' : 'สูง';
  const riskColor = confidence >= 85 ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' : confidence >= 70 ? 'text-amber-400 bg-amber-500/15 border-amber-500/25' : 'text-rose-400 bg-rose-500/15 border-rose-500/25';

  const [capital, setCapital] = useState<number>(1000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCapital = localStorage.getItem('goldai_user_capital');
      const savedRisk = localStorage.getItem('goldai_user_risk_percent');
      if (savedCapital) setCapital(parseFloat(savedCapital) || 1000);
      if (savedRisk) setRiskPercent(parseFloat(savedRisk) || 1.0);
    }
  }, []);

  const riskAmount = capital * (riskPercent / 100);
  const slPriceDiff = Math.abs(entry - stopLoss);
  const recommendedLot = slPriceDiff > 0 ? (riskAmount / (slPriceDiff * 100)) : 0.01;
  const tp1Distance = Math.abs(tp1 - entry);
  const tp2Distance = Math.abs(tp2 - entry);
  const tp1Profit = recommendedLot * 100 * tp1Distance;
  const tp2Profit = recommendedLot * 100 * tp2Distance;
  const rrRatio = slPriceDiff > 0 ? (tp1Distance / slPriceDiff) : 0;

  if (!isActive) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-950/80 backdrop-blur-xl p-6">
        {/* Subtle ambient glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-amber-500/50 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-amber-500/80 uppercase tracking-widest">
            AI Trading Assistant
          </span>
        </div>

        <div className="text-center py-8 space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/50">
            <Eye className="h-8 w-8 text-amber-500/60 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-200">AI กำลังเฝ้าดูตลาด...</h3>
            <p className="text-sm text-neutral-500 mt-1">
              รอจังหวะที่เหมาะสม เมื่อมีสัญญาณที่มั่นใจ จะแสดงแผนเทรดทันที
            </p>
          </div>
          {currentPrice > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/60 border border-neutral-800/50">
              <span className="text-[10px] text-neutral-500 font-mono">XAUUSD</span>
              <span className="text-sm font-bold font-mono text-amber-400">${formatPrice(currentPrice)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const directionGradient = isBuy
    ? 'from-emerald-500/8 via-transparent to-transparent'
    : 'from-rose-500/8 via-transparent to-transparent';
  
  const borderGlow = isBuy
    ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.12)]'
    : 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.12)]';

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-neutral-950/90 backdrop-blur-xl ${borderGlow}`}>
      {/* Ambient gradient glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${directionGradient} pointer-events-none`} />
      
      {/* Header */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className={`flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBuy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-500/80 uppercase tracking-widest">
              แผนเทรดจาก AI
            </span>
          </div>
          {freshnessText && (
            <div className="flex items-center gap-1 text-[10px] text-neutral-550 font-mono">
              <Clock className="h-3 w-3" />
              {freshnessText} {exactTimeText && `(${exactTimeText})`}
            </div>
          )}
        </div>
      </div>

      {/* Main trade card body */}
      <div className="relative px-5 pb-5">
        {/* Direction + Symbol + Price row */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            {/* Direction badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-black tracking-wider font-mono border ${
              isBuy
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
            }`}>
              {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {direction}
            </div>
            
            {/* Symbol + Timeframe */}
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-xl font-black text-white font-mono tracking-wide">XAUUSD</span>
              <span className="text-[10px] text-neutral-500 font-mono border border-neutral-800 px-1.5 py-0.5 rounded">
                {timeframe}
              </span>
            </div>
            
            {/* Current price */}
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              ${formatPrice(currentPrice)}
            </div>
          </div>

          {/* Confidence ring */}
          <div className="flex flex-col items-center gap-1">
            <ConfidenceRing value={confidence} size={68} stroke={4} />
            <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">ความมั่นใจ</span>
          </div>
        </div>

        {/* Entry / SL / TP grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Entry Zone */}
          <div className="col-span-2 bg-cyan-500/5 border border-cyan-500/15 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-cyan-400/70 font-mono uppercase tracking-wider mb-0.5">Entry Zone</div>
            <div className="text-base font-black font-mono text-cyan-300">${formatPrice(entry)}</div>
          </div>

          {/* Stop Loss */}
          <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-rose-400/70 font-mono uppercase tracking-wider mb-0.5">Stop Loss</div>
            <div className="text-sm font-bold font-mono text-rose-400">${formatPrice(stopLoss)}</div>
            <div className="text-[9px] text-rose-300/50 font-mono">{slPoints} จุด</div>
          </div>

          {/* Risk Level */}
          <div className="bg-neutral-900/60 border border-neutral-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mb-0.5">ระดับความเสี่ยง</div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${riskColor}`}>
              {riskLevel}
            </span>
          </div>

          {/* TP1 */}
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-emerald-400/70 font-mono uppercase tracking-wider mb-0.5">Take Profit 1</div>
            <div className="text-sm font-bold font-mono text-emerald-400">${formatPrice(tp1)}</div>
            <div className="text-[9px] text-emerald-300/50 font-mono">+{tp1Points} จุด</div>
          </div>

          {/* TP2 */}
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-emerald-400/70 font-mono uppercase tracking-wider mb-0.5">Take Profit 2</div>
            <div className="text-sm font-bold font-mono text-emerald-400">${formatPrice(tp2)}</div>
            <div className="text-[9px] text-emerald-300/50 font-mono">+{tp2Points} จุด</div>
          </div>
        </div>

        {/* Mini signal graph */}
        <MiniSignalGraph
          entry={entry}
          stopLoss={stopLoss}
          takeProfit1={tp1}
          takeProfit2={tp2}
          direction={direction || 'BUY'}
        />

        {/* Risk & Profit Calculator Widget */}
        <div className="mt-4 border-t border-neutral-800/60 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
              🧮 คำนวณความเสี่ยงและขนาดไม้ (Risk & Lot Calculator)
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Capital Input */}
            <div>
              <label className="block text-[9px] font-mono text-neutral-500 uppercase mb-1">
                ทุนในบัญชีของคุณ (Balance USD)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500">$</span>
                <input
                  type="number"
                  placeholder="1000"
                  value={capital || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCapital(val > 0 ? val : 0);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('goldai_user_capital', String(val > 0 ? val : 0));
                    }
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-6 pr-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>
            </div>

            {/* Risk Percent Input */}
            <div>
              <label className="block text-[9px] font-mono text-neutral-500 uppercase mb-1">
                ความเสี่ยงต่อไม้ (Risk %)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={riskPercent || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRiskPercent(val > 0 ? val : 0);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('goldai_user_risk_percent', String(val > 0 ? val : 0));
                    }
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-3 pr-6 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50 font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500">%</span>
              </div>
            </div>
          </div>

          {/* Calculator Results */}
          {capital > 0 && riskPercent > 0 && slPoints > 0 && (
            <div className="bg-neutral-950/80 border border-neutral-900/60 rounded-xl p-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                {/* Recommended Lot */}
                <div className="border-r border-neutral-800/40 pr-2">
                  <div className="text-[9px] text-neutral-500 uppercase">ขนาด Lot แนะนำ (XAUUSD)</div>
                  <div className="text-sm font-black text-amber-400 mt-0.5">
                    {recommendedLot.toFixed(2)} <span className="text-[9px] font-normal text-neutral-500">lots</span>
                  </div>
                </div>

                {/* Risk Amount */}
                <div className="pl-1">
                  <div className="text-[9px] text-neutral-500 uppercase">หากแพ้ (Loss at SL)</div>
                  <div className="text-sm font-bold text-rose-400 mt-0.5">
                    -${riskAmount.toFixed(2)} <span className="text-[9px] font-normal text-rose-500/70">({riskPercent}%)</span>
                  </div>
                </div>

                {/* Estimated Profit at TP1 */}
                <div className="border-t border-neutral-800/40 pt-2 border-r pr-2">
                  <div className="text-[9px] text-neutral-500 uppercase">หากชนะ (Profit TP1)</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    +${tp1Profit.toFixed(2)}
                  </div>
                </div>

                {/* Estimated Profit at TP2 */}
                <div className="border-t border-neutral-800/40 pt-2 pl-1">
                  <div className="text-[9px] text-neutral-500 uppercase">หากชนะ (Profit TP2)</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    +${tp2Profit.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Worthiness Rating */}
              <div className="border-t border-neutral-800/40 pt-2 flex items-center justify-between text-[9px] font-mono">
                <span className="text-neutral-500">ความคุ้มค่าของการเทรดนี้:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold border ${
                  rrRatio >= 2.5
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : rrRatio >= 2.0
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  {rrRatio >= 2.5 ? 'คุ้มค่าสูงมาก 🔥 (RR 1:2.5+)' : rrRatio >= 2.0 ? 'คุ้มค่าที่จะเสี่ยง 👍 (RR 1:2.0+)' : 'ความคุ้มค่าปานกลาง ⚠️'}
                </span>
              </div>

              {/* Simulate Entry Button for High Confidence (>= 80%) */}
              {confidence >= 80 && (
                <button
                  onClick={() => {
                    onSimulateOrder?.({
                      symbol: 'XAUUSD',
                      direction: (direction === 'SELL' ? 'SELL' : 'BUY'),
                      timeframe,
                      entryPrice: entry,
                      stopLoss,
                      takeProfit1: tp1,
                      takeProfit2: tp2,
                      lotSize: recommendedLot,
                      confidence,
                    });
                  }}
                  className="w-full mt-2.5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-neutral-950 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 cursor-pointer hover:scale-[1.01] active:scale-[0.99] font-sans"
                >
                  🚀 จำลองเข้าออเดอร์นี้ ({recommendedLot.toFixed(2)} Lots)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section 2: Market Bias Panel ──────────────────────────────────────────── */

function MarketBiasPanel({ intelligence, latestSignal }: {
  intelligence: MarketIntelligence | null;
  latestSignal: OwnerSignalSummary | null;
}) {
  // Sessions calculation
  const [sessions, setSessions] = useState<{ name: string; active: boolean; color: string }[]>([]);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const h = new Date().getUTCHours();
      const sydneyActive = h >= 21 || h < 6;
      const tokyoActive = h >= 0 && h < 9;
      const londonActive = h >= 8 && h < 17;
      const newyorkActive = h >= 13 && h < 22;

      setSessions([
        { name: 'ซิดนีย์', active: sydneyActive, color: 'blue' },
        { name: 'โตเกียว', active: tokyoActive, color: 'rose' },
        { name: 'ลอนดอน', active: londonActive, color: 'emerald' },
        { name: 'นิวยอร์ก', active: newyorkActive, color: 'amber' },
      ]);

      if (londonActive && newyorkActive) {
        setOverlapWarning('🔥 ลอนดอน × นิวยอร์ก ซ้อนทับ — ผันผวนสูงมาก!');
      } else if (tokyoActive && londonActive) {
        setOverlapWarning('⚠️ โตเกียว × ลอนดอน ซ้อนทับ — ผันผวนเริ่มสูง');
      } else {
        setOverlapWarning(null);
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const bias = intelligence?.bias;
  const biases = intelligence?.timeframeBiases;
  
  // Get AI reasoning from the latest signal
  const reasons = latestSignal
    ? parseTechnicalReasons(latestSignal.reason, latestSignal.direction, latestSignal.timeframe)
    : ['AI กำลังรอสัญญาณใหม่...'];

  // Fundamental bias
  const hasFundamental = intelligence?.fundamentalBias && intelligence.fundamentalBias !== 'NEUTRAL';

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <BarChart3 className="h-4 w-4 text-amber-500/70" />
        <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">สภาพตลาด & กลยุทธ์</h2>
      </div>

      {/* Fundamental news override */}
      {hasFundamental && (
        <div className={`border rounded-xl p-3.5 relative overflow-hidden ${
          intelligence!.fundamentalBias === 'BULLISH'
            ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-300'
            : 'bg-rose-950/30 border-rose-500/25 text-rose-300'
        }`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
            intelligence!.fundamentalBias === 'BULLISH' ? 'bg-emerald-500' : 'bg-rose-500'
          }`} />
          <div className="flex items-start gap-2.5 pl-1">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold">
                🚨 {intelligence!.fundamentalBias === 'BULLISH' ? 'ข่าวหนุนขาขึ้น' : 'ข่าวกดดันขาลง'}
              </div>
              <p className="text-[10px] text-neutral-300/80 leading-relaxed">
                {intelligence!.fundamentalWarning || 'เทรดด้วยความระมัดระวังเป็นพิเศษ'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Market Bias + Sessions row */}
      <div className="bg-neutral-950/70 border border-neutral-800/50 rounded-xl backdrop-blur-sm overflow-hidden">
        {/* Bias indicator */}
        <div className="px-4 py-3 border-b border-neutral-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${
                bias === 'BULLISH'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : bias === 'BEARISH'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400'
              }`}>
                {getTrendIcon(bias)}
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">แนวโน้มรวม</div>
                <div className={`text-sm font-bold ${getTrendColor(bias)}`}>
                  {getTrendLabel(bias)}
                </div>
              </div>
            </div>
            
            {/* Volatility */}
            <div className="text-right">
              <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">ความผันผวน</div>
              <div className={`text-xs font-bold ${
                intelligence?.volatility === 'HIGH' ? 'text-rose-400' :
                intelligence?.volatility === 'MEDIUM' ? 'text-amber-400' : 'text-neutral-400'
              }`}>
                {intelligence?.volatility === 'HIGH' ? 'สูง' :
                 intelligence?.volatility === 'MEDIUM' ? 'ปานกลาง' : 'ต่ำ'}
              </div>
            </div>
          </div>
        </div>

        {/* Timeframe biases */}
        {biases && (
          <div className="px-4 py-2.5 border-b border-neutral-800/40">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {(['D1', 'H1', 'M15', 'M5'] as const).map((tf) => {
                const tfBias = biases[tf as keyof typeof biases];
                if (!tfBias) return null;
                return (
                  <div key={tf} className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold ${
                    tfBias === 'BULLISH'
                      ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15'
                      : tfBias === 'BEARISH'
                      ? 'bg-rose-500/8 text-rose-400 border-rose-500/15'
                      : 'bg-neutral-800/40 text-neutral-500 border-neutral-700/30'
                  }`}>
                    <span className="text-neutral-500">{tf}</span>
                    <span>{getTrendLabel(tfBias)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active sessions */}
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {sessions.map((s) => (
              <div
                key={s.name}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  s.active
                    ? `bg-${s.color}-500/10 text-${s.color}-400 border-${s.color}-500/20`
                    : 'bg-neutral-900/50 text-neutral-600 border-neutral-800/30'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.active ? `bg-${s.color}-400` : 'bg-neutral-700'}`} />
                {s.name}
              </div>
            ))}
          </div>
          {overlapWarning && (
            <div className="mt-2 text-[10px] text-amber-400/80 font-medium">{overlapWarning}</div>
          )}
        </div>
      </div>

      {/* AI Reasoning card */}
      <div className="bg-neutral-950/70 border border-neutral-800/50 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap className="h-3.5 w-3.5 text-amber-500/80" />
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
            การวิเคราะห์จาก AI
          </span>
        </div>
        <ul className="space-y-2 list-none pl-0">
          {reasons.map((r, idx) => (
            <li key={idx} className="text-xs text-neutral-300 leading-relaxed flex items-start gap-2">
              <span className="text-amber-500/70 shrink-0 mt-1 text-[10px]">●</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Risk warning (compact) */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300/60 leading-relaxed">
          ควรควบคุมขนาดไม้ ตั้ง SL ที่รับได้ ไม่ไล่ราคา เปิดกราฟดูพฤติกรรมราคาประกอบเสมอ
        </p>
      </div>
    </div>
  );
}

/* ─── Section 3: Quick Stats Strip ──────────────────────────────────────────── */

function QuickStatsStrip({ ownerMetrics }: { ownerMetrics?: OwnerMetrics }) {
  const perf = ownerMetrics?.performance;
  const today = ownerMetrics?.today;

  const winRate = perf?.winRate ?? 0;
  const totalToday = today?.totalSignals ?? 0;
  const avgPoints = perf?.averagePoints ?? 0;
  const wins = perf?.wins ?? 0;
  const losses = perf?.losses ?? 0;
  
  // Calculate streak (simplified — consecutive wins/losses from the latest)
  const streak = wins > losses ? `W${Math.min(wins, 5)}` : losses > wins ? `L${Math.min(losses, 5)}` : '-';
  const streakPositive = wins >= losses;

  const stats = [
    {
      label: 'Win Rate',
      value: `${Math.round(winRate)}%`,
      color: winRate >= 60 ? 'text-emerald-400' : winRate >= 40 ? 'text-amber-400' : 'text-rose-400',
      bgColor: winRate >= 60 ? 'bg-emerald-500/8 border-emerald-500/15' : winRate >= 40 ? 'bg-amber-500/8 border-amber-500/15' : 'bg-rose-500/8 border-rose-500/15',
      icon: <Trophy className="h-3.5 w-3.5" />,
    },
    {
      label: 'สัญญาณวันนี้',
      value: `${totalToday}`,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/8 border-cyan-500/15',
      icon: <Target className="h-3.5 w-3.5" />,
    },
    {
      label: 'เฉลี่ยต่อไม้',
      value: avgPoints > 0 ? `+${Math.round(avgPoints)}` : `${Math.round(avgPoints)}`,
      subLabel: 'จุด',
      color: avgPoints >= 0 ? 'text-emerald-400' : 'text-rose-400',
      bgColor: avgPoints >= 0 ? 'bg-emerald-500/8 border-emerald-500/15' : 'bg-rose-500/8 border-rose-500/15',
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
    {
      label: 'สตรีค',
      value: streak,
      color: streakPositive ? 'text-emerald-400' : 'text-rose-400',
      bgColor: streakPositive ? 'bg-emerald-500/8 border-emerald-500/15' : 'bg-rose-500/8 border-rose-500/15',
      icon: <Flame className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500/70" />
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">สถิติเร็ว</h2>
        </div>
        <Link 
          href="/admin/performance"
          className="flex items-center gap-1 text-[10px] text-amber-500/70 font-mono font-bold hover:text-amber-400 transition-colors"
        >
          ดูทั้งหมด
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Scrollable stat pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`shrink-0 flex-1 min-w-[80px] flex flex-col items-center gap-1 px-3 py-3 rounded-xl border backdrop-blur-sm ${stat.bgColor}`}
          >
            <div className={`${stat.color} opacity-60`}>{stat.icon}</div>
            <div className={`text-lg font-black font-mono leading-none ${stat.color}`}>
              {stat.value}
              {stat.subLabel && <span className="text-[9px] font-normal ml-0.5">{stat.subLabel}</span>}
            </div>
            <div className="text-[9px] text-neutral-500 font-mono text-center leading-tight">{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Sample size note */}
      <div className="text-center text-[9px] text-neutral-600 font-mono">
        จากตัวอย่าง {perf?.sampleSize ?? 0} สัญญาณ (ตัดสินแล้ว {perf?.decidedSampleSize ?? 0} ไม้)
      </div>
    </div>
  );
}

/* ─── Signal Alert Dialog ───────────────────────────────────────────────────── */

function SignalAlertDialog({ signal, onDismiss }: {
  signal: OwnerSignalSummary;
  onDismiss: () => void;
}) {
  const isBuy = signal.direction === 'BUY';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`relative max-w-sm w-full bg-neutral-900/95 border rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden ${
        isBuy
          ? 'border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
          : 'border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.25)]'
      }`}>
        <div className={`absolute -inset-10 opacity-10 blur-[40px] pointer-events-none rounded-full ${
          isBuy ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />

        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBuy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </span>
          <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-amber-400">
            🚨 สัญญาณเข้าเทรดความมั่นใจสูง!
          </span>
        </div>

        <div className="flex justify-between items-baseline mb-2">
          <h3 className="text-xl font-black text-white font-mono tracking-wide flex items-center gap-2">
            XAUUSD <span className="text-neutral-500 text-xs font-normal">({signal.timeframe})</span>
          </h3>
          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
            isBuy
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
          }`}>
            CONFIDENCE: {signal.confidence}%
          </span>
        </div>

        <div className="text-center py-2">
          <div className={`text-5xl font-black tracking-wider uppercase font-mono drop-shadow-lg ${
            isBuy
              ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]'
          }`}>
            {signal.direction}
          </div>
        </div>

        <div className="space-y-1.5 font-mono text-xs text-neutral-300 mt-2 bg-neutral-950/40 border border-neutral-900 rounded-2xl p-4">
          <div className="flex justify-between border-b border-neutral-900 pb-1.5">
            <span className="text-neutral-500">จุดเข้าเทรด (Entry)</span>
            <span className="font-bold text-neutral-100">${signal.entry.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-900 py-1.5">
            <span className="text-neutral-500">Stop Loss (SL)</span>
            <span className="font-bold text-rose-400">
              ${signal.stopLoss.toFixed(2)} ({Math.round(Math.abs(signal.entry - signal.stopLoss) * 100)} จุด)
            </span>
          </div>
          <div className="flex justify-between border-b border-neutral-900 py-1.5">
            <span className="text-neutral-500">Take Profit 1 (TP1)</span>
            <span className="font-bold text-emerald-400">
              ${signal.takeProfit1.toFixed(2)} ({Math.round(Math.abs(signal.takeProfit1 - signal.entry) * 100)} จุด)
            </span>
          </div>
          <div className="flex justify-between pt-1.5">
            <span className="text-neutral-500">Take Profit 2 (TP2)</span>
            <span className="font-bold text-emerald-400">
              ${signal.takeProfit2.toFixed(2)} ({Math.round(Math.abs(signal.takeProfit2 - signal.entry) * 100)} จุด)
            </span>
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="mt-3 bg-neutral-950/20 border border-neutral-900/50 rounded-2xl p-4 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2 font-mono">
            เหตุผลการเข้าเทรด:
          </span>
          <ul className="space-y-1.5 list-none pl-0">
            {parseTechnicalReasons(signal.reason, signal.direction, signal.timeframe).map((r, idx) => (
              <li key={idx} className="text-[10.5px] text-neutral-200 leading-relaxed flex items-start gap-1.5 font-sans">
                <span className={`shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full ${isBuy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <MiniSignalGraph
          entry={signal.entry}
          stopLoss={signal.stopLoss}
          takeProfit1={signal.takeProfit1}
          takeProfit2={signal.takeProfit2}
          direction={signal.direction}
        />

        <button
          onClick={onDismiss}
          className={`w-full py-3 rounded-2xl font-bold text-xs uppercase cursor-pointer transition-all border mt-4 ${
            isBuy
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
          }`}
        >
          รับทราบสัญญาณซื้อขาย
        </button>
      </div>
    </div>
  );
}

/* ─── Simulated Sandbox Portfolio Panel Component ───────────────────────────── */

function SimulatedPortfolioPanel({
  trades,
  currentPrice,
  onCloseTrade,
  onClearPortfolio
}: {
  trades: any[];
  currentPrice: number;
  onCloseTrade: (id: string) => void;
  onClearPortfolio: () => void;
}) {
  const [initialCapital, setInitialCapital] = useState<number>(1000);
  
  useEffect(() => {
    const savedCapital = localStorage.getItem('goldai_user_capital');
    if (savedCapital) setInitialCapital(parseFloat(savedCapital) || 1000);
  }, [trades]);

  const closedTrades = trades.filter(t => t.status !== 'OPEN');
  const openTrades = trades.filter(t => t.status === 'OPEN');
  
  const netClosedPnL = closedTrades.reduce((sum, t) => sum + (t.profitUSD || 0), 0);
  const currentBalance = initialCapital + netClosedPnL;
  
  const winsCount = closedTrades.filter(t => t.status === 'WIN').length;
  const closedCount = closedTrades.length;
  const winRate = closedCount > 0 ? Math.round((winsCount / closedCount) * 100) : 0;
  
  const getFloatingPnL = (trade: any) => {
    if (currentPrice <= 0) return 0;
    const isBuy = trade.direction === 'BUY';
    const diff = isBuy ? (currentPrice - trade.entryPrice) : (trade.entryPrice - currentPrice);
    return trade.lotSize * 100 * diff;
  };

  return (
    <div className="bg-neutral-950/70 border border-neutral-800/50 rounded-2xl p-4 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4.5 w-4.5 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            📊 พอร์ตจำลองวัดผลของฉัน (Simulated Portfolio)
          </h3>
        </div>
        {trades.length > 0 && (
          <button 
            onClick={onClearPortfolio}
            className="text-[9px] font-mono text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            รีเซ็ตพอร์ต
          </button>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-6 text-neutral-500 text-xs">
          ยังไม่มีออเดอร์จำลองในระบบ <br />
          <span className="text-[10px] text-neutral-600 mt-1 block">
            กดปุ่ม "🚀 จำลองเข้าออเดอร์" ในแผนเทรดความแม่นยำสูง 80%+ เพื่อบันทึกผล
          </span>
        </div>
      ) : (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-3 gap-2 bg-neutral-900/30 p-2.5 rounded-xl border border-neutral-900/50 text-[10px] font-mono">
            <div>
              <div className="text-neutral-500 uppercase text-[8px]">บาลานซ์จำลอง</div>
              <div className="text-xs font-bold text-neutral-200 mt-0.5">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-neutral-500 uppercase text-[8px]">อัตราชนะ (Win Rate)</div>
              <div className="text-xs font-bold text-neutral-200 mt-0.5">
                {winRate}% <span className="text-[8px] font-normal text-neutral-500">({closedCount} ไม้ปิด)</span>
              </div>
            </div>
            <div>
              <div className="text-neutral-500 uppercase text-[8px]">กำไรสะสม</div>
              <div className={`text-xs font-bold mt-0.5 ${netClosedPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {netClosedPnL >= 0 ? '+' : ''}${netClosedPnL.toFixed(2)}
              </div>
            </div>
          </div>

          {openTrades.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-wider font-mono text-neutral-500">ออเดอร์จำลองที่เปิดอยู่ ({openTrades.length})</div>
              <div className="space-y-2">
                {openTrades.map((t) => {
                  const floating = getFloatingPnL(t);
                  const isBuy = t.direction === 'BUY';
                  return (
                    <div key={t.id} className="bg-neutral-900/50 border border-neutral-850 rounded-xl p-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {t.direction}
                          </span>
                          <span className="font-bold text-neutral-300 font-mono">{t.lotSize.toFixed(2)} Lots</span>
                          <span className="text-neutral-500 font-mono">@{t.entryPrice.toFixed(2)}</span>
                        </div>
                        <div className="text-[9px] text-neutral-500 font-mono">
                          SL: ${t.stopLoss.toFixed(2)} | TP1: ${t.takeProfit1.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold font-mono ${floating >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {floating >= 0 ? '+' : ''}${floating.toFixed(2)}
                        </div>
                        <button
                          onClick={() => onCloseTrade(t.id)}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 rounded-lg text-[9px] font-bold text-neutral-300 cursor-pointer transition-all"
                        >
                          ปิดออเดอร์
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {closedTrades.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-wider font-mono text-neutral-500">ประวัติเทรดปิดผล (ล่าสุด 5 ไม้)</div>
              <div className="bg-neutral-900/10 border border-neutral-900/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[10px] font-mono">
                  <thead>
                    <tr className="bg-neutral-900/30 text-neutral-500 border-b border-neutral-900 text-[8px] uppercase tracking-wider">
                      <th className="py-2 px-3">ประเภท</th>
                      <th className="py-2 px-3">ขนาด Lot</th>
                      <th className="py-2 px-3">ผลลัพธ์</th>
                      <th className="py-2 px-3 text-right">กำไร (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {closedTrades.slice(0, 5).map((t) => {
                      const isWin = t.status === 'WIN';
                      return (
                        <tr key={t.id} className="hover:bg-neutral-900/10">
                          <td className="py-2.5 px-3">
                            <span className={t.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-400">{t.lotSize.toFixed(2)} Lots</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1 rounded text-[8px] font-bold ${isWin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {t.profitUSD >= 0 ? '+' : ''}${t.profitUSD?.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Speculative High-Risk Plans Panel Component ───────────────────────────── */

function SpeculativePlansPanel({
  speculativePlans,
  currentPrice,
  onSimulateOrder,
}: {
  speculativePlans: ProactivePlan[] | undefined;
  currentPrice: number;
  onSimulateOrder: (order: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    timeframe: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    lotSize: number;
    confidence: number;
  }) => void;
}) {
  if (!speculativePlans || speculativePlans.length === 0) return null;

  return (
    <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-4 backdrop-blur-sm space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Flame className="h-4.5 w-4.5 text-amber-500/80 shrink-0" />
        <div>
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            ⚡ แผนเทรดทางเลือกความเสี่ยงสูง (Speculative / High-Risk Ideas)
          </h3>
          <p className="text-[9px] text-neutral-500 leading-relaxed font-sans mt-0.5">
            แผนความมั่นใจต่ำ (50%-64%) หรือระบบที่ยังอยู่ระหว่างวิจัย เผื่อลูกค้าอยากบริหารเสี่ยงเทรดด้วยล็อตขนาดเล็ก
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {speculativePlans.map((plan) => {
          const isBuy = plan.type.includes('BUY') || plan.direction === 'BUY';
          const direction = isBuy ? 'BUY' : 'SELL';
          const confidence = plan.confidence;
          const entry = plan.entry;
          const stopLoss = plan.stopLoss;
          const tp1 = plan.takeProfit;
          const tp2 = tp1;
          const isResearching = plan.researchStatus === 'RESEARCHING';
          
          const planTime = plan.lockedAt || plan.createdAt;
          const timeText = planTime ? new Date(planTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '';
          
          // Price proximity check: within $1.50
          const isNearEntry = currentPrice > 0 && Math.abs(currentPrice - entry) <= 1.50;

          const lotSize = 0.01;

          return (
            <div 
              key={plan.id}
              className={`border rounded-xl p-3.5 space-y-3 relative overflow-hidden transition-all duration-300 ${
                isNearEntry 
                  ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.08)]' 
                  : 'bg-neutral-900/20 border-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black font-mono border uppercase ${
                    isBuy 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {direction} {plan.type?.replace('_LIMIT', ' LIMIT') || 'PLAN'}
                  </span>
                  <span className="text-[9px] font-bold text-neutral-400 font-mono">
                    {plan.timeframe}
                  </span>
                  {timeText && (
                    <span className="text-[9px] text-neutral-500 font-mono flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {timeText}
                    </span>
                  )}
                  {isNearEntry && (
                    <span className="animate-pulse bg-emerald-500/25 text-emerald-400 border border-emerald-500/35 text-[8.5px] px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">
                      ราคาอยู่แนว Entry 🎯
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-amber-500 font-bold px-2 py-0.5 rounded-full bg-amber-500/5 border border-amber-500/15">
                    มั่นใจ {confidence}% {isResearching && <span className="text-[8px] text-neutral-500 ml-1">(วิจัย)</span>}
                  </span>
                </div>
              </div>

              {/* Levels summary */}
              <div className="grid grid-cols-3 gap-2 bg-neutral-950/60 p-2 rounded-lg text-[10px] font-mono text-neutral-400 border border-neutral-900">
                <div>
                  <span className="text-neutral-500 block text-[8px]">ENTRY</span>
                  <span className="text-neutral-200 font-bold">${entry.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-rose-500 block text-[8px]">STOP LOSS</span>
                  <span className="text-rose-400/90 font-bold">${stopLoss.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-emerald-500 block text-[8px]">TARGET TP</span>
                  <span className="text-emerald-400/90 font-bold">${tp1.toFixed(2)}</span>
                </div>
              </div>

              {/* Reason details */}
              {plan.reason && (
                <div className="text-[10px] text-neutral-400 leading-relaxed font-sans bg-neutral-950/30 border border-neutral-900/60 p-2.5 rounded-lg">
                  <span className="text-amber-500/80 font-bold block mb-0.5">💡 คำอธิบาย/เหตุผลเข้าซื้อขาย:</span>
                  {plan.reason}
                </div>
              )}

              {/* Simulate button */}
              <button
                onClick={() => {
                  onSimulateOrder({
                    symbol: 'XAUUSD',
                    direction,
                    timeframe: plan.timeframe || 'M15',
                    entryPrice: entry,
                    stopLoss,
                    takeProfit1: tp1,
                    takeProfit2: tp2,
                    lotSize,
                    confidence,
                  });
                }}
                className={`w-full py-1.5 text-neutral-300 font-bold rounded-lg text-[9px] flex items-center justify-center gap-1 cursor-pointer transition-all font-sans border ${
                  isNearEntry 
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-md' 
                    : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                🚀 ทดลองจำลองเข้าไม้นี้ (0.01 Lots)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main UserDashboard Component ──────────────────────────────────────────── */

export default function UserDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastGoodStatsRef = useRef<Stats | null>(null);

  // Client simulated portfolio state
  const [clientTrades, setClientTrades] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goldai_client_trades');
      if (saved) {
        try {
          setClientTrades(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Alert system
  const [activeAlertSignal, setActiveAlertSignal] = useState<OwnerSignalSummary | null>(null);
  const [alertedSignalIds, setAlertedSignalIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ids = JSON.parse(sessionStorage.getItem('alerted_signals') || '[]');
      setAlertedSignalIds(ids);
    }
  }, []);

  // Check for high-confidence alerts
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

  // Fetch dashboard stats — 15s interval for users (lighter load)
  const fetchStats = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 12000, cacheBust: true });
      setStats(data);
      lastGoodStatsRef.current = data;
      setError(null);
    } catch {
      setError(
        lastGoodStatsRef.current
          ? 'อัปเดตข้อมูลสดสะดุดชั่วคราว ระบบยังแสดงข้อมูลล่าสุดไว้ให้'
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล'
      );
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // 15-second poll for users
    return () => clearInterval(interval);
  }, []);

  // Derived data
  const intelligence = stats?.marketIntelligence?.['XAUUSD'] || null;
  const currentPrice = intelligence?.currentPrice || 0;
  const latestSignals = (stats?.ownerMetrics?.today.latestSignals || []).filter((s) => s.confidence >= 65);
  const latestSignalForStatus = latestSignals[0] || null;
  const latestActiveSignal = latestSignals.find(
    (s) => s.direction === 'BUY' || s.direction === 'SELL'
  ) || null;

  // Monitor price changes to auto-settle simulated client trades
  useEffect(() => {
    if (currentPrice <= 0 || clientTrades.length === 0) return;
    
    let hasChanges = false;
    const updated = clientTrades.map((trade) => {
      if (trade.status !== 'OPEN') return trade;
      
      const isBuy = trade.direction === 'BUY';
      const touchSL = isBuy ? currentPrice <= trade.stopLoss : currentPrice >= trade.stopLoss;
      const tpTarget = trade.takeProfit2 > 0 ? trade.takeProfit2 : trade.takeProfit1;
      const touchTP = isBuy ? currentPrice >= tpTarget : currentPrice <= tpTarget;
      
      if (touchSL) {
        hasChanges = true;
        const lossDistance = Math.abs(trade.entryPrice - trade.stopLoss);
        const lossUSD = -1 * trade.lotSize * 100 * lossDistance;
        return {
          ...trade,
          status: 'LOSS',
          closedAt: new Date().toISOString(),
          exitPrice: trade.stopLoss,
          profitUSD: parseFloat(lossUSD.toFixed(2)),
        };
      }
      
      if (touchTP) {
        hasChanges = true;
        const winDistance = Math.abs(tpTarget - trade.entryPrice);
        const winUSD = trade.lotSize * 100 * winDistance;
        return {
          ...trade,
          status: 'WIN',
          closedAt: new Date().toISOString(),
          exitPrice: tpTarget,
          profitUSD: parseFloat(winUSD.toFixed(2)),
        };
      }
      
      return trade;
    });
    
    if (hasChanges) {
      setClientTrades(updated);
      localStorage.setItem('goldai_client_trades', JSON.stringify(updated));
    }
  }, [currentPrice, clientTrades]);

  const handleSimulateOrder = (order: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    timeframe: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    lotSize: number;
    confidence: number;
  }) => {
    const hasActive = clientTrades.some(t => t.status === 'OPEN' && Math.abs(t.entryPrice - order.entryPrice) < 0.05);
    if (hasActive) {
      alert('คุณได้จำลองการเข้าแผนนี้ไว้แล้ว สามารถรอให้กราฟชนเป้าหมาย หรือกดปุ่มปิดไม้ได้ในกล่องสรุปพอร์ตด้านล่าง');
      return;
    }

    const newTrade = {
      id: `client-trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol: order.symbol,
      direction: order.direction,
      timeframe: order.timeframe,
      entryPrice: order.entryPrice,
      stopLoss: order.stopLoss,
      takeProfit1: order.takeProfit1,
      takeProfit2: order.takeProfit2,
      lotSize: order.lotSize,
      confidence: order.confidence,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
    };
    
    const updated = [newTrade, ...clientTrades];
    setClientTrades(updated);
    localStorage.setItem('goldai_client_trades', JSON.stringify(updated));
    alert('📥 บันทึกการจำลองเข้าไม้สำเร็จ! ออเดอร์จะเปิดทำงานและคำนวณกำไร/ขาดทุนตามราคาทองจริงในกล่องด้านล่างครับ');
  };

  const handleCloseTrade = (tradeId: string) => {
    if (currentPrice <= 0) return;
    const updated = clientTrades.map((trade) => {
      if (trade.id !== tradeId || trade.status !== 'OPEN') return trade;
      
      const isBuy = trade.direction === 'BUY';
      const profitDistance = isBuy ? (currentPrice - trade.entryPrice) : (trade.entryPrice - currentPrice);
      const profitUSD = trade.lotSize * 100 * profitDistance;
      const status = profitUSD >= 0 ? 'WIN' : 'LOSS';
      
      return {
        ...trade,
        status,
        closedAt: new Date().toISOString(),
        exitPrice: currentPrice,
        profitUSD: parseFloat(profitUSD.toFixed(2)),
      };
    });
    
    setClientTrades(updated);
    localStorage.setItem('goldai_client_trades', JSON.stringify(updated));
  };

  const handleClearPortfolio = () => {
    if (confirm('คุณต้องการรีเซ็ตพอร์ตจำลองและล้างประวัติทั้งหมดใช่หรือไม่?')) {
      setClientTrades([]);
      localStorage.removeItem('goldai_client_trades');
    }
  };

  /* ─── Loading State ─── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-amber-500/20 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
          </div>
          <div className="absolute -inset-4 bg-amber-500/5 rounded-full blur-xl" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm font-bold text-neutral-300">กำลังเชื่อมต่อ AI...</div>
          <div className="text-[10px] text-neutral-500 font-mono">Gold AI Signal Lab</div>
        </div>
      </div>
    );
  }

  /* ─── Error State ─── */
  if (error && !lastGoodStatsRef.current) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm text-center">
        {error}
        <button
          onClick={fetchStats}
          className="mt-3 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans text-neutral-200 pb-24 max-w-lg mx-auto">
      {/* Connection error banner (non-blocking) */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-[10px] text-amber-400 font-mono text-center">
          {error}
        </div>
      )}

      {/* Section 0: Latest signal visibility */}
      <LatestSignalStatusCard
        signal={latestSignalForStatus}
        totalToday={stats?.ownerMetrics?.today.totalSignals ?? 0}
      />

      {/* Section 1: Market Bias & Strategy */}
      <MarketBiasPanel
        intelligence={intelligence}
        latestSignal={latestActiveSignal}
      />

      {/* Section 2: Speculative High-Risk Plans Card */}
      <SpeculativePlansPanel
        speculativePlans={intelligence?.speculativePlans}
        currentPrice={currentPrice}
        onSimulateOrder={handleSimulateOrder}
      />

      {/* Section 3: AI Trading Assistant (TradePlanHero) */}
      <TradePlanHero
        intelligence={intelligence}
        latestSignal={latestActiveSignal}
        currentPrice={currentPrice}
        onSimulateOrder={handleSimulateOrder}
      />

      {/* Simulated Sandbox Portfolio */}
      <SimulatedPortfolioPanel
        trades={clientTrades}
        currentPrice={currentPrice}
        onCloseTrade={handleCloseTrade}
        onClearPortfolio={handleClearPortfolio}
      />

      {/* Section 4: Quick Stats */}
      <QuickStatsStrip ownerMetrics={stats?.ownerMetrics} />

      {/* Put MT5 Realtime Status Card at the very bottom */}
      <Mt5RealtimeStatusCard stats={stats} currentPrice={currentPrice} />

      {/* LINE Contact Support Banner */}
      <div className="bg-neutral-900/60 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-400">ติดต่อสอบถาม / แจ้งปัญหา</h4>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              แอดไลน์แชทกับทีมงานได้ที่ไอดี @413aryiz
            </p>
          </div>
        </div>
        <a 
          href="https://line.me/R/ti/p/@413aryiz" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[10px] rounded-lg transition-all shrink-0 cursor-pointer"
        >
          ติดต่อไลน์
        </a>
      </div>

      {/* Signal Alert Dialog */}
      {activeAlertSignal && (
        <SignalAlertDialog
          signal={activeAlertSignal}
          onDismiss={() => setActiveAlertSignal(null)}
        />
      )}
    </div>
  );
}
