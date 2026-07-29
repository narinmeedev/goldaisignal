'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  History,
  LifeBuoy,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';

type Direction = 'BUY' | 'SELL';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface Zone {
  id?: string;
  timeframe?: string;
  type: string;
  priceMin: number;
  priceMax: number;
  strength?: number;
}

interface TradePlan {
  id: string;
  type: string;
  title: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  confirmation?: string;
  confidence: number;
  direction?: Direction;
  timeframe?: string;
  strategyLabel?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskReasons?: string[];
  riskReward?: number;
  lockedAt?: string;
}

interface TradeResult {
  id: string;
  direction: string;
  result: string;
  entry: number;
  exitPrice?: number | null;
  rrResult?: number;
  openedAt?: string | null;
  closedAt?: string | null;
}

interface PlanLifecycle {
  status: string;
  label: string;
  nextAction: string;
  activePlans: TradeResult[];
  waitingPlans: TradeResult[];
  recentResults: TradeResult[];
}

interface Performance {
  sampleSize: number;
  decidedSampleSize: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  averageRR: number;
}

interface DashboardStats {
  qwenPerformance?: {
    totalRecorded: number;
    wins: number;
    losses: number;
    open: number;
    winRate: number;
    totalRR: number;
    trades: any[];
  };
  marketIntelligence?: Record<string, {
    currentPrice: number;
    bias: string;
    volatility: string;
    nearestSupport: Zone[];
    nearestResistance: Zone[];
    activeOrderPlan?: TradePlan | null;
    timeframeBiases?: { D1?: string; H1?: string; M15?: string; M5?: string };
    marketSession?: string;
  }>;
  mt5Connection?: {
    isLive: boolean;
    priceFeedAgeMs?: number | null;
    m5CandleSyncAgeMs?: number | null;
    lastPriceAt?: string | null;
    realtimeStatus?: { state: string; label: string; message: string };
  };
  planLifecycle?: PlanLifecycle;
  ownerMetrics?: {
    performance?: Performance;
    planLifecycle?: PlanLifecycle;
    freshness?: { aiAnalyzedAt?: string | null; sourceDataAt?: string | null };
  };
}

const formatPrice = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'รอข้อมูล';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
};

const formatAge = (value?: number | null) => {
  if (typeof value !== 'number' || value < 0) return '-';
  if (value < 60_000) return `${Math.max(1, Math.round(value / 1000))} วินาที`;
  return `${Math.round(value / 60_000)} นาที`;
};

const getDirection = (plan?: TradePlan | null): Direction | null => {
  if (plan?.direction === 'BUY' || plan?.direction === 'SELL') return plan.direction;
  if (plan?.type?.includes('BUY')) return 'BUY';
  if (plan?.type?.includes('SELL')) return 'SELL';
  return null;
};

const getEntryInstruction = (plan: TradePlan, isOpen: boolean) => {
  const direction = getDirection(plan);
  if (isOpen) return 'แผนเริ่มวัดผลแล้ว ไม่ควรเปิดซ้ำหรือไล่ราคา ให้ติดตาม TP และ SL ตามแผนเดิม';
  if (plan.type.includes('LIMIT') && direction === 'BUY') return 'รอราคาย่อลงแตะ Entry และเกิดแรงรับก่อนเข้า ห้ามเข้าเหนือจุดที่กำหนด';
  if (plan.type.includes('LIMIT') && direction === 'SELL') return 'รอราคาดีดขึ้นแตะ Entry และเกิดแรงขายก่อนเข้า ห้ามเข้าต่ำกว่าจุดที่กำหนด';
  if (plan.type.includes('STOP') && direction === 'BUY') return 'รอราคาเบรกขึ้นถึง Entry และยืนยันทิศทางก่อนเข้า ห้ามเดาทางล่วงหน้า';
  if (plan.type.includes('STOP') && direction === 'SELL') return 'รอราคาเบรกลงถึง Entry และยืนยันทิศทางก่อนเข้า ห้ามเดาทางล่วงหน้า';
  return 'รอราคาแตะ Entry และรอสัญญาณยืนยันตามแผนก่อนเข้าเท่านั้น';
};

const biasLabel: Record<string, string> = {
  BULLISH: 'ขาขึ้น',
  BEARISH: 'ขาลง',
  BUY: 'ขาขึ้น',
  SELL: 'ขาลง',
  WAIT_AND_SEE: 'รอดูทิศทาง',
  NEUTRAL: 'เป็นกลาง',
};

