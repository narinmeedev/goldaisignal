'use client';

import { Check, Shield, Zap, TrendingUp, Lock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PROMOTIONAL_MONTHLY_PRICE_THB, REGULAR_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col w-full overflow-x-hidden">
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-16 flex flex-col items-center justify-center">
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center px-4 py-1.5 bg-amber-500/10 rounded-full mb-6 border border-amber-500/20 text-amber-400 font-medium text-sm gap-2">
            <Zap className="h-4 w-4" /> โปรโมชัน {formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}/เดือน จากราคาปกติ {formatBaht(REGULAR_MONTHLY_PRICE_THB)} ทดลองฟรี {TRIAL_DURATION_DAYS} วัน
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-100 tracking-tight mb-4">
            เข้าสู่ระบบสัญญาณเทรด <span className="text-amber-500">Gold AI</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            อัปเกรดพอร์ตการลงทุนของคุณด้วยระบบวิเคราะห์แนวโน้มตลาดทองคำด้วยสมองกลที่แม่นยำ พร้อมระบบแจ้งเตือนจุดเข้า-ออก แบบเรียลไทม์
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Card 1: Free Plan */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-neutral-100">ทดลองใช้งาน (Free Trial)</h2>
                  <p className="text-xs text-neutral-400 mt-1">เริ่มต้นทดลองใช้ระบบและติดตามทิศทางตลาด</p>
                </div>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-mono font-bold">
                  ฟรี {TRIAL_DURATION_DAYS} วันแรก
                </span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-200">สัญญาณเทรดจำกัดช่วงเวลา</h3>
                    <p className="text-[11px] text-neutral-500">เข้าถึงฟีเจอร์การวิเคราะห์แนวโน้มหลักทั้งหมดเป็นเวลา {TRIAL_DURATION_DAYS} วัน</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-200">วิเคราะห์ทิศทางตลาดพื้นฐาน</h3>
                    <p className="text-[11px] text-neutral-500">เข้าใช้งาน Dashboard ดูทิศทางหลัก Directional Bias</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-4 w-4 text-neutral-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500">ไม่มีการแจ้งเตือนพิเศษเมื่อหมดอายุ</h3>
                    <p className="text-[11px] text-neutral-600">สิทธิ์การทดลองใช้อายุ {TRIAL_DURATION_DAYS} วัน เมื่อครบกำหนดต้องต่ออายุเพื่อใช้งานต่อ</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="mt-auto pt-6 border-t border-neutral-850">
              <p className="text-xs text-neutral-400 text-center mb-4 leading-relaxed">
                ลงทะเบียนตอนนี้เพื่อรับสิทธิ์ทดลองใช้งาน PRO ทันที {TRIAL_DURATION_DAYS} วันแรก
              </p>
              <button 
                onClick={() => router.push('/checkout')}
                className="w-full bg-neutral-850 hover:bg-neutral-800 text-neutral-200 font-bold py-3.5 rounded-xl transition-all border border-neutral-800 hover:border-neutral-750 flex items-center justify-center gap-2"
              >
                สมัครสมาชิกเพื่อเริ่มต้นใช้งานฟรี
              </button>
            </div>
          </div>

          {/* Card 2: VIP Plan */}
          <div className="bg-neutral-900 border-2 border-amber-500/40 rounded-3xl p-8 shadow-2xl shadow-amber-500/5 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 text-[10px] font-black py-1 px-4 rounded-b-xl uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              แพ็กเกจยอดนิยม
            </div>

            <div className="mt-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                    สมาชิก PRO รายเดือน <span className="text-amber-500 text-[10px] bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 rounded font-mono font-normal">PRO</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">ปลดล็อกข้อมูลวิเคราะห์แม่นยำ 24 ชม.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500 font-mono leading-none">ค่าบริการ</div>
                  <div className="text-[10px] text-neutral-500 font-mono line-through mt-1">{formatBaht(REGULAR_MONTHLY_PRICE_THB)}</div>
                  <div className="text-2xl font-black text-amber-500 font-mono leading-none mt-1">{formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}</div>
                  <div className="text-[9px] text-neutral-400 mt-1 font-semibold">ต่อเดือน ช่วงโปรโมชัน</div>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-200">ปลดล็อกทุกแผนวิเคราะห์ (5+ แผน)</h3>
                    <p className="text-[11px] text-neutral-500">รวมถึงแผน Scalping, Zone, Swing, Follow Trend จาก AI</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-200">สแกนแนวรับ/แนวต้าน Liquidity แบบ MTF</h3>
                    <p className="text-[11px] text-neutral-500">คำนวณแนวรับต้านข้าม Timeframe (H1, M15) ป้องกัน False Signals</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-medium text-neutral-200">ระบบแจ้งเตือนจุดเข้า-ออกสำคัญ</h3>
                    <p className="text-[11px] text-neutral-500">แจ้งเตือนเรียลไทม์ราคาทะลุโซนและสัญญาณกลับตัวผ่าน Line/Telegram</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-800">
              <div className="text-center mb-4">
                <p className="text-neutral-400 text-[10px] leading-relaxed">
                  * ต่ออายุสิทธิ์การเข้าใช้งานบทวิเคราะห์และสัญญาณเตือน PRO รายเดือน
                </p>
              </div>
              <button 
                onClick={() => router.push('/checkout')}
                className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2"
              >
                สมัครใช้งาน PRO รายเดือน
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8 opacity-60">
          <div className="flex items-center gap-2 text-neutral-400 text-sm font-medium">
            <Shield className="h-4 w-4" /> ปลอดภัย 100%
          </div>
          <div className="flex items-center gap-2 text-neutral-400 text-sm font-medium">
            <Lock className="h-4 w-4" /> รองรับ PromptPay
          </div>
          <div className="flex items-center gap-2 text-neutral-400 text-sm font-medium">
            <TrendingUp className="h-4 w-4" /> อัปเดตทุกวินาที
          </div>
        </div>

      </div>
    </div>
  );
}
