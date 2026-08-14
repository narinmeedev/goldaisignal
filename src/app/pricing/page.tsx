import Link from 'next/link';
import { ArrowRight, BarChart3, Bell, Check, CircleDollarSign, Clock3, LineChart, MessageCircle, ShieldCheck, Target } from 'lucide-react';
import PublicShell from '@/components/PublicShell';
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

const included = [
  { icon: Target, title: 'แผนหลักปัจจุบัน', desc: 'BUY / SELL / NO TRADE พร้อม Entry, Stop Loss และ Take Profit' },
  { icon: LineChart, title: 'กราฟวิเคราะห์หลายกรอบเวลา', desc: 'แท่งเทียน โซนแนวรับแนวต้าน และภาพรวม D1 ถึง M5' },
  { icon: ShieldCheck, title: 'เงื่อนไขความเสี่ยง', desc: 'คะแนนความเสี่ยง เหตุผลประกอบ และ Risk/Reward ของแผน' },
  { icon: Bell, title: 'LINE notification', desc: 'แจ้งเตือนเมื่อมีแผนใหม่ที่ผ่านเกณฑ์ของระบบ' },
  { icon: BarChart3, title: 'ประวัติและผลการติดตาม', desc: 'Win rate, R-multiple และสถานะแผนที่ตรวจสอบย้อนหลังได้' },
  { icon: Clock3, title: 'ข้อมูลตลาดต่อเนื่อง', desc: 'อ่านราคาจาก MT5 และแสดงสถานะความสดของข้อมูล' },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <main>
        <section className="relative overflow-hidden border-b border-ga-border">
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(39,49,59,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(39,49,59,0.18)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
            <span className="public-kicker">Pricing · Gold AI Signal Pro</span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-ga-text sm:text-5xl">แพ็กเกจเดียว<br /><span className="text-ga-gold">เห็นข้อมูลครบก่อนตัดสินใจ</span></h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-ga-muted">ทดลองใช้งาน Dashboard และการนำเสนอแผนจริงก่อน ไม่มีการรับประกันผลกำไร และระบบอาจเลือกไม่ออกแผนเมื่อคุณภาพไม่ผ่านเกณฑ์</p>
          </div>
        </section>

        <section className="bg-[#0d141c]">
          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:px-8 lg:py-20">
            <div className="public-panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ga-border p-6 sm:p-8">
                <div><p className="font-mono text-xs uppercase tracking-[0.14em] text-ga-muted">Pro monthly</p><h2 className="mt-2 text-2xl font-semibold text-ga-text">สมาชิก PRO รายเดือน</h2></div>
                <span className="rounded-md border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5 text-xs font-medium text-emerald-400">ทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน</span>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1"><span className="font-mono text-5xl font-semibold tracking-tight text-ga-gold">{formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}</span><span className="pb-2 text-sm text-ga-muted">ต่อเดือน</span></div>
                <p className="mt-2 text-sm text-ga-muted">ราคาปกติ <span className="line-through">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</span> · ราคาพิเศษช่วงเปิดตัว</p>
                <Link href="/checkout" className="public-button-primary mt-7 min-h-14 w-full px-6 text-base">เริ่มทดลองใช้งาน <ArrowRight className="h-4 w-4" /></Link>
                <p className="mt-3 text-center text-xs text-ga-muted">เริ่มทดลองโดยไม่ผูกบัตร · ชำระผ่าน PromptPay เมื่อต้องการต่ออายุ</p>
                <div className="my-7 border-t border-ga-border" />
                <h3 className="text-sm font-semibold text-ga-text">สิ่งที่รวมในแพ็กเกจ</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {included.map(({ icon: Icon, title, desc }) => <div key={title} className="rounded-lg border border-ga-border bg-ga-canvas p-4"><Icon className="h-4 w-4 text-ga-gold" /><p className="mt-3 text-sm font-semibold text-ga-text">{title}</p><p className="mt-1 text-xs leading-5 text-ga-muted">{desc}</p></div>)}
                </div>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="public-panel p-6 sm:p-7">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ga-gold">ก่อนเริ่มใช้งาน</p>
                <ul className="mt-5 space-y-4">
                  {['ระบบเป็นเครื่องมือช่วยตัดสินใจ ไม่ใช่ระบบรับประกันผลตอบแทน', 'สมาชิกควรกำหนดขนาด Lot และความเสี่ยงต่อครั้งด้วยตนเอง', 'เมื่อข้อมูลไม่สดหรือคุณภาพแผนไม่ผ่าน ระบบจะแสดง NO TRADE', 'ผลลัพธ์ในอดีตไม่รับรองผลลัพธ์ในอนาคต'].map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-[#c7ced5]"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />{item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-ga-gold/25 bg-ga-gold/6 p-6">
                <CircleDollarSign className="h-5 w-5 text-ga-gold" />
                <h3 className="mt-4 text-base font-semibold text-ga-text">ทดลองให้เห็นวิธีทำงานก่อน</h3>
                <p className="mt-2 text-sm leading-6 text-ga-muted">เข้า Dashboard ดูราคา สถานะแผน กราฟ และวิธีอธิบายความเสี่ยง แล้วจึงตัดสินใจว่าจะใช้งานต่อหรือไม่</p>
              </div>
              <a href="https://line.me/R/ti/p/@413aryiz" target="_blank" rel="noreferrer" className="public-button-secondary min-h-12 w-full px-5"><MessageCircle className="h-4 w-4 text-emerald-400" /> สอบถามรายละเอียดผ่าน LINE</a>
            </aside>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
