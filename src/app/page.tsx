'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, BarChart3, Bell, CheckCircle2, ChevronRight,
  Database, Gauge, LineChart, MessageCircle, Radar, ShieldCheck, Target,
} from 'lucide-react';
import LiveMarketPreview, { type PublicDashboardStats } from '@/components/LiveMarketPreview';
import PublicShell from '@/components/PublicShell';
import DashboardProductPreview from '@/components/DashboardProductPreview';
import { fetchDashboardStats } from '@/lib/dashboard-fetch';
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

const features = [
  { icon: Target, tone: 'text-ga-gold border-ga-gold/25 bg-ga-gold/8', title: 'แผนหลักที่อ่านจบในหน้าจอเดียว', desc: 'แสดงทิศทาง จุดเข้า Stop Loss, Take Profit และ Risk/Reward โดยเรียงระดับราคาตามตำแหน่งจริงบนกราฟ' },
  { icon: Radar, tone: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/8', title: 'เลือกแผนตามสภาวะตลาด', desc: 'แยก Trend, Range, Transition และภาวะผันผวนสูง เพื่อไม่ใช้วิธีเดียวกับตลาดทุกแบบ' },
  { icon: ShieldCheck, tone: 'text-rose-400 border-rose-500/25 bg-rose-500/8', title: 'ไม่ผ่านเงื่อนไข = ไม่ส่งสัญญาณ', desc: 'ตรวจคุณภาพข้อมูล Spread, โครงสร้างราคา และข้อจำกัดความเสี่ยงก่อนนำเสนอแผนแก่สมาชิก' },
  { icon: LineChart, tone: 'text-sky-400 border-sky-500/25 bg-sky-500/8', title: 'กราฟพร้อมโซนแนวรับแนวต้าน', desc: 'เห็นแท่งเทียน แถบ Support/Resistance และระดับแผนในบริบทเดียว พร้อมซูมดูภาพรวมหรือรายละเอียด' },
  { icon: Bell, tone: 'text-violet-400 border-violet-500/25 bg-violet-500/8', title: 'แจ้งเตือนเมื่อมีแผนที่ผ่านเกณฑ์', desc: 'รับข้อมูลแผนใหม่ผ่าน LINE และกลับมาตรวจเหตุผลกับสถานะล่าสุดใน Dashboard ได้ทันที' },
  { icon: BarChart3, tone: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/8', title: 'ติดตามผลแบบตรวจสอบได้', desc: 'บันทึกผลเมื่อราคาแตะ Entry และติดตามจนถึง TP/SL เพื่อดู Win rate, R-multiple และ Drawdown จากข้อมูลจริง' },
];

const workflow = [
  { icon: Database, step: '01', title: 'รับข้อมูลจาก MT5', desc: 'ราคาและแท่งเทียนหลายกรอบเวลา' },
  { icon: Activity, step: '02', title: 'อ่านสภาวะตลาด', desc: 'โครงสร้าง ทิศทาง และความผันผวน' },
  { icon: Gauge, step: '03', title: 'ผ่านด่านคุณภาพ', desc: 'ข้อมูล ความเสี่ยง และ Risk/Reward' },
  { icon: Target, step: '04', title: 'นำเสนอแผนเดียว', desc: 'Entry, Stop Loss, Take Profit ชัดเจน' },
];

export default function LandingPage() {
  const [stats, setStats] = useState<PublicDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) localStorage.setItem('referred_by', referralCode.toUpperCase());
    const load = async () => {
      try { setStats(await fetchDashboardStats('XAUUSD', { retries: 1, timeoutMs: 12_000, public: true })); }
      catch { setStats(null); }
      finally { setLoading(false); }
    };
    const initialTimer = window.setTimeout(load, 0);
    const interval = window.setInterval(load, 15_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(interval); };
  }, []);

  return (
    <PublicShell>
      <main>
        <section id="overview" className="relative overflow-hidden border-b border-ga-border">
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(39,49,59,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(39,49,59,0.22)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
          <div aria-hidden="true" className="absolute left-[10%] top-0 h-72 w-72 rounded-full bg-ga-gold/5 blur-[110px]" />
          <div className="relative mx-auto grid max-w-[1440px] gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 lg:px-8 lg:py-24">
            <div>
              <span className="public-kicker"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> XAUUSD · MT5 Decision Support</span>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.14] tracking-[-0.035em] text-ga-text sm:text-5xl lg:text-[52px]">เห็นแผนเทรดทองคำ<br /><span className="text-ga-gold">ชัดเจนก่อนตัดสินใจ</span></h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-ga-muted">Gold AI Signal จัดโครงสร้างข้อมูลตลาดให้เป็นแผนที่อ่านง่าย พร้อม Entry, Stop Loss, Take Profit, Risk/Reward และเหตุผลประกอบ โดยไม่สร้างแผนเมื่อข้อมูลหรือคุณภาพไม่ผ่านเกณฑ์</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/pricing" className="public-button-primary min-h-13 px-6 text-base">เริ่มทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/login" className="public-button-secondary min-h-13 px-6 text-base">เปิด Dashboard <ChevronRight className="h-4 w-4" /></Link>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 divide-x divide-ga-border border-y border-ga-border py-4">
                {[['1 แผน', 'แผนหลักปัจจุบัน'], ['5 TF', 'ภาพรวมหลายกรอบ'], ['NO TRADE', 'เมื่อไม่ผ่านเกณฑ์']].map(([value, label]) => (
                  <div key={label} className="px-3 first:pl-0 sm:px-5"><p className="font-mono text-sm font-semibold text-ga-text">{value}</p><p className="mt-1 text-[11px] leading-4 text-ga-muted">{label}</p></div>
                ))}
              </div>
            </div>
            <LiveMarketPreview stats={stats} loading={loading} />
          </div>
        </section>

        <section className="border-b border-ga-border bg-[#0d141c] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <DashboardProductPreview />
        </section>

        <section id="features" className="border-b border-ga-border">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div><span className="public-kicker">ระบบวิเคราะห์</span><h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.025em] text-ga-text sm:text-4xl">ข้อมูลเท่าที่จำเป็น<br />แต่ครบสำหรับวางแผน</h2></div>
              <p className="max-w-2xl text-sm leading-7 text-ga-muted lg:justify-self-end">ออกแบบตามหลักเดียวกับ Dashboard ใหม่: อ่านทิศทางก่อน เห็นระดับราคาเป็นลำดับ และแยกสถานะความเสี่ยงด้วยสีที่สม่ำเสมอ</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, tone, title, desc }) => (
                <article key={title} className="public-panel p-6 transition-colors hover:border-[#3a4652] hover:bg-ga-elevated"><span className={`flex h-11 w-11 items-center justify-center rounded-lg border ${tone}`}><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-base font-semibold text-ga-text">{title}</h3><p className="mt-2 text-sm leading-6 text-ga-muted">{desc}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-ga-border">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="public-panel overflow-hidden">
              <div className="grid border-b border-ga-border p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div><span className="public-kicker">Data pipeline</span><h2 className="mt-5 text-3xl font-semibold tracking-[-0.025em] text-ga-text">จากราคา MT5 สู่แผนที่อธิบายได้</h2></div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-ga-muted lg:mt-0">ระบบไม่ควรออกสัญญาณเพียงเพราะราคาขยับ ทุกแผนต้องผ่านลำดับการตรวจที่ชัดเจนก่อนแสดงผล</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4">
                {workflow.map(({ icon: Icon, step, title, desc }, index) => (
                  <div key={step} className={`relative p-6 sm:p-8 ${index < workflow.length - 1 ? 'border-b border-ga-border sm:border-b-0 sm:border-r' : ''}`}><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-ga-gold" /><span className="font-mono text-xs text-[#5e6975]">{step}</span></div><h3 className="mt-10 text-base font-semibold text-ga-text">{title}</h3><p className="mt-2 text-sm text-ga-muted">{desc}</p></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#0d141c]">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <span className="public-kicker">Gold AI Signal Pro</span>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.025em] text-ga-text sm:text-4xl">เริ่มจากการทดลองใช้<br />แล้วตัดสินใจจากของจริง</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-ga-muted">ดูรูปแบบ Dashboard, การนำเสนอแผน และการแจ้งเตือนก่อนเลือกใช้งานต่อ ไม่มีการรับประกันผลกำไรและไม่ควรใช้แทนการบริหารความเสี่ยงของคุณ</p>
              <div className="mt-7 flex flex-wrap gap-3"><Link href="/pricing" className="public-button-primary min-h-12 px-5">ดูรายละเอียดแพ็กเกจ <ArrowRight className="h-4 w-4" /></Link><a href="https://line.me/R/ti/p/@413aryiz" target="_blank" rel="noreferrer" className="public-button-secondary min-h-12 px-5"><MessageCircle className="h-4 w-4" /> สอบถามทีมงาน</a></div>
            </div>
            <div className="public-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ga-border pb-6"><div><p className="font-mono text-xs uppercase tracking-[0.14em] text-ga-muted">Founding member</p><p className="mt-2 text-xl font-semibold text-ga-text">สมาชิก PRO รายเดือน</p></div><span className="rounded-md border border-ga-gold/30 bg-ga-gold/8 px-3 py-1.5 text-xs font-medium text-ga-gold">สิทธิ์จำนวนจำกัด</span></div>
              <div className="py-6"><div className="flex items-end gap-2"><span className="font-mono text-4xl font-semibold text-ga-gold">{formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}</span><span className="pb-1 text-sm text-ga-muted">/ เดือน</span></div><p className="mt-2 text-xs text-ga-muted">จากราคาปกติ <span className="line-through">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</span></p><p className="mt-3 text-sm font-medium leading-6 text-ga-text">ชำระวันนี้และผ่านการอนุมัติ ล็อกราคา {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}/เดือนไว้ตลอดอายุสมาชิก</p></div>
              <ul className="space-y-3 border-t border-ga-border pt-6">{['Dashboard แผนหลักพร้อม Entry / SL / TP', 'กราฟพร้อมแนวรับแนวต้านหลายกรอบเวลา', 'คะแนนความเสี่ยง เหตุผล และ Risk/Reward', 'แจ้งเตือนแผนที่ผ่านเกณฑ์ผ่าน LINE'].map((item) => <li key={item} className="flex gap-3 text-sm text-[#c7ced5]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</li>)}</ul>
              <Link href="/checkout" className="public-button-primary mt-7 min-h-13 w-full px-5">รับสิทธิ์ราคา {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)} <ArrowRight className="h-4 w-4" /></Link><p className="mt-3 text-center text-xs leading-5 text-ga-muted">ทดลองฟรี {TRIAL_DURATION_DAYS} วันโดยไม่ผูกบัตร · สิทธิ์ล็อกราคาเริ่มเมื่อชำระเงินผ่านการอนุมัติ</p>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
