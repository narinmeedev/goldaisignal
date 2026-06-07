'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Copy, Check, RefreshCw, Brain } from 'lucide-react';

interface RuleChange {
  rule: string;
  rationale: string;
}

interface ReviewData {
  date: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  netR: number;
  bestSetup: string;
  worstSetup: string;
  summary: string;
  ruleChanges: RuleChange[];
  trades: any[];
}

export default function ReviewPage() {
  const [date, setDate] = useState('');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Set default date to today's local date
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    const formatted = localToday.toISOString().split('T')[0];
    setDate(formatted);
  }, []);

  const fetchReview = async (targetDate: string) => {
    if (!targetDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/export/daily-review?date=${targetDate}`);
      const data = await res.json();
      if (res.ok) {
        setReview(data);
      } else {
        setError(data.error || 'ไม่สามารถจัดทำบทวิเคราะห์ของวันนี้ได้');
      }
    } catch {
      setError('ข้อผิดพลาดเครือข่ายในการประมวลผลสรุปวิเคราะห์รายวัน');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (date) {
      fetchReview(date);
    }
  }, [date]);

  const handleCopyJson = () => {
    if (!review) return;
    
    // Copy the structured JSON review format specified in spec
    const specExport = {
      date: review.date,
      total_trades: review.totalTrades,
      wins: review.winCount,
      losses: review.lossCount,
      net_r: review.netR,
      best_setup: review.bestSetup,
      worst_setup: review.worstSetup,
      summary: review.summary,
      rule_changes: review.ruleChanges,
      trades: review.trades.map((t) => ({
        id: t.id,
        direction: t.direction,
        entry: t.entry,
        exit: t.exitPrice,
        result: t.result,
        r_result: t.rrResult,
        notes: t.notes,
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(specExport, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            สรุปผลวิเคราะห์พอร์ตและคำแนะนำเกณฑ์โดย AI (AI Trade Review)
          </h1>
          <p className="text-neutral-400 text-xs mt-1">
            ส่งออกข้อมูลประวัติการเทรดประจำวันรูปแบบ JSON เพื่อส่งต่อให้ AI วิเคราะห์ และรับคำแนะนำการปรับกฎความเสี่ยงอัตโนมัติ
          </p>
        </div>

        {/* Date Selector input */}
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-amber-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs font-mono text-neutral-250 focus:outline-none focus:border-amber-500/30 cursor-pointer"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 font-mono text-sm text-amber-500 animate-pulse">
          <RefreshCw className="h-6 w-6 animate-spin" />
          กำลังรวบรวมข้อมูลพอร์ตการเทรดจำลองและคำนวณสถิติประจำวัน...
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm">
          {error}
        </div>
      ) : review ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Stats & Recommendations (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Daily stats cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-neutral-900/40 border border-neutral-855 rounded-xl p-4">
                <span className="text-[9px] font-mono text-neutral-500 uppercase block">จำนวนเทรดรวม</span>
                <span className="text-lg font-mono font-bold text-neutral-200 mt-1 block">{review.totalTrades} ไม้</span>
              </div>
              <div className="bg-neutral-900/40 border border-neutral-855 rounded-xl p-4">
                <span className="text-[9px] font-mono text-neutral-500 uppercase block">อัตราชนะ (ชนะ/แพ้)</span>
                <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block">
                  {review.winCount} <span className="text-neutral-600">/</span> <span className="text-rose-500">{review.lossCount}</span>
                </span>
              </div>
              <div className="bg-neutral-900/40 border border-neutral-855 rounded-xl p-4">
                <span className="text-[9px] font-mono text-neutral-500 uppercase block">กำไรสะสมสุทธิ</span>
                <span className="text-lg font-mono font-bold text-amber-400 mt-1 block">{review.netR >= 0 ? `+${review.netR}` : review.netR}R</span>
              </div>
            </div>

            {/* AI Summary card */}
            <div className="relative overflow-hidden bg-neutral-900/25 border border-neutral-900 rounded-2xl p-6 space-y-3">
              <div className="absolute top-0 right-0 h-24 w-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
              <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                <Brain className="h-4 w-4 text-amber-500" />
                บทวิเคราะห์ความเสี่ยงพอร์ตโดยผู้จัดการกองทุน AI (AI Risk Officer Review)
              </h2>
              <p className="text-xs leading-relaxed text-neutral-350">
                {review.summary}
              </p>
            </div>

            {/* Rule changes column */}
            <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 space-y-4">
              <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                คำแนะนำปรับปรุงเกณฑ์การวิเคราะห์ระบบเพื่อลด Fakeout (Adaptive Rules)
              </h2>
              
              <div className="space-y-4">
                {review.ruleChanges && review.ruleChanges.length > 0 ? (
                  review.ruleChanges.map((rule, idx) => (
                    <div key={idx} className="bg-neutral-950/60 border border-neutral-850 rounded-xl p-4 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[9px] font-bold border border-amber-500/20">
                          ข้อเสนอใหม่
                        </span>
                        <h3 className="text-xs font-bold text-neutral-200">{rule.rule}</h3>
                      </div>
                      <p className="text-[11px] text-neutral-400 pl-[70px] leading-relaxed">
                        {rule.rationale}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-neutral-600 text-xs italic font-mono">
                    ไม่มีเกณฑ์ข้อเสนอความเสี่ยงใหม่ที่คัดค้านสำหรับประวัติวันนี้
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: JSON Export Workspace (5 cols) */}
          <div className="lg:col-span-5 bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 flex flex-col justify-between h-fit space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                ข้อมูล JSON ส่งออกประจำวัน (Daily Payload)
              </h2>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-850 hover:border-neutral-700 bg-neutral-950/80 text-[10px] font-bold text-amber-500 cursor-pointer transition-all active:scale-95"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? 'คัดลอกแล้ว!' : 'คัดลอก JSON'}
              </button>
            </div>

            <p className="text-[10px] text-neutral-500 leading-relaxed font-mono">
              คัดลอกโค้ดโครงสร้างข้อมูลวิเคราะห์นี้ เพื่อใช้ป้อนให้ห้องแชต ChatGPT/Claude สำหรับเป็นความรู้และเกณฑ์ตรวจสอบพฤติกรรมการเคลื่อนไหวของราคา (Price Action Audit)
            </p>

            <pre className="bg-neutral-950/80 border border-neutral-850 p-4 rounded-xl text-[9px] font-mono text-neutral-350 overflow-x-auto max-h-[360px] scrollbar-thin">
              {JSON.stringify({
                date: review.date,
                total_trades: review.totalTrades,
                wins: review.winCount,
                losses: review.lossCount,
                net_r: review.netR,
                best_setup: review.bestSetup,
                worst_setup: review.worstSetup,
                summary: review.summary,
                rule_changes: review.ruleChanges,
                trades_logged: review.trades.length
              }, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-neutral-650 font-mono text-xs">
          โปรดเลือกวันที่เพื่อแสดงประวัติการตรวจสอบของพอร์ต
        </div>
      )}
    </div>
  );
}
