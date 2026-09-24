'use client';

import { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Flame,
  Layers,
  Lock,
  MessageCircle,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import PublicShell from '@/components/PublicShell';
import {
  PROMOTIONAL_MONTHLY_PRICE_THB,
  REGULAR_MONTHLY_PRICE_THB,
  TRIAL_DURATION_DAYS,
  formatBaht,
} from '@/lib/billing';

// Simulation scenarios for interactive Telegram / LINE bot preview
interface SimulationScenario {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  stageBadge: string;
  timestamp: string;
  telegramMessage: {
    badge: string;
    header: string;
    symbol: string;
    action: 'BUY' | 'SELL' | 'ALERT';
    entry: string;
    sl: string;
    tp1: string;
    tp2: string;
    tp3: string;
    rr: string;
    analysis: string;
    followUpText?: string;
    resultPips?: string;
    reactions: { emoji: string; count: number }[];
  };
  chartState: {
    status: string;
    currentPrice: string;
    pnlPips: string;
    pnlColor: string;
    activeZone: string;
    targetHitLevel?: number; // 0: None, 1: TP1, 2: TP2, 3: TP3
  };
}

const scenarios: SimulationScenario[] = [
  {
    id: 'entry-signal',
    title: '1. สัญญาณเข้าเทรดสด (Entry)',
    tag: 'NEW SIGNAL',
    tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stageBadge: 'จังหวะเข้าเทรดความได้เปรียบสูง',
    timestamp: '14:25 น.',
    telegramMessage: {
      badge: 'GOLD AI VIP SIGNAL',
      header: '🚨 NEW TRADE SIGNAL CONFIRMED',
      symbol: 'XAUUSD (GOLD SPOT)',
      action: 'BUY',
      entry: '2,742.50 - 2,744.00',
      sl: '2,736.80 (จุดตัดขาดทุน 570 จุด)',
      tp1: '2,750.00 (+600 จุด / แบ่งปิด 50%)',
      tp2: '2,758.00 (+1,400 จุด / ล็อกกำไร)',
      tp3: '2,768.00 (+2,400 จุด / เป้าหมายสูงสุด)',
      rr: '1 : 2.85 (High Risk/Reward)',
      analysis:
        'AI ตรวจพบ Bullish CHoCH บน H1 + Liquidity Sweep แนวรับ 2,741.00 และเกิด Fair Value Gap (FVG) ในกรอบ M15 แรงซื้อสถาบันหนุนชัดเจน',
      reactions: [
        { emoji: '🔥', count: 74 },
        { emoji: '🚀', count: 58 },
        { emoji: '💰', count: 92 },
        { emoji: '🎯', count: 46 },
      ],
    },
    chartState: {
      status: 'SIGNAL ACTIVE · IN ENTRY ZONE',
      currentPrice: '2,743.20',
      pnlPips: '+70 Pips',
      pnlColor: 'text-emerald-400',
      activeZone: 'M15 Demand / FVG Zone',
      targetHitLevel: 0,
    },
  },
  {
    id: 'tp1-hit',
    title: '2. แตะเป้าหมาย TP1 (+600 จุด)',
    tag: 'TP1 REACHED',
    tagColor: 'bg-ga-gold/20 text-ga-gold border-ga-gold/30',
    stageBadge: 'ล็อกกำไรครึ่งพอร์ต + กันทุน',
    timestamp: '14:42 น.',
    telegramMessage: {
      badge: 'TARGET 1 ACHIEVED',
      header: '🎯 XAUUSD HIT TAKE PROFIT 1',
      symbol: 'XAUUSD (GOLD SPOT)',
      action: 'BUY',
      entry: '2,742.50',
      sl: 'เลื่อน SL บังทุนที่ 2,743.00 (Risk Free)',
      tp1: '2,750.00 ✅ (HIT)',
      tp2: '2,758.00 (กำลังมุ่งหน้า)',
      tp3: '2,768.00 (เป้าหมายหลัก)',
      rr: '1 : 2.85',
      resultPips: '+600 Pips (กำไร ~$60 ต่อ 0.1 Lot)',
      analysis:
        'ราคาทองคำดีดตัวทะลุ High เดิมตามโมเดล SMC ชน TP1 สำเร็จ สมาชิกปิดทำกำไร 50% และเลื่อน Stop Loss มาบังจุดเข้าเพื่อปล่อยให้พอร์ตรันกำไรอย่างไร้ความเสี่ยง',
      followUpText: '💡 คำแนะนำจากระบบ: ล็อกกำไรเข้ากระเป๋า 50% ทันที และปล่อยไม้อีกครึ่งหนึ่งรันไปสู่ TP2/TP3',
      reactions: [
        { emoji: '🎯', count: 128 },
        { emoji: '🔥', count: 96 },
        { emoji: '💸', count: 83 },
      ],
    },
    chartState: {
      status: 'TP1 HIT · RUNNING RISK-FREE',
      currentPrice: '2,750.80',
      pnlPips: '+760 Pips',
      pnlColor: 'text-emerald-400',
      activeZone: 'Breakout Expansion',
      targetHitLevel: 1,
    },
  },
  {
    id: 'tp2-hit',
    title: '3. ชนเป้าหมาย TP2 (+1,400 จุด)',
    tag: 'TP2 REACHED',
    tagColor: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
    stageBadge: 'กำไรก้อนใหญ่รันเทรนด์ยาว',
    timestamp: '15:15 น.',
    telegramMessage: {
      badge: 'TARGET 2 ACHIEVED',
      header: '🔥 XAUUSD HIT TAKE PROFIT 2',
      symbol: 'XAUUSD (GOLD SPOT)',
      action: 'BUY',
      entry: '2,742.50',
      sl: 'Trail Stop ล็อกกำไรที่ 2,752.00',
      tp1: '2,750.00 ✅ (HIT)',
      tp2: '2,758.00 ✅ (HIT)',
      tp3: '2,768.00 (รันไม้สุดท้าย)',
      rr: '1 : 2.85',
      resultPips: '+1,400 Pips (กำไร ~$140 ต่อ 0.1 Lot)',
      analysis:
        'แรงซื้อทะลุแนวต้านสำคัญ 2,755 ดันราคาชน TP2 2,758.00 ตรงตามเป้าหมายโครงสร้าง Fibonacci Expansion 161.8%',
      followUpText: '💎 สมาชิกสามารถปิดทำกำไรเพิ่มอีก 30% หรือ Trailing Stop กำไรไว้ได้เลย',
      reactions: [
        { emoji: '🚀', count: 165 },
        { emoji: '💰', count: 142 },
        { emoji: '👑', count: 88 },
      ],
    },
    chartState: {
      status: 'TP2 HIT · MAXIMUM PROFIT EXPANSION',
      currentPrice: '2,759.50',
      pnlPips: '+1,620 Pips',
      pnlColor: 'text-emerald-400',
      activeZone: 'Expansion Target Zone',
      targetHitLevel: 2,
    },
  },
  {
    id: 'tp3-hit',
    title: '4. จบไม้เต็มเป้า TP3 (+2,400 จุด)',
    tag: 'FULL TARGET TP3',
    tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    stageBadge: 'จบไม้เทรด 100% สถิติยอดเยี่ยม',
    timestamp: '16:05 น.',
    telegramMessage: {
      badge: 'FULL TARGET COMPLETED',
      header: '💎 XAUUSD FULL TP3 HIT (+2,400 PIPS)',
      symbol: 'XAUUSD (GOLD SPOT)',
      action: 'BUY',
      entry: '2,742.50',
      sl: 'CLOSED',
      tp1: '2,750.00 ✅',
      tp2: '2,758.00 ✅',
      tp3: '2,768.00 ✅ (MAX TARGET)',
      rr: '1 : 2.85',
      resultPips: '+2,400 Pips (กำไร ~$240 ต่อ 0.1 Lot)',
      analysis:
        'ปิดไม้เทรดสมบูรณ์แบบ 100% รวมผลกำไรไม้เดียวกว่า +2,400 จุด สถิติ AI Win Rate สัปดาห์นี้อยู่ที่ 81.5%',
      followUpText: '🎉 ยินดีกับสมาชิก VIP ทุกท่าน! รอสัญญาณชุดถัดไปเมื่อโครงสร้างตลาดใหม่อนุมัติ',
      reactions: [
        { emoji: '🎉', count: 210 },
        { emoji: '👑', count: 175 },
        { emoji: '💰', count: 198 },
        { emoji: '🔥', count: 144 },
      ],
    },
    chartState: {
      status: 'TRADE COMPLETED · FULL TP3 RECORDED',
      currentPrice: '2,768.40',
      pnlPips: '+2,440 Pips',
      pnlColor: 'text-purple-300',
      activeZone: 'Take Profit 3 Full Target',
      targetHitLevel: 3,
    },
  },
  {
    id: 'news-warning',
    title: '5. แจ้งเตือนข่าวกล่องแดง (NO TRADE)',
    tag: 'MARKET RISK ALERT',
    tagColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    stageBadge: 'ระบบป้องกันทุนช่วงตลาดผันผวน',
    timestamp: '19:15 น.',
    telegramMessage: {
      badge: 'SYSTEM RISK ALERT',
      header: '⚠️ HIGH VOLATILITY & NEWS ALERT',
      symbol: 'XAUUSD (US CPI FLASH)',
      action: 'ALERT',
      entry: 'NO TRADE / พักดูตลาด',
      sl: '-',
      tp1: '-',
      tp2: '-',
      tp3: '-',
      rr: 'PAUSE',
      analysis:
        'มีประกาศตัวเลขดัชนีราคาผู้บริโภคสหรัฐฯ (US Core CPI) ในเวลา 19:30 น. กราฟมีความเสี่ยงเกิด Slippage และ Spread ถ่างสูง ระบบ AI สั่งระงับการออกสัญญาณชั่วคราวเพื่อปกป้องเงินทุนสมาชิก',
      followUpText: '🛡️ "การไม่เทรดในช่วงเสี่ยง คือกลยุทธ์ของนักเทรดมืออาชีพ" ระบบจะเริ่มวิเคราะห์ใหม่หลังข่าวสะเด็ดน้ำ 20-30 นาที',
      reactions: [
        { emoji: '👍', count: 112 },
        { emoji: '🛡️', count: 98 },
        { emoji: '🙏', count: 87 },
      ],
    },
    chartState: {
      status: 'MARKET RISK LOCK · WAITING FOR NEWS SETTLEMENT',
      currentPrice: '2,752.10',
      pnlPips: 'PROTECTED',
      pnlColor: 'text-amber-400',
      activeZone: 'High Volatility Buffer Zone',
      targetHitLevel: 0,
    },
  },
];

// Live ticker tape items
const recentSignalsTicker = [
  { pair: 'XAUUSD', type: 'BUY', entry: '2,742.50', result: 'TP3 HIT', pips: '+2,400 Pips', time: '1 ชม. ที่แล้ว', isWin: true },
  { pair: 'XAUUSD', type: 'SELL', entry: '2,765.00', result: 'TP2 HIT', pips: '+1,350 Pips', time: '4 ชม. ที่แล้ว', isWin: true },
  { pair: 'XAUUSD', type: 'BUY', entry: '2,730.20', result: 'TP1 HIT', pips: '+620 Pips', time: '8 ชม. ที่แล้ว', isWin: true },
  { pair: 'XAUUSD', type: 'SELL', entry: '2,755.00', result: 'SL HIT', pips: '-480 Pips', time: '14 ชม. ที่แล้ว', isWin: false },
  { pair: 'XAUUSD', type: 'BUY', entry: '2,718.00', result: 'TP3 HIT', pips: '+2,550 Pips', time: '1 วันที่แล้ว', isWin: true },
  { pair: 'XAUUSD', type: 'BUY', entry: '2,752.00', result: 'TP2 HIT', pips: '+1,280 Pips', time: '1 วันที่แล้ว', isWin: true },
  { pair: 'XAUUSD', type: 'SELL', entry: '2,780.40', result: 'TP3 HIT', pips: '+2,800 Pips', time: '2 วันที่แล้ว', isWin: true },
];

export default function LandingPage() {
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [previewPlatform, setPreviewPlatform] = useState<'telegram' | 'line'>('telegram');
  const [copiedSignal, setCopiedSignal] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Auto-switch simulation step every 8 seconds when autoplay is enabled
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveScenarioIndex((prev) => (prev + 1) % scenarios.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Periodic toast simulator
  useEffect(() => {
    const toastTimer = setTimeout(() => {
      setToastNotification('🎯 [Telegram VIP] XAUUSD Hit TP2 (+1,400 จุด) เรียบร้อยแล้ว!');
    }, 2500);

    const toastInterval = setInterval(() => {
      const messages = [
        '🚀 [Telegram VIP] สัญญาณใหม่: BUY XAUUSD @ 2,742.50 โซน Demand M15',
        '🎯 [Telegram VIP] XAUUSD ชนเป้า TP1 (+600 จุด) สมาชิกแบ่งปิด 50% เรียบร้อย!',
        '🔥 [Telegram VIP] XAUUSD ทะลุ TP2 (+1,400 จุด) เลื่อน SL บังทุน รันกำไรไร้ความเสี่ยง',
        '💎 [Telegram VIP] ปิดเต็มเป้า TP3 (+2,400 จุด) รวมสถิติเดือนนี้ Win Rate 81.5%',
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setToastNotification(randomMsg);
      setTimeout(() => setToastNotification(null), 5000);
    }, 14000);

    return () => {
      clearTimeout(toastTimer);
      clearInterval(toastInterval);
    };
  }, []);

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) localStorage.setItem('referred_by', referralCode.toUpperCase());
  }, []);

  const currentScenario = scenarios[activeScenarioIndex];

  const handleCopySimulation = () => {
    const msg = currentScenario.telegramMessage;
    const text = `🚨 ${msg.header}\n${msg.symbol} (${msg.action})\n📍 Entry: ${msg.entry}\n🛑 SL: ${msg.sl}\n🎯 TP: ${msg.tp1} | ${msg.tp2} | ${msg.tp3}\n📊 R:R: ${msg.rr}`;
    navigator.clipboard.writeText(text);
    setCopiedSignal(true);
    setTimeout(() => setCopiedSignal(false), 2000);
  };

  return (
    <PublicShell>
      <main className="relative overflow-hidden">
        {/* Ambient Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-full max-w-7xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(227,181,45,0.15),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-sky-500/10 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-96 left-5 h-80 w-80 rounded-full bg-emerald-500/5 blur-[120px]"
        />

        {/* FLOATING REAL-TIME TOAST SIMULATOR */}
        {toastNotification && (
          <div className="fixed bottom-6 right-4 z-50 max-w-md animate-bounce sm:right-8">
            <div className="flex items-center gap-3 rounded-2xl border border-sky-500/40 bg-[#0c1622]/95 p-4 text-xs font-medium text-neutral-100 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Send className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sky-300">Gold AI VIP Telegram</span>
                  <span className="text-[10px] text-neutral-400">เมื่อสักครู่</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-neutral-200">{toastNotification}</p>
              </div>
            </div>
          </div>
        )}

        {/* 1. HERO SECTION */}
        <section id="overview" className="relative px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            {/* Live Indicator Pill */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-ga-gold/40 bg-ga-gold/10 px-4 py-1.5 text-xs font-semibold text-ga-gold shadow-[0_0_25px_rgba(227,181,45,0.2)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ga-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ga-gold" />
              </span>
              <span>LIVE AI ENGINE · สัญญาณเทรดทองคำ XAUUSD ยิงตรงเข้ามือถือ 24 ชม.</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-ga-text sm:text-6xl lg:text-7xl lg:leading-[1.12]">
              ระบบสัญญาณเทรดทองคำ <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-ga-gold via-amber-200 to-ga-gold bg-clip-text text-transparent">
                AI Smart Money
              </span>{' '}
              ยิงตรงเข้า <span className="text-sky-400">Telegram VIP</span>
            </h1>

            {/* Sub-headline */}
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-ga-muted sm:text-xl">
              <strong className="font-semibold text-ga-text">ไม่ต้องนั่งเฝ้าจอทั้งวัน!</strong> AI ประมวลผลแท่งเทียน MT5 + โครงสร้างราคา SMC คำนวณจุดเข้า Entry, SL และเป้าหมาย TP1-TP3 ชัดเจน แจ้งเตือนเข้ามือถือคุณทันทีที่เกิดจังหวะได้เปรียบ
            </p>

            {/* CTA Buttons */}
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/checkout"
                className="group relative inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-ga-gold via-amber-400 to-amber-500 px-9 text-base font-bold text-neutral-950 shadow-[0_0_35px_rgba(227,181,45,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_50px_rgba(227,181,45,0.55)] sm:w-auto"
              >
                <Zap className="h-5 w-5 fill-neutral-950" />
                <span>สมัครสมาชิก VIP รับสัญญาณทันที</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/login"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-ga-border bg-[#131b24] px-8 text-base font-semibold text-ga-text transition-colors hover:border-ga-gold/40 hover:bg-[#1a2533] sm:w-auto"
              >
                <span>เข้าสู่ระบบสมาชิก (Member Hub)</span>
                <ChevronRight className="h-4 w-4 text-ga-muted" />
              </Link>
            </div>

            {/* Micro Trust Stats */}
            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-ga-border/60 pt-6 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center p-2">
                <span className="font-mono text-2xl font-bold text-ga-gold sm:text-3xl">&gt; 78%</span>
                <span className="mt-1 text-xs text-ga-muted">Win Rate สถิติย้อนหลัง</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <span className="font-mono text-2xl font-bold text-emerald-400 sm:text-3xl">1 : 2.5+</span>
                <span className="mt-1 text-xs text-ga-muted">Risk / Reward ต่อไม้</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <span className="font-mono text-2xl font-bold text-sky-400 sm:text-3xl">&lt; 1 วินาที</span>
                <span className="mt-1 text-xs text-ga-muted">ความเร็วแจ้งเตือนบน Telegram</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <span className="font-mono text-2xl font-bold text-purple-400 sm:text-3xl">35%</span>
                <span className="mt-1 text-xs text-ga-muted">Affiliate ค่าคอมมิชชั่น</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 🔥 INTERACTIVE SOFTWARE SIMULATION SHOWCASE (เหมือนจำลองซอฟต์แวร์จริง) */}
        <section id="interactive-demo" className="relative border-y border-ga-border bg-[#080d14] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center">
              <span className="public-kicker">
                <Sparkles className="h-4 w-4 text-ga-gold" /> LIVE SOFTWARE & TELEGRAM SIMULATION
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-ga-text sm:text-4xl">
                จำลองการทำงานจริง <span className="text-ga-gold">ของระบบสัญญาณ Gold AI</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ga-muted sm:text-base">
                ลองกดเลือกลำดับขั้นตอนด้านล่าง เพื่อดูตัวอย่างข้อความที่บอท AI รายงานส่งตรงเข้า Telegram VIP ของคุณในแต่ละช่วงการเทรด
              </p>
            </div>

            {/* Interactive Scenario Buttons */}
            <div className="mt-8 flex items-center justify-center gap-2 overflow-x-auto pb-2 sm:gap-3 hide-scrollbar">
              {scenarios.map((scenario, idx) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setActiveScenarioIndex(idx);
                    setIsAutoPlaying(false);
                  }}
                  className={`group relative shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                    activeScenarioIndex === idx
                      ? 'border border-ga-gold bg-ga-gold/15 text-ga-gold shadow-[0_0_20px_rgba(227,181,45,0.2)]'
                      : 'border border-neutral-800 bg-[#111822] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeScenarioIndex === idx ? 'bg-ga-gold animate-ping' : 'bg-neutral-600'
                      }`}
                    />
                    {scenario.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Autoplay status bar */}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isAutoPlaying ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                {isAutoPlaying ? 'เล่นอัตโนมัติ (เปลี่ยนสถานะทุก 7 วิ)' : 'โหมดเลือกเอง'}
              </span>
              <button
                type="button"
                onClick={() => setIsAutoPlaying((prev) => !prev)}
                className="text-amber-400 hover:underline"
              >
                {isAutoPlaying ? 'หยุดเล่นออโต้' : '▶ เล่นออโต้'}
              </button>
            </div>

            {/* DUAL PANE SOFTWARE SIMULATOR FRAME */}
            <div className="mt-8 grid gap-6 lg:grid-cols-12">
              {/* LEFT PANE: TELEGRAM APP WINDOW (MOCKUP) */}
              <div className="lg:col-span-7 flex flex-col rounded-3xl border border-sky-500/30 bg-[#0d141e] shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden">
                {/* Telegram App Bar */}
                <div className="flex items-center justify-between border-b border-neutral-800 bg-[#101924] px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]">
                      <Send className="h-5 w-5" />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#101924] bg-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-100">Gold AI VIP Signals</span>
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-400 border border-sky-500/30">
                          VERIFIED BOT
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400">12,850+ สมาชิก · แจ้งเตือนสด 24 ชม.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      ● LIVE ENGINE
                    </span>
                  </div>
                </div>

                {/* Telegram Message Area */}
                <div className="flex-1 p-5 sm:p-6 space-y-4 bg-[radial-gradient(#1a2634_1px,transparent_1px)] [background-size:16px_16px]">
                  {/* Scenario Tag Ribbon */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${currentScenario.tagColor}`}>
                      <Zap className="h-3.5 w-3.5" />
                      {currentScenario.tag}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      {currentScenario.timestamp} (Bangkok Time)
                    </span>
                  </div>

                  {/* Main Bot Message Bubble */}
                  <div className="relative rounded-2xl border border-sky-500/25 bg-[#121c28] p-5 text-sm text-neutral-100 shadow-xl transition-all">
                    {/* Header line */}
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-ga-gold">
                          {currentScenario.telegramMessage.badge}
                        </span>
                        <h4 className="font-extrabold text-neutral-100 sm:text-base">
                          {currentScenario.telegramMessage.header}
                        </h4>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                          currentScenario.telegramMessage.action === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : currentScenario.telegramMessage.action === 'SELL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {currentScenario.telegramMessage.action}
                      </span>
                    </div>

                    {/* Trade Levels Specs */}
                    <div className="mt-4 space-y-2 font-mono text-xs sm:text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-neutral-900/60 px-3 py-2">
                        <span className="text-neutral-400 font-sans">📌 คู่เงิน (Symbol):</span>
                        <span className="font-bold text-neutral-100">{currentScenario.telegramMessage.symbol}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-neutral-900/60 px-3 py-2">
                        <span className="text-neutral-400 font-sans">📍 จุดเข้า (Entry Zone):</span>
                        <span className="font-bold text-ga-gold">{currentScenario.telegramMessage.entry}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-neutral-900/60 px-3 py-2">
                        <span className="text-neutral-400 font-sans">🛑 จุดยอมแพ้ (Stop Loss):</span>
                        <span className="font-bold text-rose-400">{currentScenario.telegramMessage.sl}</span>
                      </div>

                      <div className="space-y-1.5 rounded-lg border border-neutral-800 bg-[#0d141f] p-3">
                        <p className="flex justify-between">
                          <span className="text-neutral-400 font-sans">🏁 เป้าหมาย TP 1:</span>
                          <span className="font-bold text-emerald-400">{currentScenario.telegramMessage.tp1}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400 font-sans">🏁 เป้าหมาย TP 2:</span>
                          <span className="font-bold text-emerald-400">{currentScenario.telegramMessage.tp2}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400 font-sans">🏁 เป้าหมาย TP 3:</span>
                          <span className="font-bold text-emerald-400">{currentScenario.telegramMessage.tp3}</span>
                        </p>
                      </div>

                      {currentScenario.telegramMessage.resultPips && (
                        <div className="flex items-center justify-between rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-3 py-2">
                          <span className="text-emerald-300 font-sans font-bold">💰 ผลลัพธ์ไม้เทรด:</span>
                          <span className="font-bold text-emerald-300">{currentScenario.telegramMessage.resultPips}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-neutral-400">
                        <span>Risk to Reward Ratio:</span>
                        <span className="font-bold text-sky-400">{currentScenario.telegramMessage.rr}</span>
                      </div>
                    </div>

                    {/* AI Technical Analysis Rationale */}
                    <div className="mt-4 rounded-xl border border-neutral-800 bg-[#0a1017] p-3 text-xs text-neutral-300">
                      <p className="font-semibold text-ga-gold flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> เหตุผลวิเคราะห์ AI Smart Money (SMC):
                      </p>
                      <p className="mt-1 leading-relaxed text-neutral-400">
                        {currentScenario.telegramMessage.analysis}
                      </p>
                    </div>

                    {/* Follow-up Bot Instruction */}
                    {currentScenario.telegramMessage.followUpText && (
                      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-950/20 p-2.5 text-xs text-sky-200">
                        {currentScenario.telegramMessage.followUpText}
                      </div>
                    )}

                    {/* Reactions & Copy */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/80 pt-3">
                      <div className="flex items-center gap-1.5">
                        {currentScenario.telegramMessage.reactions.map((react, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800/80 px-2.5 py-0.5 text-xs font-medium text-neutral-200"
                          >
                            <span>{react.emoji}</span>
                            <span className="font-mono text-[10px] text-neutral-400">{react.count}</span>
                          </span>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleCopySimulation}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-300 hover:border-neutral-500 hover:text-white"
                      >
                        {copiedSignal ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedSignal ? 'คัดลอกแล้ว!' : 'คัดลอกสัญญาณ'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: AI MARKET SCANNER & MT5 CANDLESTICK VISUALIZER */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-ga-border bg-[#0b1118] p-5 sm:p-6 shadow-2xl">
                <div>
                  {/* Visualizer Top Bar */}
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                    <div className="flex items-center gap-2 text-ga-gold">
                      <BarChart3 className="h-4 w-4" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">
                        MT5 AI RADAR SCANNER
                      </span>
                    </div>
                    <span className="font-mono text-xs text-neutral-400">XAUUSD · M15</span>
                  </div>

                  {/* Telemetry Status Card */}
                  <div className="mt-4 rounded-2xl border border-neutral-800 bg-[#0f1722] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">สถานะสัญญาณปัจจุบัน</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        LIVE ACTIVE
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500">ราคาทองคำล่าสุด</span>
                        <p className="font-mono text-2xl font-extrabold text-ga-gold">
                          {currentScenario.chartState.currentPrice}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-neutral-500">Pips สะสม</span>
                        <p className={`font-mono text-lg font-bold ${currentScenario.chartState.pnlColor}`}>
                          {currentScenario.chartState.pnlPips}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Graphic Candlestick & Target Levels Simulation */}
                  <div className="relative mt-5 h-56 rounded-2xl border border-neutral-800 bg-[#070b10] p-4 overflow-hidden">
                    {/* Laser Radar Scan Line Effect */}
                    <div className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-ga-gold to-transparent opacity-75 blur-sm animate-scanline" />

                    {/* Chart Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-15">
                      <div className="border-b border-neutral-500 border-dashed" />
                      <div className="border-b border-neutral-500 border-dashed" />
                      <div className="border-b border-neutral-500 border-dashed" />
                      <div className="border-b border-neutral-500 border-dashed" />
                    </div>

                    {/* Horizontal Target Indicator Lines */}
                    <div className="relative h-full flex flex-col justify-between font-mono text-[10px] z-10">
                      {/* TP3 Level */}
                      <div className={`flex items-center justify-between transition-colors ${currentScenario.chartState.targetHitLevel === 3 ? 'text-purple-300 font-bold' : 'text-neutral-500'}`}>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" /> TP3: 2,768.00 (+2,400 Pips)
                        </span>
                        <span>{currentScenario.chartState.targetHitLevel === 3 ? '🎯 REACHED' : 'TARGET'}</span>
                      </div>

                      {/* TP2 Level */}
                      <div className={`flex items-center justify-between transition-colors ${currentScenario.chartState.targetHitLevel && currentScenario.chartState.targetHitLevel >= 2 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> TP2: 2,758.00 (+1,400 Pips)
                        </span>
                        <span>{currentScenario.chartState.targetHitLevel && currentScenario.chartState.targetHitLevel >= 2 ? '🎯 REACHED' : 'TARGET'}</span>
                      </div>

                      {/* TP1 Level */}
                      <div className={`flex items-center justify-between transition-colors ${currentScenario.chartState.targetHitLevel && currentScenario.chartState.targetHitLevel >= 1 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> TP1: 2,750.00 (+600 Pips)
                        </span>
                        <span>{currentScenario.chartState.targetHitLevel && currentScenario.chartState.targetHitLevel >= 1 ? '🎯 REACHED' : 'TARGET'}</span>
                      </div>

                      {/* Entry Box / Zone */}
                      <div className="my-1 rounded border border-ga-gold/60 bg-ga-gold/10 px-2 py-1 flex items-center justify-between text-ga-gold font-bold">
                        <span>📍 ENTRY ZONE: 2,742.50 - 2,744.00</span>
                        <span>DEMAND FVG</span>
                      </div>

                      {/* SL Level */}
                      <div className="flex items-center justify-between text-rose-400 font-bold">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> SL: 2,736.80
                        </span>
                        <span>STOP LOSS</span>
                      </div>
                    </div>
                  </div>

                  {/* Confluence Badges */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-neutral-800 bg-[#0e1622] p-2.5">
                      <span className="text-[10px] text-neutral-500 uppercase">Engine Model</span>
                      <p className="font-semibold text-neutral-200">Gemini 2.5 + SMC</p>
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-[#0e1622] p-2.5">
                      <span className="text-[10px] text-neutral-500 uppercase">MT5 Latency</span>
                      <p className="font-semibold text-emerald-400">&lt; 15ms Ultra-Fast</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action in Simulator */}
                <div className="mt-6 pt-4 border-t border-neutral-800">
                  <Link
                    href="/checkout"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ga-gold to-amber-400 text-sm font-bold text-neutral-950 shadow-lg transition-all hover:brightness-110"
                  >
                    <span>เข้าร่วมกลุ่มรับสัญญาณสดทันที</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. VERIFIED RECENT SIGNALS STREAMING TICKER */}
        <section className="relative border-b border-ga-border bg-[#0b1017] py-6 overflow-hidden">
          <div className="flex items-center gap-4 px-4 max-w-6xl mx-auto mb-3">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ga-gold">
              <Activity className="h-4 w-4" /> ประวัติสัญญาณล่าสุด (Verified Trade Feed):
            </span>
          </div>

          <div className="relative w-full overflow-hidden">
            <div className="animate-marquee flex items-center gap-4">
              {[...recentSignalsTicker, ...recentSignalsTicker].map((item, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#111822] px-4 py-2 text-xs font-mono text-neutral-200 shadow-sm"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold text-[10px] ${
                      item.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {item.type} {item.pair}
                  </span>
                  <span className="text-neutral-400">@{item.entry}</span>
                  <span
                    className={`font-bold ${
                      item.isWin ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.result} ({item.pips})
                  </span>
                  <span className="text-[10px] text-neutral-500 font-sans">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. TELEGRAM VS LINE PREVIEW SHOWCASE */}
        <section id="mobile-alerts" className="relative border-b border-ga-border bg-[#090e14] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span className="public-kicker">
                <Smartphone className="h-4 w-4 text-ga-gold" /> DUAL NOTIFICATION PLATFORMS
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                แจ้งเตือนครบทั้ง <span className="text-sky-400">Telegram VIP</span> และ <span className="text-emerald-400">LINE OA</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-ga-muted">
                เลือกรับสัญญาณผ่านช่องทางที่คุณสะดวกที่สุด สัญญาณส่งออกพร้อมกันเสี้ยววินาที
              </p>
            </div>

            {/* Switcher Tabs */}
            <div className="mt-10 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewPlatform('telegram')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                  previewPlatform === 'telegram'
                    ? 'bg-sky-500 text-white shadow-[0_0_25px_rgba(14,165,233,0.4)]'
                    : 'border border-ga-border bg-[#111923] text-ga-muted hover:text-ga-text'
                }`}
              >
                <Send className="h-4 w-4" /> Telegram VIP Channel
              </button>
              <button
                type="button"
                onClick={() => setPreviewPlatform('line')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                  previewPlatform === 'line'
                    ? 'bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                    : 'border border-ga-border bg-[#111923] text-ga-muted hover:text-ga-text'
                }`}
              >
                <MessageCircle className="h-4 w-4" /> LINE Official VIP
              </button>
            </div>

            {/* Mockup Showcase */}
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="relative rounded-3xl border border-ga-border bg-[#0d141d] p-6 shadow-2xl sm:p-8">
                {previewPlatform === 'telegram' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-ga-border/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white">
                          <Send className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ga-text">Gold AI VIP Signals</span>
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">CHANNEL</span>
                          </div>
                          <span className="text-xs text-ga-muted">สัญญาณเทรดทองคำ Realtime</span>
                        </div>
                      </div>
                      <span className="text-xs text-ga-muted">เมื่อสักครู่</span>
                    </div>

                    <div className="rounded-2xl border border-sky-500/20 bg-[#121c27] p-5 font-mono text-sm leading-relaxed text-neutral-100">
                      <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                        <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <Flame className="h-4 w-4 text-emerald-400" /> BUY XAUUSD (GOLD)
                        </span>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">CONFIRMED</span>
                      </div>

                      <div className="mt-4 space-y-2 text-xs sm:text-sm">
                        <p className="flex justify-between">
                          <span className="text-neutral-400">📍 โซนเข้า (Entry):</span>
                          <span className="font-bold text-ga-gold">2,742.50 - 2,744.00</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400">🛑 จุดตัดขาดทุน (SL):</span>
                          <span className="font-bold text-rose-400">2,736.80</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400">🏁 เป้าหมาย TP 1:</span>
                          <span className="font-bold text-emerald-400">2,750.00 (+600 จุด)</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400">🏁 เป้าหมาย TP 2:</span>
                          <span className="font-bold text-emerald-400">2,758.00 (+1,400 จุด)</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400">🏁 เป้าหมาย TP 3:</span>
                          <span className="font-bold text-emerald-400">2,768.00 (+2,400 จุด)</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-neutral-400">📊 Risk/Reward:</span>
                          <span className="font-bold text-sky-400">1 : 2.8</span>
                        </p>
                      </div>

                      <div className="mt-4 rounded-lg border border-neutral-700/50 bg-[#0c1219] p-3 text-xs font-sans text-neutral-300">
                        <p className="font-semibold text-ga-gold">💡 เหตุผลวิเคราะห์ทางเทคนิค (AI Logic):</p>
                        <p className="mt-1 text-neutral-400">ราคาทำ Bullish CHoCH บน H1 พร้อมทดสอบ Demand Zone M15 และ Liquidity Sweep บริเวณ 2,741 มีแรงซื้อกลับชัดเจน</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-ga-border/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ga-text">Gold AI Signal Official</span>
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">VERIFIED</span>
                          </div>
                          <span className="text-xs text-ga-muted">LINE VIP Notification</span>
                        </div>
                      </div>
                      <span className="text-xs text-ga-muted">เมื่อสักครู่</span>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-[#0f1d19] p-5 font-mono text-sm leading-relaxed text-neutral-100">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                        <span className="font-bold text-emerald-400">🔔 สัญญาณเทรดทองคำใหม่!</span>
                        <span className="text-xs text-emerald-300 font-sans">Gold AI Bot</span>
                      </div>

                      <div className="mt-4 space-y-2 text-xs sm:text-sm font-sans">
                        <p className="font-bold text-base text-ga-gold">🚨 แผนการเทรด: BUY XAUUSD</p>
                        <p className="text-neutral-300">• จุดเข้า (Entry Zone): <strong className="text-ga-gold font-mono">2,742.50 - 2,744.00</strong></p>
                        <p className="text-neutral-300">• จุดยอมแพ้ (Stop Loss): <strong className="text-rose-400 font-mono">2,736.80</strong></p>
                        <p className="text-neutral-300">• เป้าทำกำไร (TP): <strong className="text-emerald-400 font-mono">2,750 / 2,758 / 2,768</strong></p>
                        <p className="text-neutral-300">• R:R Ratio: <strong className="text-sky-400 font-mono">1 : 2.8</strong></p>
                        <div className="mt-3 rounded bg-black/40 p-2.5 text-xs text-neutral-400">
                          ⚠️ ควบคุมความเสี่ยงไม่เกิน 1-2% ต่อไม้ และตั้ง SL ทันทีหลังเปิดออเดอร์
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 5. PAIN POINTS & SOLUTIONS */}
        <section id="features" className="relative border-b border-ga-border px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span className="public-kicker">SOLUTIONS FOR TRADERS</span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                แก้ปัญหาการเทรดทองคำ <span className="text-ga-gold">ที่คุณเคยเจอ</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-ga-muted">
                ให้ AI เป็นผู้ช่วยส่วนตัวคัดกรองสัญญาณคุณภาพสูง แทนการลองผิดลองถูกด้วยตัวเอง
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">ไม่ต้องนั่งเฝ้าจอทั้งวัน</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  สัญญาณยิงตรงเข้า Telegram & LINE บนมือถือ ไม่ต้องเปิดคอมทิ้งไว้ ไม่เสียงานประจำ มีเวลาใช้ชีวิตมากขึ้น
                </p>
              </div>

              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">มี Stop Loss ทุกไม้ คุมพอร์ตปลอดภัย</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  ไม่พาค้างดอย ไม่พาลากพอร์ตแตก มีการคำนวณจุดตัดขาดทุน (SL Buffer) อิงตามโครงสร้าง Swing High/Low เสมอ
                </p>
              </div>

              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-ga-gold/30 bg-ga-gold/10 text-ga-gold">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">AI วิเคราะห์แม่นยำ + SMC</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  ใช้ Smart Money Concept, Fair Value Gap (FVG) และ Multi-Timeframe กรองเฉพาะจังหวะที่มีแต้มต่อสูง
                </p>
              </div>

              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                  <Radio className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">ตลาดผันผวน AI แจ้งเตือนพัก</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  เมื่อตลาดผันผวนสูง ข่าวกล่องแดง หรือทิศทางไม่ชัดเจน ระบบจะแจ้ง NO TRADE เตือนให้หยุดเทรด เพื่อรักษาเงินทุน
                </p>
              </div>

              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">ระบบสมาชิก & สถิติโปร่งใส</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  มีระบบ VIP Member Hub จัดการวันใช้งาน เช็คสถิติไม้เทรดย้อนหลัง และรับลิงก์เข้ากลุ่ม VIP ได้ทันทีตลอด 24 ชม.
                </p>
              </div>

              <div className="rounded-2xl border border-ga-border bg-[#0e151e] p-6 transition-all hover:border-ga-gold/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <WalletCards className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ga-text">Affiliate 35% รายได้เสริม</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  สมาชิกทุกคนมีลิงก์แนะนำเพื่อน รับส่วนแบ่งค่าคอมมิชชั่น 35% ทุกยอดชำระแบบ Recurring ตลอดอายุสมาชิกเพื่อน
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. THREE STEP PROCESS */}
        <section id="workflow" className="relative border-b border-ga-border bg-[#0a0f15] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span className="public-kicker">EASY 3 STEPS</span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                เริ่มต้นรับสัญญาณ <span className="text-ga-gold">ใน 3 ขั้นตอนง่ายๆ</span>
              </h2>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              <div className="relative rounded-3xl border border-ga-border bg-[#0e1620] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ga-gold/10 font-mono text-xl font-bold text-ga-gold border border-ga-gold/30">
                  01
                </div>
                <h3 className="mt-6 text-lg font-bold text-ga-text">สมัครและเปิดสิทธิ์ VIP</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  ลงทะเบียนและชำระค่าบริการผ่าน PromptPay สแกน QR Code อนุมัติรวดเร็ว หรือทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน
                </p>
              </div>

              <div className="relative rounded-3xl border border-ga-border bg-[#0e1620] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 font-mono text-xl font-bold text-sky-400 border border-sky-500/30">
                  02
                </div>
                <h3 className="mt-6 text-lg font-bold text-ga-text">กดเข้ากลุ่ม Telegram & LINE</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  เข้าสู่หน้า Member Hub กดปุ่มเข้าร่วม Telegram VIP Group หรือเชื่อมต่อ LINE Notification ได้ทันทีด้วยคลิกเดียว
                </p>
              </div>

              <div className="relative rounded-3xl border border-ga-border bg-[#0e1620] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 font-mono text-xl font-bold text-emerald-400 border border-emerald-500/30">
                  03
                </div>
                <h3 className="mt-6 text-lg font-bold text-ga-text">รับสัญญาณและเทรดทำกำไร</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  เมื่อระบบตรวจพบจังหวะเทรด สัญญาณจะเด้งแจ้งเตือนบนมือถือ ให้คุณเปิดออเดอร์ตามระดับราคาที่แนะนำได้ทันที
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. PRICING & OFFER */}
        <section id="pricing" className="relative border-b border-ga-border px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="public-kicker">VIP MEMBERSHIP</span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                แพ็กเกจสมาชิก <span className="text-ga-gold">Gold AI Signal VIP</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-ga-muted">
                ราคาสมาชิกพิเศษ Founding Member สิทธิ์จำนวนจำกัด ล็อกราคาเดิมตลอดอายุการใช้งาน
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-md">
              <div className="relative overflow-hidden rounded-3xl border-2 border-ga-gold/50 bg-[#0e1622] p-8 shadow-[0_0_50px_rgba(227,181,45,0.15)] sm:p-10">
                <div className="absolute right-0 top-0 rounded-bl-xl bg-ga-gold px-4 py-1 font-mono text-xs font-bold text-neutral-950">
                  POPULAR
                </div>

                <p className="font-mono text-xs uppercase tracking-widest text-ga-gold">FOUNDING MEMBER VIP</p>
                <h3 className="mt-2 text-2xl font-bold text-ga-text">สมาชิก VIP รายเดือน</h3>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-mono text-5xl font-extrabold text-ga-gold">{formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}</span>
                  <span className="text-sm text-ga-muted">/ เดือน</span>
                  <span className="ml-2 text-sm text-neutral-500 line-through">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</span>
                </div>

                <p className="mt-3 text-xs leading-5 text-emerald-400">
                  ✨ ชำระวันนี้ ล็อกราคาโปรโมชั่น {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}/เดือน ตลอดอายุสมาชิก
                </p>

                <div className="my-6 border-t border-ga-border" />

                <ul className="space-y-3.5 text-sm text-neutral-200">
                  {[
                    'รับสัญญาณสด XAUUSD ในกลุ่ม VIP Telegram 24 ชม.',
                    'ระบบแจ้งเตือนผ่าน LINE Official Account',
                    'ระดับราคา Entry, Stop Loss และเป้าหมาย TP1-TP3 ชัดเจน',
                    'เหตุผลวิเคราะห์โครงสร้างตลาด SMC & FVG ทุกไม้',
                    'การแจ้งเตือนสภาวะตลาดเสี่ยง / ข่าวแรง / NO TRADE',
                    'เข้าใช้งาน VIP Member Hub บริหารวันใช้งาน',
                    'รับสิทธิ์โปรแกรม Affiliate แนะนำเพื่อน รับคอมมิชชั่น 35%',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/checkout"
                  className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ga-gold to-amber-400 text-base font-bold text-neutral-950 shadow-lg transition-all hover:brightness-110"
                >
                  <span>สมัครสมาชิกและรับสิทธิ์ทันที</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <p className="mt-4 text-center text-xs text-ga-muted">
                  ชำระเงินง่ายผ่าน PromptPay QR Code · หรือทดลองฟรี {TRIAL_DURATION_DAYS} วัน
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. AFFILIATE REFERRAL CALLOUT */}
        <section className="relative border-b border-ga-border bg-[#0d141d] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-3xl border border-purple-500/30 bg-purple-950/10 p-8 sm:p-10">
            <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                  <WalletCards className="h-4 w-4" /> AFFILIATE PROGRAM
                </div>
                <h3 className="text-2xl font-bold text-ga-text">แนะนำเพื่อนเทรด รับค่าคอมมิชชั่น 35%</h3>
                <p className="text-sm text-ga-muted">
                  รับส่วนแบ่ง Recurring 35% ทุกยอดชำระของเพื่อนที่คุณแนะนำ เบิกถอนเข้าบัญชีธนาคารได้ทันที
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/20 px-6 text-sm font-bold text-purple-200 hover:bg-purple-500/30"
              >
                <span>รับลิงก์แนะนำใน Hub</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* 9. DISCLAIMER */}
        <section id="disclaimer" className="border-t border-ga-border bg-[#080d12] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 sm:p-8">
              <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
                <ShieldAlert className="h-6 w-6 text-amber-400" />
                <h3 className="text-base font-bold text-ga-text">คำเตือนความเสี่ยงและข้อตกลงการใช้งาน (Disclaimer)</h3>
              </div>
              <div className="mt-4 space-y-3 text-xs leading-6 text-ga-muted">
                <p>
                  1. <strong className="text-neutral-200">เครื่องมือช่วยวิเคราะห์ทางเทคนิค:</strong> Gold AI Signal เป็นซอฟต์แวร์จัดโครงสร้างและวิเคราะห์ข้อมูลราคาทองคำ ไม่ใช่บริการระดมทุน ไม่ใช่คำแนะนำทางการเงิน และไม่มีการรับประกันผลตอบแทน 100%
                </p>
                <p>
                  2. <strong className="text-neutral-200">การบริหารความเสี่ยง:</strong> การซื้อขายทองคำและ Forex มีความผันผวนสูง ผู้ใช้งานเป็นผู้มีอำนาจตัดสินใจเปิด-ปิดออเดอร์ด้วยตนเอง ควรใช้ Money Management (MM) และคำนวณ Lot Size อย่างเคร่งครัด
                </p>
                <p>
                  3. <strong className="text-neutral-200">ความรับผิดชอบ:</strong> ผลการดำเนินงานในอดีตไม่ได้รับประกันผลกำไรในอนาคต ความเสียหายหรือผลขาดทุนจากการตัดสินใจซื้อขายของผู้ใช้ถือเป็นความรับผิดชอบของผู้ใช้งาน 100%
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
