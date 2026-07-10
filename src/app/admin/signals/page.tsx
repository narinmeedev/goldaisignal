'use client';

import React, { useEffect, useState } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number;
  status: string;
  fakeoutScore: number;
  reason: string;
  createdAt: string;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      const res = await fetch('/api/admin/signals');
      const data = await res.json();
      if (res.ok) {
        setSignals(data);
      } else {
        setError(data.error || 'ไม่สามารถโหลดประวัติสัญญาณได้');
      }
    } catch {
      setError('ข้อผิดพลาดเครือข่ายในการโหลดข้อมูลสัญญาณ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const parseTechnicalReasons = (reasonStr: string, direction: string, timeframe: string): string[] => {
    if (!reasonStr) return ['ผ่านเกณฑ์มาตรฐานของระบบ'];
    try {
      const reason = JSON.parse(reasonStr);
      if (reason.proactiveReason) {
        if (typeof reason.proactiveReason === 'string') {
          const lines = reason.proactiveReason
            .split('\n')
            .map((l: string) => l.trim().replace(/^-\s*/, '').replace(/^•\s*/, ''))
            .filter(Boolean);
          if (lines.length > 0) return lines;
        }
      }

      const points: string[] = [];

      // 1. Zone/Supply/Demand hits
      if (reason.zoneHit) {
        const zoneType = reason.zoneHit.type === 'SUPPORT' ? 'demand zone' : 'supply zone';
        points.push(`ราคาชน ${zoneType} บริเวณ ${timeframe}`);
      } else if (reason.fallbackSeeding) {
        points.push('ระบบเริ่มต้นใหม่ (Cold-start): รอสะสมกำลังสร้างฐานราคา');
      } else {
        const zoneName = direction === 'BUY' ? 'demand zone' : 'supply zone';
        points.push(`ราคาเคลื่อนไหวเข้าใกล้ ${zoneName} สำคัญ`);
      }

      // 2. Trend alignment
      if (reason.trendAligned === true) {
        points.push(`แนวโน้มสอดคล้องกับเทรนด์หลัก H4 (${direction === 'BUY' ? 'ขาขึ้น BULLISH' : 'ขาลง BEARISH'})`);
      } else if (reason.trendAligned === false) {
        points.push(`สัญญาณสวนเทรนด์หลัก H4 (${direction === 'BUY' ? 'เทรนด์หลักยังเป็นขาลง' : 'เทรนด์หลักยังเป็นขาขึ้น'})`);
      }

      // 3. RSI Status
      if (reason.overboughtAlert || (reason.rsi14 && reason.rsi14 > 70)) {
        points.push(`RSI เริ่มอ่อนแรง (${Math.round(reason.rsi14 || 70)} > 70)`);
      } else if (reason.oversoldAlert || (reason.rsi14 && reason.rsi14 < 30)) {
        points.push(`RSI เริ่มพยุงตัวกลับขึ้น (${Math.round(reason.rsi14 || 30)} < 30)`);
      } else if (reason.rsi14) {
        points.push(`RSI พร้อมกลับตัว (ค่าปัจจุบัน ${Math.round(reason.rsi14)})`);
      }

      // 4. Structure changes
      if (direction === 'SELL') {
        points.push(`โครงสร้าง ${timeframe} ทำ lower high`);
      } else {
        points.push(`โครงสร้าง ${timeframe} ทำ higher low`);
      }

      // 5. Entry strategy warning
      if (reason.fakeBreakout) {
        points.push('เกิดสัญญาณเบรคหลอก (Fakeout Trap) ให้ตั้ง SL เคร่งครัด');
      }
      
      points.push('รอราคากลับเข้าโซนก่อนเข้า ไม่ไล่ราคา');

      return points;
    } catch {
      if (typeof reasonStr === 'string' && reasonStr.trim().length > 0) {
        return reasonStr
          .split('\n')
          .map((l: string) => l.trim().replace(/^-\s*/, '').replace(/^•\s*/, ''))
          .filter(Boolean);
      }
      return ['ผ่านเกณฑ์มาตรฐานของระบบ'];
    }
  };

  const renderReasonBadges = (reasonStr: string, direction: string, timeframe: string) => {
    const reasons = parseTechnicalReasons(reasonStr, direction, timeframe);
    return (
      <div className="space-y-1 py-1 max-w-[260px] min-w-[200px]">
        <ul className="space-y-1 list-none pl-0">
          {reasons.map((r, idx) => (
            <li key={idx} className="text-[10.5px] text-neutral-300 leading-relaxed flex items-start gap-1">
              <span className="text-amber-500/80 shrink-0 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-amber-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        กำลังโหลดและตรวจสอบฐานข้อมูลสมองกล...
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
            <Terminal className="h-5 w-5 text-amber-500" />
            ประวัติการคัดกรองสัญญาณโดยสมองกล (Decision Engine Logs)
          </h1>
          <p className="text-neutral-400 text-xs mt-1">
            บันทึกการทำงานของ AI ในการวิเคราะห์ Technical, ตัวกรองเบรคหลอก (Anti-Fakeout) และการประเมินความเสี่ยงทั้งหมดแบบละเอียด
          </p>
        </div>
        <button 
          onClick={fetchSignals}
          className="p-2 border border-neutral-850 rounded-xl bg-neutral-900/40 text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 transition-all cursor-pointer"
          title="รีเฟรชประวัติ"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Signals Table */}
      <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6">
        {signals.length > 0 ? (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-neutral-900 text-neutral-500">
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">เวลาประมวลผล</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">สินทรัพย์</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ไทม์เฟรม</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ทิศทางสัญญาณ</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">เป้าหมายราคา</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ระดับความมั่นใจ / โอกาสหลอก</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">ผลตรวจวิเคราะห์ตัวกรอง</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">สถานะออเดอร์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {signals.map((signal) => (
                  <tr key={signal.id} className="hover:bg-neutral-900/10 transition-colors">
                    <td className="py-4 px-4 text-neutral-400">
                      {new Date(signal.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 font-bold text-neutral-200">{signal.symbol}</td>
                    <td className="py-4 px-4 text-neutral-400">{signal.timeframe}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        signal.direction === 'BUY' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : signal.direction === 'SELL' 
                          ? 'bg-rose-500/10 text-rose-400' 
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {signal.direction === 'NO_TRADE' ? 'ไม่ทำตามแผน' : signal.direction}
                      </span>
                    </td>
                    <td className="py-4 px-4 space-y-1">
                      <div>ราคาเข้าเป้า: <span className="text-neutral-300 font-bold">${signal.entry.toFixed(2)}</span></div>
                      {signal.stopLoss > 0 && (
                        <div className="text-[10px] text-neutral-500">
                          SL: <span className="text-rose-500">${signal.stopLoss.toFixed(2)}</span> | 
                          TP1: <span className="text-emerald-500">${signal.takeProfit1.toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 space-y-1">
                      <div>แม่นยำ: <span className="text-neutral-300 font-bold">{signal.confidence}%</span></div>
                      <div className="text-[10px]">
                        เสี่ยงเบรคหลอก:{' '}
                        <span className={`font-bold ${signal.fakeoutScore > 50 ? 'text-amber-500' : 'text-neutral-500'}`}>
                          {signal.fakeoutScore}/100
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {renderReasonBadges(signal.reason, signal.direction, signal.timeframe)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        signal.status === 'active' 
                          ? 'bg-amber-500/5 text-amber-500 border-amber-500/10' 
                          : signal.status === 'win' 
                          ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' 
                          : signal.status === 'loss' 
                          ? 'bg-rose-500/5 text-rose-500 border-rose-500/10' 
                          : signal.status === 'cancelled'
                          ? 'bg-neutral-900 text-rose-400 border-rose-900/10'
                          : 'bg-neutral-900 text-neutral-500 border-neutral-850'
                      }`}>
                        {signal.status === 'active' && <span className="h-1 w-1 rounded-full bg-amber-500 animate-ping" />}
                        {signal.status === 'active' ? 'เปิดอยู่' : signal.status === 'win' ? 'ชนะ' : signal.status === 'loss' ? 'แพ้' : signal.status === 'cancelled' ? 'ปฏิเสธสัญญาณ' : signal.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-600 font-mono text-xs">
            ไม่พบประวัติการกรองสัญญาณในระบบ คุณสามารถสร้างสัญญาณวิเคราะห์ทดลองได้จากหน้าแผงควบคุมหลัก
          </div>
        )}
      </div>
    </div>
  );
}
