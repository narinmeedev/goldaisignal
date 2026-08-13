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
  Flame,
  Gauge,
  History,
  LifeBuoy,
  Loader2,
  Pin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import TradePlanChart from './components/TradePlanChart';
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
  planTime?: string;
  createdAtThailand?: string;
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
  suggestedPlans?: any[];
  marketIntelligence?: Record<string, {
    currentPrice: number;
    bias: string;
    volatility: string;
    nearestSupport: Zone[];
    nearestResistance: Zone[];
    activeOrderPlan?: TradePlan | null;
    timeframeBiases?: { D1?: string; H1?: string; M15?: string; M5?: string };
    marketSession?: string;
    candles?: any[];
    m5Candles?: any[];
    m15Candles?: any[];
    h1Candles?: any[];
    proactivePlans?: any[];
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

function renderHighlightedReason(reasonText: string) {
  if (!reasonText) return null;

  const parts = reasonText.split(/(\(.*?\))/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('(') && part.endsWith(')')) {
          const content = part.slice(1, -1);
          const isWarning = part.includes('ห้าม') || part.includes('คัท') || part.includes('เสีย');
          const isBullish = part.includes('ขึ้น') || part.includes('BOS') || part.includes('CHoCH');

          const bgClass = isWarning
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
            : isBullish
              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]';

          return (
            <span
              key={i}
              className={`mx-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-black tracking-wide ${bgClass}`}
            >
              {content}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
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
  const [pinnedPlanId, setPinnedPlanId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPin = localStorage.getItem('goldai_pinned_plan_id');
      if (savedPin) setPinnedPlanId(savedPin);
    }
  }, []);

  const handleResetStats = async () => {
    if (!confirm('⚠️ คุณต้องการรีเซ็ตสถิติและประวัติการเทรดทั้งหมดเพื่อเริ่มวัดผลใหม่ใช่หรือไม่?')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/trades', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + data.message);
        await load(true);
      } else {
        alert('❌ ' + (data.error || 'ไม่สามารถรีเซ็ตสถิติได้'));
      }
    } catch {
      alert('❌ ไม่สามารถเชื่อมต่อระบบรีเซ็ตได้');
    } finally {
      setIsResetting(false);
    }
  };

  const togglePinPlan = (id: string) => {
    const newPin = pinnedPlanId === id ? null : id;
    setPinnedPlanId(newPin);
    if (typeof window !== 'undefined') {
      if (newPin) localStorage.setItem('goldai_pinned_plan_id', newPin);
      else localStorage.removeItem('goldai_pinned_plan_id');
    }
  };

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
            const planAgeMins = (Date.now() - new Date(cachedPlan.lockedAt || Date.now()).getTime()) / (1000 * 60);
            if (planAgeMins < 20 && !cachedPlan.isClosed) {
              currentActivePlan = cachedPlan;
            } else {
              localStorage.removeItem('GOLDAI_SAVED_QWEN_PLAN');
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
    }, 3_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 15-minute automatic Qwen AI re-analysis
    const qwenInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch('/api/admin/qwen-analyze', { method: 'POST' })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.appliedPlan) {
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
          })
          .catch(() => {});
      }
    }, 15 * 60 * 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.clearInterval(qwenInterval);
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
    <div className="w-full max-w-none space-y-4 sm:space-y-6">


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



      {/* MAIN TWO-COLUMN SPLIT SCREEN (LEFT: EXPANDED LIVE CHART, RIGHT: ACTIVE TRADE PLAN) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: EXPANDED LIVE CHART & CANDLE VISUALIZER (8 Cols for Maximum Width) */}
        <div className="lg:col-span-8 space-y-6">
          <section id="active-plan-chart-supplement" className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" /> 📈 กราฟแท่งเทียนสด & โซนออเดอร์ (Live Chart & Level Overlays)
              </h3>
              <span className="text-xs text-neutral-400">ข้อมูลแท่งเทียนสดจาก MT5 Feed</span>
            </div>
            <TradePlanChart
              plan={plan}
              currentPrice={market?.currentPrice ?? null}
              candles={market?.candles || []}
              m5Candles={market?.m5Candles || []}
              m15Candles={market?.m15Candles || []}
              h1Candles={market?.h1Candles || []}
              timeframe="M15"
              marketSession={market?.marketSession || 'ปลายตลาดนิวยอร์ก'}
              bias={market?.bias ?? 'NEUTRAL'}
            />
          </section>
        </div>

        {/* RIGHT COLUMN: ACTIVE TRADE PLAN CARD ONLY (4 Cols on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Trade Plan Card */}
          {(() => {
            const isBuy = direction === 'BUY';
            const isSell = direction === 'SELL';
            const cardBgClass = plan 
              ? isBuy 
                ? 'border-emerald-500/20 bg-gradient-to-b from-neutral-900/90 via-neutral-900/80 to-emerald-950/10 shadow-[0_4px_30px_rgba(16,185,129,0.03)]'
                : 'border-rose-500/20 bg-gradient-to-b from-neutral-900/90 via-neutral-900/80 to-rose-950/10 shadow-[0_4px_30px_rgba(244,63,94,0.03)]'
              : 'border-neutral-800 bg-neutral-900/40 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.2)]';

            return (
              <section id="active-plan" className={`rounded-xl border p-5 transition-all duration-300 ${cardBgClass}`}>
                <div className="flex flex-col gap-3 border-b border-neutral-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                      isBuy 
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                        : isSell 
                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
                          : 'border-neutral-800 bg-neutral-800/60 text-neutral-400'
                    }`}>
                      {isBuy ? <ArrowUp className="h-5 w-5" /> : isSell ? <ArrowDown className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400/80">แผนหลักปัจจุบัน</span>
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[9px] font-black text-sky-300 border border-sky-500/30 uppercase">
                          {plan?.timeframe ? `สัญญาณ ${plan.timeframe}` : 'สัญญาณ M15'}
                        </span>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Flame className="h-2.5 w-2.5 text-amber-400 fill-amber-400" /> 🔥 ต้นเทรนด์
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-neutral-50">
                        {plan ? `${direction ?? ''} · ${plan.title}` : 'ยังไม่มีแผนที่ผ่านเกณฑ์'}
                      </h2>
                    </div>
                  </div>
                  {plan && (
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                        AI: {Math.round(plan.confidence)}/100
                      </span>
                    </div>
                  )}
                </div>

                {plan ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-2.5 grid-cols-3">
                      <PriceLevel label="Entry" value={plan.entry} tone="entry" />
                      <PriceLevel label="Stop Loss" value={plan.stopLoss} tone="sl" />
                      <PriceLevel label="Take Profit" value={plan.takeProfit} tone="tp" />
                    </div>

                    <div className="rounded-lg border border-neutral-800 bg-neutral-955/40 p-3.5 text-xs leading-5 text-neutral-300">
                      {renderHighlightedReason(plan.reason)}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Clock3 className="mx-auto h-8 w-8 text-neutral-600 animate-pulse" />
                    <p className="mt-2 text-sm font-semibold text-neutral-200">รอราคาเข้าเงื่อนไขโซนสวย</p>
                  </div>
                )}
              </section>
            );
          })()}

          {/* 2. Market Structure & Trend Confluence (BACK IN RIGHT COLUMN) */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)] space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
              <Activity className="h-4 w-4 text-amber-400" />
              <h3 className="font-bold text-sm text-neutral-100">🎯 เทรนด์ตลาด & โครงสร้างราคา (MTF Confluence)</h3>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {Object.entries(market?.timeframeBiases ?? {}).map(([timeframe, bias]) => (
                <div key={timeframe} className="rounded-lg border border-neutral-800/80 bg-neutral-955/60 p-2">
                  <p className="text-[10px] text-neutral-500 font-bold">{timeframe}</p>
                  <p className={`mt-0.5 text-xs font-black ${bias === 'BUY' || bias === 'BULLISH' ? 'text-emerald-400' : bias === 'SELL' || bias === 'BEARISH' ? 'text-rose-400' : 'text-neutral-400'}`}>
                    {biasLabel[bias ?? 'NEUTRAL'] ?? bias}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5">
                <p className="flex items-center gap-1 text-xs font-bold text-emerald-400"><TrendingUp className="h-3.5 w-3.5" /> 🟢 แนวรับ (Support)</p>
                <div className="mt-1.5 space-y-1 text-xs">
                  {supportZones.length ? supportZones.slice(0, 2).map((zone, index) => (
                    <div key={zone.id ?? index} className="flex justify-between font-mono text-neutral-300">
                      <span>{zone.timeframe || 'Key'}</span>
                      <span className="font-bold text-emerald-300">${formatPrice(zone.priceMax)}</span>
                    </div>
                  )) : <span className="text-[11px] text-neutral-500">รอโซนใหม่</span>}
                </div>
              </div>

              <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-2.5">
                <p className="flex items-center gap-1 text-xs font-bold text-rose-400"><TrendingDown className="h-3.5 w-3.5" /> 🔴 แนวต้าน (Resistance)</p>
                <div className="mt-1.5 space-y-1 text-xs">
                  {resistanceZones.length ? resistanceZones.slice(0, 2).map((zone, index) => (
                    <div key={zone.id ?? index} className="flex justify-between font-mono text-neutral-300">
                      <span>{zone.timeframe || 'Key'}</span>
                      <span className="font-bold text-rose-300">${formatPrice(zone.priceMin)}</span>
                    </div>
                  )) : <span className="text-[11px] text-neutral-500">รอโซนใหม่</span>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* FULL-WIDTH SECOND ROW: LIST OF CANDIDATE TRADE PLANS (5 PLANS IN HORIZONTAL GRID) */}
      {(() => {
        const proactiveList = (market?.proactivePlans || []).map((p: any) => ({
          id: p.id || `proactive-${p.entry}`,
          type: p.type || (p.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT'),
          title: p.title || `แผน ${p.type || p.direction} ย่อ/เด้งรับโซน`,
          entry: Number(p.entry),
          stopLoss: Number(p.stopLoss),
          takeProfit: Number(p.takeProfit || p.takeProfit1),
          confidence: Number(p.confidence || 88),
          reason: p.reason || p.notes,
          direction: p.type?.includes('BUY') || p.direction === 'BUY' ? 'BUY' : 'SELL',
        }));

        const suggestedList = (stats?.suggestedPlans || [])
          .filter((p: any) => p.result === 'PLAN')
          .map((p: any) => ({
            id: p.id,
            type: p.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT',
            title: p.notes || `แผน ${p.direction} รอราคาเข้า`,
            entry: Number(p.entry),
            stopLoss: Number(p.stopLoss),
            takeProfit: Number(p.takeProfit1 || p.takeProfit),
            confidence: Number(p.confidence || 88),
            reason: p.notes,
            direction: p.direction,
          }));

        const planMap = new Map<string, any>();
        [...proactiveList, ...suggestedList].forEach((item) => {
          const key = `${item.direction}_${item.entry.toFixed(2)}`;
          if (!planMap.has(key)) planMap.set(key, item);
        });

        const currentPx = market?.currentPrice ?? 0;
        const candidatePlans = Array.from(planMap.values()).sort((a, b) => {
          if (a.id === pinnedPlanId) return -1;
          if (b.id === pinnedPlanId) return 1;
          return Math.abs(a.entry - currentPx) - Math.abs(b.entry - currentPx);
        });

        return (
          <section id="candidate-plans-list" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.3)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-neutral-100">
                  📋 แผนเทรดสำรอง / โซนรอเข้าตามลำดับ ({candidatePlans.length} แผน)
                </h3>
              </div>
              <span className="text-xs text-neutral-400">
                เรียงเป็นแถวอิสระ สามารถคลิก <Pin className="inline h-3 w-3 text-amber-400" /> ปักหมุดแผนที่ต้องการให้อยู่ซ้ายสุดได้
              </span>
            </div>

            {candidatePlans.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {candidatePlans.map((item, idx) => {
                  const isBuyPlan = item.direction === 'BUY';
                  const distToEntry = Math.abs((market?.currentPrice ?? 0) - item.entry).toFixed(2);
                  const isPinned = item.id === pinnedPlanId;
                  const isEarlyTrend = item.isEarlyTrend || idx === 0 || item.reason?.includes('CHoCH') || item.reason?.includes('ต้นเทรนด์');

                  return (
                    <div
                      key={item.id || idx}
                      className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-300 hover:border-neutral-700 ${
                        isPinned
                          ? 'border-amber-400/80 bg-neutral-900 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/50'
                          : isBuyPlan
                            ? 'border-emerald-500/20 bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-emerald-950/20'
                            : 'border-rose-500/20 bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-rose-950/20'
                      }`}
                    >
                      <div>
                        {/* Card Header: Type Badge & Pin Button */}
                        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                              isBuyPlan ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {isBuyPlan ? <ArrowUp className="mr-1 h-3 w-3 inline" /> : <ArrowDown className="mr-1 h-3 w-3 inline" />}
                              {item.type || `${item.direction}_LIMIT`}
                            </span>
                          </div>

                          <button
                            onClick={() => togglePinPlan(item.id)}
                            title={isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดแผนนี้'}
                            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-extrabold transition-all ${
                              isPinned ? 'border-amber-400 bg-amber-500/20 text-amber-300' : 'border-neutral-800 text-neutral-400 hover:text-amber-300'
                            }`}
                          >
                            <Pin className={`h-2.5 w-2.5 ${isPinned ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
                            {isPinned ? 'ปักแล้ว' : 'ปักหมุด'}
                          </button>
                        </div>

                        {/* Sub Header: Distance & Time */}
                        <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                          <span>ห่างราคาปัจจุบัน: <strong className="text-neutral-200 tabular-nums">${distToEntry}</strong></span>
                          {isEarlyTrend && (
                            <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-black text-amber-300 border border-amber-500/30">
                              🔥 ต้นเทรนด์
                            </span>
                          )}
                        </div>

                        {/* Price Grid */}
                        <div className="mt-2.5 grid grid-cols-3 gap-1 text-center text-[11px]">
                          <div className="rounded bg-neutral-950 p-1.5 border border-sky-500/20">
                            <div className="text-[9px] text-sky-400 font-bold">Entry</div>
                            <div className="font-bold text-neutral-100">${item.entry.toFixed(2)}</div>
                          </div>
                          <div className="rounded bg-neutral-950 p-1.5 border border-rose-500/20">
                            <div className="text-[9px] text-rose-400 font-bold">SL</div>
                            <div className="font-bold text-rose-300">${item.stopLoss.toFixed(2)}</div>
                          </div>
                          <div className="rounded bg-neutral-950 p-1.5 border border-emerald-500/20">
                            <div className="text-[9px] text-emerald-400 font-bold">TP</div>
                            <div className="font-bold text-emerald-300">${item.takeProfit.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {(item.reason || item.title) && (
                        <div className="mt-2.5 text-[10px] leading-4 text-neutral-300 border-t border-neutral-800/60 pt-2 font-medium line-clamp-2">
                          {renderHighlightedReason(item.reason || item.title)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-4 text-xs text-neutral-500">ไม่มีแผนสำรองค้างในระบบ</p>
            )}
          </section>
        );
      })()}

      {/* BOTTOM SECTION: PERFORMANCE STATISTICS & TRACK RECORD */}
      <div id="stats-overview" className="mt-6 space-y-6">
        {stats?.qwenPerformance && (
          <section className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-neutral-900 to-indigo-950/40 p-4 backdrop-blur-md shadow-[0_4px_20px_rgba(168,85,247,0.15)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-purple-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/20 text-purple-300">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-purple-200">📊 สถิติวัดผลแผน Qwen AI (Performance Track Record)</h3>
                  <p className="text-xs text-purple-300/80">ระบบบันทึกและวัดผลอัตโนมัติ เพื่อใช้อ้างอิงผลงานสด 100%</p>
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
                <div className="text-xs text-neutral-400">แผนทั้งหมด</div>
                <div className="mt-1 text-base font-bold text-neutral-100">{stats.qwenPerformance.totalRecorded} ไม้</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 p-2.5">
                <div className="text-xs text-emerald-400">Take Profit (ชนะ)</div>
                <div className="mt-1 text-base font-bold text-emerald-300">{stats.qwenPerformance.wins} ไม้</div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-950/30 p-2.5">
                <div className="text-xs text-rose-400">Stop Loss (แพ้)</div>
                <div className="mt-1 text-base font-bold text-rose-300">{stats.qwenPerformance.losses} ไม้</div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2.5">
                <div className="text-xs text-amber-400">กำลังติดตามผลสด</div>
                <div className="mt-1 text-base font-bold text-amber-300">{stats.qwenPerformance.open} ไม้</div>
              </div>
            </div>
          </section>
        )}
      </div>

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

      <footer className="flex flex-col gap-3 border-t border-neutral-800 py-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>การเทรดทองคำมีความเสี่ยง ใช้ Stop Loss และขนาดสัญญาที่เหมาะกับเงินทุนทุกครั้ง</p>
        <Link href="/admin/support" className="inline-flex items-center gap-2 font-medium text-neutral-300 hover:text-white"><LifeBuoy className="h-4 w-4" /> ติดต่อทีมดูแล</Link>
      </footer>
    </div>
  );
}
