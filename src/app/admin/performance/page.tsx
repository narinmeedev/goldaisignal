'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Target } from 'lucide-react';

interface Bucket {
  name?: string;
  wins: number;
  losses: number;
  be: number;
  total: number;
  netR: number;
  netPoints: number;
}

interface ResearchCandidate {
  id: string;
  label: string;
  mode: string;
  status: 'APPROVED' | 'RESEARCHING';
  winRate: number;
  sampleSize: number;
  netR: number;
  rationale: string;
  liveForwardTest?: { winRate: number; sampleSize: number; wins: number; losses: number; breakEven: number; netR: number };
  backtest?: { winRate: number; sampleSize: number; wins: number; losses: number; netR: number };
}

interface PerformanceData {
  summary: {
    totalSignalsCount: number;
    totalClosed: number;
    decidedSampleSize: number;
    wins: number;
    losses: number;
    breakEven: number;
    winRate: number;
    winRate7d: number;
    total7d: number;
    winRate30d: number;
    total30d: number;
    winRate90d: number;
    total90d: number;
    profitFactor: number | null;
    averageRR: number;
    totalR: number;
    averagePoints: number | null;
    totalPoints: number | null;
    pointSampleSize: number;
    maxLosingStreak: number;
    bestSession: string;
    bestTimeframe: string;
    bestSetupType: string;
  };
  sessions: Record<string, Bucket>;
  timeframes: Record<string, Bucket>;
  setups: Record<string, Bucket>;
  strategyResearch?: { generatedAt: string; targetWinRate: number; candidates: ResearchCandidate[] } | null;
}

const winRate = (bucket: Bucket) => {
  const decided = bucket.wins + bucket.losses;
  return decided ? Math.round((bucket.wins / decided) * 100) : null;
};

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border-r border-neutral-800 p-4 last:border-r-0"><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 text-xl font-bold text-neutral-100">{value}</p><p className="mt-1 text-xs text-neutral-500">{detail}</p></div>;
}

