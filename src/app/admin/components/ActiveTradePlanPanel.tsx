'use client';

import { Activity, ArrowDown, ArrowUp, ShieldCheck, Target, TrendingUp, UsersRound } from 'lucide-react';

interface PlanSummary {
  type: string;
  title: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timeframe?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore?: number;
  riskReward?: number;
}

interface ActiveTradePlanPanelProps {
  plan: PlanSummary | null;
  currentPrice: number | null;
  direction: 'BUY' | 'SELL' | null;
  instruction: string;
  timeframeBiases?: Record<string, string | undefined>;
  hasSupport: boolean;
}

const formatPrice = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const biasLabel: Record<string, string> = {
  BUY: 'ขาขึ้น',
  BULLISH: 'ขาขึ้น',
  SELL: 'ขาลง',
  BEARISH: 'ขาลง',
  NEUTRAL: 'เป็นกลาง',
  WAIT_AND_SEE: 'รอดู',
};

const riskLabel: Record<string, string> = {
  LOW: 'ความเสี่ยงต่ำ',
  MEDIUM: 'ความเสี่ยงปานกลาง',
  HIGH: 'ความเสี่ยงสูง',
};

function PlanLevel({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'profit' | 'entry' | 'loss';
}) {
  const toneClass = tone === 'profit'
    ? 'border-emerald-400 text-emerald-400'
    : tone === 'loss'
      ? 'border-rose-400 text-rose-400'
      : 'border-amber-400 text-amber-400';

  return (
    <div className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-4">
      <div className={`relative z-10 mt-1 h-4 w-4 rounded-full border-2 bg-[#111820] ${toneClass}`} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(112px,0.9fr)] sm:items-center">
        <div>
          <p className={`text-[13px] font-medium ${toneClass.split(' ').at(-1)}`}>{label}</p>
          <p className={`mt-1 font-mono text-[22px] font-semibold tabular-nums ${toneClass.split(' ').at(-1)}`}>
            {formatPrice(value)}
          </p>
        </div>
        <p className="border-l border-[#2a333d] pl-4 text-[13px] leading-6 text-[#a2abb7]">{helper}</p>
      </div>
    </div>
  );
}

