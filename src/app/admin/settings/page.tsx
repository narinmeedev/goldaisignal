'use client';

import React, { useState, useEffect } from 'react';
import { Settings, AlertTriangle, Save, Loader2, ServerCog } from 'lucide-react';

export default function SettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [trialDuration, setTrialDuration] = useState('30');
  const [paidDuration, setPaidDuration] = useState('90');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.MAINTENANCE_MODE === 'true') {
            setMaintenanceMode(true);
          }
          if (data.settings?.TRIAL_DURATION_DAYS) {
            setTrialDuration(data.settings.TRIAL_DURATION_DAYS);
          }
          if (data.settings?.PAID_DURATION_DAYS) {
            setPaidDuration(data.settings.PAID_DURATION_DAYS);
          }
        }
      } catch (err) {
        setMessage({ text: 'Failed to load settings', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const res1 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'MAINTENANCE_MODE', 
          value: maintenanceMode ? 'true' : 'false' 
        })
      });

      const res2 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'TRIAL_DURATION_DAYS', 
          value: trialDuration
        })
      });

      const res3 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'PAID_DURATION_DAYS', 
          value: paidDuration
        })
      });
      
      if (res1.ok && res2.ok && res3.ok) {
        setMessage({ text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว', type: 'success' });
      } else {
        setMessage({ text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลบางส่วน', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-amber-500" />
          ตั้งค่าระบบ (System Settings)
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          จัดการการตั้งค่าพื้นฐานของระบบและเซิร์ฟเวอร์
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-mono border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center p-12 bg-neutral-900/50 rounded-2xl border border-neutral-800">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Maintenance Mode Toggle */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex gap-4">
                <div className={`mt-1 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  maintenanceMode 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                    : 'bg-neutral-800/50 border-neutral-700 text-neutral-500'
                }`}>
                  <ServerCog className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-100 mb-1">โหมดปิดปรับปรุงระบบ (Maintenance Mode)</h2>
                  <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
                    เมื่อเปิดใช้งาน จะมีการแสดงป้ายประกาศสีแดงเตือนลูกค้าทุกหน้าระบบว่า 
                    "ระบบกำลังปรับปรุง อาจไม่ได้รับสัญญาณชั่วคราว โปรดเทรดด้วยความระมัดระวัง"
                  </p>
                  
                  {maintenanceMode && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg max-w-fit">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <span className="text-xs font-mono font-medium text-rose-400 uppercase tracking-wider">
                        Status: Active (กำลังแจ้งเตือนลูกค้า)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                />
                <div className="w-14 h-7 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Subscription Campaigns Settings */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-neutral-800 pb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-100">ตั้งค่าระยะเวลาแพ็กเกจ (Campaign Durations)</h2>
                <p className="text-sm text-neutral-400">กำหนดระยะเวลาสำหรับการทดลองใช้งานฟรี และการต่ออายุแพ็กเกจรายเดือนเมื่อชำระเงิน</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">
                  ระยะเวลาทดลองใช้ฟรี (วัน)
                </label>
                <input
                  type="number"
                  min="1"
                  value={trialDuration}
                  onChange={(e) => setTrialDuration(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  placeholder="30"
                />
                <p className="text-xs text-neutral-500">
                  จำนวนวันที่ลูกค้าจะใช้งานได้ฟรีหลังสมัครสมาชิกใหม่ (เริ่มต้น 30 วัน)
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">
                  ระยะเวลาแพ็กเกจเมื่อชำระเงิน (วัน)
                </label>
                <input
                  type="number"
                  min="1"
                  value={paidDuration}
                  onChange={(e) => setPaidDuration(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  placeholder="90"
                />
                <p className="text-xs text-neutral-500">
                  จำนวนวันที่ลูกค้าจะได้รับการต่ออายุเมื่อแอดมินอนุมัติการชำระเงิน (เริ่มต้น 90 วัน หรือตามโปรโมชัน)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
