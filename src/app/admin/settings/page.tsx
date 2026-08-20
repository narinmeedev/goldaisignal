'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Loader2, Save, Send, ServerCog, Settings } from 'lucide-react';
import { PAID_DURATION_DAYS, TRIAL_DURATION_DAYS } from '@/lib/billing';

interface FormState {
  maintenanceMode: boolean;
  trialDuration: string;
  paidDuration: string;
  fundamentalBias: string;
  newsWarning: string;
  lineNotifyToken: string;
  lineChannelId: string;
  lineChannelSecret: string;
  lineSecretConfigured: boolean;
}

const initialState: FormState = {
  maintenanceMode: false,
  trialDuration: String(TRIAL_DURATION_DAYS),
  paidDuration: String(PAID_DURATION_DAYS),
  fundamentalBias: 'NEUTRAL',
  newsWarning: '',
  lineNotifyToken: '',
  lineChannelId: '',
  lineChannelSecret: '',
  lineSecretConfigured: false,
};

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'โหลดการตั้งค่าไม่สำเร็จ');
        const settings = data.settings ?? {};
        setForm({
          maintenanceMode: settings.MAINTENANCE_MODE === 'true',
          trialDuration: settings.TRIAL_DURATION_DAYS || String(TRIAL_DURATION_DAYS),
          paidDuration: settings.PAID_DURATION_DAYS || String(PAID_DURATION_DAYS),
          fundamentalBias: settings.FUNDAMENTAL_BIAS_XAUUSD || 'NEUTRAL',
          newsWarning: settings.FUNDAMENTAL_NEWS_WARNING_XAUUSD || '',
          lineNotifyToken: settings.LINE_NOTIFY_TOKEN || '',
          lineChannelId: settings.LINE_CHANNEL_ID || '',
          lineChannelSecret: '',
          lineSecretConfigured: settings.LINE_CHANNEL_SECRET_CONFIGURED === 'true' || Boolean(settings.LINE_NOTIFY_TOKEN),
        });
      } catch (error) {
        setNotice({ type: 'error', text: error instanceof Error ? error.message : 'โหลดการตั้งค่าไม่สำเร็จ' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    const settings: Record<string, string> = {
      MAINTENANCE_MODE: String(form.maintenanceMode),
      TRIAL_DURATION_DAYS: form.trialDuration,
      PAID_DURATION_DAYS: form.paidDuration,
      FUNDAMENTAL_BIAS_XAUUSD: form.fundamentalBias,
      FUNDAMENTAL_NEWS_WARNING_XAUUSD: form.newsWarning.trim(),
      LINE_NOTIFY_TOKEN: form.lineNotifyToken.trim(),
      LINE_CHANNEL_ID: form.lineChannelId.trim(),
    };
    if (form.lineChannelSecret.trim()) settings.LINE_CHANNEL_SECRET = form.lineChannelSecret.trim();
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setForm((current) => ({ ...current, lineChannelSecret: '', lineSecretConfigured: current.lineSecretConfigured || Boolean(settings.LINE_CHANNEL_SECRET || settings.LINE_NOTIFY_TOKEN) }));
      setNotice({ type: 'success', text: 'บันทึกการตั้งค่า LINE และระบบเรียบร้อยแล้ว' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  const testLine = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/test-notification', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ส่งข้อความทดสอบไม่สำเร็จ');
      setNotice({ type: 'success', text: data.message || 'LINE พร้อมใช้งาน' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'ส่งข้อความทดสอบไม่สำเร็จ' });
    } finally {
      setTesting(false);
    }
  };

  const [resettingPlan, setResettingPlan] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

  const resetActivePlan = async () => {
    if (!confirm('ยืนยันการล้างแคชแผนปัจจุบันเพื่อคำนวณใหม่? (สถิติย้อนหลังจะไม่ถูกลบ)')) return;
    setResettingPlan(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/trades?mode=active_plan_only', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ล้างแผนไม่สำเร็จ');
      setNotice({ type: 'success', text: data.message || 'ล้างแคชแผนปัจจุบันเรียบร้อยแล้ว' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'ล้างแผนไม่สำเร็จ' });
    } finally {
      setResettingPlan(false);
    }
  };

  const resetAllTrades = async () => {
    if (!confirm('⚠️ ยืนยันการล้างประวัติการเทรดและสถิติทั้งหมด?\n\nสถิติเดิม (รวม 19 ไม้ที่ติด SL จากเวอร์ชันก่อน) จะถูกล้างทั้งหมดเพื่อเริ่มนับ Win Rate > 75% ใหม่อย่างแม่นยำ 100%')) return;
    setResettingAll(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/trades?mode=all', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'รีเซ็ตไม่สำเร็จ');
      setNotice({ type: 'success', text: data.message || 'ล้างประวัติการเทรดทั้งหมดเรียบร้อยแล้ว' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'รีเซ็ตไม่สำเร็จ' });
    } finally {
      setResettingAll(false);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังโหลดการตั้งค่า</div>;

  const inputClass = 'h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-amber-500';

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-800 pb-5">
        <div className="flex items-center gap-2 text-amber-400"><Settings className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Operations</span></div>
        <h1 className="mt-2 text-2xl font-bold">ตั้งค่าบริการ</h1>
        <p className="mt-1 text-sm text-neutral-400">เฉพาะค่าที่มีผลต่อบริการสมาชิก แผนทองคำ และการส่ง LINE Notification</p>
      </header>

      {notice && <div className={`rounded-lg border p-4 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{notice.text}</div>}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-3"><ServerCog className="mt-0.5 h-5 w-5 text-amber-400" /><div><h2 className="font-bold">ปิดบริการชั่วคราว</h2><p className="mt-1 text-sm leading-6 text-neutral-400">สมาชิกจะไม่เห็นแผนจนกว่าแอดมินจะปิดโหมดนี้ ใช้เมื่อข้อมูล MT5 หรือระบบวิเคราะห์ไม่พร้อมเท่านั้น</p></div></div>
          <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
            <input type="checkbox" checked={form.maintenanceMode} onChange={(event) => update('maintenanceMode', event.target.checked)} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full bg-neutral-700 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-rose-500 peer-checked:after:translate-x-5" />
          </label>
        </div>
        {form.maintenanceMode && <p className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="h-4 w-4" />โหมดปิดบริการกำลังทำงาน</p>}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="font-bold">อายุการใช้งานสมาชิก</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">ทดลองใช้ฟรี (วัน)<input type="number" min="1" max={TRIAL_DURATION_DAYS} value={form.trialDuration} onChange={(event) => update('trialDuration', event.target.value)} className={`${inputClass} mt-2`} /></label>
          <label className="text-sm text-neutral-300">ต่ออายุเมื่อชำระเงิน (วัน)<input type="number" min="1" max={PAID_DURATION_DAYS} value={form.paidDuration} onChange={(event) => update('paidDuration', event.target.value)} className={`${inputClass} mt-2`} /></label>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" /><div><h2 className="font-bold">ความเสี่ยงข่าวทองคำ</h2><p className="mt-1 text-sm text-neutral-400">ใช้เมื่อมีข่าวแรงที่โมเดลเทคนิคอาจยังไม่สะท้อน ระบบจะนำข้อมูลนี้ไปเพิ่มความเสี่ยงและคัดกรองแผน</p></div></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[240px_1fr]">
          <label className="text-sm text-neutral-300">ผลกระทบต่อทิศทาง<select value={form.fundamentalBias} onChange={(event) => update('fundamentalBias', event.target.value)} className={`${inputClass} mt-2`}><option value="NEUTRAL">ไม่ระบุทิศทาง</option><option value="BULLISH">ข่าวหนุนราคาขึ้น</option><option value="BEARISH">ข่าวกดราคาลง</option></select></label>
          <label className="text-sm text-neutral-300">ความเสี่ยงที่เกิดขึ้น<textarea value={form.newsWarning} onChange={(event) => update('newsWarning', event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-amber-500" placeholder="เช่น มีประกาศ CPI เวลา 19:30 น. อาจเกิด slippage สูง" /></label>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div className="flex gap-3">
          <Bell className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <h2 className="font-bold">การตั้งค่าแจ้งเตือน LINE (LINE Official Account / Messaging API)</h2>
            <p className="mt-1 text-sm text-neutral-400">ส่งสัญญาณแผนเข้าเทรดและผล TP/SL กระจายหาผู้ติดตาม LINE Official Account และสมาชิกที่มีสิทธิ์ใช้งาน</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-amber-300">1. LINE Official Account Channel Access Token (แนะนำส่ง Broadcast บอร์ดแคสต์หาสมาชิกทุกคน)</label>
          <input
            type="text"
            value={form.lineNotifyToken}
            onChange={(event) => update('lineNotifyToken', event.target.value)}
            className={`${inputClass} mt-1.5 font-mono text-xs`}
            placeholder="ใส่ Channel Access Token (ออกไอดีจาก LINE Official Account Manager -> developers.line.biz)"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-neutral-500">หากใส่ Channel Access Token นี้ ระบบจะใช้ LINE Broadcast API ยิงสัญญาณแผนเทรดสดหาผู้ติดตาม LINE OA ทุกคนโดยอัตโนมัติ</p>
        </div>

        <div className="pt-2 border-t border-neutral-800">
          <label className="text-sm font-semibold text-neutral-300">2. LINE Webhook & Channel Credentials (สำหรับระบบ Bot ทักทายอัตโนมัติ)</label>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-neutral-400">Channel ID<input value={form.lineChannelId} onChange={(event) => update('lineChannelId', event.target.value)} className={`${inputClass} mt-1 font-mono`} autoComplete="off" /></label>
            <label className="text-xs text-neutral-400">Channel Secret<input type="password" value={form.lineChannelSecret} onChange={(event) => update('lineChannelSecret', event.target.value)} className={`${inputClass} mt-1 font-mono`} placeholder={form.lineSecretConfigured ? 'ตั้งค่าแล้ว · ใส่ค่าใหม่เมื่อต้องการเปลี่ยน' : 'ยังไม่ได้ตั้งค่า'} autoComplete="new-password" /></label>
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm">
          <p className="text-neutral-500 text-xs">LINE Bot Webhook URL</p>
          <code className="mt-0.5 block break-all text-amber-300 font-mono text-xs">https://goldaisig.com/api/webhooks/line</code>
        </div>

        <button type="button" onClick={testLine} disabled={testing || !form.lineSecretConfigured} className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-amber-500/30 px-4 text-sm font-medium text-amber-300 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          ทดสอบส่งข้อความ LINE
        </button>
      </section>

      <section className="rounded-lg border border-amber-500/30 bg-neutral-900 p-5 space-y-4">
        <div className="flex gap-3">
          <ServerCog className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <h2 className="font-bold text-amber-300">⚙️ การจัดการแผนเทรด & รีเซ็ตวัดผลอัลกอริทึม (Algorithm Reset)</h2>
            <p className="mt-1 text-sm text-neutral-400">
              ใช้สำหรับล้างแคชแผนเทรดเดิม หรือล้างสถิติเก่าทั้งหมดเพื่อเริ่มต้นวัดผลอัลกอริทึมใหม่ (Win Rate &gt; 75% Benchmark)
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-neutral-800">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-200">1. ล้างแคชแผนปัจจุบัน (Force Re-Evaluate)</h3>
              <p className="mt-1 text-xs text-neutral-400 leading-5">
                ล้างเฉพาะแผนที่กำลังค้างอยู่ เพื่อสั่งให้ระบบคำนวณแผนเทรดใหม่ตามโครงสร้างราคา MT5 ล่าสุดทันที (ไม่ลบสถิติย้อนหลัง)
              </p>
            </div>
            <button
              type="button"
              onClick={resetActivePlan}
              disabled={resettingPlan || resettingAll}
              className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition-all"
            >
              {resettingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
              ล้างแผนปัจจุบันและคำนวณใหม่
            </button>
          </div>

          <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-rose-300">2. ล้างประวัติสถิติทั้งหมด & เริ่มวัดผลใหม่ (Full Reset)</h3>
              <p className="mt-1 text-xs text-neutral-400 leading-5">
                ลบประวัติไม้เทรดเก่าและแผนทั้งหมด เพื่อเริ่มต้นนับ Win Rate และประวัติผลงานใหม่จากศูนย์ 100%
              </p>
            </div>
            <button
              type="button"
              onClick={resetAllTrades}
              disabled={resettingPlan || resettingAll}
              className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50 transition-all"
            >
              {resettingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              ล้างประวัติการเทรดและเริ่มวัดผลใหม่ทั้งหมด
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-400 px-5 text-sm font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกการตั้งค่า
        </button>
      </div>
    </main>
  );
}
