'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
  XCircle,
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number | null;
  exitPrice?: number | null;
  result: string;
  rrResult: number;
  openedAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  signal?: { confidence?: number | null } | null;
}

type Filter = 'ALL' | 'WAITING' | 'OPEN' | 'CLOSED';

const formatPrice = (value?: number | null) => typeof value === 'number'
  ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '-';

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(value))
  : '-';

const statusLabel: Record<string, string> = {
  PLAN: 'รอราคาเข้า',
  TESTING: 'รอราคาเข้า',
  OPEN: 'กำลังวัดผล',
  WIN: 'ชนะ · TP',
  LOSS: 'แพ้ · SL',
  BE: 'เสมอ',
  CANCELLED: 'ยกเลิก',
};

function StatusIcon({ result }: { result: string }) {
  if (result === 'WIN') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (result === 'LOSS') return <XCircle className="h-4 w-4 text-rose-400" />;
  if (result === 'OPEN') return <Target className="h-4 w-4 text-sky-400" />;
  if (result === 'CANCELLED') return <ShieldAlert className="h-4 w-4 text-neutral-500" />;
  return <Clock3 className="h-4 w-4 text-amber-400" />;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/trades', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดประวัติแผนไม่สำเร็จ');
      setTrades(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดประวัติแผนไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const decided = trades.filter((trade) => ['WIN', 'LOSS'].includes(trade.result));
    const wins = decided.filter((trade) => trade.result === 'WIN').length;
    const losses = decided.length - wins;
    const totalR = trades.filter((trade) => ['WIN', 'LOSS', 'BE'].includes(trade.result)).reduce((sum, trade) => sum + Number(trade.rrResult || 0), 0);
    return { decided: decided.length, wins, losses, winRate: decided.length ? Math.round((wins / decided.length) * 100) : null, totalR };
  }, [trades]);

  const visibleTrades = useMemo(() => trades.filter((trade) => {
    if (filter === 'WAITING') return ['PLAN', 'TESTING'].includes(trade.result);
    if (filter === 'OPEN') return trade.result === 'OPEN';
    if (filter === 'CLOSED') return ['WIN', 'LOSS', 'BE', 'CANCELLED'].includes(trade.result);
    return true;
  }), [filter, trades]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-400"><History className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Plan Journal</span></div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-50">ประวัติและผลวัดแผนทองคำ</h1>
          <p className="mt-1 text-sm text-neutral-400">ทุกแผนมีสถานะตั้งแต่รอเข้า จนถึงปิดผลหรือยกเลิก เพื่อวัดคุณภาพระบบจากข้อมูลจริง</p>
        </div>
        <button type="button" onClick={() => load(true)} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-200 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> อัปเดต
        </button>
      </header>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      <section className="grid overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['ผลตัดสิน', `${metrics.decided} แผน`],
          ['ชนะ / แพ้', `${metrics.wins} / ${metrics.losses}`],
          ['Win rate', metrics.winRate === null ? '-' : `${metrics.winRate}%`],
          ['ผลรวม', `${metrics.totalR >= 0 ? '+' : ''}${metrics.totalR.toFixed(2)}R`],
        ].map(([label, value]) => <div key={label} className="border-r border-neutral-800 p-4 last:border-r-0"><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 text-xl font-bold text-neutral-100">{value}</p></div>)}
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 p-1">
        {([
          ['ALL', 'ทั้งหมด'],
          ['WAITING', 'รอเข้า'],
          ['OPEN', 'กำลังวัดผล'],
          ['CLOSED', 'ปิดแล้ว'],
        ] as [Filter, string][]).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`h-9 shrink-0 rounded-lg px-4 text-sm font-medium ${filter === value ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        {loading ? (
          <div className="flex min-h-60 items-center justify-center text-sm text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังโหลดผลแผน</div>
        ) : visibleTrades.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/60 text-xs text-neutral-500">
                <tr><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">แผน</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">SL / TP</th><th className="px-4 py-3">ผลออก</th><th className="px-4 py-3">R</th><th className="px-4 py-3">เวลา</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {visibleTrades.map((trade) => (
                  <tr key={trade.id} className="text-neutral-300 hover:bg-neutral-800/30">
                    <td className="px-4 py-4"><span className="inline-flex items-center gap-2 font-medium"><StatusIcon result={trade.result} />{statusLabel[trade.result] ?? trade.result}</span></td>
                    <td className="px-4 py-4"><p className={`font-bold ${trade.direction === 'BUY' ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.direction} XAUUSD</p><p className="mt-1 text-xs text-neutral-600">#{trade.id.slice(0, 8)}</p></td>
                    <td className="px-4 py-4 tabular-nums">{formatPrice(trade.entry)}{typeof trade.signal?.confidence === 'number' && <p className="mt-1 text-xs text-neutral-500">เงื่อนไข {trade.signal.confidence}/100</p>}</td>
                    <td className="px-4 py-4"><p className="tabular-nums text-rose-300">SL {formatPrice(trade.stopLoss)}</p><p className="mt-1 tabular-nums text-emerald-300">TP {formatPrice(trade.takeProfit1)}</p></td>
                    <td className="px-4 py-4 tabular-nums">{formatPrice(trade.exitPrice)}</td>
                    <td className={`px-4 py-4 font-bold ${trade.rrResult >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{['PLAN', 'TESTING', 'OPEN', 'CANCELLED'].includes(trade.result) ? '-' : `${trade.rrResult >= 0 ? '+' : ''}${Number(trade.rrResult).toFixed(2)}R`}</td>
                    <td className="px-4 py-4 text-xs text-neutral-500">{formatDate(trade.closedAt ?? trade.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="py-16 text-center text-sm text-neutral-500">ยังไม่มีแผนในสถานะนี้</div>}
      </section>

      <p className="text-xs leading-5 text-neutral-500">สถิติใช้เฉพาะแผน XAU ที่ระบบบันทึกและปิดผลแล้ว แผนที่ยกเลิกหรือยังรอเข้าไม่นับใน Win rate</p>
    </main>
  );
}
