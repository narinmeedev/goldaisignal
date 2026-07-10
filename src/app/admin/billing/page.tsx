'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  TrendingUp, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { PAID_DURATION_DAYS, PROMOTIONAL_MONTHLY_PRICE_THB, TRIAL_DURATION_DAYS, formatBaht } from '@/lib/billing';

interface Payment {
  id: string;
  amount: number;
  slipUrl: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Subscription {
  plan: string;
  status: string;
  endsAt: string | null;
}

export default function BillingPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBillingData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/billing');
      const data = await res.json();
      if (res.ok && data.success) {
        setSubscription(data.subscription);
        setPayments(data.payments || []);
      } else {
        setErrorMsg(data.error || 'ไม่สามารถโหลดข้อมูลประวัติบิลได้');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const getRemainingDays = (endsAtStr: string | null) => {
    if (!endsAtStr) return 0;
    const diffTime = new Date(endsAtStr).getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getProgressPercentage = (endsAtStr: string | null, planType: string) => {
    if (!endsAtStr) return 0;
    const totalDuration = planType === 'trial' ? TRIAL_DURATION_DAYS : PAID_DURATION_DAYS;
    const daysLeft = getRemainingDays(endsAtStr);
    const percentage = (daysLeft / totalDuration) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  const formatThaiDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
  };

  const getStatusConfig = (status: string, endsAt: string | null) => {
    const daysLeft = getRemainingDays(endsAt);
    if (status === 'expired' || (endsAt && new Date(endsAt) < new Date())) {
      return {
        text: 'หมดอายุการใช้งาน (EXPIRED)',
        style: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        dot: 'bg-rose-500'
      };
    }
    if (status === 'pending') {
      return {
        text: 'รอแอดมินอนุมัติชำระเงิน (PENDING)',
        style: 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse',
        dot: 'bg-amber-500'
      };
    }
    if (status === 'active') {
      return {
        text: 'กำลังใช้งานปกติ (ACTIVE)',
        style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        dot: 'bg-emerald-400'
      };
    }
    return {
      text: 'ไม่มีแพ็กเกจการใช้งาน',
      style: 'bg-neutral-800 border-neutral-700 text-neutral-400',
      dot: 'bg-neutral-500'
    };
  };

  const daysRemaining = subscription ? getRemainingDays(subscription.endsAt) : 0;
  const progressPercent = subscription ? getProgressPercentage(subscription.endsAt, subscription.plan) : 0;
  const statusConfig = subscription ? getStatusConfig(subscription.status, subscription.endsAt) : null;

  return (
    <div className="space-y-6 font-sans text-neutral-200 pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-250 bg-clip-text text-transparent flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-amber-500" />
            ข้อมูลแพ็กเกจและบิลชำระเงิน (My Billing)
          </h1>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            ดูสถานะอายุการใช้งานแพ็กเกจ และประวัติการอัปโหลดสลิปโอนเงินของคุณทั้งหมด
          </p>
        </div>
        <button
          onClick={() => fetchBillingData(true)}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-850 text-xs font-bold text-neutral-200 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-mono text-xs shadow-lg">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-neutral-500 font-mono text-sm bg-neutral-900/10 border border-white/5 rounded-3xl">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          <span>กำลังโหลดข้อมูลบิลและการใช้งาน...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Expiry & Plan Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase">
                  {subscription?.plan === 'trial' ? 'สิทธิ์ทดลองใช้งานฟรี (Free Trial)' : 'สมาชิก PRO รายเดือน'}
                </span>
                {statusConfig && (
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold flex items-center gap-1.5 ${statusConfig.style}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}></span>
                    {statusConfig.text}
                  </span>
                )}
              </div>

              {/* Countdown Gauge */}
              <div className="text-center py-4 space-y-2">
                <span className="text-[10px] text-neutral-500 font-mono block uppercase">ระยะเวลาการเข้าใช้งานคงเหลือ</span>
                <div className="text-5xl font-black text-white font-mono tracking-tight flex items-baseline justify-center gap-1">
                  {daysRemaining}
                  <span className="text-sm font-bold text-neutral-400">วัน</span>
                </div>
                
                {/* Progress bar */}
                <div className="max-w-[240px] mx-auto space-y-1">
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        daysRemaining <= 3 ? 'bg-rose-500' :
                        daysRemaining <= 7 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-neutral-500">
                    <span>หมดอายุ</span>
                    <span>{subscription?.plan === 'trial' ? TRIAL_DURATION_DAYS : PAID_DURATION_DAYS} วัน</span>
                  </div>
                </div>
              </div>

              {/* Date Details */}
              <div className="border-t border-white/5 pt-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 text-[10px] flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> วันเปิดใช้งาน</span>
                  <span className="text-neutral-300 font-semibold">
                    {payments.filter(p => p.status === 'approved').length > 0
                      ? formatThaiDate(payments.filter(p => p.status === 'approved')[0].createdAt)
                      : 'เริ่มจากบัญชีใหม่'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 text-[10px] flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> วันที่หมดอายุ</span>
                  <span className="text-neutral-300 font-semibold">
                    {subscription?.endsAt ? formatThaiDate(subscription.endsAt) : '-'}
                  </span>
                </div>
              </div>

              {/* Alert Status Info Box */}
              {subscription?.status === 'pending' && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-xs text-neutral-300 leading-relaxed flex gap-2">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ระบบกำลังตรวจสอบสลิปโอนเงินของคุณ</strong><br />
                    ปกติสลิปจะได้รับการอนุมัติโดยแอดมินภายใน 1-3 ชั่วโมง หากผ่านแล้วระบบจะปรับยอดวันใช้งานให้อัตโนมัติครับ
                  </p>
                </div>
              )}

              {subscription?.status === 'expired' && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 text-xs text-neutral-300 leading-relaxed flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>แพ็กเกจการใช้งานของคุณหมดอายุแล้ว</strong><br />
                    สิทธิ์การดึงแผนเทรดและแนวรับแนวต้านอัตโนมัติถูกระงับชั่วคราว โปรดกดต่ออายุแพ็กเกจเพื่อกลับมาใช้งานอย่างต่อเนื่อง
                  </p>
                </div>
              )}

              {/* Renew CTA Button */}
              <div className="pt-2">
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  ต่ออายุการใช้งาน PRO ({formatBaht(PROMOTIONAL_MONTHLY_PRICE_THB)}/เดือน)
                  <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Payment Slip History */}
          <div className="lg:col-span-7 bg-neutral-900/40 border border-white/5 rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2.5 border-b border-white/5 pb-3">
              <TrendingUp className="h-4.5 w-4.5 text-cyan-400" />
              ประวัติการแจ้งโอนเงินและสลิปหลักฐาน
            </h3>

            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950/50 text-[10px] uppercase text-neutral-500 font-bold border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">วันที่ส่งสลิป</th>
                    <th className="px-4 py-3">ยอดโอน</th>
                    <th className="px-4 py-3">หลักฐานสลิป</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3 text-right">หมายเหตุแอดมิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-neutral-300">
                        {new Date(p.createdAt).toLocaleDateString('th-TH')} <br />
                        <span className="text-[10px] text-neutral-500">
                          {new Date(p.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                      </td>
                      <td className="px-4 py-3 text-amber-500 font-bold">฿{p.amount}</td>
                      <td className="px-4 py-3">
                        <a 
                          href={p.slipUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
                        >
                          เปิดดูสลิปโอน <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'approved' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                            อนุมัติแล้ว
                          </span>
                        ) : p.status === 'rejected' ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">
                            ปฏิเสธ
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold animate-pulse">
                            รอตรวจสอบ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[10px] text-neutral-400 max-w-[150px] truncate" title={p.notes || ''}>
                        {p.notes || '-'}
                      </td>
                    </tr>
                  ))}

                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-neutral-600 text-xs italic">
                        ยังไม่เคยมีบันทึกการส่งหลักฐานสลิปโอนเงินเข้าระบบ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
