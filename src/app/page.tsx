'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Flame,
  Globe,
  Layers,
  Lock,
  MessageCircle,
  PhoneCall,
  Radio,
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
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'telegram' | 'line'>('telegram');

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) localStorage.setItem('referred_by', referralCode.toUpperCase());
  }, []);

  return (
    <PublicShell>
      <main className="relative overflow-hidden">
        {/* Ambient Glows */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-full max-w-7xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(227,181,45,0.12),transparent_70%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-emerald-500/5 blur-[120px]" />

        {/* 1. HERO SECTION (High-Converting Sales Hook) */}
        <section id="overview" className="relative border-b border-ga-border/80 px-4 pb-20 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-ga-gold/30 bg-ga-gold/10 px-4 py-1.5 text-xs font-semibold text-ga-gold shadow-[0_0_20px_rgba(227,181,45,0.15)]">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ga-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ga-gold" />
              </span>
              <span>GOLD AI VIP SIGNALS · แจ้งเตือนตรงเข้ามือถือ 24 ชม.</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-ga-text sm:text-6xl lg:text-7xl lg:leading-[1.15]">
              สัญญาณเทรดทองคำ <span className="bg-gradient-to-r from-ga-gold via-amber-200 to-ga-gold bg-clip-text text-transparent">AI Real-Time</span><br />
              ยิงตรงเข้า <span className="text-sky-400">Telegram VIP</span> & <span className="text-emerald-400">LINE</span>
            </h1>

            {/* Sub-headline */}
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-ga-muted sm:text-xl">
              <strong className="font-semibold text-ga-text">ไม่ต้องนั่งเฝ้าจอกราฟทั้งวัน!</strong> ระบบ AI วิเคราะห์โครงสร้างราคา SMC + FVG คำนวณจุดเข้า Entry, SL และ TP พร้อมส่งแจ้งเตือนเข้ามือถือคุณทันทีเมื่อมีจังหวะความได้เปรียบสูง
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/checkout"
                className="group relative inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-ga-gold via-amber-400 to-amber-500 px-8 text-base font-bold text-neutral-950 shadow-[0_0_30px_rgba(227,181,45,0.3)] transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(227,181,45,0.5)] sm:w-auto"
              >
                <Zap className="h-5 w-5 fill-neutral-950" />
                <span>สมัครสมาชิก VIP รับสัญญาณทันที</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/login"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ga-border bg-[#131b24] px-8 text-base font-semibold text-ga-text transition-colors hover:border-ga-gold/40 hover:bg-[#1a2533] sm:w-auto"
              >
                <span>เข้าสู่ระบบสมาชิก (Member Hub)</span>
                <ChevronRight className="h-4 w-4 text-ga-muted" />
              </Link>
            </div>

            {/* Trust Highlights */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-ga-border/60 pt-8 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center p-3">
                <span className="font-mono text-2xl font-bold text-ga-gold sm:text-3xl">&gt; 78%</span>
                <span className="mt-1 text-xs text-ga-muted">Win Rate เฉลี่ย</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3">
                <span className="font-mono text-2xl font-bold text-emerald-400 sm:text-3xl">1 : 2.5+</span>
                <span className="mt-1 text-xs text-ga-muted">Risk / Reward ต่อไม้</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3">
                <span className="font-mono text-2xl font-bold text-sky-400 sm:text-3xl">&lt; 1 วินาที</span>
                <span className="mt-1 text-xs text-ga-muted">ความเร็วแจ้งเตือนบนมือถือ</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3">
                <span className="font-mono text-2xl font-bold text-purple-400 sm:text-3xl">35%</span>
                <span className="mt-1 text-xs text-ga-muted">Affiliate ค่าคอมแนะนำ</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. MOBILE ALERT SHOWCASE (Telegram & LINE Preview) */}
        <section id="mobile-alerts" className="relative border-b border-ga-border bg-[#090e14] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span className="public-kicker">
                <Smartphone className="h-4 w-4 text-ga-gold" /> LIVE MOBILE NOTIFICATIONS
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                แจ้งเตือนชัดเจน <span className="text-ga-gold">พร้อมระดับราคา</span> ให้คุณกดตามได้ทันที
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-ga-muted">
                สัญญาณทุกตัวถูกกรองด้วย AI อัจฉริยะ ระบุจุดเข้า Entry, Stop Loss และเป้ากำไร Take Profit อย่างโปร่งใส ไม่ปล่อยให้คุณเคว้งคว้าง
              </p>
            </div>

            {/* Switcher Tabs */}
            <div className="mt-10 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('telegram')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                  activeTab === 'telegram'
                    ? 'bg-sky-500 text-white shadow-[0_0_25px_rgba(14,165,233,0.4)]'
                    : 'border border-ga-border bg-[#111923] text-ga-muted hover:text-ga-text'
                }`}
              >
                <Send className="h-4 w-4" /> Telegram VIP Channel
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('line')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                  activeTab === 'line'
                    ? 'bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                    : 'border border-ga-border bg-[#111923] text-ga-muted hover:text-ga-text'
                }`}
              >
                <MessageCircle className="h-4 w-4" /> LINE Official VIP
              </button>
            </div>

            {/* Mockup Card */}
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="relative rounded-2xl border border-ga-border bg-[#0d141d] p-6 shadow-2xl sm:p-8">
                {activeTab === 'telegram' ? (
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

                    <div className="rounded-xl border border-sky-500/20 bg-[#121c27] p-5 font-mono text-sm leading-relaxed text-neutral-100">
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

                    <div className="rounded-xl border border-emerald-500/20 bg-[#0f1d19] p-5 font-mono text-sm leading-relaxed text-neutral-100">
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

        {/* 3. PAIN POINTS & SOLUTIONS (ทำไมนักเทรดไทยถึงเลือกเรา) */}
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

        {/* 4. THREE STEP PROCESS (ขั้นตอนง่ายๆ 3 สเต็ป) */}
        <section id="workflow" className="relative border-b border-ga-border bg-[#0a0f15] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <span className="public-kicker">EASY 3 STEPS</span>
              <h2 className="mt-4 text-3xl font-extrabold text-ga-text sm:text-4xl">
                เริ่มต้นรับสัญญาณ <span className="text-ga-gold">ใน 3 ขั้นตอนง่ายๆ</span>
              </h2>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              <div className="relative rounded-2xl border border-ga-border bg-[#0e1620] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ga-gold/10 font-mono text-xl font-bold text-ga-gold border border-ga-gold/30">
                  01
                </div>
                <h3 className="mt-6 text-lg font-bold text-ga-text">สมัครและเปิดสิทธิ์ VIP</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  ลงทะเบียนและชำระค่าบริการผ่าน PromptPay สแกน QR Code อนุมัติรวดเร็ว หรือทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน
                </p>
              </div>

              <div className="relative rounded-2xl border border-ga-border bg-[#0e1620] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 font-mono text-xl font-bold text-sky-400 border border-sky-500/30">
                  02
                </div>
                <h3 className="mt-6 text-lg font-bold text-ga-text">กดเข้ากลุ่ม Telegram & LINE</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  เข้าสู่หน้า Member Hub กดปุ่มเข้าร่วม Telegram VIP Group หรือเชื่อมต่อ LINE Notification ได้ทันทีด้วยคลิกเดียว
                </p>
              </div>

              <div className="relative rounded-2xl border border-ga-border bg-[#0e1620] p-8 text-center">
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

        {/* 5. PRICING & OFFER (แพ็กเกจสมาชิก VIP) */}
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

        {/* 6. AFFILIATE REFERRAL CALLOUT (แนะนำเพื่อน 35%) */}
        <section className="relative border-b border-ga-border bg-[#0d141d] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-purple-500/30 bg-purple-950/10 p-8 sm:p-10">
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

        {/* 7. RISK DISCLAIMER & TERMS */}
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