const riskStyles: Record<RiskLevel, string> = {
  LOW: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  MEDIUM: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  HIGH: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

function Metric({ label, value, detail, valueClassName, className }: { label: string; value: React.ReactNode; detail?: string; valueClassName?: string; className?: string }) {
  return (
    <div className={`min-w-0 px-5 py-4 bg-neutral-950/20 hover:bg-neutral-950/40 transition-colors ${className || ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-lg font-bold ${valueClassName || 'text-neutral-100'}`}>{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-neutral-400/70">{detail}</p>}
    </div>
  );
}

function PriceLevel({ label, value, tone }: { label: string; value: number; tone: 'entry' | 'sl' | 'tp' }) {
  const toneClass = tone === 'tp'
    ? 'border-emerald-500/20 bg-emerald-950/25 text-emerald-300 shadow-[0_2px_12px_rgba(16,185,129,0.02)]'
    : tone === 'sl'
      ? 'border-rose-500/20 bg-rose-950/25 text-rose-300 shadow-[0_2px_12px_rgba(244,63,94,0.02)]'
      : 'border-amber-500/20 bg-amber-950/15 text-amber-200 shadow-[0_2px_12px_rgba(245,158,11,0.02)]';

  return (
    <div className={`rounded-xl border px-5 py-4 text-center transition-transform hover:scale-[1.01] ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="mt-1.5 text-2xl font-black tracking-tight tabular-nums">${formatPrice(value)}</p>
    </div>
  );
}

export default function UserDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQwenAnalyzing, setIsQwenAnalyzing] = useState(false);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [qwenData, setQwenData] = useState<any>(null);
  const [showQwenModal, setShowQwenModal] = useState(false);

  const runQwenAnalysis = async () => {
    setIsQwenAnalyzing(true);
    setShowQwenModal(true);
    try {
      const res = await fetch('/api/admin/qwen-analyze', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setQwenData(data);
        if (data.appliedPlan) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('GOLDAI_SAVED_QWEN_PLAN', JSON.stringify(data.appliedPlan));
            } catch {}
          }
          setStats((prev) => {
            if (!prev || !prev.marketIntelligence?.XAUUSD) return prev;
            return {
              ...prev,
              marketIntelligence: {
                ...prev.marketIntelligence,
                XAUUSD: {
                  ...prev.marketIntelligence.XAUUSD,
                  activeOrderPlan: data.appliedPlan,
                  hasActivePlan: true,
                },
              },
            };
          });
        }
        load(true).catch(() => {});
      } else {
        alert(data.error || 'Qwen 3.5-9B ไม่ตอบกลับ');
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อกับ Qwen 3.5-9B API บนเครื่องได้');
    } finally {
      setIsQwenAnalyzing(false);
    }
  };

  const applyQwenPlan = async () => {
    if (!qwenData?.result) return;
    setIsApplyingPlan(true);
    try {
      const planPayload = {
        action: 'apply',
        plan: {
          ...qwenData.result,
          currentPrice: qwenData.currentPrice,
        },
      };

      const res = await fetch('/api/admin/qwen-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
      });
      const data = await res.json();

      if (data.success) {
        setShowQwenModal(false);
        if (data.appliedPlan) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('GOLDAI_SAVED_QWEN_PLAN', JSON.stringify(data.appliedPlan));
            } catch {}
          }
          setStats((prev) => {
            if (!prev || !prev.marketIntelligence?.XAUUSD) return prev;
            return {
              ...prev,
              marketIntelligence: {
                ...prev.marketIntelligence,
                XAUUSD: {
                  ...prev.marketIntelligence.XAUUSD,
                  activeOrderPlan: data.appliedPlan,
                  hasActivePlan: true,
                },
              },
            };
          });
        }
        alert('✅ บันทึกและนำแผน Qwen 3.5-9B ขึ้นแสดงผลเรียบร้อยแล้ว!');
        load(true).catch(() => {});
      } else {
        alert(data.error || 'ไม่สามารถนำแผนไปใช้ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึกแผน Qwen');
    } finally {
      setIsApplyingPlan(false);
    }
  };

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 15_000, cacheBust: true });
      
      // Fallback: If DB hasn't returned active plan yet, restore from localStorage if applied recently
      let currentActivePlan = data?.marketIntelligence?.XAUUSD?.activeOrderPlan;
      if (!currentActivePlan && typeof window !== 'undefined') {
        try {
          const cachedPlanStr = localStorage.getItem('GOLDAI_SAVED_QWEN_PLAN');
          if (cachedPlanStr) {
            const cachedPlan = JSON.parse(cachedPlanStr);
            const planAgeHours = (Date.now() - new Date(cachedPlan.lockedAt || Date.now()).getTime()) / (1000 * 60 * 60);
            if (planAgeHours < 6) {
              currentActivePlan = cachedPlan;
            }
          }
        } catch {}
      }

      if (data?.marketIntelligence?.XAUUSD) {
        data.marketIntelligence.XAUUSD.activeOrderPlan = currentActivePlan;
        data.marketIntelligence.XAUUSD.hasActivePlan = Boolean(currentActivePlan);
      }

      setStats(data);
      setError(null);
    } catch (loadError) {
      console.warn('[UserDashboard] Non-fatal load error:', loadError);
      // Keep existing stats visible instead of breaking the UI
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role === 'admin') {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const market = stats?.marketIntelligence?.XAUUSD;
  const plan = market?.activeOrderPlan ?? null;
  const lifecycle = stats?.ownerMetrics?.planLifecycle ?? stats?.planLifecycle;
  const performance = stats?.ownerMetrics?.performance;
  const isOpen = (lifecycle?.activePlans?.length ?? 0) > 0;
  const direction = getDirection(plan);
  const isLive = stats?.mt5Connection?.realtimeStatus?.state === 'LIVE';
  const riskLevel = plan?.riskLevel ?? 'HIGH';
  const riskScore = plan?.riskScore ?? null;
  const supportZones = useMemo(() => (market?.nearestSupport ?? []).slice(0, 3), [market?.nearestSupport]);
  const resistanceZones = useMemo(() => (market?.nearestResistance ?? []).slice(0, 3), [market?.nearestResistance]);

  if (loading && !stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-neutral-400">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" /> กำลังอ่านข้อมูลทองคำล่าสุด
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">AI Assistant Active</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold bg-gradient-to-r from-neutral-50 via-neutral-100 to-amber-200 bg-clip-text text-transparent">ผู้ช่วยวิเคราะห์เทรดทองคำ AI</h1>
          <p className="mt-1 text-sm text-neutral-400">ใช้แผนหลักล่าสุดเพียงแผนเดียว และรอ Entry ตามเงื่อนไขก่อนตัดสินใจ</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runQwenAnalysis}
              disabled={isQwenAnalyzing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-950/80 px-4 text-sm font-bold text-purple-200 hover:from-purple-800/70 hover:to-indigo-800/70 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            >
              {isQwenAnalyzing ? <Loader2 className="h-4 w-4 animate-spin text-purple-300" /> : <Sparkles className="h-4 w-4 text-purple-400" />}
              🤖 สั่ง Qwen 3.5-9B วิเคราะห์กราฟสด
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/system/status', { cache: 'no-store' });
                } catch {}
                await load(true);
              }}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-neutral-900 px-3.5 text-sm font-bold text-amber-200 hover:bg-amber-900/50 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              <RefreshCw className={`h-4 w-4 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
              ⚡️ กระตุ้นซิงค์ด่วน (Force Sync)
            </button>
          </div>
        )}
      </header>

      {/* Qwen 3.5-9B Analysis Modal */}
      {showQwenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-purple-500/40 bg-neutral-950 p-6 text-neutral-100 shadow-[0_0_50px_rgba(168,85,247,0.3)]">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-purple-200">Qwen 3.5-9B Local AI Analyst</h3>
                  <p className="text-xs text-neutral-400">ประมวลผลตรงผ่าน LM Studio (127.0.0.1:1234)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQwenModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {isQwenAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                  <p className="mt-4 font-bold text-neutral-200">กำลังยิงข้อมูลกราฟสดเข้า Qwen 3.5-9B LLM...</p>
                  <p className="mt-1 text-xs text-neutral-400">วิเคราะห์ราคาปัจจุบัน, RSI, EMA, และแนวรับต้าน</p>
                </div>
              ) : qwenData?.result ? (
                <>
                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">แหล่งประมวลผล: {qwenData.result.source}</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                        ความมั่นใจ {qwenData.result.confidence}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-200">
                      {qwenData.result.reason}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-center">
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">จุดเข้าเสนอแนะ (ENTRY)</p>
                      <p className="mt-1 text-xl font-black text-amber-200">${qwenData.result.refinedEntry?.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 text-center">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">ตัดขาดทุน (STOP LOSS)</p>
                      <p className="mt-1 text-xl font-black text-rose-200">${qwenData.result.refinedSL?.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-center">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">ทำกำไร (TAKE PROFIT)</p>
                      <p className="mt-1 text-xl font-black text-emerald-200">${qwenData.result.refinedTP?.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowQwenModal(false)}
                      className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
                    >
                      ปิดหน้าต่าง
                    </button>
                    <button
                      type="button"
                      onClick={applyQwenPlan}
                      disabled={isApplyingPlan}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 transition-all"
                    >
                      {isApplyingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      นำแผนไปใช้และอัปเดตหน้าจอ
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center py-6 text-neutral-400">ไม่พบผลการวิเคราะห์</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(() => {
        const biasVal = market?.bias ?? 'NEUTRAL';
        const dataStatusValue = isLive ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            LIVE
          </span>
        ) : (
          <span className="text-amber-500">DELAYED</span>
        );

        return (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-800/60 gap-[1px] backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <Metric label="ราคาทองล่าสุด" value={formatPrice(market?.currentPrice)} detail="USD / troy ounce" className="col-span-1" />
            <Metric label="สถานะข้อมูล" value={dataStatusValue} detail={`ราคา ${formatAge(stats?.mt5Connection?.priceFeedAgeMs)}`} className="col-span-1" />
            <Metric label="ตลาดปัจจุบัน" value={market?.marketSession || 'รอข้อมูล'} detail="ช่วงเวลาเทรดหลัก" className="col-span-1" />
            <Metric 
              label="มุมมองตลาด" 
              value={
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-black transition-colors ${
                  biasVal === 'BULLISH' || biasVal === 'BUY'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : biasVal === 'BEARISH' || biasVal === 'SELL'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                      : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
                }`}>
                  {biasLabel[biasVal] ?? biasVal ?? 'รอข้อมูล'}
                </span>
              } 
              detail={`ความผันผวน ${market?.volatility ?? '-'}`} 
              className="col-span-1"
            />
            <Metric label="อัปเดตล่าสุด" value={formatDateTime(stats?.ownerMetrics?.freshness?.sourceDataAt ?? stats?.mt5Connection?.lastPriceAt)} detail="เวลาไทย" className="col-span-2 sm:col-span-1" />
          </section>
        );
      })()}

      {/* Qwen AI Track Record & Performance Reference Card */}
      {stats?.qwenPerformance && (
        <section className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-neutral-900 to-indigo-950/40 p-4 backdrop-blur-md shadow-[0_4px_20px_rgba(168,85,247,0.15)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/20 text-purple-300">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-200">🏆 สถิติวัดผลแผน Qwen 3.5-9B AI (Track Record Reference)</h3>
                <p className="text-xs text-purple-300/80">ระบบบันทึกและวัดผลการชน TP/SL อัตโนมัติ เพื่อใช้อ้างอิงผลงานประกอบการขายบริการ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
                Win Rate {stats.qwenPerformance.winRate}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-300">
                สะสม +{stats.qwenPerformance.totalRR}R
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg border border-purple-500/20 bg-neutral-950/50 p-2.5">
              <div className="text-xs text-neutral-400">แผนที่บันทึกวัดผลทั้งหมด</div>
              <div className="mt-1 text-base font-bold text-neutral-100">{stats.qwenPerformance.totalRecorded} ไม้</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 p-2.5">
              <div className="text-xs text-emerald-400">ชน Take Profit (ชนะ)</div>
              <div className="mt-1 text-base font-bold text-emerald-300">{stats.qwenPerformance.wins} ไม้</div>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/30 p-2.5">
              <div className="text-xs text-rose-400">ชน Stop Loss (แพ้)</div>
              <div className="mt-1 text-base font-bold text-rose-300">{stats.qwenPerformance.losses} ไม้</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2.5">
              <div className="text-xs text-amber-400">กำลังติดตามผลสด</div>
              <div className="mt-1 text-base font-bold text-amber-300">{stats.qwenPerformance.open} ไม้</div>
            </div>
          </div>
        </section>
      )}

      {(() => {
        const isBuy = direction === 'BUY';
        const isSell = direction === 'SELL';
        const cardBgClass = plan 
          ? isBuy 
            ? 'border-emerald-500/20 bg-gradient-to-b from-neutral-900/90 via-neutral-900/80 to-emerald-950/10 shadow-[0_4px_30px_rgba(16,185,129,0.03)]'
            : 'border-rose-500/20 bg-gradient-to-b from-neutral-900/90 via-neutral-900/80 to-rose-950/10 shadow-[0_4px_30px_rgba(244,63,94,0.03)]'
          : 'border-neutral-800 bg-neutral-900/40 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.2)]';

        return (
          <section id="active-plan" className={`rounded-xl border p-5 sm:p-6 transition-all duration-300 ${cardBgClass}`}>
            <div className="flex flex-col gap-3 border-b border-neutral-800/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isBuy 
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : isSell 
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
                      : 'border-neutral-800 bg-neutral-800/60 text-neutral-400'
                }`}>
                  {isBuy ? <ArrowUp className="h-6 w-6" /> : isSell ? <ArrowDown className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400/80">แผนหลักปัจจุบัน</span>
                    {plan && (
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[8px] font-extrabold uppercase tracking-wide animate-pulse ${
                        isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        Active
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-neutral-50">
                    {plan ? `${direction ?? ''} · ${plan.title}` : 'ยังไม่มีแผนที่ผ่านเกณฑ์'}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {plan ? (isOpen ? 'เปิดวัดผลแล้ว' : 'รอราคาเข้าเงื่อนไข') : 'ระบบจะเงียบจนกว่าข้อมูลสด โครงสร้าง และความเสี่ยงจะผ่านเกณฑ์พร้อมกัน'}
                  </p>
                </div>
              </div>
              {plan && (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-[0_2px_8px_rgba(245,158,11,0.02)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    คะแนน AI: {Math.round(plan.confidence)}/100
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${riskStyles[riskLevel]}`}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    ความเสี่ยง: {riskScore ?? '-'}/100 · {riskLevel}
                  </span>
                </div>
              )}
            </div>

            {plan ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <PriceLevel label="Entry" value={plan.entry} tone="entry" />
                  <PriceLevel label="Stop Loss" value={plan.stopLoss} tone="sl" />
                  <PriceLevel label="Take Profit" value={plan.takeProfit} tone="tp" />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-955/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                      <Target className="h-4 w-4 text-amber-400" /> วิธีใช้แผนนี้
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-300">{getEntryInstruction(plan, isOpen)}</p>
                    <p className="mt-3 border-t border-neutral-800 pt-3 text-sm leading-6 text-neutral-400">{plan.reason}</p>
                  </div>

                  <div className="rounded-lg border border-neutral-800 bg-neutral-955/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                        <Gauge className="h-4 w-4 text-amber-400" /> ความเสี่ยงที่ต้องรู้
                      </div>
                      <span className="text-sm font-semibold text-neutral-300">RR 1:{(plan.riskReward ?? 0).toFixed(2)}</span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {(plan.riskReasons?.length ? plan.riskReasons : ['ทุกแผนมีโอกาสชน Stop Loss และอาจเกิด slippage ในช่วงราคาผันผวน']).map((reason) => (
                        <li key={reason} className="flex gap-2 text-sm leading-5 text-neutral-400">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Clock3 className="mx-auto h-9 w-9 text-neutral-600 animate-pulse" />
                <p className="mt-3 font-semibold text-neutral-200">รอแผนใหม่อย่างมีวินัย</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                  การไม่มีแผนคือสถานะปกติเมื่อคะแนนเงื่อนไขต่ำกว่า 70, ความเสี่ยงสูงกว่า 55, RR ต่ำกว่า 1:2 หรือข้อมูล MT5 ไม่สด
                </p>
              </div>
            )}
          </section>
        );
      })()}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-400" />
            <h2 className="font-bold text-neutral-100">โครงสร้างตลาดที่ระบบเห็น</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(market?.timeframeBiases ?? {}).map(([timeframe, bias]) => (
              <div key={timeframe} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                <p className="text-xs text-neutral-500">{timeframe}</p>
                <p className={`mt-1 text-sm font-semibold ${bias === 'BUY' || bias === 'BULLISH' ? 'text-emerald-300' : bias === 'SELL' || bias === 'BEARISH' ? 'text-rose-300' : 'text-neutral-300'}`}>
                  {biasLabel[bias ?? 'NEUTRAL'] ?? bias}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><TrendingUp className="h-4 w-4" /> แนวรับ</p>
              <div className="mt-2 space-y-2">
                {supportZones.length ? supportZones.map((zone, index) => {
                  const strength = zone.strength ?? 1;
                  const isStrong = strength >= 4;
                  const isMedium = strength === 3;
                  const priceClass = isStrong 
                    ? 'text-emerald-400 font-bold' 
                    : isMedium 
                      ? 'text-amber-400 font-bold' 
                      : 'text-neutral-200';
                  return (
                    <div key={zone.id ?? `${zone.priceMin}-${index}`} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm">
                      <span className="flex items-center gap-1.5 text-neutral-500">
                        {zone.timeframe ?? 'Zone'}
                        {isStrong && <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-300">★ แข็ง</span>}
                        {isMedium && <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300">★ แข็ง</span>}
                      </span>
                      <span className={`font-medium tabular-nums ${priceClass}`}>
                        {formatPrice(zone.priceMin)} - {formatPrice(zone.priceMax)}
                      </span>
                    </div>
                  );
                }) : <p className="py-3 text-sm text-neutral-500">ยังไม่มีแนวรับที่ยืนยันจากข้อมูลจริง</p>}
              </div>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-300"><TrendingDown className="h-4 w-4" /> แนวต้าน</p>
              <div className="mt-2 space-y-2">
                {resistanceZones.length ? resistanceZones.map((zone, index) => {
                  const strength = zone.strength ?? 1;
                  const isStrong = strength >= 4;
                  const isMedium = strength === 3;
                  const priceClass = isStrong 
                    ? 'text-rose-400 font-bold' 
                    : isMedium 
                      ? 'text-amber-400 font-bold' 
                      : 'text-neutral-200';
                  return (
                    <div key={zone.id ?? `${zone.priceMax}-${index}`} className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm">
                      <span className="flex items-center gap-1.5 text-neutral-500">
                        {zone.timeframe ?? 'Zone'}
                        {isStrong && <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-300">★ แข็ง</span>}
                        {isMedium && <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300">★ แข็ง</span>}
                      </span>
                      <span className={`font-medium tabular-nums ${priceClass}`}>
                        {formatPrice(zone.priceMin)} - {formatPrice(zone.priceMax)}
                      </span>
                    </div>
                  );
                }) : <p className="py-3 text-sm text-neutral-500">ยังไม่มีแนวต้านที่ยืนยันจากข้อมูลจริง</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-amber-400" />
              <h2 className="font-bold text-neutral-100">ผลวัดแผนจริงล่าสุด</h2>
            </div>
            <Link href="/admin/trades" className="text-sm font-medium text-amber-400 hover:text-amber-300">ดูทั้งหมด</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-950/60">
            <Metric label="Win rate" value={performance?.decidedSampleSize ? `${performance.winRate}%` : '-'} detail={`${performance?.decidedSampleSize ?? 0} ผลตัดสิน`} />
            <Metric label="ชนะ / แพ้" value={`${performance?.wins ?? 0} / ${performance?.losses ?? 0}`} />
            <Metric label="Average R" value={performance?.sampleSize ? `${performance.averageRR.toFixed(2)}R` : '-'} />
          </div>
          <div className="mt-4 space-y-2">
            {(lifecycle?.recentResults ?? []).slice(0, 5).map((trade) => (
              <div key={trade.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-3">
                <div className="flex items-center gap-3">
                  {trade.result === 'WIN' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 text-rose-400" />}
                  <div>
                    <p className="text-sm font-semibold text-neutral-200">{trade.direction} · {trade.result}</p>
                    <p className="text-xs text-neutral-500">{formatDateTime(trade.closedAt)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${Number(trade.rrResult) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Number(trade.rrResult ?? 0).toFixed(2)}R</span>
              </div>
            ))}
            {!lifecycle?.recentResults?.length && <p className="py-7 text-center text-sm text-neutral-500">ยังไม่มีผลปิดแผนเพียงพอสำหรับสรุป</p>}
          </div>
          <p className="mt-4 text-xs leading-5 text-neutral-500">Win rate เป็นผลย้อนหลังจากแผนที่ปิดแล้ว ไม่ใช่การรับประกันผลลัพธ์ของแผนถัดไป และตัวอย่างจำนวนน้อยมีความคลาดเคลื่อนสูง</p>
        </section>
      </div>

      <footer className="flex flex-col gap-3 border-t border-neutral-800 py-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>การเทรดทองคำมีความเสี่ยง ใช้ Stop Loss และขนาดสัญญาที่เหมาะกับเงินทุนทุกครั้ง</p>
        <Link href="/admin/support" className="inline-flex items-center gap-2 font-medium text-neutral-300 hover:text-white"><LifeBuoy className="h-4 w-4" /> ติดต่อทีมดูแล</Link>
      </footer>
    </main>
  );
}
