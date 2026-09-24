'use client';

import React, { useState } from 'react';
import { Send, Sparkles, MessageSquare, AlertCircle, CheckCircle2, Loader2, Radio } from 'lucide-react';

export default function AdminBroadcastPage() {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'ALL' | 'TELEGRAM' | 'LINE'>('ALL');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGenerateAiSignal = async () => {
    setIsGeneratingAi(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/ai-plan/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: false }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        const p = data.plan;
        const template =
          `⚡ [ Gold AI Signal แผนเทรดใหม่ ] ⚡\n\n` +
          `🕒 เวลาที่ให้แผน: ${p.createdAtThailand} (เวลาไทย)\n` +
          `📌 แผน: ${p.title}\n` +
          `📊 ประเภท: ${p.type}\n` +
          `🎯 จุดเข้า (Entry Target): $${p.entry.toFixed(2)}${p.entry2 ? ` (ไม้ 2: $${p.entry2.toFixed(2)})` : ''}\n` +
          `🔴 Stop Loss (SL): $${p.stopLoss.toFixed(2)}\n` +
          `🟢 Take Profit 1 (TP1): $${p.takeProfit.toFixed(2)}\n` +
          (p.takeProfit2 ? `🟢 Take Profit 2 (TP2): $${p.takeProfit2.toFixed(2)}\n` : '') +
          `🧠 AI Confidence: ${p.confidence}%\n\n` +
          `💡 เหตุผลวิเคราะห์:\n${p.reason.replace(/\*/g, '')}\n` +
          (p.invalidation ? `\n🚫 Invalidation Rule:\n${p.invalidation}\n` : '') +
          `\n👉 ดูรายละเอียดเพิ่มเติมและสถิติสดที่ goldaisig.com`;
        setMessage(template);
      } else {
        setStatus({ type: 'error', text: data.error || 'ไม่สามารถวิเคราะห์แผน AI ได้' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการเรียก AI' });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!confirm(`ยืนยันการส่งข้อความ Broadcast ไปยัง ${target === 'ALL' ? 'Telegram & LINE' : target}?`)) return;

    setIsSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, target }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: 'ส่งสัญญาณบรอดแคสต์ไปยังสมาชิกสำเร็จแล้ว!' });
      } else {
        setStatus({ type: 'error', text: data.error || 'ส่งบรอดแคสต์ไม่สำเร็จ' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-neutral-100">
          <Radio className="h-6 w-6 text-amber-500" />
          ระบบบรอดแคสต์สัญญาณ (Signal Broadcast Center)
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          ส่งสัญญาณเทรดทองคำและข้อความแจ้งเตือนด่วนไปยังกลุ่ม Telegram VIP และ LINE ของสมาชิกทันที
        </p>
      </div>

      {status && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
            status.type === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/25 bg-rose-500/10 text-rose-400'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Editor */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <h2 className="text-base font-semibold text-neutral-200">ข้อความที่ต้องการส่ง</h2>
            <button
              type="button"
              onClick={handleGenerateAiSignal}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {isGeneratingAi ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              สร้างแผนเทรดอัตโนมัติด้วย AI
            </button>
          </div>

          <form onSubmit={handleSendBroadcast} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                ช่องทางเป้าหมาย (Destination)
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { id: 'ALL', label: '🚀 ทั้งหมด (TG + LINE)' },
                  { id: 'TELEGRAM', label: '✈️ Telegram VIP' },
                  { id: 'LINE', label: '💬 LINE VIP / Notify' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTarget(t.id as any)}
                    className={`rounded-xl border p-3 text-center text-xs font-medium transition ${
                      target === t.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-400 shadow-sm'
                        : 'border-neutral-800 bg-neutral-800/40 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                เนื้อหาข้อความ (Message Body)
              </label>
              <textarea
                rows={12}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความแจ้งเตือน หรือกดปุ่ม 'สร้างแผนเทรดอัตโนมัติด้วย AI' ด้านบน..."
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-sm leading-6 text-neutral-200 placeholder-neutral-600 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              บรอดแคสต์ส่งทันที ({target === 'ALL' ? 'Telegram & LINE' : target})
            </button>
          </form>
        </div>

        {/* Preview / Tips */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              ข้อดีของการส่งผ่าน Telegram & LINE
            </h3>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-neutral-400">
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                สมาชิกได้รับข้อความแจ้งเตือนบนหน้าจอมือถือทันทีที่มีสัญญาณ
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                ไม่ต้องคอยเปิดหน้าเว็บค้างไว้ สะดวก รวดเร็ว ตรงพฤติกรรมเทรดเดอร์ไทย
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                ลดปัญหาความล่าช้าในการเข้าออเดอร์ทองคำที่วิ่งเร็ว
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              💡 ตัวอย่างการจัดรูปแบบ
            </p>
            <p className="mt-2 text-xs leading-6 text-neutral-300">
              ควรระบุจุดเข้า (Entry), Stop Loss (SL), และเป้าทำกำไร (TP) ชัดเจน พร้อมระบุเวลาไทย เพื่อให้สมาชิกเปิด MT5 วางแผน Pending Order ได้ทันที
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
