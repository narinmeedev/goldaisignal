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
  timeframe?: string;
  marketSession?: string;
  bias?: string;
}

export default function TradePlanChart({
  plan,
  currentPrice,
  candles = [],
  timeframe = 'M15',
  marketSession = 'ปลายตลาดนิวยอร์ก',
  bias = 'NEUTRAL'
}: TradePlanChartProps) {
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Process real candles from database
  const chartCandles = useMemo(() => {
    if (candles && candles.length > 0) {
      // Sort chronologically ascending
      const sorted = [...candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      return sorted.slice(-30);
    }

    // Fallback baseline when database candles are loading or empty
    const base = currentPrice || plan?.entry || 4040.0;
    const generated: Candle[] = [];
    const now = Date.now();

    for (let i = 29; i >= 0; i--) {
      const timeStr = new Date(now - i * 15 * 60 * 1000).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      generated.push({
        time: timeStr,
        open: base,
        high: base + 0.5,
        low: base - 0.5,
        close: base,
        volume: 100
      });
    }

    if (currentPrice && generated.length > 0) {
      generated[generated.length - 1].close = currentPrice;
      generated[generated.length - 1].high = Math.max(generated[generated.length - 1].high, currentPrice);
      generated[generated.length - 1].low = Math.min(generated[generated.length - 1].low, currentPrice);
    }

    return generated;
  }, [candles, currentPrice, plan?.entry]);

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
    const height = 240; // SVG canvas inner height
    const topPadding = 15;
    const availableHeight = height - 30;
    const ratio = (priceMetrics.max - price) / priceMetrics.range;
    return topPadding + ratio * availableHeight;
  };

  const isBuy = plan?.type.includes('BUY') ?? bias.includes('BUY');
  const confidenceScore = plan?.confidence ?? 88;
  const riskScore = plan?.riskScore ?? (plan?.riskLevel === 'HIGH' ? 75 : plan?.riskLevel === 'MEDIUM' ? 45 : 25);
  const riskLevelText = plan?.riskLevel ?? (riskScore > 65 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW');

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* LEFT CARD: Interactive Candlestick Chart with Entry/SL/TP Overlay */}
      <div className="lg:col-span-8 rounded-2xl border border-neutral-800/90 bg-gradient-to-b from-neutral-900/90 via-neutral-950 to-neutral-900/90 p-5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              isBuy ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}>
              {isBuy ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
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
              <h3 className="mt-1 text-base font-bold text-neutral-100 sm:text-lg">
                {plan ? `${plan.type.replace('_LIMIT', '').replace('_STOP', '')} - ${plan.title}` : 'รอการวิเคราะห์แผนใหม่โดย Qwen AI'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-400">
              {timeframe}
            </span>
          </div>
        </div>

        {/* Chart Viewport Container */}
        <div className="relative mt-4 h-[280px] w-full overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-950/90 p-2">
          {/* Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:24px_24px]"></div>

          {/* SVG Canvas for Candles & Level Overlays */}
          <svg className="h-full w-full overflow-visible" viewBox="0 0 700 240" preserveAspectRatio="none">
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

            {/* Candlestick Bars */}
            {chartCandles.map((c, i) => {
              const barWidth = 12;
              const gap = 6;
              const x = 20 + i * (barWidth + gap);
              const isBull = c.close >= c.open;
              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);
              const bodyTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1.5);
              const color = isBull ? '#10b981' : '#f43f5e';

              return (
                <g
                  key={i}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={() => setHoveredCandle(c)}
                  onMouseLeave={() => setHoveredCandle(null)}
                >
                  {/* High-Low Wick */}
                  <line x1={x + barWidth / 2} y1={yHigh} x2={x + barWidth / 2} y2={yLow} stroke={color} strokeWidth="1.5" />
                  {/* Candle Body */}
                  <rect
                    x={x}
                    y={bodyTop}
                    width={barWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1.5"
                    stroke={color}
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* OVERLAY: ENTRY PRICE LINE & BADGE */}
            {plan && (
              <g>
                <line
                  x1="0"
                  y1={getY(plan.entry)}
                  x2="600"
                  y2={getY(plan.entry)}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
                <rect
                  x="480"
                  y={getY(plan.entry) - 12}
                  width="130"
                  height="24"
                  rx="6"
                  fill="#0284c7"
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

            {/* OVERLAY: STOP LOSS (SL) PRICE LINE & BADGE */}
            {plan && (
              <g>
                <line
                  x1="0"
                  y1={getY(plan.stopLoss)}
                  x2="600"
                  y2={getY(plan.stopLoss)}
                  stroke="#f43f5e"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
                <rect
                  x="480"
                  y={getY(plan.stopLoss) - 12}
                  width="130"
                  height="24"
                  rx="6"
                  fill="#e11d48"
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

            {/* OVERLAY: TAKE PROFIT (TP) PRICE LINE & BADGE */}
            {plan && (
              <g>
                <line
                  x1="0"
                  y1={getY(plan.takeProfit)}
                  x2="600"
                  y2={getY(plan.takeProfit)}
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="5 3"
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
      </div>

      {/* RIGHT CARD: AI Quantitative Gauges (Confidence & Risk Meters) */}
      <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-neutral-800/90 bg-gradient-to-b from-neutral-900/90 via-neutral-950 to-neutral-900/90 p-5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div>
          {/* Top Bar Chart Visualization */}
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              โครงสร้างปริมาณเทรด AI
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

          {/* Gauges Section */}
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            {/* AI Confidence Gauge */}
            <div className="flex flex-col items-center rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3">
              <div className="relative h-20 w-32 flex items-center justify-center">
                <svg className="h-full w-full" viewBox="0 0 100 60">
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="url(#confGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="126"
                    strokeDashoffset={126 - (126 * Math.min(confidenceScore, 100)) / 100}
                  />
                  <defs>
                    <linearGradient id="confGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-1 text-center">
                  <span className="text-lg font-black text-emerald-400">{confidenceScore}</span>
                  <span className="text-[10px] text-neutral-500">/100</span>
                </div>
              </div>
              <p className="mt-1 text-xs font-bold text-neutral-300">คะแนน AI: {confidenceScore}/100</p>
            </div>

            {/* Risk Gauge */}
            <div className="flex flex-col items-center rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3">
              <div className="relative h-20 w-32 flex items-center justify-center">
                <svg className="h-full w-full" viewBox="0 0 100 60">
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="url(#riskGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="126"
                    strokeDashoffset={126 - (126 * Math.min(riskScore, 100)) / 100}
                  />
                  <defs>
                    <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-1 text-center">
                  <span className={`text-xs font-black uppercase ${
                    riskLevelText === 'HIGH' ? 'text-rose-400' : riskLevelText === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {riskLevelText}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs font-bold text-neutral-300">ความเสี่ยง: {riskLevelText}</p>
            </div>
          </div>
        </div>

        {/* Footer Watermark */}
        <div className="mt-6 border-t border-neutral-800/80 pt-3 text-center">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            POWERED BY QWEN AI ALGORITHM | goldaisig.com
          </p>
        </div>
      </div>
    </div>
  );
}
