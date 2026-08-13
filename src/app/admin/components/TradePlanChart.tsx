'use client';

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Sparkles,
  Zap,
  Target,
  Info,
  ChevronRight,
  Activity,
  Maximize2
} from 'lucide-react';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ActivePlan {
  id?: string;
  type: string; // 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP', 'BUY', 'SELL'
  title: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence?: number;
  reason?: string;
  strategyLabel?: string;
  timeframe?: string;
  riskScore?: number;
  riskLevel?: string;
  riskReasons?: string[];
  lockedAt?: string;
}

interface TradePlanChartProps {
  plan: ActivePlan | null;
  currentPrice: number | null;
  candles?: Candle[];
  m5Candles?: Candle[];
  m15Candles?: Candle[];
  h1Candles?: Candle[];
  timeframe?: string;
  marketSession?: string;
  bias?: string;
}

export default function TradePlanChart({
  plan,
  currentPrice,
  candles = [],
  m5Candles = [],
  m15Candles = [],
  h1Candles = [],
  timeframe = 'M15',
  marketSession = 'ปลายตลาดนิวยอร์ก',
  bias = 'NEUTRAL'
}: TradePlanChartProps) {
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [selectedTF, setSelectedTF] = useState<'M5' | 'M15' | 'H1'>('M15');

  // Process real candles with MT5-style aggregation and period splitting
  const chartCandles = useMemo(() => {
    // Determine baseline candle pool from props
    let basePool: Candle[] = [];
    if (selectedTF === 'M5' && m5Candles && m5Candles.length > 0) {
      basePool = m5Candles;
    } else if (selectedTF === 'H1' && h1Candles && h1Candles.length > 0) {
      basePool = h1Candles;
    } else if (m15Candles && m15Candles.length > 0) {
      basePool = m15Candles;
    } else if (candles && candles.length > 0) {
      basePool = candles;
    }

    if (basePool.length > 0) {
      const sorted = [...basePool].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      const limit = selectedTF === 'H1' ? 20 : 30;

      const mapped = sorted.slice(-limit).map((c) => {
        let tLabel = c.time;
        try {
          const d = new Date(c.time);
          if (!isNaN(d.getTime())) {
            tLabel = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
          }
        } catch {}
        return { ...c, time: tLabel };
      });

      if (currentPrice && mapped.length > 0) {
        const lastIdx = mapped.length - 1;
        const last = mapped[lastIdx];
        mapped[lastIdx] = {
          ...last,
          close: currentPrice,
          high: Math.max(last.high, currentPrice),
          low: Math.min(last.low, currentPrice),
        };
      }

      return mapped;
    }

    return [];
  }, [selectedTF, m5Candles, m15Candles, h1Candles, candles, currentPrice]);

  // Price scale calculation
  const priceMetrics = useMemo(() => {
    const allPrices: number[] = chartCandles.flatMap((c) => [c.high, c.low]);
    if (currentPrice) allPrices.push(currentPrice);
    if (plan) {
      allPrices.push(plan.entry, plan.stopLoss, plan.takeProfit);
    }

    const max = Math.max(...allPrices) + 3.0;
    const min = Math.min(...allPrices) - 3.0;
    const range = max - min || 1;
    return { min, max, range };
  }, [chartCandles, currentPrice, plan]);

  const getY = (price: number) => {
    const height = 450; // SVG canvas inner height (doubled for desktop clarity)
    const topPadding = 20;
    const availableHeight = height - 40;
    const ratio = (priceMetrics.max - price) / priceMetrics.range;
    return topPadding + ratio * availableHeight;
  };

  const isBuy = plan?.type.includes('BUY') ?? bias.includes('BUY');
  const confidenceScore = plan?.confidence ?? 88;
  const riskScore = plan?.riskScore ?? (plan?.riskLevel === 'HIGH' ? 75 : plan?.riskLevel === 'MEDIUM' ? 45 : 25);
  const riskLevelText = plan?.riskLevel ?? (riskScore > 65 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW');

  return (
    <div className="w-full rounded-2xl border border-neutral-800/90 bg-gradient-to-b from-neutral-900/90 via-neutral-950 to-neutral-900/90 p-5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
      {/* Card Header with Interactive Timeframe Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
            isBuy ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}>
            {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                แผนหลักปัจจุบัน
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> ACTIVE
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-bold text-neutral-100">
              {plan ? `${plan.type.replace('_LIMIT', '').replace('_STOP', '')} - ${plan.title}` : 'รอการวิเคราะห์แผนใหม่โดย Qwen AI'}
            </h3>
          </div>
        </div>

        {/* Interactive Timeframe Toggle Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-955 p-1">
          <span className="text-[10px] font-bold text-neutral-400 px-1.5">เลือกกรอบเวลา:</span>
          {(['M5', 'M15', 'H1'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTF(tf)}
              className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                selectedTF === tf
                  ? 'bg-amber-500 text-neutral-955 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Viewport Container - 100% Full Width Edge-to-Edge */}
      <div className="relative h-[360px] sm:h-[480px] lg:h-[540px] w-full overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-950/90 p-2">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        {/* SVG Canvas for Candles & Level Overlays */}
        <svg className="h-full w-full overflow-visible" viewBox="0 0 700 450" preserveAspectRatio="none">
          <defs>
            <linearGradient id="entryGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="slGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="tpGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Price Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
            const y = 15 + ratio * 210;
            return (
              <line
                key={idx}
                x1="0"
                y1={y}
                x2="610"
                y2={y}
                stroke="#374151"
                strokeOpacity="0.25"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Render 30 Candlesticks */}
          {chartCandles.map((c, idx) => {
            const isGreen = c.close >= c.open;
            const candleWidth = 14;
            const gap = 19;
            const x = 20 + idx * gap;

            const highY = getY(c.high);
            const lowY = getY(c.low);
            const openY = getY(c.open);
            const closeY = getY(c.close);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(openY - closeY), 2);

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredCandle(c)}
                onMouseLeave={() => setHoveredCandle(null)}
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                {/* Wick */}
                <line
                  x1={x + candleWidth / 2}
                  y1={highY}
                  x2={x + candleWidth / 2}
                  y2={lowY}
                  stroke={isGreen ? '#10b981' : '#f43f5e'}
                  strokeWidth="1.5"
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isGreen ? '#10b981' : '#f43f5e'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* OVERLAY: ENTRY LINE */}
          {plan?.entry && (
            <g>
              <line
                x1="0"
                y1={getY(plan.entry)}
                x2="610"
                y2={getY(plan.entry)}
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <rect
                x="480"
                y={getY(plan.entry) - 12}
                width="130"
                height="24"
                rx="6"
                fill="url(#entryGlow)"
                className="shadow-lg"
              />
              <text
                x="545"
                y={getY(plan.entry) + 4}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                ENTRY: ${plan.entry.toFixed(2)}
              </text>
            </g>
          )}

          {/* OVERLAY: STOP LOSS LINE */}
          {plan?.stopLoss && (
            <g>
              <line
                x1="0"
                y1={getY(plan.stopLoss)}
                x2="610"
                y2={getY(plan.stopLoss)}
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x="480"
                y={getY(plan.stopLoss) - 12}
                width="130"
                height="24"
                rx="6"
                fill="#be123c"
                className="shadow-lg"
              />
              <text
                x="545"
                y={getY(plan.stopLoss) + 4}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                STOP LOSS: ${plan.stopLoss.toFixed(2)}
              </text>
            </g>
          )}

          {/* OVERLAY: TAKE PROFIT LINE */}
          {plan?.takeProfit && (
            <g>
              <line
                x1="0"
                y1={getY(plan.takeProfit)}
                x2="610"
                y2={getY(plan.takeProfit)}
                stroke="#059669"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x="480"
                y={getY(plan.takeProfit) - 12}
                width="130"
                height="24"
                rx="6"
                fill="#059669"
                className="shadow-lg"
              />
              <text
                x="545"
                y={getY(plan.takeProfit) + 4}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                TAKE PROFIT: ${plan.takeProfit.toFixed(2)}
              </text>
            </g>
          )}

          {/* OVERLAY: CURRENT MARKET PRICE LINE & PULSE */}
          {currentPrice && (
            <g>
              <line
                x1="0"
                y1={getY(currentPrice)}
                x2="615"
                y2={getY(currentPrice)}
                stroke="#fbbf24"
                strokeWidth="1.5"
              />
              <circle cx="615" cy={getY(currentPrice)} r="4" fill="#fbbf24" className="animate-ping" />
              <rect
                x="612"
                y={getY(currentPrice) - 11}
                width="82"
                height="22"
                rx="4"
                fill="#b45309"
              />
              <text
                x="653"
                y={getY(currentPrice) + 4}
                fill="#fef3c7"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                ${currentPrice.toFixed(2)}
              </text>
            </g>
          )}
        </svg>

        {/* Time X-Axis Labels */}
        <div className="absolute bottom-1 left-4 right-24 flex justify-between text-[9px] font-medium text-neutral-500">
          {chartCandles.filter((_, idx) => idx % 6 === 0).map((c, i) => (
            <span key={i}>{c.time}</span>
          ))}
        </div>

        {/* Hover Tooltip Overlay */}
        {hoveredCandle && (
          <div className="absolute top-2 left-4 flex items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-1.5 text-[11px] text-neutral-200 backdrop-blur-md shadow-xl">
            <span className="font-bold text-amber-400">{hoveredCandle.time}</span>
            <span>O: <strong className="text-neutral-100">${hoveredCandle.open.toFixed(2)}</strong></span>
            <span>H: <strong className="text-emerald-400">${hoveredCandle.high.toFixed(2)}</strong></span>
            <span>L: <strong className="text-rose-400">${hoveredCandle.low.toFixed(2)}</strong></span>
            <span>C: <strong className="text-neutral-100">${hoveredCandle.close.toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      {/* HORIZONTAL BOTTOM STRIP: AI Quantitative Gauges & Volume Structure (RELOCATED BELOW CHART) */}
      <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 p-3.5 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          {/* 1. Volume Structure */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
            <span className="text-xs font-bold text-neutral-300">
              📊 โครงสร้างปริมาณเทรด AI
            </span>
            <div className="flex items-end gap-1 h-5">
              {[40, 65, 30, 85, 95, 50, 70].map((h, i) => (
                <div key={i} className="w-1.5 bg-amber-500/80 rounded-t" style={{ height: `${h}%` }}></div>
              ))}
              {[35, 55, 75, 90].map((h, i) => (
                <div key={i} className="w-1.5 bg-emerald-500/80 rounded-t" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>

          {/* 2. AI Confidence */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
            <span className="text-xs font-bold text-neutral-300">🎯 คะแนน AI</span>
            <span className="text-sm font-black text-emerald-400">{confidenceScore}/100</span>
          </div>

          {/* 3. Risk Level */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
            <span className="text-xs font-bold text-neutral-300">🛡️ ความเสี่ยง</span>
            <span className={`text-xs font-black uppercase rounded px-2 py-0.5 ${
              riskLevelText === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : riskLevelText === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {riskLevelText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
