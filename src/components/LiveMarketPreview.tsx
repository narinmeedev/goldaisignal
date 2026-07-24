'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowRight, Clock3, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';
import { TRIAL_DURATION_DAYS } from '@/lib/billing';

interface LiveMarketPreviewProps {
  stats?: PublicDashboardStats | null;
  loading?: boolean;
}

export interface PublicDashboardStats {
  marketIntelligence?: {
    XAUUSD?: {
      currentPrice?: number;
      bias?: string;
      volatility?: string;
      hasActivePlan?: boolean;
    };
  };
  mt5Connection?: {
    realtimeStatus?: { state?: string; message?: string };
  };
}

const formatPrice = (value?: number) => typeof value === 'number' && value > 0
  ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : 'รอข้อมูล';

const biasLabel: Record<string, string> = {
  BULLISH: 'ขาขึ้น',
  BEARISH: 'ขาลง',
  NEUTRAL: 'เป็นกลาง',
  WAIT_AND_SEE: 'รอดูทิศทาง',
};

export default function LiveMarketPreview({ stats: suppliedStats, loading: suppliedLoading }: LiveMarketPreviewProps) {
  const [localStats, setLocalStats] = useState<PublicDashboardStats | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const stats = suppliedStats !== undefined ? suppliedStats : localStats;
  const loading = suppliedLoading !== undefined ? suppliedLoading : localLoading;

  useEffect(() => {
    if (suppliedStats !== undefined && suppliedLoading !== undefined) return;
    const load = async () => {
      try {
        setLocalStats(await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 12_000, public: true }));
      } catch {
        setLocalStats(null);
      } finally {
        setLocalLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [suppliedLoading, suppliedStats]);

  if (loading) {
    return <div className="flex min-h-56 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-sm text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />กำลังอ่านสถานะตลาดทองคำ</div>;
  }

  const market = stats?.marketIntelligence?.XAUUSD;
  if (!market) {
    return <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100"><AlertTriangle className="mb-2 h-5 w-5" />ยังรับข้อมูลตลาดไม่ได้ ระบบจะไม่แสดงราคาและแผนสมมติ</div>;
  }

  const realtime = stats?.mt5Connection?.realtimeStatus;
  const isLive = realtime?.state === 'LIVE';
  const marketBias = market.bias ?? 'NEUTRAL';
  const bullish = marketBias === 'BULLISH';

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="grid gap-0 lg:grid-cols-[1fr_0.85fr]">
        <div className="border-b border-neutral-800 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={isLive ? 'text-emerald-300' : 'text-amber-300'}>{isLive ? 'LIVE FROM MT5' : 'DATA DELAYED'}</span>
              </div>
              <p className="mt-3 text-sm text-neutral-500">ราคาทองคำ XAUUSD</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-50">{formatPrice(market.currentPrice)}</p>
            </div>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${bullish ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : marketBias === 'BEARISH' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-neutral-700 bg-neutral-950 text-neutral-300'}`}>
              {bullish ? <TrendingUp className="h-4 w-4" /> : marketBias === 'BEARISH' ? <TrendingDown className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
              {biasLabel[marketBias] ?? marketBias}
            </div>
          </div>

          {!isLive && <p className="mt-5 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-5 text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />{realtime?.message || 'ระบบกำลังรอราคาสดและแท่ง M5 จาก MT5'}</p>}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"><p className="text-xs text-neutral-500">ความผันผวน</p><p className="mt-1 font-semibold text-neutral-200">{market.volatility ?? '-'}</p></div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"><p className="text-xs text-neutral-500">สถานะแผนสมาชิก</p><p className="mt-1 font-semibold text-neutral-200">{market.hasActivePlan ? 'มีแผนที่ผ่านเกณฑ์' : 'กำลังรอจังหวะ'}</p></div>
          </div>
        </div>

        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <Clock3 className="h-6 w-6 text-amber-400" />
            <h3 className="mt-3 text-lg font-bold text-neutral-50">ไม่มีแผนเดโมและไม่สร้างจุดเข้าแทนข้อมูลจริง</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">สมาชิกจะเห็นแผนหลักเพียงแผนเดียวเมื่อข้อมูล MT5 สด คะแนนเงื่อนไข ความเสี่ยง และ Risk/Reward ผ่านเกณฑ์พร้อมกัน</p>
          </div>
          <Link href="/pricing" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-neutral-950 hover:bg-amber-300">
            ทดลองใช้งาน {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
