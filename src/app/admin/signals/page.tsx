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

  const renderReasonBadges = (reasonStr: string) => {
    try {
      const reason = JSON.parse(reasonStr);
      const badges = [];

      if (reason.duplicateRejected) badges.push({ text: 'บล็อกสัญญาณซ้ำซ้อน', color: 'bg-rose-500/10 text-rose-450 border border-rose-850' });
      if (reason.dailyLimitExceeded) badges.push({ text: 'ลิมิตไม้ประจำวันครบแล้ว', color: 'bg-rose-500/10 text-rose-450 border border-rose-850' });
      if (reason.consecutiveLossLimit) badges.push({ text: 'หยุดอัตโนมัติ: แพ้ติดกัน 3 ครั้ง', color: 'bg-rose-500/10 text-rose-450 border border-rose-850' });
      
      if (reason.trendAligned === true) badges.push({ text: 'เทรนสอดคล้อง H4', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' });
      if (reason.trendAligned === false) badges.push({ text: 'เทรนขัดแย้ง H4', color: 'bg-neutral-800 text-neutral-450 border border-neutral-850' });

      if (reason.liquiditySweep) badges.push({ text: 'ตรวจพบกวาดสภาพคล่อง', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' });
      
      if (reason.zoneHit) {
        badges.push({ text: `เข้าทดสอบแนว ${reason.zoneHit.type === 'SUPPORT' ? 'รับ' : 'ต้าน'}`, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' });
      }

      if (reason.fakeBreakout) badges.push({ text: 'เบรคหลอก (Fakeout Trap)', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' });
      if (reason.largeCandleRange) badges.push({ text: 'ผันผวนแรงผิดปกติ', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' });
      if (reason.sidewaysRange) badges.push({ text: 'ไซด์เวย์บีบอัดตัว', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' });

      if (reason.lowRiskReward) badges.push({ text: 'RR ต่ำกว่า 1:2', color: 'bg-rose-500/10 text-rose-450 border border-rose-850' });
      if (reason.highFakeoutRisk) badges.push({ text: 'เสี่ยงหลอกลวงสูง', color: 'bg-rose-500/10 text-rose-450 border border-rose-850' });

      if (badges.length === 0) return <span className="text-[10px] text-neutral-500 italic">ผ่านเกณฑ์มาตรฐาน</span>;

      return (
        <div className="flex flex-wrap gap-1 max-w-[320px]">
          {badges.map((b, idx) => (
            <span key={idx} className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide font-mono ${b.color}`}>
              {b.text}
            </span>
          ))}
        </div>
      );
    } catch {
      return <span className="text-[10px] text-neutral-500">-</span>;
    }
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
                      {renderReasonBadges(signal.reason)}
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
