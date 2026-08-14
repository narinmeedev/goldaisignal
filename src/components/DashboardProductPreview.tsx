import Image from 'next/image';
import { BarChart3, Layers3, ShieldCheck } from 'lucide-react';

interface DashboardProductPreviewProps {
  compact?: boolean;
}

export default function DashboardProductPreview({ compact = false }: DashboardProductPreviewProps) {
  return (
    <div className={compact ? 'mx-auto max-w-[1200px]' : 'mx-auto max-w-[1440px]'}>
      <div className="mb-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="public-kicker">Dashboard preview</span>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-ga-text sm:text-3xl">
            เห็นกราฟและแผนหลักในบริบทเดียวกัน
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-ga-muted">
          ภาพตัวอย่างหน้าจอสมาชิก แสดงกราฟ XAUUSD, โซนแนวรับแนวต้าน และลำดับราคาเป้าหมาย จุดเข้า และจุดหยุดขาดทุน
        </p>
      </div>

      <figure className="overflow-hidden rounded-xl border border-ga-border bg-[#0f161e] shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
        <div className="flex h-10 items-center justify-between border-b border-ga-border px-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-ga-gold/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ga-muted">Gold AI Signal · Member Dashboard</span>
        </div>
        <div className="hide-scrollbar overflow-x-auto bg-[#071019]">
          <Image
            src="/dashboard-product-preview.png"
            width={1486}
            height={1058}
            sizes="(max-width: 768px) 760px, (max-width: 1280px) 100vw, 1400px"
            alt="ตัวอย่าง Dashboard Gold AI Signal แสดงกราฟทองคำ XAUUSD พร้อมแนวรับ แนวต้าน Entry Stop Loss Take Profit และแผนหลักปัจจุบัน"
            className="h-auto min-w-[760px] w-full"
          />
        </div>
        <figcaption className="grid gap-px border-t border-ga-border bg-ga-border sm:grid-cols-3">
          {[
            { icon: BarChart3, title: 'กราฟและระดับราคา', desc: 'อ่าน Entry, SL และ TP จากตำแหน่งจริง' },
            { icon: Layers3, title: 'ภาพรวมหลายกรอบเวลา', desc: 'ตรวจทิศทาง D1 ถึง M5 ในหน้าจอเดียว' },
            { icon: ShieldCheck, title: 'แผนพร้อมความเสี่ยง', desc: 'เห็นเหตุผลและ Risk/Reward ก่อนตัดสินใจ' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 bg-ga-surface p-4 sm:p-5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ga-gold" />
              <div><p className="text-sm font-semibold text-ga-text">{title}</p><p className="mt-1 text-xs leading-5 text-ga-muted">{desc}</p></div>
            </div>
          ))}
        </figcaption>
      </figure>
      <p className="mt-3 text-center text-[11px] text-ga-muted sm:hidden">เลื่อนภาพซ้าย–ขวาเพื่อดูรายละเอียด Dashboard</p>
    </div>
  );
}
