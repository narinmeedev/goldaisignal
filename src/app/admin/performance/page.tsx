'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  Trophy, 
  Flame, 
  BarChart3, 
  Clock, 
  Compass, 
  Layers, 
  Award, 
  Percent, 
  DollarSign,
  Activity,
  Zap
} from 'lucide-react';

interface Summary {
  totalSignalsCount: number;
  totalClosed: number;
  winRate7d: number;
  total7d: number;
  winRate30d: number;
  total30d: number;
  winRate90d: number;
  total90d: number;
  profitFactor: number;
  averageRR: number;
  averagePoints: number;
  totalPoints: number;
  maxLosingStreak: number;
  bestSession: string;
  bestTimeframe: string;
  bestSetupType: string;
}

interface StrategyResearchReport {
  symbol: string;
  generatedAt: string;
  targetWinRate: number;
  approvedStrategies: string[];
  candidates: Array<{
    id: string;
    label: string;
    mode: string;
    status: 'APPROVED' | 'RESEARCHING';
    winRate: number;
    sampleSize: number;
    wins: number;
    losses: number;
    netR: number;
    parameters: {
      confirmation: string;
      slPoints?: number;
      riskReward: number;
      lookaheadBars: number;
    };
    backtest?: {
      winRate: number;
      sampleSize: number;
      wins: number;
      losses: number;
      netR: number;
    };
    liveForwardTest?: {
      winRate: number;
      sampleSize: number;
      wins: number;
      losses: number;
      breakEven: number;
      netR: number;
    };
    rationale: string;
  }>;
}

