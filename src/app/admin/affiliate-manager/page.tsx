'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Wallet, 
  Percent, 
  CheckCircle, 
  Coins, 
  RefreshCw, 
  Settings,
  ChevronRight,
  TrendingUp,
  Sliders,
  DollarSign
} from 'lucide-react';

export default function AffiliateManagerPage() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState<number>(0.15);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchAffiliates = async () => {
    try {
      const res = await fetch('/api/admin/affiliate');
      const json = await res.json();
      if (res.ok && json.success) {
        setAffiliates(json.affiliates);
      } else {
        setErrorMsg(json.error || 'โหลดข้อมูลผู้แนะนำล้มเหลว');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const handleUpdateRate = async (userId: string) => {
    setIsUpdating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-rate', userId, rate: newRate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        setEditingUserId(null);
        await fetchAffiliates();
      } else {
        setErrorMsg(data.error || 'ไม่สามารถอัปเดตอัตราส่วนแบ่งได้');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePayoutCutoff = async (userId: string, email: string, pendingAmount: number) => {
    if (!confirm(`ยืนยันการโอนเงินจำนวน ฿${pendingAmount.toFixed(2)} ให้กับผู้ใช้งาน ${email} เรียบร้อยแล้วใช่หรือไม่?\nการดำเนินการนี้จะปรับสถานะค่าคอมมิชชั่นค้างจ่ายทั้งหมดเป็น PAID`)) {
      return;
    }

    setIsUpdating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'payout-cutoff', userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        await fetchAffiliates();
      } else {
        setErrorMsg(data.error || 'ไม่สามารถบันทึกการจ่ายเงินได้');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsUpdating(false);
    }
  };

  // Calculate platform totals
  const totalAffiliates = affiliates.length;
  const totalPendingPayout = affiliates.reduce((sum, a) => sum + a.pendingCommission, 0);
  const totalPaidPayout = affiliates.reduce((sum, a) => sum + a.paidCommission, 0);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm font-mono font-medium">กำลังโหลดข้อมูลแผงควบคุมหลัก Affiliate...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            ระบบจัดการพันธมิตร (Affiliate Manager Panel)
          </h1>
          <p className="text-sm text-neutral-400 mt-1.5 leading-relaxed">
            จัดการอัตราส่วนแบ่งคอมมิชชั่นรายบุคคล ตรวจสอบยอดค้างจ่าย และบันทึกประวัติการตัดรอบบัญชีจ่ายเงิน
          </p>
        </div>
        <button
          onClick={fetchAffiliates}
          className="p-3 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all flex items-center gap-2 text-xs font-mono self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Message Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-bold text-center">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-mono text-center">
          {errorMsg}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">จำนวนพันธมิตรทั้งหมด</span>
            <span className="text-2xl font-bold text-neutral-100">{totalAffiliates} คน</span>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">ยอดรวมค้างชำระสิ้นเดือน</span>
            <span className="text-2xl font-bold text-amber-500">฿{totalPendingPayout.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center animate-pulse">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">ยอดที่ทำการจ่ายเงินแล้วสะสม</span>
            <span className="text-2xl font-bold text-emerald-400">฿{totalPaidPayout.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Affiliates List Table */}
      <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-4">
        <h3 className="font-bold text-lg text-neutral-200">รายชื่อสมาชิก Affiliate</h3>

        <div className="overflow-x-auto">
          {affiliates.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-sm font-mono">
              ยังไม่มีพันธมิตรที่มีการแนะนำเพื่อนหรือส่วนแบ่งในประวัติระบบ
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800/80 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
                  <th className="pb-3 font-semibold">อีเมลผู้แนะนำ</th>
                  <th className="pb-3 font-semibold">อัตราส่วนแบ่ง (%)</th>
                  <th className="pb-3 font-semibold text-center">ยอดแนะนำ (สมัคร/Active)</th>
                  <th className="pb-3 font-semibold text-right">ยอดแนะนำสะสม</th>
                  <th className="pb-3 font-semibold text-right text-amber-500">ค้างชำระ (สิ้นเดือน)</th>
                  <th className="pb-3 font-semibold text-right">จ่ายแล้วสะสม</th>
                  <th className="pb-3 font-semibold text-right">จัดการการเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {affiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-neutral-800/10 transition-colors">
                    <td className="py-4 font-mono font-medium text-neutral-300">{aff.email}</td>
                    
                    {/* Rate Editing cell */}
                    <td className="py-4">
                      {editingUserId === aff.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={newRate}
                            onChange={(e) => setNewRate(parseFloat(e.target.value))}
                            className="w-16 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs font-mono text-center text-amber-400 focus:outline-none focus:border-amber-500/50"
                          />
                          <button
                            onClick={() => handleUpdateRate(aff.id)}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-amber-500 text-neutral-950 font-bold text-[10px] rounded hover:bg-amber-600 cursor-pointer transition-colors"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[10px] rounded cursor-pointer transition-colors"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-neutral-300 font-semibold">
                            {(aff.affiliateRate * 100).toFixed(0)}%
                          </span>
                          <button
                            onClick={() => {
                              setEditingUserId(aff.id);
                              setNewRate(aff.affiliateRate);
                            }}
                            className="p-1 text-neutral-500 hover:text-amber-500 transition-colors cursor-pointer"
                            title="ปรับแต่งเปอร์เซ็นต์ส่วนแบ่ง"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-4 text-center font-mono text-neutral-300 text-xs">
                      {aff.totalSignups} คน / <span className="text-emerald-400">{aff.activeReferees} คน</span>
                    </td>

                    <td className="py-4 text-right font-mono text-neutral-400 text-xs">
                      ฿{aff.totalRevenue.toFixed(0)}
                    </td>

                    <td className="py-4 text-right font-mono font-bold text-amber-500 text-sm">
                      ฿{aff.pendingCommission.toFixed(2)}
                    </td>

                    <td className="py-4 text-right font-mono text-neutral-400 text-xs">
                      ฿{aff.paidCommission.toFixed(2)}
                    </td>

                    {/* Cutoff Payout actions */}
                    <td className="py-4 text-right">
                      {aff.pendingCommission > 0 ? (
                        <button
                          onClick={() => handlePayoutCutoff(aff.id, aff.email, aff.pendingCommission)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer inline-flex items-center gap-1 active:translate-y-px"
                        >
                          <DollarSign className="h-3 w-3" />
                          <span>ตัดยอดจ่ายเงิน</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-neutral-600 font-mono">
                          โอนหมดแล้ว (ไม่มีค้าง)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