function BreakdownTable({ title, rows }: { title: string; rows: Record<string, Bucket> }) {
  const entries = Object.entries(rows);
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
      <h2 className="border-b border-neutral-800 px-4 py-3 text-sm font-bold text-neutral-200">{title}</h2>
      {entries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-neutral-950/60 text-xs text-neutral-500"><tr><th className="px-4 py-3">กลุ่ม</th><th className="px-4 py-3">W / L / BE</th><th className="px-4 py-3">Win rate</th><th className="px-4 py-3 text-right">Net R</th></tr></thead><tbody className="divide-y divide-neutral-800">{entries.map(([name, bucket]) => { const rate = winRate(bucket); return <tr key={name}><td className="px-4 py-3 font-medium text-neutral-200">{bucket.name ?? name}</td><td className="px-4 py-3 text-neutral-400">{bucket.wins} / {bucket.losses} / {bucket.be}</td><td className="px-4 py-3 text-neutral-300">{rate === null ? '-' : `${rate}%`} <span className="text-xs text-neutral-600">({bucket.wins + bucket.losses})</span></td><td className={`px-4 py-3 text-right font-bold ${bucket.netR >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{bucket.netR >= 0 ? '+' : ''}{bucket.netR.toFixed(2)}R</td></tr>; })}</tbody></table></div> : <p className="p-6 text-sm text-neutral-500">ยังไม่มีตัวอย่าง</p>}
    </section>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/performance', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดสถิติไม่สำเร็จ');
      setData(result);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดสถิติไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังคำนวณผลจากแผนที่ปิดจริง</div>;
  if (error || !data) return <div className="m-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || 'ไม่มีข้อมูลสถิติ'}</div>;

  const summary = data.summary;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Measured Performance</span></div><h1 className="mt-2 text-2xl font-bold">ประสิทธิภาพแผนทองคำ</h1><p className="mt-1 text-sm text-neutral-400">คำนวณจากแผน XAU ที่ปิดผลในฐานข้อมูลเท่านั้น ไม่มีการเติมผลหรือราคาจำลอง</p></div>
        <button type="button" onClick={() => load(true)} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />อัปเดต</button>
      </header>

      {summary.decidedSampleSize < 20 && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">ตัวอย่างยังน้อย: {summary.decidedSampleSize} ผลตัดสิน</p><p className="text-amber-100/75">Win rate ช่วงนี้อาจแกว่งมาก ควรใช้ประกอบการประเมินระบบ ไม่ควรตีความเป็นโอกาสชนะของแผนถัดไป</p></div></div>}

      <section className="grid overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Win rate รวม" value={summary.decidedSampleSize ? `${summary.winRate}%` : '-'} detail={`${summary.wins} ชนะ / ${summary.losses} แพ้`} />
        <SummaryMetric label="ผลรวม" value={`${summary.totalR >= 0 ? '+' : ''}${summary.totalR.toFixed(2)}R`} detail={`${summary.totalClosed} แผนปิดผล รวม BE ${summary.breakEven}`} />
        <SummaryMetric label="Average R" value={`${summary.averageRR >= 0 ? '+' : ''}${summary.averageRR.toFixed(2)}R`} detail="เฉลี่ยรวมทุกแผนที่ปิด" />
        <SummaryMetric label="Profit factor" value={summary.profitFactor === null ? '-' : summary.profitFactor.toFixed(2)} detail="Gross win R / Gross loss R" />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="font-bold text-neutral-100">Win rate ตามช่วงเวลา</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[[7, summary.winRate7d, summary.total7d], [30, summary.winRate30d, summary.total30d], [90, summary.winRate90d, summary.total90d]].map(([days, rate, sample]) => <div key={days} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"><p className="text-xs text-neutral-500">{days} วัน</p><p className="mt-1 text-2xl font-bold text-neutral-100">{sample ? `${rate}%` : '-'}</p><p className="mt-1 text-xs text-neutral-500">{sample} ผลตัดสิน</p></div>)}
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><p className="rounded-lg border border-neutral-800 p-3 text-neutral-400">แพ้ติดกันสูงสุด <strong className="block text-lg text-rose-300">{summary.maxLosingStreak}</strong></p><p className="rounded-lg border border-neutral-800 p-3 text-neutral-400">Session เด่น <strong className="block text-lg text-neutral-200">{summary.bestSession}</strong></p><p className="rounded-lg border border-neutral-800 p-3 text-neutral-400">Timeframe เด่น <strong className="block text-lg text-neutral-200">{summary.bestTimeframe}</strong></p><p className="rounded-lg border border-neutral-800 p-3 text-neutral-400">Setup เด่น <strong className="block truncate text-lg text-neutral-200">{summary.bestSetupType}</strong></p></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3"><BreakdownTable title="แยกตาม Session" rows={data.sessions} /><BreakdownTable title="แยกตาม Timeframe" rows={data.timeframes} /><BreakdownTable title="แยกตามกลยุทธ์" rows={data.setups} /></div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="flex items-center gap-2 font-bold"><Target className="h-5 w-5 text-amber-400" />สถานะกลยุทธ์ที่ระบบกำลังเรียนรู้</h2><p className="mt-1 text-sm text-neutral-400">ระบบคัดกลยุทธ์ที่ผลวัดต่ำกว่าเกณฑ์ออกจากการสร้างแผนใหม่โดยอัตโนมัติ</p></div><p className="text-xs text-neutral-500">อัปเดต {data.strategyResearch?.generatedAt ? new Date(data.strategyResearch.generatedAt).toLocaleString('th-TH-u-ca-gregory') : '-'}</p></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="text-xs text-neutral-500"><tr><th className="px-3 py-3">กลยุทธ์</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3">Forward result</th><th className="px-3 py-3">Backtest</th><th className="px-3 py-3">Net R</th></tr></thead><tbody className="divide-y divide-neutral-800">{(data.strategyResearch?.candidates ?? []).map((strategy) => { const forward = strategy.liveForwardTest; const backtest = strategy.backtest; return <tr key={strategy.id}><td className="px-3 py-4"><p className="font-medium text-neutral-200">{strategy.label}</p><p className="mt-1 text-xs text-neutral-600">{strategy.mode}</p></td><td className="px-3 py-4">{strategy.status === 'APPROVED' ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" />ผ่านเกณฑ์</span> : <span className="inline-flex items-center gap-1 text-amber-300"><ShieldAlert className="h-4 w-4" />กำลังสะสมผล</span>}</td><td className="px-3 py-4 text-neutral-300">{forward?.sampleSize ? `${forward.winRate}% · ${forward.sampleSize} ตัวอย่าง` : 'ยังไม่มีตัวอย่าง'}</td><td className="px-3 py-4 text-neutral-400">{backtest?.sampleSize ? `${backtest.winRate}% · ${backtest.sampleSize} ตัวอย่าง` : '-'}</td><td className={`px-3 py-4 font-bold ${(forward?.netR ?? strategy.netR) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{(forward?.netR ?? strategy.netR).toFixed(2)}R</td></tr>; })}</tbody></table>{!data.strategyResearch?.candidates?.length && <p className="py-8 text-center text-sm text-neutral-500">ยังไม่มีรายงานวิจัยกลยุทธ์</p>}</div>
      </section>

      <p className="text-xs leading-5 text-neutral-500">ค่า “เด่น” จะแสดงชื่อกลุ่มเมื่อมีอย่างน้อย 3 ผลตัดสินเท่านั้น ผลย้อนหลังและ backtest ไม่รับประกันผลในอนาคต</p>
    </main>
  );
}
