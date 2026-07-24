'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Gift,
  LineChart,
  LogIn,
  MessageCircle,
  Rocket,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserPlus,
  Zap,
} from 'lucide-react';
import LiveMarketPreview, { type PublicDashboardStats } from '@/components/LiveMarketPreview';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

export default function LandingPage() {
  const [stats, setStats] = useState<PublicDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) localStorage.setItem('referred_by', referralCode.toUpperCase());

    const load = async () => {
      try {
        setStats(await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 12_000, public: true }));
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    const initialTimer = window.setTimeout(load, 0);
    const interval = window.setInterval(load, 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 pb-24 text-neutral-100 md:pb-0">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-neutral-900 bg-neutral-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Zap className="h-5 w-5 text-amber-400" />
            </span>
            <span>
              <strong className="block text-sm font-black tracking-tight text-neutral-100">GOLD AI SIGNAL</strong>
              <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">XAUUSD Trading Assistant</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">เข้าสู่ระบบ</Link>
            <Link href="/pricing" className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:from-amber-300 hover:to-amber-400 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]">
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />ทดลองฟรี</span>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ═══════════ HERO ═══════════ */}
        <section className="border-b border-neutral-900 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src="/hero-bg.jpg" alt="" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-neutral-950/90 to-neutral-950" />
          </div>
          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pb-14 sm:pt-20">
            <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1 text-[10px] font-black text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              Gold AI Trade Assistant Active
            </div>
            <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-5xl md:text-6xl bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
              แผนเทรดทองคำ XAUUSD<br className="hidden sm:inline" /> ที่ชัดเจนก่อนตัดสินใจ
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
              ระบบสรุปแผนหลักเพียงแผนเดียว Real-time พร้อม Entry · SL · TP · Risk/Reward ชัดเจน ไม่ส่งแผนเมื่อคุณภาพไม่ผ่านเกณฑ์
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row px-4">
              <Link href="/pricing" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 text-base font-bold text-neutral-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_4px_24px_rgba(245,158,11,0.3)] transition-all">
                <Rocket className="h-5 w-5" /> เริ่มทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน
              </Link>
              <Link href="/login" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 font-semibold text-neutral-200 hover:bg-neutral-800 transition-all">
                <LogIn className="h-4 w-4" /> เข้าสู่ระบบสมาชิก
              </Link>
            </div>
          </div>
          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-14 sm:px-6">
            <LiveMarketPreview stats={stats} loading={loading} />
          </div>
        </section>

        {/* ═══════════ FEATURES ═══════════ */}
        <section className="border-b border-neutral-900">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                <Star className="h-3 w-3" /> ทำไมต้อง Gold AI Signal
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">ระบบช่วยวิเคราะห์ที่ออกแบบมาเพื่อเทรดเดอร์ทองคำ</h2>
            </div>
            
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', title: 'หนึ่งแผนหลัก · ไม่ซ้ำซ้อน', desc: 'ระบบจะมีแผนที่ยังทำงานอยู่เพียงแผนเดียว ไม่มีสัญญาณชุดใหม่มาทับกัน แผนจะอยู่จนกว่าจะเข้าเงื่อนไขหรือหมดอายุ' },
                { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', title: 'ประเมินความเสี่ยงทุกแผน', desc: 'ทุกแผนมาพร้อมคะแนนความเสี่ยง 0-100 วิเคราะห์จากความผันผวน ทิศทางขัดแย้ง ข่าว และปัจจัยอื่นๆ ชัดเจน' },
                { icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'วัดผลโปร่งใส · ตรวจสอบได้', desc: 'ทุกแผนที่ราคาแตะจุดเข้าจะถูกติดตามจนชน TP/SL เพื่อสรุป Win rate และ R-multiple จากข้อมูลจริงแบบไร้การบิดเบือน' },
                { icon: Bell, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', title: 'แจ้งเตือน LINE ทันที', desc: 'เมื่อระบบออกแผนใหม่ สมาชิกจะได้รับแจ้งเตือนผ่าน LINE ทันที ไม่พลาดจังหวะเทรดสำคัญตลอด 24 ชั่วโมง' },
                { icon: LineChart, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', title: 'แนวรับแนวต้านจากโครงสร้างจริง', desc: 'คำนวณจากข้อมูลแท่งเทียน M15 และ H1 จาก MT5 โดยตรง ไม่ใช้การลากเส้นด้วยมือ ทำให้ได้ระดับราคาที่แม่นยำ' },
                { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', title: 'ข้อมูล Real-time จาก MT5', desc: 'ระบบเชื่อมตรงกับ MetaTrader 5 เพื่อรับข้อมูลราคาและแท่งเทียน XAUUSD แบบ Real-time ไม่ใช้ข้อมูลจากแหล่งที่สาม' },
              ].map(({ icon: Icon, color, bg, title, desc }) => (
                <div key={title} className="group bg-neutral-900/30 border border-neutral-900 p-6 rounded-2xl shadow-xl hover:border-neutral-800 hover:bg-neutral-900/50 transition-all duration-300">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">{title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ SERVICE FLOW ═══════════ */}
        <section className="border-b border-neutral-900 bg-neutral-900/10">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-0.5 text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                <TrendingUp className="h-3 w-3 text-amber-400" /> ขั้นตอนการทำงาน
              </span>
              <h2 className="mt-4 text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">ข้อมูลจริงเข้าสู่ระบบ สรุปผลกลับไปพัฒนาระบบ</h2>
              <p className="mt-3 text-sm text-neutral-400">ทุกขั้นตอนทำงานอัตโนมัติ ตั้งแต่รับราคาจาก MT5 จนถึงส่งแจ้งเตือนและเก็บสถิติวัดผล</p>
            </div>
            <div className="rounded-2xl border border-neutral-900 bg-neutral-950/60 p-3 sm:p-5 shadow-2xl overflow-hidden">
              <img src="/service-flow.jpg" alt="Service Flow: MT5 → AI Analysis → Quality Filter → LINE Alerts → Performance Analytics" className="w-full h-auto rounded-xl" />
            </div>
          </div>
        </section>

        {/* ═══════════ PRICING — HERO SECTION ═══════════ */}
        <section className="relative overflow-hidden">
          {/* Glow decorations */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-emerald-500/3 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 relative z-10">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1 text-[10px] font-black text-amber-400 uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <Crown className="h-3.5 w-3.5" /> แพ็กเกจสมาชิก PRO
              </span>
              <h2 className="mt-5 text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
                เข้าถึงแผนเทรดระดับ PRO
              </h2>
              <p className="mt-3 text-sm text-neutral-400 max-w-lg mx-auto">ดูแผนพร้อมวิเคราะห์ความเสี่ยง รับแจ้งเตือนทันทีผ่าน LINE และตรวจสอบสถิติได้ตลอดเวลา</p>
            </div>

            {/* Price Card */}
            <div className="max-w-lg mx-auto rounded-3xl border-2 border-amber-500/30 bg-gradient-to-b from-neutral-900/80 via-neutral-900/60 to-neutral-950/80 p-8 sm:p-10 shadow-[0_8px_60px_rgba(245,158,11,0.08)] relative overflow-hidden backdrop-blur-lg">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-neutral-950">
                  <Sparkles className="h-3 w-3" /> แนะนำ
                </span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Gift className="h-3.5 w-3.5" /> ทดลองฟรี {TRIAL_DURATION_DAYS} วัน
                </span>
              </div>

              {/* Plan Name */}
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">สมาชิก PRO รายเดือน</h3>
              
              {/* Price */}
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-black text-amber-400">{formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}</span>
                <span className="text-neutral-500 text-sm font-bold">/เดือน</span>
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">ราคาปกติ <span className="line-through">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</span> · ราคาพิเศษช่วงเปิดตัว</p>

              {/* CTA */}
              <Link href="/pricing" className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-base font-black text-neutral-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_6px_30px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98]">
                <Rocket className="h-5 w-5" /> เริ่มทดลองใช้ฟรี
              </Link>
              <p className="mt-3 text-center text-[11px] text-neutral-500">ไม่ต้องผูกบัตร · ยกเลิกได้ทุกเมื่อ</p>

              {/* Divider */}
              <div className="my-7 border-t border-neutral-800/80" />

              {/* Feature List */}
              <ul className="space-y-4">
                {[
                  { icon: Target, color: 'text-amber-400', text: 'แผนเทรดหลัก XAUUSD พร้อม Entry / SL / TP' },
                  { icon: ShieldAlert, color: 'text-rose-400', text: 'วิเคราะห์ความเสี่ยงทุกแผน พร้อมคะแนน 0-100' },
                  { icon: Bell, color: 'text-sky-400', text: 'แจ้งเตือนแผนใหม่ผ่าน LINE ทันที' },
                  { icon: LineChart, color: 'text-emerald-400', text: 'แนวรับแนวต้านจากข้อมูล MT5 Real-time' },
                  { icon: BarChart3, color: 'text-violet-400', text: 'ประวัติแผน · Win rate · สถิติ R-multiple' },
                  { icon: Clock, color: 'text-cyan-400', text: 'ข้อมูลราคาอัปเดตทุก 10 วินาที' },
                  { icon: MessageCircle, color: 'text-emerald-400', text: 'ช่องทางแจ้งปัญหาและแชทกับทีมงาน' },
                ].map(({ icon: Icon, color, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-neutral-900/80 border border-neutral-800 mt-0.5">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </span>
                    <span className="text-sm text-neutral-300 leading-snug">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Secondary CTA */}
            <div className="mt-10 text-center">
              <p className="text-sm text-neutral-400">มีบัญชีอยู่แล้ว?</p>
              <Link href="/login" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors">
                <LogIn className="h-4 w-4" /> เข้าสู่ระบบสมาชิก <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ FINAL CTA BANNER ═══════════ */}
        <section className="border-t border-neutral-900">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
            <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/5 via-neutral-950/40 to-neutral-950 p-8 sm:p-12 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <Zap className="mx-auto h-10 w-10 text-amber-400 mb-4" />
              <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">พร้อมเทรดทองคำด้วย AI แล้วหรือยัง?</h2>
              <p className="mt-3 text-sm text-neutral-400 max-w-md mx-auto">เริ่มต้นทดลองใช้งานฟรี {TRIAL_DURATION_DAYS} วัน ดูแผนเทรดจริง วิเคราะห์ความเสี่ยงจริง วัดผลจริง</p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/pricing" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-base font-bold text-neutral-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_4px_24px_rgba(245,158,11,0.25)] transition-all">
                  <Sparkles className="h-5 w-5" /> สมัครทดลองฟรี
                </Link>
                <a href="https://line.me/R/ti/p/@413aryiz" target="_blank" rel="noreferrer" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  <MessageCircle className="h-5 w-5" /> สอบถามทาง LINE
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 px-4 py-12 text-center text-xs leading-relaxed text-neutral-500 bg-neutral-950">
        <p className="font-bold text-neutral-300 tracking-wider">GOLD AI SIGNAL</p>
        <p className="mx-auto mt-2 max-w-xl text-[11px]">
          การเทรดทองคำมีความเสี่ยง ข้อมูลที่นำเสนอผ่านระบบนี้เป็นเครื่องมือช่วยวิเคราะห์ทางเทคนิคเท่านั้น ไม่ถือเป็นการชี้นำหรือระดมทุนใดๆ ผู้ใช้งานควรพิจารณาความเสี่ยงและตั้ง SL ทุกครั้งก่อนเข้าออเดอร์
        </p>
      </footer>

      {/* Floating Glass Bottom Navigation on Mobile */}
      <nav className="fixed inset-x-4 bottom-4 z-40 grid h-14 grid-cols-4 items-center rounded-2xl border border-neutral-900/60 bg-neutral-950/80 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] md:hidden">
        <Link href="/pricing" className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-bold">
          <Sparkles className="h-4 w-4" />
          <span>ทดลองฟรี</span>
        </Link>
        <Link href="/login" className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-neutral-400 hover:text-white transition-colors">
          <LogIn className="h-4 w-4" />
          <span>เข้าสู่ระบบ</span>
        </Link>
        <Link href="/checkout" className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-neutral-400 hover:text-white transition-colors">
          <CreditCard className="h-4 w-4" />
          <span>ชำระเงิน</span>
        </Link>
        <a href="https://line.me/R/ti/p/@413aryiz" target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors font-bold">
          <MessageCircle className="h-4 w-4" />
          <span>LINE</span>
        </a>
      </nav>
    </div>
  );
}
