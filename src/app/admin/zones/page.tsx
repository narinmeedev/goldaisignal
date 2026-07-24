'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Layers3, Loader2, RefreshCw } from 'lucide-react';

interface Zone {
  id: string;
  symbol: string;
  timeframe: string;
  type: 'SUPPORT' | 'RESISTANCE';
  priceMin: number;
  priceMax: number;
  strength: number;
  touchCount: number;
  updatedAt: string;
}

interface ZonesResponse {
  symbol: string;
  zones: Zone[];
  updatedAt?: string | null;
}

const formatPrice = (value: number) => value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function ZoneList({ title, type, zones }: { title: string; type: Zone['type']; zones: Zone[] }) {
  const isSupport = type === 'SUPPORT';
  const Icon = isSupport ? ArrowDownToLine : ArrowUpToLine;
  return (
    <section className="border border-neutral-800 bg-neutral-900/50">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-4 sm:px-5">
        <h2 className={`flex items-center gap-2 font-bold ${isSupport ? 'text-emerald-300' : 'text-rose-300'}`}>
          <Icon className="h-5 w-5" />{title}
        </h2>
        <span className="text-xs text-neutral-500">{zones.length} ระดับ</span>
      </header>
      {zones.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">ยังไม่มีระดับที่ยืนยันจากแท่งเทียน MT5</p>
      ) : (
        <div className="divide-y divide-neutral-800">
          {zones.map((zone) => {
            const isStrong = zone.strength >= 4;
            const isMedium = zone.strength === 3;
            let highlightClass = "";
            if (isStrong) {
              highlightClass = isSupport 
                ? "bg-emerald-500/5 border-l-4 border-l-emerald-500" 
                : "bg-rose-500/5 border-l-4 border-l-rose-500";
            } else if (isMedium) {
              highlightClass = "bg-amber-500/5 border-l-4 border-l-amber-500";
            }
            return (
              <div key={zone.id} className={`grid grid-cols-[1fr_auto] gap-4 px-4 py-4 sm:px-5 transition-all ${highlightClass}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-neutral-100">{formatPrice(zone.priceMin)} - {formatPrice(zone.priceMax)}</p>
                    {isStrong && (
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${isSupport ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        ★ แข็งแรงมาก
                      </span>
                    )}
                    {isMedium && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        ★ แข็งปานกลาง
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{zone.timeframe} · ยืนยัน {zone.touchCount} ครั้ง</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">ความแข็งแรง</p>
                  <p className={`mt-1 font-bold ${isStrong ? (isSupport ? 'text-emerald-400' : 'text-rose-400') : isMedium ? 'text-amber-400' : 'text-neutral-200'}`}>
                    {Math.min(5, zone.strength)}/5
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ZonesPage() {
  const [data, setData] = useState<ZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/admin/zones', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'โหลดแนวรับและแนวต้านไม่สำเร็จ');
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดแนวรับและแนวต้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadZones, 0);
    const timer = window.setInterval(loadZones, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadZones]);

  const support = useMemo(() => data?.zones.filter((zone) => zone.type === 'SUPPORT') ?? [], [data]);
  const resistance = useMemo(() => data?.zones.filter((zone) => zone.type === 'RESISTANCE') ?? [], [data]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังโหลดแนวรับและแนวต้าน</div>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-400"><Layers3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Market levels</span></div>
          <h1 className="mt-2 text-2xl font-bold">แนวรับและแนวต้านทองคำ</h1>
          <p className="mt-1 text-sm text-neutral-400">คำนวณจากแท่งเทียน MT5 ของ {data?.symbol || 'XAUUSD'} เท่านั้น</p>
        </div>
        <button onClick={loadZones} className="inline-flex h-11 items-center justify-center gap-2 border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium hover:border-neutral-500 hover:bg-neutral-800">
          <RefreshCw className="h-4 w-4" />อัปเดตข้อมูล
        </button>
      </header>

      {error && <div className="border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
        <span>สัญลักษณ์ {data?.symbol || '-'}</span>
        <span>อัปเดต {formatDate(data?.updatedAt)}</span>
        <span>แสดงเฉพาะระดับที่ระบบคำนวณได้จริง</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ZoneList title="แนวรับ" type="SUPPORT" zones={support} />
        <ZoneList title="แนวต้าน" type="RESISTANCE" zones={resistance} />
      </div>
    </main>
  );
}
