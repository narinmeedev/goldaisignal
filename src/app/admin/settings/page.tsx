'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Globe,
  Loader2,
  MessageCircle,
  Save,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import {
  PAID_DURATION_DAYS,
  PROMOTIONAL_MONTHLY_PRICE_THB,
  REGULAR_MONTHLY_PRICE_THB,
  TRIAL_DURATION_DAYS,
} from '@/lib/billing';

interface FormState {
  maintenanceMode: boolean;
  trialDuration: string;
  paidDuration: string;
  promoPrice: string;
  regularPrice: string;
  telegramVipLink: string;
  telegramBotToken: string;
  telegramChatId: string;
  lineVipLink: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  promptPayNumber: string;
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
  promoPrice: String(PROMOTIONAL_MONTHLY_PRICE_THB),
  regularPrice: String(REGULAR_MONTHLY_PRICE_THB),
  telegramVipLink: '',
  telegramBotToken: '',
  telegramChatId: '',
  lineVipLink: '',
  bankName: 'ธนาคารกสิกรไทย (KBank)',
  bankAccountNumber: '',
  bankAccountName: '',
  promptPayNumber: '',
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
  const [testingLine, setTestingLine] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
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
          promoPrice: settings.PROMOTIONAL_MONTHLY_PRICE_THB || String(PROMOTIONAL_MONTHLY_PRICE_THB),
          regularPrice: settings.REGULAR_MONTHLY_PRICE_THB || String(REGULAR_MONTHLY_PRICE_THB),
          telegramVipLink: settings.TELEGRAM_VIP_LINK || '',
          telegramBotToken: settings.TELEGRAM_BOT_TOKEN || '',
          telegramChatId: settings.TELEGRAM_CHAT_ID || '',
          lineVipLink: settings.LINE_VIP_LINK || '',
          bankName: settings.BANK_NAME || 'ธนาคารกสิกรไทย (KBank)',
          bankAccountNumber: settings.BANK_ACCOUNT_NUMBER || '',
          bankAccountName: settings.BANK_ACCOUNT_NAME || '',
          promptPayNumber: settings.PROMPTPAY_NUMBER || '',
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
      PROMOTIONAL_MONTHLY_PRICE_THB: form.promoPrice,
      REGULAR_MONTHLY_PRICE_THB: form.regularPrice,
      TELEGRAM_VIP_LINK: form.telegramVipLink.trim(),
      TELEGRAM_BOT_TOKEN: form.telegramBotToken.trim(),
      TELEGRAM_CHAT_ID: form.telegramChatId.trim(),
      LINE_VIP_LINK: form.lineVipLink.trim(),
      BANK_NAME: form.bankName.trim(),
      BANK_ACCOUNT_NUMBER: form.bankAccountNumber.trim(),
      BANK_ACCOUNT_NAME: form.bankAccountName.trim(),
      PROMPTPAY_NUMBER: form.promptPayNumber.trim(),
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
      setNotice({ type: 'success', text: 'บันทึกการตั้งค่าระบบและกลุ่ม VIP เรียบร้อยแล้ว' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  const testLine = async () => {
    setTestingLine(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/test-notification', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ส่งข้อความทดสอบไม่สำเร็จ');
      setNotice({ type: 'success', text: data.message || 'LINE พร้อมใช้งาน' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'ส่งข้อความทดสอบไม่สำเร็จ' });
    } finally {
      setTestingLine(false);
    }
  };

  const testTelegram = async () => {
    setTestingTelegram(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BUY',
          symbol: 'XAUUSD',
          entryLow: 2740,
          entryHigh: 2742,
          stopLoss: 2735,
          tp1: 2748,
          tp2: 2755,
          riskReward: '1:2.5',
          reason: 'ข้อความทดสอบระบบส่งสัญญาณ Telegram VIP อัตโนมัติ',
          channels: { telegram: true, line: false },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ส่งข้อความ Telegram ไม่สำเร็จ');
      setNotice({ type: 'success', text: 'ส่งสัญญาณทดสอบเข้า Telegram VIP สำเร็จแล้ว' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'ส่งข้อความ Telegram ไม่สำเร็จ' });
    } finally {
      setTestingTelegram(false);
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
    if (!confirm('⚠️ ยืนยันการล้างประวัติการเทรดและสถิติทั้งหมด?\n\nสถิติเดิมจะถูกล้างทั้งหมดเพื่อเริ่มนับ Win Rate ใหม่อย่างแม่นยำ 100%')) return;
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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />กำลังโหลดการตั้งค่า</div>;

  const inputClass = 'h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-amber-500';

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-800 pb-5">
        <div className="flex items-center gap-2 text-amber-400">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">System Settings</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">ตั้งค่าระบบ & กลุ่มส่งสัญญาณ VIP</h1>
        <p className="mt-1 text-sm text-neutral-400">
          จัดการลิงก์กลุ่ม Telegram/LINE VIP, ข้อมูลการชำระเงิน, ราคาแพ็กเกจ และการแจ้งเตือน
        </p>
      </header>

      {notice && (
        <div className={`rounded-xl border p-4 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
          {notice.text}
        </div>
      )}

      {/* 1. VIP COMMUNITY LINKS */}
      <section className="rounded-xl border border-sky-500/30 bg-neutral-900 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-neutral-100">1. กลุ่มส่งสัญญาณ Telegram VIP & LINE Community</h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              ลิงก์ที่สมาชิก VIP จะกดเข้ากลุ่มได้จากหน้า Member Hub ทันทีหลังได้รับการอนุมัติสิทธิ์
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-neutral-800">
          <div>
            <label className="text-xs font-semibold text-sky-300">Telegram VIP Invite Link (ลิงก์เชิญเข้ากลุ่ม)</label>
            <input
              type="text"
              value={form.telegramVipLink}
              onChange={(e) => update('telegramVipLink', e.target.value)}
              className={`${inputClass} mt-1.5 font-mono text-xs`}
              placeholder="https://t.me/+YourTelegramVipInviteLink"
            />
            <p className="mt-1 text-[11px] text-neutral-500">ปุ่มในหน้า Member Hub จะพาสมาชิก VIP ไปยังลิงก์นี้</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-300">LINE VIP / Official Account Link</label>
            <input
              type="text"
              value={form.lineVipLink}
              onChange={(e) => update('lineVipLink', e.target.value)}
              className={`${inputClass} mt-1.5 font-mono text-xs`}
              placeholder="https://line.me/R/ti/p/@413aryiz"
            />
            <p className="mt-1 text-[11px] text-neutral-500">ลิงก์เพิ่มเพื่อน LINE OA หรือกลุ่มไลน์ VIP</p>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800">
          <h3 className="text-xs font-bold text-neutral-300">Telegram Bot Broadcast Configuration (สำหรับส่งสัญญาณอัตโนมัติ)</h3>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-neutral-400">Telegram Bot Token</label>
              <input
                type="password"
                value={form.telegramBotToken}
                onChange={(e) => update('telegramBotToken', e.target.value)}
                className={`${inputClass} mt-1 font-mono text-xs`}
                placeholder="7123456789:AAHxxxxx..."
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Telegram Channel / Chat ID</label>
              <input
                type="text"
                value={form.telegramChatId}
                onChange={(e) => update('telegramChatId', e.target.value)}
                className={`${inputClass} mt-1 font-mono text-xs`}
                placeholder="-100xxxxxxxxxx"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={testTelegram}
            disabled={testingTelegram || !form.telegramBotToken || !form.telegramChatId}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-40"
          >
            {testingTelegram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            ทดสอบส่งสัญญาณเข้า Telegram
          </button>
        </div>
      </section>

      {/* 2. BANK & PAYMENT SETTINGS */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-neutral-100">2. ข้อมูลบัญชีธนาคาร & พร้อมเพย์ (สำหรับหน้าชำระเงิน)</h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              ข้อมูลนี้จะแสดงให้ลูกค้าเห็นในหน้าแจ้งชำระเงิน / แนบสลิปโอนเงิน
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-neutral-800">
          <div>
            <label className="text-xs text-neutral-300">ชื่อธนาคาร</label>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => update('bankName', e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="เช่น ธนาคารกสิกรไทย (KBank)"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">เลขที่บัญชี</label>
            <input
              type="text"
              value={form.bankAccountNumber}
              onChange={(e) => update('bankAccountNumber', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
              placeholder="xxx-x-xxxxx-x"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">ชื่อบัญชี</label>
            <input
              type="text"
              value={form.bankAccountName}
              onChange={(e) => update('bankAccountName', e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="ชื่อ-นามสกุลเจ้าของบัญชี"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">เบอร์พร้อมเพย์ / PromptPay ID</label>
            <input
              type="text"
              value={form.promptPayNumber}
              onChange={(e) => update('promptPayNumber', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
              placeholder="08x-xxx-xxxx"
            />
          </div>
        </div>
      </section>

      {/* 3. PRICING & MEMBERSHIP DURATION */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-neutral-100">3. ราคาและอายุการใช้งานสมาชิก</h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              กำหนดราคาแพ็กเกจและจำนวนวันใช้งานเมื่อสมาชิกชำระเงินหรือทดลองใช้
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-neutral-800">
          <div>
            <label className="text-xs text-neutral-300">ราคาโปรโมชั่น (บาท/เดือน)</label>
            <input
              type="number"
              value={form.promoPrice}
              onChange={(e) => update('promoPrice', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">ราคาปกติ (บาท/เดือน)</label>
            <input
              type="number"
              value={form.regularPrice}
              onChange={(e) => update('regularPrice', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">จำนวนวันทดลองใช้ฟรี (วัน)</label>
            <input
              type="number"
              min="1"
              value={form.trialDuration}
              onChange={(e) => update('trialDuration', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-300">จำนวนวันต่ออายุเมื่อชำระเงิน (วัน)</label>
            <input
              type="number"
              min="1"
              value={form.paidDuration}
              onChange={(e) => update('paidDuration', e.target.value)}
              className={`${inputClass} mt-1 font-mono`}
            />
          </div>
        </div>
      </section>

      {/* 4. LINE NOTIFICATION */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-neutral-100">4. การตั้งค่าแจ้งเตือน LINE Official Account</h2>
            <p className="mt-0.5 text-xs text-neutral-400">ส่งสัญญาณแผนเข้าเทรดและผล TP/SL กระจายหาผู้ติดตาม LINE OA</p>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800 space-y-3">
          <div>
            <label className="text-xs font-semibold text-amber-300">LINE OA Channel Access Token</label>
            <input
              type="text"
              value={form.lineNotifyToken}
              onChange={(e) => update('lineNotifyToken', e.target.value)}
              className={`${inputClass} mt-1.5 font-mono text-xs`}
              placeholder="ใส่ Channel Access Token (developers.line.biz)"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-neutral-400">LINE Channel ID</label>
              <input
                value={form.lineChannelId}
                onChange={(e) => update('lineChannelId', e.target.value)}
                className={`${inputClass} mt-1 font-mono text-xs`}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">LINE Channel Secret</label>
              <input
                type="password"
                value={form.lineChannelSecret}
                onChange={(e) => update('lineChannelSecret', e.target.value)}
                className={`${inputClass} mt-1 font-mono text-xs`}
                placeholder={form.lineSecretConfigured ? 'ตั้งค่าแล้ว · ใส่ใหม่เพื่อเปลี่ยน' : 'ยังไม่ได้ตั้งค่า'}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={testLine}
            disabled={testingLine || !form.lineSecretConfigured}
            className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {testingLine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            ทดสอบส่งข้อความ LINE
          </button>
        </div>
      </section>

      {/* 5. MAINTENANCE & NEWS BIAS */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-3">
            <ServerCog className="mt-0.5 h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-base text-neutral-100">5. โหมดปิดปรับปรุง & ข่าวผันผวน</h2>
              <p className="mt-1 text-xs text-neutral-400">ปิดการแสดงแผนชั่วคราว หรือระบุความเสี่ยงข่าวกล่องแดงเพื่อสั่งระบบแจ้งเตือน</p>
            </div>
          </div>
          <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
            <input type="checkbox" checked={form.maintenanceMode} onChange={(e) => update('maintenanceMode', e.target.checked)} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full bg-neutral-700 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-rose-500 peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[220px_1fr] pt-2 border-t border-neutral-800">
          <div>
            <label className="text-xs text-neutral-300">ทิศทางข่าว (Fundamental Bias)</label>
            <select
              value={form.fundamentalBias}
              onChange={(e) => update('fundamentalBias', e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="NEUTRAL">ไม่ระบุทิศทาง</option>
              <option value="BULLISH">ข่าวหนุนราคาขึ้น</option>
              <option value="BEARISH">ข่าวกดราคาลง</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-300">ข้อความเตือนความเสี่ยงข่าว</label>
            <input
              type="text"
              value={form.newsWarning}
              onChange={(e) => update('newsWarning', e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="เช่น มีประกาศตัวเลข CPI 19:30 น. เสี่ยง Slippage สูง"
            />
          </div>
        </div>
      </section>

      {/* 6. ALGORITHM RESET CONTROLS */}
      <section className="rounded-xl border border-amber-500/30 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ServerCog className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="font-bold text-amber-300">6. การจัดการแผนเทรด & รีเซ็ตสถิติ</h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              ล้างแคชแผนปัจจุบันเพื่อคำนวณใหม่ หรือล้างสถิติเก่าเพื่อเริ่มนับ Win Rate จากศูนย์
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-neutral-800">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-neutral-200">ล้างแคชแผนปัจจุบัน (Force Re-Evaluate)</h3>
              <p className="mt-1 text-[11px] text-neutral-400">
                ล้างแผนที่กำลังค้างอยู่ เพื่อให้ระบบคำนวณแผนใหม่ตามโครงสร้างราคา MT5 ล่าสุด (ไม่ลบสถิติย้อนหลัง)
              </p>
            </div>
            <button
              type="button"
              onClick={resetActivePlan}
              disabled={resettingPlan || resettingAll}
              className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {resettingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
              ล้างแผนปัจจุบันและคำนวณใหม่
            </button>
          </div>

          <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-rose-300">ล้างประวัติสถิติทั้งหมด (Full Reset)</h3>
              <p className="mt-1 text-[11px] text-neutral-400">
                ลบประวัติไม้เทรดเก่าทั้งหมด เพื่อเริ่มต้นนับ Win Rate จากศูนย์ 100%
              </p>
            </div>
            <button
              type="button"
              onClick={resetAllTrades}
              disabled={resettingPlan || resettingAll}
              className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
            >
              {resettingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              ล้างประวัติและเริ่มวัดผลใหม่
            </button>
          </div>
        </div>
      </section>

      {/* SAVE BUTTON */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-sm font-bold text-neutral-950 shadow-lg hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกการตั้งค่าทั้งหมด
        </button>
      </div>
    </main>
  );
}
