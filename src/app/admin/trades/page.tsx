'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  DollarSign, 
  Play
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  exitPrice: number | null;
  result: string;
  rrResult: number;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Price Simulator State
  const [testSymbol] = useState<'XAUUSD'>('XAUUSD');
  const [testPrice, setTestPrice] = useState(4450.0);
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const fetchTrades = async () => {
    try {
      const res = await fetch('/api/admin/trades');
      const data = await res.json();
      if (res.ok) {
        setTrades(data);
      } else {
        setError(data.error || 'ไม่สามารถโหลดประวัติการติดตามแผนได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดเครือข่ายในการดึงข้อมูลแผนการเทรด');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleEvaluatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestLogs([]);
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate_price',
          price: testPrice,
          symbol: testSymbol,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.closedTrades && data.closedTrades.length > 0) {
          setTestLogs(data.closedTrades);
        } else {
          setTestLogs([`ประมวลผลราคาสำหรับ ${testSymbol} สำเร็จ: ไม่มีออเดอร์ใดชนหน้าทุน SL หรือเป้ากำไร TP (ออเดอร์ยังรันอยู่)`]);
        }
        fetchTrades(); // reload
      } else {
        setTestLogs([`เกิดข้อผิดพลาด: ${data.error}`]);
      }
    } catch {
      setTestLogs(['ข้อผิดพลาดเน็ตเวิร์กในการประมวลผลราคาจำลอง']);
    } finally {
      setIsTesting(false);
    }
  };

  // Compute trade stats
  const closed = trades.filter((t) => t.result !== 'OPEN' && t.result !== 'PLAN');
  const wins = closed.filter((t) => t.result === 'WIN').length;
  const losses = closed.filter((t) => t.result === 'LOSS').length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
  const totalR = parseFloat(closed.reduce((sum, t) => sum + t.rrResult, 0).toFixed(2));
  const activeCount = trades.filter((t) => t.result === 'OPEN').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-amber-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        กำลังดึงข้อมูลและเชื่อมโยงผลจำลองพอร์ต...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            สมุดบันทึกผลสถิติและติดตามแผนการเทรด (Trading Plans Journal)
          </h1>
          <p className="text-neutral-400 text-xs mt-1">
            วิเคราะห์ผลความแม่นยำของแผนจำลองย้อนหลัง อัตราชนะของกลยุทธ์ และสถิติกำไรสะสมเพื่อทดสอบประสิทธิภาพสมองกล
          </p>
        </div>
        <button 
          onClick={fetchTrades}
          className="p-2 border border-neutral-850 rounded-xl bg-neutral-900/40 text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 transition-all cursor-pointer"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">แผนที่ปิดติดตามเสร็จสิ้น</span>
          <span className="text-2xl font-extrabold font-mono text-neutral-200 block mt-2">{closed.length} แผน</span>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">ชนะ / แพ้</span>
          <span className="text-2xl font-extrabold font-mono text-emerald-400 block mt-2">
            ชนะ {wins} แผน <span className="text-neutral-600">/</span> <span className="text-rose-500">แพ้ {losses} แผน</span>
          </span>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">อัตราชนะแผนแนะนำ (Win Rate)</span>
          <span className="text-2xl font-extrabold font-mono text-emerald-400 block mt-2">{winRate}%</span>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">กำไรรวมสะสมพอร์ตจำลอง</span>
          <span className="text-2xl font-extrabold font-mono text-amber-400 block mt-2">{totalR >= 0 ? `+${totalR}` : totalR}R</span>
        </div>
      </div>

      {/* Interactive price tester */}
      <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            เครื่องมือจำลองระดับราคาเพื่อตรวจเช็กเป้าหมายแผนเทรด
          </h2>
          <p className="text-[10px] text-neutral-500 mt-1 font-mono">
            ป้อนราคาจำลองเพื่อตรวจสอบว่าแผนงานที่เปิดติดตามอยู่ บรรลุระดับราคาเป้าหมายทำกำไร (TP) หรือชนระดับราคาป้องกันความเสี่ยง (SL)
          </p>
        </div>

        <form onSubmit={handleEvaluatePrice} className="flex flex-col md:flex-row items-stretch gap-4 max-w-3xl text-xs">
          <div className="md:w-60 px-4 py-3.5 bg-neutral-950 border border-neutral-850 rounded-xl text-amber-300 font-mono font-bold">
            ทองคำ XAUUSD เท่านั้น
          </div>

          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-neutral-500 font-mono font-bold">$</span>
              <input
                type="number"
                step="0.1"
                value={testPrice}
                onChange={(e) => setTestPrice(parseFloat(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-neutral-950/80 border border-neutral-850 rounded-xl text-neutral-200 font-mono focus:outline-none focus:border-amber-500/30"
                placeholder="4450.00"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isTesting}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-xs font-bold text-neutral-950 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTesting ? 'กำลังคำนวณ...' : 'ตรวจสอบระดับราคา'}
            {!isTesting && <Play className="h-3.5 w-3.5 fill-neutral-950 text-neutral-950" />}
          </button>
        </form>

        {testLogs.length > 0 && (
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 font-mono text-[10px] text-amber-400 space-y-1 animate-fade-in">
            <div className="font-bold text-neutral-500 border-b border-neutral-900 pb-1 mb-1">ผลประเมินเป้าหมายจำลองโดยสมองกล:</div>
            {testLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* Trades Table */}
      <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6">
        {trades.length > 0 ? (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-neutral-900 text-neutral-500">
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ไอดีแผน</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">สินทรัพย์</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ฝั่งซื้อขาย</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ราคา เข้า / ออก</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">เป้าหมาย (SL / TP)</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ผลลัพธ์จำลอง</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">สัดส่วน R-Profit</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">บันทึกของระบบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-neutral-900/10 transition-colors">
                    <td className="py-4 px-4 text-neutral-400" title={trade.id}>
                      {trade.id.slice(0, 8)}...
                    </td>
                    <td className="py-4 px-4 font-bold text-neutral-200">{trade.symbol}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        trade.direction === 'BUY' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-4 px-4 space-y-1">
                      <div>เข้า: <span className="text-neutral-350">${trade.entry.toFixed(2)}</span></div>
                      {trade.exitPrice && (
                        <div className="text-[10px] text-neutral-500">
                          ออก: <span className="text-neutral-350">${trade.exitPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 space-y-1">
                      <div>SL: <span className="text-rose-500">${trade.stopLoss.toFixed(2)}</span></div>
                      <div className="text-[10px] text-neutral-500">
                        TP1: <span className="text-emerald-500">${trade.takeProfit1.toFixed(2)}</span> | 
                        TP2: <span className="text-emerald-400">${trade.takeProfit2.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        trade.result === 'OPEN' 
                          ? 'bg-blue-500/5 text-blue-400 border-blue-500/10' 
                          : trade.result === 'WIN' 
                          ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' 
                          : trade.result === 'LOSS' 
                          ? 'bg-rose-500/5 text-rose-500 border-rose-500/10' 
                          : 'bg-neutral-900 text-neutral-400 border-neutral-850'
                      }`}>
                        {trade.result === 'OPEN' && <span className="h-1 w-1 rounded-full bg-blue-400 animate-ping" />}
                        {trade.result === 'OPEN' ? 'กำลังติดตาม' : trade.result === 'WIN' ? 'ชนะ (ชน TP)' : trade.result === 'LOSS' ? 'แพ้ (ชน SL)' : 'เสร็จสิ้น'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-neutral-300">
                      {trade.result === 'OPEN' ? '-' : `${trade.rrResult >= 0 ? `+${trade.rrResult}` : trade.rrResult}R`}
                    </td>
                    <td className="py-4 px-4 text-[10px] text-neutral-450 max-w-[240px] truncate" title={trade.notes || ''}>
                      {trade.notes || 'กำลังติดตามระดับราคาเป้าหมายความคุ้มค่า'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-650 font-mono text-xs">
            ไม่พบประวัติแผนการเทรดในระบบ สามารถส่งสัญญาณทดสอบเข้ามาผ่านหน้าแผงควบคุมหลัก
          </div>
        )}
      </div>
    </div>
  );
}