export default function ActiveTradePlanPanel({
  plan,
  currentPrice,
  direction,
  instruction,
  timeframeBiases = {},
  hasSupport,
}: ActiveTradePlanPanelProps) {
  if (!plan) {
    return (
      <section className="flex min-h-[520px] items-center justify-center rounded-xl border border-[#27313b] bg-[#111820] p-8 text-center">
        <div>
          <Activity className="mx-auto h-8 w-8 text-[#6f7a86]" />
          <h2 className="mt-4 text-[20px] font-semibold text-[#f3f5f7]">กำลังรอแผนที่ผ่านเกณฑ์</h2>
          <p className="mt-2 max-w-xs text-[14px] leading-6 text-[#929ca8]">ระบบจะแสดง Entry, Take Profit และ Stop Loss เมื่อข้อมูลตลาดพร้อม</p>
        </div>
      </section>
    );
  }

  const isBuy = direction === 'BUY';
  const frames = ['D1', 'H4', 'H1', 'M15', 'M5'];
  const alignedFrames = frames.filter((frame) => {
    const bias = timeframeBiases[frame];
    return isBuy ? bias === 'BUY' || bias === 'BULLISH' : bias === 'SELL' || bias === 'BEARISH';
  }).length;
  const rr = plan.riskReward && Number.isFinite(plan.riskReward)
    ? plan.riskReward
    : Math.abs((plan.takeProfit - plan.entry) / Math.max(Math.abs(plan.entry - plan.stopLoss), 0.01));
  const displayedCurrentPrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice)
    ? currentPrice
    : plan.entry;
  const priceLevels = [
    { kind: 'profit' as const, price: plan.takeProfit },
    { kind: 'market' as const, price: displayedCurrentPrice },
    { kind: 'loss' as const, price: plan.stopLoss },
  ].sort((a, b) => b.price - a.price);

  return (
    <section id="active-plan" className="flex h-full min-h-[720px] flex-col rounded-xl border border-[#27313b] bg-[#111820] p-5 xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-[#f3f5f7]">แผนหลักปัจจุบัน</p>
          <div className="mt-3 flex items-center gap-2">
            {isBuy ? <ArrowUp className="h-5 w-5 text-emerald-400" /> : <ArrowDown className="h-5 w-5 text-rose-400" />}
            <h2 className={`text-[25px] font-semibold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {direction ?? plan.type} · {plan.timeframe || 'M15'}
            </h2>
          </div>
        </div>
        <div className={`min-w-[92px] rounded-lg border px-3 py-2 text-right ${isBuy ? 'border-emerald-500/45 bg-emerald-500/5' : 'border-rose-500/45 bg-rose-500/5'}`}>
          <p className="text-[12px] text-[#9aa4b0]">ความมั่นใจ</p>
          <p className={`mt-0.5 font-mono text-[22px] font-semibold tabular-nums ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {Math.round(plan.confidence)}<span className="text-[14px] text-[#c6ccd3]">/100</span>
          </p>
        </div>
      </div>

      <p className="mt-3 max-w-md text-[15px] leading-7 text-[#f0f2f4]">{instruction}</p>

      <div
        className="relative mt-4 border-y border-[#29323c] py-1 before:absolute before:bottom-5 before:left-[7px] before:top-5 before:w-px before:bg-[#53606c]"
        aria-label="ระดับราคาเรียงจากราคาสูงไปต่ำ"
      >
        {priceLevels.map((level) => {
          if (level.kind === 'profit') {
            return (
              <PlanLevel
                key={level.kind}
                label="เป้าหมาย"
                value={plan.takeProfit}
                helper={isBuy ? 'เป้าหมายทำกำไร โซนแนวต้านถัดไป' : 'เป้าหมายทำกำไร โซนแนวรับถัดไป'}
                tone="profit"
              />
            );
          }

          if (level.kind === 'loss') {
            return (
              <PlanLevel
                key={level.kind}
                label="จุดหยุดขาดทุน"
                value={plan.stopLoss}
                helper="หากราคาถึงระดับนี้ แผนจะไม่เป็นไปตามคาด"
                tone="loss"
              />
            );
          }

          return (
            <div key={level.kind} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-y border-dashed border-amber-400/45 py-3">
              <div className="relative z-10 mt-1 h-4 w-4 rounded-full border-2 border-amber-400 bg-[#111820]" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[17px] font-semibold tabular-nums text-amber-400">{formatPrice(currentPrice)}</p>
                  <p className="text-[11px] text-[#8f99a5]">ราคาปัจจุบัน</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium text-amber-400">จุดเข้า</p>
                  <p className="font-mono text-[21px] font-semibold tabular-nums text-amber-400">{formatPrice(plan.entry)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <h3 className="text-[17px] font-semibold text-amber-400">เหตุผลที่ระบบเลือกแผนนี้</h3>
        <div className="mt-3 divide-y divide-[#27313b] overflow-hidden rounded-lg border border-[#27313b]">
          {[
            { icon: TrendingUp, text: `โครงสร้างราคา${isBuy ? 'เป็นขาขึ้น' : 'เป็นขาลง'}` },
            { icon: ShieldCheck, text: hasSupport ? 'แนวรับยังทำงาน' : 'รอการยืนยันจากโซนราคา' },
            { icon: UsersRound, text: `${alignedFrames || 0} จาก 5 กรอบเวลาไปทางเดียวกัน` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-[#0e141b] px-3 py-2.5 text-[13px] text-[#d8dde3]">
              <Icon className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[17px] font-semibold text-amber-400">ภาพรวมหลายกรอบเวลา</h3>
        <div className="mt-3 grid grid-cols-5 divide-x divide-[#27313b] overflow-hidden rounded-lg border border-[#27313b] bg-[#0e141b]">
          {frames.map((frame) => {
            const bias = timeframeBiases[frame] ?? 'NEUTRAL';
            const bullish = bias === 'BUY' || bias === 'BULLISH';
            const bearish = bias === 'SELL' || bias === 'BEARISH';
            return (
              <div key={frame} className="px-1 py-2.5 text-center">
                <p className="font-mono text-[12px] text-[#a4adb8]">{frame}</p>
                <p className={`mt-1 text-[11px] font-medium ${bullish ? 'text-emerald-400' : bearish ? 'text-rose-400' : 'text-[#7d8792]'}`}>
                  {biasLabel[bias] ?? bias}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#303945] bg-[#0e141b] px-4 py-3">
        <p className={`text-[14px] font-semibold ${plan.riskLevel === 'HIGH' ? 'text-rose-400' : 'text-amber-400'}`}>
          {riskLabel[plan.riskLevel ?? 'MEDIUM']}
        </p>
        <p className="font-mono text-[14px] text-[#aeb6c0]">Risk/Reward <span className="font-semibold text-emerald-400">{rr.toFixed(1)}R</span></p>
      </div>

      <p className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-[#7f8995]">
        <Target className="h-3.5 w-3.5" /> AI ช่วยวิเคราะห์ ไม่รับประกันผลลัพธ์
      </p>
    </section>
  );
}
