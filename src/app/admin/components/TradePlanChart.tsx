'use client';

import { useMemo, useState } from 'react';
import { Activity, CandlestickChart, Expand, SlidersHorizontal } from 'lucide-react';

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
  type: string;
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

export interface ChartZone {
  id?: string;
  timeframe?: string;
  priceMin: number;
  priceMax: number;
  strength?: number;
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
  supportZones?: ChartZone[];
  resistanceZones?: ChartZone[];
}

const formatPrice = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
};

export default function TradePlanChart({
  plan,
  currentPrice,
  candles = [],
  m5Candles = [],
  m15Candles = [],
  h1Candles = [],
  supportZones = [],
  resistanceZones = [],
}: TradePlanChartProps) {
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [selectedTF, setSelectedTF] = useState<'M5' | 'M15' | 'H1'>('M15');

  const chartCandles = useMemo(() => {
    const source = selectedTF === 'M5' && m5Candles.length
      ? m5Candles
      : selectedTF === 'H1' && h1Candles.length
        ? h1Candles
        : m15Candles.length
          ? m15Candles
          : candles;

    const limit = selectedTF === 'H1' ? 24 : 36;
    const mapped = [...source]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-limit)
      .map((candle) => ({ ...candle, time: formatTime(candle.time) }));

    if (currentPrice && mapped.length) {
      const lastIndex = mapped.length - 1;
      const latest = mapped[lastIndex];
      mapped[lastIndex] = {
        ...latest,
        close: currentPrice,
        high: Math.max(latest.high, currentPrice),
        low: Math.min(latest.low, currentPrice),
      };
    }

    return mapped;
  }, [candles, currentPrice, h1Candles, m15Candles, m5Candles, selectedTF]);

  const latestCandle = chartCandles.at(-1) ?? null;
  const visibleSupport = supportZones.slice(0, 2);
  const visibleResistance = resistanceZones.slice(0, 2);

  const priceMetrics = useMemo(() => {
    const values = chartCandles.flatMap((candle) => [candle.high, candle.low]);
    if (currentPrice) values.push(currentPrice);
    if (plan) values.push(plan.entry, plan.stopLoss, plan.takeProfit);
    [...visibleSupport, ...visibleResistance].forEach((zone) => values.push(zone.priceMin, zone.priceMax));

    if (!values.length) values.push(4300, 4310);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    const padding = Math.max((rawMax - rawMin) * 0.1, 2.5);
    const max = rawMax + padding;
    const min = rawMin - padding;
    return { min, max, range: Math.max(max - min, 1) };
  }, [chartCandles, currentPrice, plan, visibleResistance, visibleSupport]);

  const priceTop = 28;
  const priceBottom = 350;
  const plotWidth = 610;
  const getY = (price: number) => priceTop + ((priceMetrics.max - price) / priceMetrics.range) * (priceBottom - priceTop);
  const candleGap = plotWidth / Math.max(chartCandles.length, 1);
  const candleWidth = Math.max(5, Math.min(11, candleGap * 0.58));
  const maxVolume = Math.max(...chartCandles.map((candle) => candle.volume ?? 0), 0);
  const priceTicks = Array.from({ length: 6 }, (_, index) => priceMetrics.max - (priceMetrics.range * index) / 5);

  const renderZone = (zone: ChartZone, tone: 'support' | 'resistance', index: number) => {
    const upper = Math.max(zone.priceMin, zone.priceMax);
    const lower = Math.min(zone.priceMin, zone.priceMax);
    const y = getY(upper);
    const height = Math.max(getY(lower) - y, 8);
    const support = tone === 'support';
    const stroke = support ? '#22c98b' : '#e4586b';
    const label = support ? 'แนวรับ' : 'แนวต้าน';

    return (
      <g key={`${tone}-${zone.id ?? index}`}>
        <rect x="0" y={y} width={plotWidth} height={height} fill={stroke} fillOpacity={support ? 0.14 : 0.12} stroke={stroke} strokeOpacity="0.62" />
        <text x={support ? 108 : 8} y={y + Math.min(height - 3, 15)} fill={support ? '#63d9ad' : '#ef9ba7'} fontSize="10" fontWeight="500">
          {label} {formatPrice(lower)}–{formatPrice(upper)}
        </text>
      </g>
    );
  };

  const renderLevel = (value: number | undefined, label: string, color: string, dash = '5 4', tagOffset = 0) => {
    if (!value || !Number.isFinite(value)) return null;
    const y = getY(value);
    return (
      <g>
        <line x1="0" y1={y} x2={plotWidth} y2={y} stroke={color} strokeWidth="1.2" strokeDasharray={dash} />
        <text x="8" y={y - 6} fill={color} fontSize="10" fontWeight="600">{label}</text>
        <rect x="612" y={y - 10 + tagOffset} width="84" height="20" rx="3" fill={color} />
        <text x="654" y={y + 4 + tagOffset} fill="#071018" fontSize="10" fontWeight="700" textAnchor="middle">{formatPrice(value)}</text>
      </g>
    );
  };

  return (
    <section className="flex h-full min-h-[680px] flex-col rounded-xl border border-[#27313b] bg-[#111820] p-4 xl:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-[18px] font-medium text-[#e9edf1]">XAUUSD · {selectedTF}</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> สด
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#929ca8]">Gold Spot / U.S. Dollar</p>
          {latestCandle && (
            <p className="mt-2 font-mono text-[11px] text-[#8f9aa6]">
              O <span className="text-[#cbd2d9]">{formatPrice(latestCandle.open)}</span>{' '}
              H <span className="text-emerald-400">{formatPrice(latestCandle.high)}</span>{' '}
              L <span className="text-rose-400">{formatPrice(latestCandle.low)}</span>{' '}
              C <span className="text-emerald-400">{formatPrice(latestCandle.close)}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[#2a3440] bg-[#0d131a] p-0.5">
            {(['M5', 'M15', 'H1'] as const).map((timeframe) => (
              <button
                key={timeframe}
                type="button"
                onClick={() => setSelectedTF(timeframe)}
                className={`min-h-10 min-w-14 rounded-md px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${selectedTF === timeframe ? 'border border-amber-400/70 bg-amber-400/5 text-amber-400' : 'text-[#a5aeb9] hover:bg-[#1a222c] hover:text-white'}`}
              >
                {timeframe}
              </button>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-[#2a3440] bg-[#0d131a] md:flex">
            {[{ icon: CandlestickChart, label: 'รูปแบบแท่งเทียน' }, { icon: SlidersHorizontal, label: 'ตั้งค่ากราฟ' }, { icon: Expand, label: 'ขยายกราฟ' }].map(({ icon: Icon, label }) => (
              <button key={label} type="button" aria-label={label} className="flex h-10 w-11 items-center justify-center border-r border-[#2a3440] text-[#87929e] last:border-r-0 hover:bg-[#1a222c] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400">
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 min-h-[500px] flex-1 overflow-hidden rounded-lg border border-[#202a34] bg-[#0b1118]">
        {!chartCandles.length && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-[13px] text-[#77828e]">
            <Activity className="mr-2 h-4 w-4" /> รอข้อมูลแท่งเทียนจาก MT5
          </div>
        )}

        <svg className="h-full min-h-[500px] w-full" viewBox="0 0 700 470" preserveAspectRatio="none" role="img" aria-label={`กราฟแท่งเทียน XAUUSD ${selectedTF} พร้อมแนวรับ แนวต้าน Entry Take Profit และ Stop Loss`}>
          {priceTicks.map((price, index) => {
            const y = getY(price);
            return (
              <g key={index}>
                <line x1="0" y1={y} x2={plotWidth} y2={y} stroke="#34404b" strokeOpacity="0.35" strokeDasharray="2 3" />
                <text x="620" y={y + 4} fill="#818c98" fontSize="10">{formatPrice(price)}</text>
              </g>
            );
          })}

          {Array.from({ length: 8 }, (_, index) => (
            <line key={index} x1={(plotWidth * index) / 7} y1={priceTop} x2={(plotWidth * index) / 7} y2="438" stroke="#27323c" strokeOpacity="0.28" />
          ))}

          {visibleResistance.map((zone, index) => renderZone(zone, 'resistance', index))}
          {visibleSupport.map((zone, index) => renderZone(zone, 'support', index))}

          {chartCandles.map((candle, index) => {
            const positive = candle.close >= candle.open;
            const color = positive ? '#1fc48d' : '#f05261';
            const x = index * candleGap + candleGap / 2;
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
            const volumeHeight = maxVolume ? ((candle.volume ?? 0) / maxVolume) * 55 : 0;

            return (
              <g key={`${candle.time}-${index}`} onMouseEnter={() => setHoveredCandle(candle)} onMouseLeave={() => setHoveredCandle(null)} className="cursor-crosshair">
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.3" />
                <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} fill={color} rx="0.8" />
                {volumeHeight > 0 && <rect x={x - candleWidth / 2} y={435 - volumeHeight} width={candleWidth} height={volumeHeight} fill={color} fillOpacity="0.45" />}
              </g>
            );
          })}

          {renderLevel(plan?.takeProfit, 'Take Profit', '#20bd87')}
          {renderLevel(plan?.entry, 'Entry', '#e2b72f', '', 2)}
          {renderLevel(plan?.stopLoss, 'Stop Loss', '#ef4e61', '5 4', 12)}
          {renderLevel(currentPrice ?? undefined, '', '#e3b52d', '2 3', -8)}

          {maxVolume > 0 && <text x="8" y="375" fill="#909aa6" fontSize="10">Volume</text>}

          {chartCandles.filter((_, index) => index % Math.max(Math.ceil(chartCandles.length / 6), 1) === 0).map((candle, index, labels) => (
            <text key={`${candle.time}-${index}`} x={8 + (index * (plotWidth - 24)) / Math.max(labels.length - 1, 1)} y="458" fill="#818c98" fontSize="10">{candle.time}</text>
          ))}
        </svg>

        {hoveredCandle && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-[#34404b] bg-[#101820]/95 px-3 py-2 font-mono text-[11px] text-[#b9c1ca] shadow-xl">
            <strong className="text-amber-400">{hoveredCandle.time}</strong>
            <span>O {formatPrice(hoveredCandle.open)}</span>
            <span className="text-emerald-400">H {formatPrice(hoveredCandle.high)}</span>
            <span className="text-rose-400">L {formatPrice(hoveredCandle.low)}</span>
            <span>C {formatPrice(hoveredCandle.close)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-[#818c98]">
        <div className="flex gap-4"><span>1D</span><span>5D</span><span>1M</span><span>3M</span><span>6M</span><span>YTD</span><span>1Y</span></div>
        <div className="flex gap-4"><span>Asia/Bangkok</span><span>%</span><span>log</span><span className="text-amber-400">auto</span></div>
      </div>
    </section>
  );
}
