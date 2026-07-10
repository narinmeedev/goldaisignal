'use client';

import React, { useState, useEffect } from 'react';
import { Settings, AlertTriangle, Save, Loader2, ServerCog, Bell } from 'lucide-react';
import { PAID_DURATION_DAYS, TRIAL_DURATION_DAYS } from '@/lib/billing';

export default function SettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [trialDuration, setTrialDuration] = useState(String(TRIAL_DURATION_DAYS));
  const [paidDuration, setPaidDuration] = useState(String(PAID_DURATION_DAYS));
  const [fundamentalBiasXAU, setFundamentalBiasXAU] = useState('NEUTRAL');
  const [newsWarningXAU, setNewsWarningXAU] = useState('');
  
  // Notification states
  const [lineNotifyToken, setLineNotifyToken] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [lineChannelId, setLineChannelId] = useState('');
  const [lineChannelSecret, setLineChannelSecret] = useState('');

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
            const parsedTrial = Number.parseInt(data.settings.TRIAL_DURATION_DAYS, 10);
            setTrialDuration(String(Math.min(Number.isFinite(parsedTrial) ? parsedTrial : TRIAL_DURATION_DAYS, TRIAL_DURATION_DAYS)));
          }
          if (data.settings?.PAID_DURATION_DAYS) {
            const parsedPaid = Number.parseInt(data.settings.PAID_DURATION_DAYS, 10);
            setPaidDuration(String(Math.min(Number.isFinite(parsedPaid) ? parsedPaid : PAID_DURATION_DAYS, PAID_DURATION_DAYS)));
          }
          if (data.settings?.FUNDAMENTAL_BIAS_XAUUSD) {
            setFundamentalBiasXAU(data.settings.FUNDAMENTAL_BIAS_XAUUSD);
          }
          if (data.settings?.FUNDAMENTAL_NEWS_WARNING_XAUUSD) {
            setNewsWarningXAU(data.settings.FUNDAMENTAL_NEWS_WARNING_XAUUSD);
          }
          if (data.settings?.LINE_NOTIFY_TOKEN) {
            setLineNotifyToken(data.settings.LINE_NOTIFY_TOKEN);
          }
          if (data.settings?.TELEGRAM_BOT_TOKEN) {
            setTelegramBotToken(data.settings.TELEGRAM_BOT_TOKEN);
          }
          if (data.settings?.TELEGRAM_CHAT_ID) {
            setTelegramChatId(data.settings.TELEGRAM_CHAT_ID);
          }
          if (data.settings?.LINE_CHANNEL_ID) {
            setLineChannelId(data.settings.LINE_CHANNEL_ID);
          }
          if (data.settings?.LINE_CHANNEL_SECRET) {
            setLineChannelSecret(data.settings.LINE_CHANNEL_SECRET);
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

      const res4 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'FUNDAMENTAL_BIAS_XAUUSD', 
          value: fundamentalBiasXAU
        })
      });

      const res5 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'FUNDAMENTAL_NEWS_WARNING_XAUUSD', 
          value: newsWarningXAU
        })
      });

      const res6 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'LINE_NOTIFY_TOKEN', 
          value: lineNotifyToken
        })
      });

      const res7 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'TELEGRAM_BOT_TOKEN', 
          value: telegramBotToken
        })
      });

      const res8 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'TELEGRAM_CHAT_ID', 
          value: telegramChatId
        })
      });

      const res9 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'LINE_CHANNEL_ID', 
          value: lineChannelId
        })
      });

      const res10 = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'LINE_CHANNEL_SECRET', 
          value: lineChannelSecret
        })
      });

      if (res1.ok && res2.ok && res3.ok && res4.ok && res5.ok && res6.ok && res7.ok && res8.ok && res9.ok && res10.ok) {
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
                  max={TRIAL_DURATION_DAYS}
                  placeholder={String(TRIAL_DURATION_DAYS)}
                />
                <p className="text-xs text-neutral-500">
                  จำนวนวันที่ลูกค้าจะใช้งานได้ฟรีหลังสมัครสมาชิกใหม่ ตอนนี้จำกัดสูงสุด {TRIAL_DURATION_DAYS} วัน
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
                  max={PAID_DURATION_DAYS}
                  placeholder={String(PAID_DURATION_DAYS)}
                />
                <p className="text-xs text-neutral-500">
                  จำนวนวันที่ลูกค้าจะได้รับการต่ออายุเมื่อแอดมินอนุมัติการชำระเงิน (รายเดือนเริ่มต้น {PAID_DURATION_DAYS} วัน)
                </p>
              </div>
            </div>
          </div>

          {/* Fundamental News & Sentiment Settings */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-neutral-800 pb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-100">การควบคุมปัจจัยทางข่าวและอารมณ์ตลาด (Fundamental News & Sentiment)</h2>
                <p className="text-sm text-neutral-400">ควบคุมทิศทางข่าวสารเพื่อป้องกันความเสียหายในวันผันผวนสูง (เช่น มีประกาศตัวเลขสำคัญหรือข่าวสงคราม)</p>
              </div>
            </div>

            {/* XAUUSD Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                ทองคำ (XAUUSD)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    ทิศทางอารมณ์ตลาดหลัก (Market Bias)
                  </label>
                  <select
                    value={fundamentalBiasXAU}
                    onChange={(e) => setFundamentalBiasXAU(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="NEUTRAL">ไซด์เวย์ / ไม่มีข่าวแรง (NEUTRAL)</option>
                    <option value="BULLISH">มองขึ้นรุนแรง / ข่าวหนุนซื้อ (BULLISH)</option>
                    <option value="BEARISH">มองลงรุนแรง / ข่าวหนุนขาย (BEARISH)</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    ข้อความเตือนภัยข่าวสาร (News Alert Message)
                  </label>
                  <textarea
                    value={newsWarningXAU}
                    onChange={(e) => setNewsWarningXAU(e.target.value)}
                    rows={2}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 placeholder:text-neutral-600"
                    placeholder="ระบุข่าวประกาศหรือคำเตือน เช่น 'มีข่าวสงครามอิหร่าน กราฟทองคำมีแนวโน้มขึ้นรุนแรง แนะนำให้ปิดออเดอร์ SELL ทั้งหมด...'"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Push Notification Settings */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-neutral-800 pb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-100">ตั้งค่าการแจ้งเตือนจุดเข้า/ออกออเดอร์มือถือ (Push Notifications)</h2>
                <p className="text-sm text-neutral-400">ส่งสัญญาณเข้าซื้อขายและรายงานผลการปิดชนเป้าหมาย (TP/SL) ตรงสู่มือถือผ่าน LINE Notify หรือ Telegram</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* LINE Notify Token */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">
                  LINE Notify Access Token
                </label>
                <input
                  type="text"
                  value={lineNotifyToken}
                  onChange={(e) => setLineNotifyToken(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                  placeholder="ใส่ LINE Notify Token ที่ได้จากการสร้างลิ้งก์ที่ notify-bot.line.me"
                />
                <p className="text-xs text-neutral-500">
                  สร้างโทเคนได้ฟรีที่ notify-bot.line.me แล้วเชิญ LINE Notify เข้ากลุ่มเป้าหมาย (เว้นว่างไว้หากไม่ใช้งาน)
                </p>
              </div>

              {/* LINE Messaging API Bot Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-neutral-800 pt-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    LINE Messaging API Channel ID
                  </label>
                  <input
                    type="text"
                    value={lineChannelId}
                    onChange={(e) => setLineChannelId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                    placeholder="LINE Channel ID"
                  />
                  <p className="text-xs text-neutral-500">
                    ไอดีแชนแนลบอทจาก LINE Developers (เว้นว่างไว้หากไม่ใช้งาน)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    LINE Messaging API Channel Secret
                  </label>
                  <input
                    type="text"
                    value={lineChannelSecret}
                    onChange={(e) => setLineChannelSecret(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                    placeholder="LINE Channel Secret"
                  />
                  <p className="text-xs text-neutral-500">
                    ความลับแชนแนลบอทจาก LINE Developers
                  </p>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-400 space-y-2">
                <p className="font-bold text-neutral-300">🔗 LINE Webhook URL สำหรับตั้งค่าใน LINE Developer Console:</p>
                <div className="flex items-center justify-between gap-4 bg-neutral-900 border border-neutral-800/80 rounded-lg p-2.5">
                  <span className="text-amber-400 select-all">https://goldaisig.com/api/webhooks/line</span>
                  <span className="text-[10px] text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Copy</span>
                </div>
                <p className="text-neutral-500">คัดลอกลิงก์นี้ไปวางที่ช่อง "Webhook URL" ในตั้งค่า Messaging API ของ LINE Developers และกดปุ่ม Verify เพื่อยืนยันการเชื่อมต่อ</p>
              </div>

              {/* Telegram Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Telegram Bot Token
                  </label>
                  <input
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                    placeholder="บอทโทเคน เช่น 123456789:ABCdefGhIjk..."
                  />
                  <p className="text-xs text-neutral-500">
                    รับโทเคนบอทโดยการสร้างบอทผ่าน @BotFather ใน Telegram
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                    placeholder="ไอดีผู้ใช้ หรือไอดีกลุ่ม เช่น -100123456789"
                  />
                  <p className="text-xs text-neutral-500">
                    รับไอดีผู้ใช้หรือกลุ่มผ่าน @userinfobot หรือบอทคล้ายคลึงกัน
                  </p>
                </div>
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
