'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Lock, ArrowRight, Zap, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface LiveMarketPreviewProps {
  stats?: any;
  loading?: boolean;
}

export default function LiveMarketPreview({ stats: propStats, loading: propLoading }: LiveMarketPreviewProps) {
  const [localStats, setLocalStats] = useState<any>(null);
  const [localLoading, setLocalLoading] = useState(true);

  const stats = propStats !== undefined ? propStats : localStats;
  const loading = propLoading !== undefined ? propLoading : localLoading;

  useEffect(() => {
    // Only fetch internally if props are not provided
    if (propStats !== undefined && propLoading !== undefined) return;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/dashboard-stats?symbol=XAUUSD');
        const data = await res.json();
        setLocalStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLocalLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [propStats, propLoading]);

  if (loading) {
    return (
      <div className="w-full h-48 bg-neutral-900/50 rounded-3xl border border-neutral-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="text-sm">กำลังวิเคราะห์ตลาดแบบเรียลไทม์...</span>
        </div>
      </div>
    );
  }

  if (!stats || !stats.marketIntelligence || !stats.marketIntelligence.XAUUSD) return null;

  const { currentPrice, bias, trendStrength, volatility, marketSession } = stats.marketIntelligence.XAUUSD;
  const isBullish = bias === 'BULLISH';
  
  const freePlan = stats.marketIntelligence.XAUUSD.proactivePlans?.[0] || {
    title: 'โซนเฝ้าระวังดักซื้อ (Support Zone)',
    entry: 4452.84,
    stopLoss: 4440.00,
    takeProfit: 4475.00,
    type: 'BUY_ZONE',
    confidence: 75,
    reason: 'ราคามีโอกาสย่อตัวลงมาทดสอบแนวรับแข็งแกร่ง แนะนำให้รอสัญญาณกลับตัวคอนเฟิร์มก่อนเข้าออเดอร์',
  };

  return (
    <div className="w-full bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
      
      <div className="p-6 sm:p-8">
        
        {/* Market Session Badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-full flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs text-neutral-400">Market Session:</span>
            <span className="text-xs font-bold text-amber-500">{marketSession || 'Unknown'}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {stats?.mt5Connection?.isLive ? (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono text-emerald-400 font-medium">LIVE XAUUSD</span>
                </>
              ) : (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-mono text-amber-400 font-medium" title="ระบบกำลังใช้ราคาสำรองตลาดโลกชั่วคราวเนื่องจากขาดการเชื่อมต่อกับ MT5">XAUUSD (ราคาตลาดโลก)</span>
                </>
              )}
            </div>
            <h3 className="text-3xl font-bold font-mono">
              ${currentPrice?.toFixed(2) || 'N/A'}
            </h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-2">
              <span className="text-xs text-neutral-500 uppercase">Trend</span>
              {isBullish ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-bold">BULLISH</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-400">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-bold">BEARISH</span>
                </div>
              )}
            </div>
            
            <div className="px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-2">
              <span className="text-xs text-neutral-500 uppercase">Power</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${isBullish ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${trendStrength}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(trendStrength)}%</span>
              </div>
            </div>
            
            <div className="px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-2">
              <span className="text-xs text-neutral-500 uppercase">Vol</span>
              <span className={`text-sm font-bold ${
                volatility === 'HIGH' ? 'text-rose-400' : 
                volatility === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {volatility}
              </span>
            </div>
          </div>
        </div>

        {/* AI Plans Grid: Free Plan + Locked VIP Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Card 1: Free Sample Plan */}
          <div className="bg-neutral-900/60 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.05)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                ✨ แผนตัวอย่างฟรี (Free Plan)
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-indigo-300 bg-indigo-500/10">
                ความมั่นใจ {freePlan.confidence}%
              </span>
            </div>

            <h4 className="text-sm font-bold text-neutral-100 mb-2">{freePlan.title}</h4>
            <p className="text-[10px] text-neutral-450 mb-4 h-12 overflow-hidden leading-relaxed">
              {freePlan.reason}
            </p>

            {freePlan.type !== 'WAIT' ? (
              <div className="space-y-2 font-mono text-xs">
                {/* 3 Entry Points */}
                <div className="bg-black/45 border border-white/5 rounded-xl px-3 py-2 space-y-1.5">
                  <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider block">แนวจุดเข้าแนะนำ (3 Entry Levels)</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-black/25 rounded p-1.5">
                      <span className="text-[8px] text-neutral-500 block mb-0.5">Entry = จุดเข้า</span>
                      <span className="text-neutral-200 font-bold">${freePlan.entry1?.toFixed(2) ?? freePlan.entry?.toFixed(2) ?? '0.00'}</span>
                    </div>
                    <div className="bg-amber-500/5 rounded p-1.5 border border-amber-500/15">
                      <span className="text-[8px] text-amber-400/80 block mb-0.5">Entry 2 (แนะนำ)</span>
                      <span className="text-amber-400 font-black">${freePlan.entry2?.toFixed(2) ?? '0.00'}</span>
                    </div>
                    <div className="bg-emerald-500/5 rounded p-1.5 border border-emerald-500/15">
                      <span className="text-[8px] text-emerald-400/80 block mb-0.5">Entry 3 (ดีสุด)</span>
                      <span className="text-emerald-400 font-black">${freePlan.entry3?.toFixed(2) ?? '0.00'}</span>
                    </div>
                  </div>
                </div>

                {/* SL / TP Row */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-rose-950/20 rounded-xl px-3 py-2 border border-rose-500/10">
                    <span className="text-[8px] text-rose-500 block mb-0.5">ตัดขาดทุน (SL)</span>
                    <span className="text-rose-400 font-bold">${freePlan.stopLoss?.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="bg-emerald-950/20 rounded-xl px-3 py-2 border border-emerald-500/10">
                    <span className="text-[8px] text-emerald-500 block mb-0.5">ทำกำไร (TP)</span>
                    <span className="text-emerald-400 font-bold">${freePlan.takeProfit?.toFixed(2) ?? '0.00'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 text-center text-xs font-medium text-neutral-400">
                ⚠️ โปรดรอจังหวะราคาย่อตัวและเฝ้าสังเกตการณ์แนวรับถัดไป
              </div>
            )}
          </div>

          {/* Card 2: Locked VIP Plans CTA */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[180px] group">
            <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[1.5px] rounded-2xl flex flex-col items-center justify-center p-5 text-center z-10">
              <Lock className="h-6 w-6 text-amber-500 mb-2 animate-bounce" />
              <h4 className="text-xs font-bold text-white mb-1">
                ปลดล็อกแผนวิเคราะห์ทั้งหมด (PRO)
              </h4>
              <p className="text-[10px] text-neutral-400 mb-4 max-w-[280px] leading-relaxed">
                มีอีกกว่า 5+ แผนทางเลือก (เช่น Scalping, Follow Trend) ทำงานสดเรียลไทม์ 24 ชม.
              </p>
              <Link 
                href="/pricing"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center gap-1.5"
              >
                ทดลองใช้งาน PRO ฟรี 30 วันแรก <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            {/* Blurred background mock plan to look cool */}
            <div className="opacity-20 blur-[2px] select-none">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border bg-purple-500/10 text-purple-300 border-purple-500/20">
                  ⚡ SCALPING BUY
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10">
                  ความมั่นใจ 85%
                </span>
              </div>
              <h4 className="text-sm font-bold text-neutral-100 mb-1">Scalping Momentum Surge</h4>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="bg-black/40 rounded px-2 py-1 border border-white/5 text-center">ENTRY</div>
                <div className="bg-rose-950/30 rounded px-2 py-1 border border-rose-500/10 text-center">SL</div>
                <div className="bg-emerald-950/30 rounded px-2 py-1 border border-emerald-500/10 text-center">TP</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
