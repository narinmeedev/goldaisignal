'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowRight, BarChart3, Clock3, Loader2, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';
import { TRIAL_DURATION_DAYS } from '@/lib/billing';

interface LiveMarketPreviewProps { stats?: PublicDashboardStats | null; loading?: boolean; }
export interface PublicDashboardStats {
  marketIntelligence?: { XAUUSD?: { currentPrice?: number; bias?: string; volatility?: string; hasActivePlan?: boolean; }; };
  mt5Connection?: { realtimeStatus?: { state?: string; message?: string }; };
}

const formatPrice = (value?: number) => typeof value === 'number' && value > 0
  ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'รอข้อมูล';
const biasLabel: Record<string, string> = { BULLISH: 'ขาขึ้น', BEARISH: 'ขาลง', NEUTRAL: 'เป็นกลาง', WAIT_AND_SEE: 'รอดูทิศทาง' };

export default function LiveMarketPreview({ stats: suppliedStats, loading: suppliedLoading }: LiveMarketPreviewProps) {
  const [localStats, setLocalStats] = useState<PublicDashboardStats | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const stats = suppliedStats !== undefined ? suppliedStats : localStats;
  const loading = suppliedLoading !== undefined ? suppliedLoading : localLoading;

  useEffect(() => {
    if (suppliedStats !== undefined && suppliedLoading !== undefined) return;
    const load = async () => {
      try { setLocalStats(await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 12_000, public: true })); }
      catch { setLocalStats(null); }
      finally { setLocalLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [suppliedLoading, suppliedStats]);

  if (loading) return <div className="public-panel flex min-h-[430px] items-center justify-center text-sm text-ga-muted"><Loader2 className="mr-2 h-5 w-5 animate-spin text-ga-gold" />กำลังอ่านสถานะตลาดทองคำ</div>;
  const market = stats?.marketIntelligence?.XAUUSD;
  if (!market) return <div className="public-panel flex min-h-[300px] flex-col items-center justify-center p-8 text-center"><AlertTriangle className="h-7 w-7 text-ga-gold" /><h3 className="mt-4 font-semibold text-ga-text">ยังรับข้อมูลตลาดไม่ได้</h3><p className="mt-2 max-w-md text-sm leading-6 text-ga-muted">ระบบจะไม่สร้างราคาและแผนสมมติ กรุณากลับมาตรวจอีกครั้งเมื่อ MT5 เชื่อมต่อ</p></div>;

  const realtime = stats?.mt5Connection?.realtimeStatus;
  const isLive = realtime?.state === 'LIVE';
  const marketBias = market.bias ?? 'NEUTRAL';
  const bullish = marketBias === 'BULLISH';

  return (
    <section className="public-panel overflow-hidden">
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-ga-border bg-[#0f161e] px-5 py-3">
        <div className="flex items-center gap-3"><BarChart3 className="h-4 w-4 text-ga-gold" /><span className="font-mono text-xs font-semibold text-ga-text">XAUUSD · MARKET OVERVIEW</span></div>
        <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[10px] ${isLive ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-400' : 'border-ga-gold/25 bg-ga-gold/8 text-ga-gold'}`}><span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-ga-gold'}`} />{isLive ? 'LIVE FROM MT5' : 'DATA DELAYED'}</span>
      </div>

      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-ga-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ga-muted">Gold Spot / U.S. Dollar</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><p className="font-mono text-3xl font-semibold tabular-nums text-ga-text sm:text-4xl">{formatPrice(market.currentPrice)}</p><span className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${bullish ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-400' : marketBias === 'BEARISH' ? 'border-rose-500/25 bg-rose-500/8 text-rose-400' : 'border-ga-border bg-ga-canvas text-ga-muted'}`}>{bullish ? <TrendingUp className="h-4 w-4" /> : marketBias === 'BEARISH' ? <TrendingDown className="h-4 w-4" /> : <Activity className="h-4 w-4" />}{biasLabel[marketBias] ?? marketBias}</span></div>

          <div className="relative mt-7 h-32 overflow-hidden rounded-lg border border-ga-border bg-ga-canvas">
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(39,49,59,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(39,49,59,0.28)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <svg viewBox="0 0 520 130" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true"><path d="M0 104 C46 102 55 82 92 88 S148 48 190 61 S246 84 286 53 S345 35 382 45 S442 20 520 27" fill="none" stroke="#20bd87" strokeWidth="2" /><path d="M0 104 C46 102 55 82 92 88 S148 48 190 61 S246 84 286 53 S345 35 382 45 S442 20 520 27 L520 130 L0 130 Z" fill="url(#preview-fill)" opacity=".45" /><defs><linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#20bd87" stopOpacity=".35" /><stop offset="1" stopColor="#20bd87" stopOpacity="0" /></linearGradient></defs></svg>
            <span className="absolute bottom-3 left-3 font-mono text-[10px] text-ga-muted">ภาพประกอบแนวโน้ม · ไม่ใช่กราฟราคาเต็ม</span>
          </div>

          {!isLive && <p className="mt-4 flex gap-2 rounded-lg border border-ga-gold/25 bg-ga-gold/8 p-3 text-xs leading-5 text-[#dbc77e]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{realtime?.message || 'ระบบกำลังรอราคาสดและแท่ง M5 จาก MT5'}</p>}
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-ga-border bg-ga-canvas p-3"><p className="text-xs text-ga-muted">ความผันผวน</p><p className="mt-1 font-mono text-sm font-semibold text-ga-text">{market.volatility ?? '-'}</p></div>
            <div className="rounded-lg border border-ga-border bg-ga-canvas p-3"><p className="text-xs text-ga-muted">สถานะแผน</p><p className="mt-1 text-sm font-semibold text-ga-text">{market.hasActivePlan ? 'มีแผนที่ผ่านเกณฑ์' : 'กำลังรอจังหวะ'}</p></div>
          </div>
          <div className="mt-5 flex-1 rounded-lg border border-ga-border bg-[#0f161e] p-4"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h3 className="mt-3 text-base font-semibold text-ga-text">ใช้ข้อมูลจริง ไม่สร้างแผนเดโม</h3><p className="mt-2 text-sm leading-6 text-ga-muted">สมาชิกจะเห็นแผนเมื่อข้อมูล MT5, เงื่อนไขกลยุทธ์ ความเสี่ยง และ Risk/Reward ผ่านเกณฑ์พร้อมกัน</p></div>
          <div className="mt-4 flex items-center gap-2 text-xs text-ga-muted"><Clock3 className="h-4 w-4 text-ga-gold" />สถานะอัปเดตอัตโนมัติทุก 15 วินาที</div>
          <Link href="/pricing" className="public-button-primary mt-5 min-h-11 px-4 text-sm">ทดลองใช้งาน {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}