interface PerformanceData {
  summary: Summary;
  sessions: Record<string, { name: string; wins: number; losses: number; be: number; total: number; netR: number; netPoints: number }>;
  timeframes: Record<string, { wins: number; losses: number; be: number; total: number; netR: number; netPoints: number }>;
  setups: Record<string, { wins: number; losses: number; be: number; total: number; netR: number; netPoints: number }>;
  strategyResearch?: StrategyResearchReport;
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    try {
      const res = await fetch('/api/admin/performance');
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || 'ไม่สามารถดึงข้อมูลผลลัพธ์ประสิทธิภาพได้');
      }
    } catch {
      setError('ข้อผิดพลาดเครือข่ายในการโหลดข้อมูลประสิทธิภาพ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-amber-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        กำลังคำนวณและประมวลผลสถิติประสิทธิภาพสมองกล...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm">
        {error || 'ไม่สามารถเข้าถึงข้อมูลสถิติได้'}
      </div>
    );
  }

  const { summary, sessions, timeframes, setups } = data;

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-10">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            แผงวัดผลประสิทธิภาพสัญญาณเทรด (Signal Performance Analytics)
          </h1>
          <p className="text-neutral-400 text-xs mt-1">
            สถิติวัดผลแพ้-ชนะของสัญญาณเทรด (Win Rate), Profit Factor, กำไรสุทธิเป็นจุด, กำไร RR เฉลี่ย และสถิติแยกตามช่วงเวลาเทรด
          </p>
        </div>
        <button 
          onClick={fetchPerformance}
          className="p-2.5 border border-neutral-800 rounded-xl bg-neutral-900/60 text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 transition-all cursor-pointer shadow-md"
          title="รีเฟรชสถิติ"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Win Rate Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 7 Days Win Rate */}
        <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 blur-[35px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-neutral-400 font-mono">WIN RATE (7 วันที่ผ่านมา)</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Percent className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-neutral-100">{summary.winRate7d}%</span>
            <span className="text-xs text-neutral-500 font-mono">จาก {summary.total7d} สัญญาณ</span>
          </div>
          <div className="mt-4 w-full bg-neutral-950 rounded-full h-1.5 border border-neutral-900">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${summary.winRate7d}%` }}></div>
          </div>
        </div>

        {/* 30 Days Win Rate */}
        <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 blur-[35px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-neutral-400 font-mono">WIN RATE (30 วันที่ผ่านมา)</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Percent className="h-4 w-4 text-indigo-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-neutral-100">{summary.winRate30d}%</span>
            <span className="text-xs text-neutral-500 font-mono">จาก {summary.total30d} สัญญาณ</span>
          </div>
          <div className="mt-4 w-full bg-neutral-950 rounded-full h-1.5 border border-neutral-900">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${summary.winRate30d}%` }}></div>
          </div>
        </div>

        {/* 90 Days Win Rate */}
        <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-sm group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 right-0 h-24 w-24 bg-amber-500/5 blur-[35px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-neutral-400 font-mono">WIN RATE (90 วันที่ผ่านมา)</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Percent className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-neutral-100">{summary.winRate90d}%</span>
            <span className="text-xs text-neutral-500 font-mono">จาก {summary.total90d} สัญญาณ</span>
          </div>
          <div className="mt-4 w-full bg-neutral-950 rounded-full h-1.5 border border-neutral-900">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${summary.winRate90d}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Core Statistics Matrix (5 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Signals */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 backdrop-blur-sm shadow-md">
          <div className="flex justify-between items-center text-neutral-500 text-xs font-mono mb-2">
            <span>สัญญาณทั้งหมด</span>
            <Activity className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="text-xl font-bold text-neutral-200">{summary.totalSignalsCount}</div>
          <div className="text-[10px] text-neutral-500 mt-1">ประเมิน ({summary.totalClosed} ไม้ปิดผล)</div>
        </div>

        {/* Profit Factor */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 backdrop-blur-sm shadow-md">
          <div className="flex justify-between items-center text-neutral-500 text-xs font-mono mb-2">
            <span>PROFIT FACTOR</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className={`text-xl font-bold ${summary.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-neutral-200'}`}>
            {summary.profitFactor}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">Gross Profit / Loss</div>
        </div>

        {/* Average Achieved RR & Points */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 backdrop-blur-sm shadow-md">
          <div className="flex justify-between items-center text-neutral-500 text-xs font-mono mb-2">
            <span>กำไรเฉลี่ยต่อไม้</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-neutral-200">
            +{summary.averageRR}R
          </div>
          <div className="text-[10px] text-indigo-300 font-bold mt-1">
            (+{summary.averagePoints.toLocaleString()} จุด)
          </div>
        </div>

        {/* Net Profit Points */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 backdrop-blur-sm shadow-md ring-1 ring-amber-500/10">
          <div className="flex justify-between items-center text-neutral-500 text-xs font-mono mb-2">
            <span>กำไรรวมสุทธิ (จุด)</span>
            <Zap className="h-4 w-4 text-amber-500 animate-pulse" />
          </div>
          <div className={`text-xl font-bold ${summary.totalPoints >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
            {summary.totalPoints >= 0 ? '+' : ''}{summary.totalPoints.toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-400 font-bold mt-1">จุด (Points) ทั้งหมด</div>
        </div>

        {/* Max Losing Streak */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 backdrop-blur-sm shadow-md">
          <div className="flex justify-between items-center text-neutral-500 text-xs font-mono mb-2">
            <span>แพ้สูงสุดติดกัน</span>
            <Flame className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-500">{summary.maxLosingStreak} ไม้</div>
          <div className="text-[10px] text-neutral-500 mt-1">Loss Streak สูงสุด</div>
        </div>
      </div>

      {/* Best Strengths Highlight Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Best Session */}
        <div className="relative overflow-hidden bg-neutral-900/20 border border-neutral-900 rounded-3xl p-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-mono">BEST SESSION</div>
              <div className="text-base font-bold text-neutral-200">ช่วงเวลาเทรดดีที่สุด</div>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 tracking-tight uppercase">
            {summary.bestSession}
          </div>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            ชั่วโมงที่สัญญาณ AI ทำกำไรและอ่านสภาวะความผันผวนของทองคำได้ดีที่สุด
          </p>
        </div>

        {/* Best Timeframe */}
        <div className="relative overflow-hidden bg-neutral-900/20 border border-neutral-900 rounded-3xl p-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-mono">BEST TIMEFRAME</div>
              <div className="text-base font-bold text-neutral-200">ไทม์เฟรมที่ดีที่สุด</div>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-indigo-400 tracking-tight">
            {summary.bestTimeframe}
          </div>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            ไทม์เฟรมที่มีความแม่นยำในการคัดกรองจุดเข้าซื้อขาย (Entry Zone) สูงสุด
          </p>
        </div>

        {/* Best Setup Type */}
        <div className="relative overflow-hidden bg-neutral-900/20 border border-neutral-900 rounded-3xl p-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 font-mono">BEST SETUP TYPE</div>
              <div className="text-base font-bold text-neutral-200">กลยุทธ์/รูปแบบที่ดีที่สุด</div>
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 tracking-tight line-clamp-1">
            {summary.bestSetupType}
          </div>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            กลยุทธ์ที่ประมวลผลสัญญาณคัดกรองผ่านตัวคัดกรองเบรคหลอกได้เฉียบคมที่สุด
          </p>
        </div>
      </div>

      {/* Breakdown Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Session Performance Table */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            ประสิทธิภาพตาม Session เทรด
          </h3>
          <div className="overflow-hidden rounded-xl border border-neutral-900">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="bg-neutral-950 text-neutral-500 border-b border-neutral-900 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">สถิติ W/L</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">กำไรสุทธิ (R / จุด)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {Object.values(sessions).map((sess) => {
                  const wr = sess.total > 0 ? Math.round((sess.wins / sess.total) * 100) : 0;
                  return (
                    <tr key={sess.name} className="hover:bg-neutral-900/10">
                      <td className="py-3 px-3 font-bold text-neutral-300">{sess.name}</td>
                      <td className="py-3 px-3 text-neutral-400">{sess.wins}W - {sess.losses}L</td>
                      <td className="py-3 px-3 font-bold text-neutral-200">{wr}%</td>
                      <td className={`py-3 px-3 text-right font-bold ${sess.netR >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        <div>+{sess.netR.toFixed(1)}R</div>
                        <div className="text-[10px] text-neutral-500 font-normal">
                          ({sess.netPoints >= 0 ? '+' : ''}{sess.netPoints.toLocaleString()} จุด)
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Timeframe Performance Table */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            ประสิทธิภาพแยกตาม Timeframe
          </h3>
          <div className="overflow-hidden rounded-xl border border-neutral-900">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="bg-neutral-950 text-neutral-500 border-b border-neutral-900 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2.5 px-3">TF</th>
                  <th className="py-2.5 px-3">สถิติ W/L</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">กำไรสุทธิ (R / จุด)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {Object.entries(timeframes).map(([tf, stats]) => {
                  const wr = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
                  return (
                    <tr key={tf} className="hover:bg-neutral-900/10">
                      <td className="py-3 px-3 font-bold text-neutral-300">{tf}</td>
                      <td className="py-3 px-3 text-neutral-400">{stats.wins}W - {stats.losses}L</td>
                      <td className="py-3 px-3 font-bold text-neutral-200">{wr}%</td>
                      <td className={`py-3 px-3 text-right font-bold ${stats.netR >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        <div>+{stats.netR.toFixed(1)}R</div>
                        <div className="text-[10px] text-neutral-500 font-normal">
                          ({stats.netPoints >= 0 ? '+' : ''}{stats.netPoints.toLocaleString()} จุด)
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Setup Type Performance Table */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-500" />
            ประสิทธิภาพคัดตาม Setup Type
          </h3>
          <div className="overflow-hidden rounded-xl border border-neutral-900">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="bg-neutral-950 text-neutral-500 border-b border-neutral-900 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2.5 px-3">Setup กลยุทธ์</th>
                  <th className="py-2.5 px-3">W/L</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">กำไรสุทธิ (R / จุด)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {Object.entries(setups).map(([setup, stats]) => {
                  const wr = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
                  return (
                    <tr key={setup} className="hover:bg-neutral-900/10">
                      <td className="py-3 px-3 font-bold text-neutral-300 truncate max-w-[100px]" title={setup}>{setup}</td>
                      <td className="py-3 px-3 text-neutral-400">{stats.wins}W - {stats.losses}L</td>
                      <td className="py-3 px-3 font-bold text-neutral-200">{wr}%</td>
                      <td className={`py-3 px-3 text-right font-bold ${stats.netR >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        <div>+{stats.netR.toFixed(1)}R</div>
                        <div className="text-[10px] text-neutral-500 font-normal">
                          ({stats.netPoints >= 0 ? '+' : ''}{stats.netPoints.toLocaleString()} จุด)
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Strategy Research & AI Optimization Report Section */}
      {data.strategyResearch && (
        <div className="bg-neutral-900/10 border border-neutral-900 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-48 w-48 bg-amber-500/5 blur-[55px] rounded-full pointer-events-none" />
          
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              <Compass className="h-5 w-5 text-amber-500" />
              🧠 รายงานวิจัยและคัดกรองกลยุทธ์ AI (AI Strategy Research & Optimization)
            </h2>
            <p className="text-neutral-400 text-xs leading-relaxed">
              ผลการทดสอบการเข้า-ออกออเดอร์จริงและย้อนหลังของเอไอ ระบบทำการวัดผล (Win Rate / RR) เพื่อคัดกรองเฉพาะสไตล์เทรดที่ผ่านเกณฑ์เท่านั้นมาแจ้งเตือนคุณ
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {data.strategyResearch.candidates.map((strategy) => {
              const isApproved = strategy.status === 'APPROVED';
              
              // Localized strategy labels
              let strategyTitle = strategy.label;
              if (strategy.id.includes('support')) strategyTitle = '📈 เก็งกำไรสั้นฝั่งซื้อ (Support Scalping)';
              else if (strategy.id.includes('resistance')) strategyTitle = '📉 เก็งกำไรสั้นฝั่งขาย (Resistance Scalping)';
              else if (strategy.id.includes('follow_trend')) strategyTitle = '🔥 เทรดตามเทรนด์ย่อตัว (EMA Pullback Trend)';

              return (
                <div 
                  key={strategy.id} 
                  className={`relative rounded-2xl border bg-neutral-950/60 p-5 space-y-4 flex flex-col justify-between ${
                    isApproved 
                      ? 'border-emerald-500/20 hover:border-emerald-500/30' 
                      : 'border-neutral-800 hover:border-neutral-700'
                  } transition-all`}
                >
                  <div className="space-y-3">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded border uppercase ${
                        isApproved
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {isApproved ? '● อนุมัติใช้งาน (Approved)' : '○ อยู่ระหว่างวิจัย (Researching)'}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">{strategy.mode}</span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-neutral-200">{strategyTitle}</h4>

                    {/* Fit Parameters Box */}
                    <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-3 text-[10px] space-y-1.5 font-mono text-neutral-400">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">กฎคอนเฟิร์ม:</span>
                        <span className="text-neutral-300 truncate max-w-[150px]" title={strategy.parameters.confirmation}>
                          {strategy.parameters.confirmation}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">เป้าหมาย RR:</span>
                        <span className="text-emerald-400 font-bold">1:{strategy.parameters.riskReward}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">ระยะจำกัด SL:</span>
                        <span className="text-rose-400 font-bold">
                          {strategy.parameters.slPoints ? `${strategy.parameters.slPoints} จุด` : 'คำนวณตาม ATR'}
                        </span>
                      </div>
                    </div>

                    {/* Test Results */}
                    <div className="space-y-1.5 text-[10.5px]">
                      {/* Backtest */}
                      <div className="flex justify-between">
                        <span className="text-neutral-500">สถิติย้อนหลัง (Backtest):</span>
                        <span className="font-mono font-bold text-neutral-300">
                          {strategy.backtest?.winRate ?? strategy.winRate}% 
                          <span className="text-neutral-500 font-normal text-[9px] ml-1">
                            ({strategy.backtest?.wins ?? strategy.wins}W / {strategy.backtest?.losses ?? strategy.losses}L)
                          </span>
                        </span>
                      </div>
                      
                      {/* Live Forward Test */}
                      <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                        <span className="text-neutral-500">ผลออเดอร์จริง (Forward):</span>
                        <span className="font-mono font-bold text-neutral-300">
                          {strategy.liveForwardTest?.winRate ?? 0}%
                          <span className="text-neutral-500 font-normal text-[9px] ml-1">
                            ({strategy.liveForwardTest?.wins ?? 0}W / {strategy.liveForwardTest?.losses ?? 0}L)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Worthiness rationale comment */}
                  <div className="pt-2 text-[10px] text-neutral-400 leading-relaxed italic bg-neutral-900/30 p-2.5 rounded-lg border border-neutral-900/50">
                    💡 <strong>อัปเดตระบบ:</strong> {strategy.rationale.replace('optimized via recent MT5 bars.', 'ได้รับการวิเคราะห์ปรับปรุงพารามิเตอร์แบบเรียลไทม์ และตรวจเช็กเสถียรภาพสม่ำเสมอ')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-[11px] text-amber-300/80 leading-relaxed font-mono">
            ℹ️ <strong>วิธีที่ AI ปรับปรุงการส่งสัญญาณ:</strong> เมื่อใดก็ตามที่มีออเดอร์ตามแผนเทรดชน TP หรือ SL (Forward Test) ระบบจะประมวลผลคำนวณ Win Rate ล่าสุดร่วมกับสถิติย้อนหลัง หากพบว่ากลยุทธ์ใดมีอัตราแพ้เกินครึ่งหรือไม่ได้เปรียบ ระบบจะนำกลยุทธ์นั้นกลับเข้าสู่สถานะวิจัย (Researching) และหยุดแสดงคำแนะนำบนหน้าแดชบอร์ดลูกค้าทันทีจนกว่าจะปรับปรุงพารามิเตอร์ให้กลับมาเกินเกณฑ์ 70% Win Rate ขึ้นไป
          </div>
        </div>
      )}
    </div>
  );
}
