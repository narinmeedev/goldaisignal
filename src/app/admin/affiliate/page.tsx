'use client';

import React, { useEffect, useState } from 'react';
import { 
  Coins, 
  Copy, 
  Users, 
  Wallet, 
  CheckCircle, 
  Clock, 
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';

export default function AffiliatePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/affiliate/stats');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        setErrorMsg(json.error || 'โหลดข้อมูลระบบแนะนำเพื่อนล้มเหลว');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCopyLink = () => {
    if (data?.referralLink) {
      navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm font-mono">กำลังดึงข้อมูลระบบแนะนำเพื่อน...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-center">
          <p className="font-bold mb-2">เกิดข้อผิดพลาด</p>
          <p className="text-sm font-mono">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            ระบบแนะนำเพื่อน (Affiliate Program)
          </h1>
          <p className="text-sm text-neutral-400 mt-1.5 leading-relaxed">
            รับส่วนแบ่งค่าคอมมิชชั่น <span className="text-amber-400 font-bold">{(data?.affiliateRate * 100).toFixed(0)}%</span> ทุกเดือนจากยอดเงินที่เพื่อนของคุณทำการต่ออายุสมาชิก
          </p>
        </div>
        <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-2 self-start md:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-neutral-300 font-mono">ส่วนแบ่งของคุณ: {(data?.affiliateRate * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-neutral-200">ลิงก์แนะนำของคุณ</h3>
            <p className="text-xs text-neutral-400 max-w-xl">
              แชร์ลิงก์นี้ให้กับเพื่อนหรือผู้ติดตามของคุณเพื่อสมัครสมาชิก เมื่อมีการชำระค่าสมาชิกผ่าน Slip คุณจะได้รับส่วนแบ่งทันทีในระบบเพื่อรอการโอนเงินสดทุกสิ้นเดือน
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:max-w-xl shrink-0">
            <div className="flex-1 bg-neutral-950 px-4 py-3 rounded-xl border border-neutral-800 text-sm font-mono text-amber-400/90 flex items-center justify-between overflow-x-auto whitespace-nowrap">
              <span>{data?.referralLink}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>คัดลอกสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>คัดลอกลิงก์</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">ผู้สมัครผ่านลิงก์ทั้งหมด</span>
            <span className="text-2xl font-bold text-neutral-100">{data?.metrics.totalSignups} คน</span>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">ผู้ใช้ที่ Active / ต่ออายุ</span>
            <span className="text-2xl font-bold text-emerald-400">{data?.metrics.activeReferees} คน</span>
          </div>
          <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">ยอดรอโอน (ตัดรอบสิ้นเดือน)</span>
            <span className="text-2xl font-bold text-amber-500">฿{data?.metrics.pendingCommission.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center animate-pulse">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">รายได้สะสมที่โอนแล้ว</span>
            <span className="text-2xl font-bold text-neutral-100">฿{data?.metrics.paidCommission.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded-xl flex items-center justify-center">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Stats Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Referral List Table */}
        <div className="lg:col-span-2 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h3 className="font-bold text-lg text-neutral-200">รายชื่อเพื่อนที่สมัครผ่านคุณ</h3>
            <span className="text-xs text-neutral-400 font-mono">ทั้งหมด {data?.referrals.length} รายการ</span>
          </div>
          
          <div className="overflow-x-auto">
            {data?.referrals.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-sm font-mono">
                ยังไม่มีผู้สมัครใช้งานผ่านลิงก์แนะนำของคุณ
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800/80 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
                    <th className="pb-3 font-semibold">ผู้สมัคร (Masked)</th>
                    <th className="pb-3 font-semibold">แผนการใช้งาน</th>
                    <th className="pb-3 font-semibold">สถานะบริการ</th>
                    <th className="pb-3 font-semibold text-right">วันที่สมัคร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {data.referrals.map((ref: any, idx: number) => (
                    <tr key={idx} className="hover:bg-neutral-800/10 transition-colors">
                      <td className="py-3 font-mono font-medium text-neutral-300">{ref.email}</td>
                      <td className="py-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 capitalize">
                          {ref.plan}
                        </span>
                      </td>
                      <td className="py-3">
                        {ref.status === 'active' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-[10px] font-bold uppercase font-mono">
                            Active
                          </span>
                        ) : ref.status === 'pending' ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-bold uppercase font-mono">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md text-[10px] font-bold uppercase font-mono">
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-neutral-500 text-xs">
                        {new Date(ref.createdAt).toLocaleDateString('th-TH')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Commissions Logs Side Cards */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h3 className="font-bold text-lg text-neutral-200">ประวัติค่าคอมมิชชั่น</h3>
            <Coins className="h-5 w-5 text-amber-500" />
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {data?.commissions.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-xs font-mono">
                ยังไม่มีการบันทึกส่วนแบ่งค่าคอมมิชชั่นในประวัติ
              </div>
            ) : (
              data.commissions.map((comm: any) => (
                <div 
                  key={comm.id}
                  className="bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-4 space-y-2.5 transition-all hover:border-neutral-700/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300 font-mono">
                      {comm.referredEmail}
                    </span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      +฿{comm.commissionAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-500 font-mono">
                      ยอดชำระ: ฿{comm.paymentAmount.toFixed(0)}
                    </span>
                    
                    {comm.status === 'paid' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-bold font-mono">
                        PAID (โอนแล้ว)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-bold font-mono flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        PENDING
                      </span>
                    )}
                  </div>
                  
                  <div className="text-[9px] text-neutral-600 font-mono text-right">
                    {new Date(comm.createdAt).toLocaleString('th-TH')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
