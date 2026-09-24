import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Flame,
  LineChart,
  MessageCircle,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  WalletCards,
  Zap,
} from 'lucide-react';
import PublicShell from '@/components/PublicShell';
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

const included = [
  { icon: Send, title: 'Telegram VIP Channel สัญญาณสด', desc: 'แจ้งเตือน Entry, SL, TP1-TP3 ตรงเข้ามือถือ 24 ชั่วโมง' },
  { icon: MessageCircle, title: 'LINE Official VIP Alert', desc: 'รับสัญญาณและบทวิเคราะห์โครงสร้างราคาผ่าน LINE' },
  { icon: Sparkles, title: 'AI + SMC & FVG Analysis', desc: 'วิเคราะห์โครงสร้างราคาแนวรับแนวต้าน และจุดกลับตัวแม่นยำ' },
  { icon: ShieldCheck, title: 'Stop Loss Buffer ทุกไม้', desc: 'คุมความเสี่ยงปลอดภัย ไม่ลากติดลบ มีจุดยอมแพ้ชัดเจน' },
  { icon: Radio, title: 'Smart Market Filter', desc: 'แจ้งเตือน NO TRADE เมื่อตลาดผันผวนสูง หรือมีข่าวกล่องแดง' },
  { icon: WalletCards, title: 'โปรแกรม Affiliate 35%', desc: 'รับสิทธิ์แนะนำเพื่อน รับค่าคอมมิชชั่น 35% ตลอดอายุสมาชิก' },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <main className="relative overflow-hidden">
        {/* Glow */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[450px] w-full max-w-7xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(227,181,45,0.1),transparent_70%)]" />

        <section className="relative border-b border-ga-border/80 px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <span className="public-kicker">
            <Sparkles className="h-4 w-4 text-ga-gold" /> PRICING & PLANS · GOLD AI SIGNAL VIP
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-ga-text sm:text-5xl lg:text-6xl">
            แพ็กเกจสมาชิก <span className="text-ga-gold">Gold AI VIP</span><br />
            รับสัญญาณตรงบนมือถือ
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ga-muted sm:text-lg">
            เข้ากลุ่ม Telegram VIP และ LINE Notification เพื่อรับสัญญาณเทรดทองคำ AI สด 24 ชม. ไม่ต้องนั่งเฝ้าจอ ไม่พลาดทุกจังหวะสำคัญ
          </p>
        </section>

        <section className="bg-[#0b1017] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {/* VIP Package Card */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-ga-gold/40 bg-[#0e1622] p-8 shadow-2xl sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ga-border pb-6">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-ga-gold">Founding Member Privilege</p>
                  <h2 className="mt-2 text-2xl font-bold text-ga-text sm:text-3xl">สมาชิก VIP รายเดือน</h2>
                </div>
                <span className="rounded-full border border-ga-gold/30 bg-ga-gold/10 px-3.5 py-1 text-xs font-bold text-ga-gold">
                  สิทธิ์ราคาพิเศษ
                </span>
              </div>

              <div className="py-8">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-5xl font-extrabold tracking-tight text-ga-gold sm:text-6xl">
                    {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}
                  </span>
                  <span className="text-base text-ga-muted">/ เดือน</span>
                  <span className="ml-2 text-base text-neutral-500 line-through">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</span>
                </div>

                <div className="mt-5 rounded-xl border border-ga-gold/20 bg-ga-gold/5 p-4">
                  <p className="text-sm font-semibold text-ga-text">
                    🔒 สิทธิ์ล็อกราคา {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}/เดือน ตลอดอายุสมาชิก
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ga-muted">
                    ชำระเงินวันนี้ ล็อกราคานี้ไว้กับบัญชีของคุณ ไม่มีการปรับขึ้นราคาในรอบบิลถัดไป
                  </p>
                </div>

                <Link
                  href="/checkout"
                  className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-ga-gold via-amber-400 to-amber-500 text-base font-bold text-neutral-950 shadow-lg transition-all hover:brightness-110"
                >
                  <Zap className="h-5 w-5 fill-neutral-950" />
                  <span>สมัครสมาชิกและเปิดสิทธิ์ VIP</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <p className="mt-3 text-center text-xs text-ga-muted">
                  ทดลองใช้งานฟรี {TRIAL_DURATION_DAYS} วันโดยไม่ต้องผูกบัตรเครดิต
                </p>

                <div className="my-8 border-t border-ga-border" />

                <h3 className="text-sm font-bold uppercase tracking-wider text-ga-text">สิทธิ์ประโยชน์ที่ได้รับ</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {included.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="rounded-xl border border-ga-border bg-[#121a24] p-4">
                      <Icon className="h-5 w-5 text-ga-gold" />
                      <p className="mt-2.5 text-sm font-bold text-ga-text">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-ga-muted">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Guide */}
            <aside className="space-y-6 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-ga-border bg-[#0e1620] p-6 sm:p-7">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-ga-gold">ข้อตกลงและคำแนะนำ</p>
                <ul className="mt-5 space-y-4">
                  {[
                    'สัญญาณส่งตรงเข้ามือถือผ่าน Telegram & LINE ทันทีเมื่อ AI ตรวจพบจังหวะ',
                    'มีระดับ Entry, Stop Loss และ Take Profit ชัดเจนทุกไม้',
                    'สมาชิกควรกำหนดความเสี่ยงไม่เกิน 1-2% ต่อไม้',
                    'เมื่อตลาดผันผวนสูง ข่าวแรง ระบบจะแจ้งเตือน NO TRADE เพื่อรักษาทุน',
                    'สถิติโปร่งใส ตรวจสอบประวัติไม้เทรดย้อนหลังได้ในระบบสมาชิก',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-[#c7ced5]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-6 w-6 text-emerald-400" />
                  <h3 className="text-base font-bold text-ga-text">เชื่อมต่อง่ายผ่านมือถือ</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-ga-muted">
                  หลังชำระเงิน คุณจะสามารถกดเข้ากลุ่ม Telegram VIP และเปิดรับแจ้งเตือน LINE ได้ทันทีในหน้า Member Hub
                </p>
                <a
                  href="https://line.me/R/ti/p/@413aryiz"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <MessageCircle className="h-4 w-4" /> สอบถามทีมงานผ่าน LINE
                </a>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
