'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  Send,
  Settings,
  Sparkles,
  ShieldCheck,
  Bell,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Wallet,
  Smartphone,
  ChevronRight,
  Activity,
  Layers,
  HelpCircle,
  QrCode
} from 'lucide-react';
import { formatBaht, TRIAL_DURATION_DAYS } from '@/lib/billing';

interface UserSession {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'viewer';
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string | null;
  daysRemaining?: number | null;
  isAffiliate?: boolean;
  referralCode?: string;
  telegramVipLink?: string;
  lineVipLink?: string;
}

interface AdminMetrics {
  totalUsers: number;
  activeSubscribers: number;
  pendingPaymentsCount: number;
  monthRevenue: number;
  allRevenue: number;
}

export default function UserDashboard() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUserData = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data.user) {
            const endsAt = data.user.subscriptionEndsAt ? new Date(data.user.subscriptionEndsAt).getTime() : null;
            const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))) : null;
            setUser({
              ...data.user,
              daysRemaining: daysLeft,
            });

            // If admin, load metrics
            if (data.user.role === 'admin') {
              try {
                const statsRes = await fetch('/api/admin/dashboard-stats?asset=XAUUSD', { cache: 'no-store' });
                if (statsRes.ok) {
                  const statsData = await statsRes.json();
                  setAdminMetrics({
                    totalUsers: statsData.totalUsers || 0,
                    activeSubscribers: statsData.activeSubscribers || 0,
                    pendingPaymentsCount: statsData.cancelledPayments || 0, // Pending/Review
                    monthRevenue: statsData.monthRevenue || 0,
                    allRevenue: statsData.allRevenue || 0,
                  });
                }
              } catch {
                // Ignore stats load error
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user session:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUserData();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyReferral = () => {
    if (!user?.referralCode) return;
    const refUrl = `${window.location.origin}/?ref=${user.referralCode}`;
    navigator.clipboard.writeText(refUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center font-mono text-sm text-neutral-500 animate-pulse">
          กำลังโหลดข้อมูลระบบ...
        </div>
      </div>
    );
  }

  const telegramLink = user?.telegramVipLink || 'https://t.me/+GoldAISignalVIP';
  const lineLink = user?.lineVipLink || 'https://line.me/R/ti/p/@413aryiz';
  const isVipActive = user?.role === 'admin' || user?.subscriptionStatus === 'active';

  // =========================================================================
  // VIEW 1: ADMIN EXECUTIVE DASHBOARD
  // =========================================================================
  if (user?.role === 'admin') {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Back-Office Administrator
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">
              ระบบบริหารจัดการหลังบ้าน (Gold AI Signal)
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              ควบคุมดูแลสมาชิก ตรวจสอบการชำระเงิน และบรอดแคสต์สัญญาณเข้า Telegram & LINE
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/broadcast"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
            >
              <Send className="h-4 w-4" /> บรอดแคสต์สัญญาณด่วน
            </Link>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/80 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
            >
              <Settings className="h-4 w-4" /> ตั้งค่าระบบ
            </Link>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-medium uppercase tracking-wider">สมาชิกทั้งหมด</span>
              <Users className="h-5 w-5 text-amber-400" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold text-neutral-100">
              {adminMetrics?.totalUsers ?? '-'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">บัญชีที่ลงทะเบียนในระบบ</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-medium uppercase tracking-wider">สมาชิก VIP Active</span>
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold text-emerald-400">
              {adminMetrics?.activeSubscribers ?? '-'}
            </p>
            <p className="mt-1 text-xs text-emerald-500/80">สมาชิกที่รับสัญญาณในกลุ่ม</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-medium uppercase tracking-wider">รายได้เดือนนี้</span>
              <TrendingUp className="h-5 w-5 text-sky-400" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold text-neutral-100">
              {adminMetrics?.monthRevenue ? formatBaht(adminMetrics.monthRevenue) : '0 บาท'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">ยอดชำระที่อนุมัติแล้ว</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-medium uppercase tracking-wider">ตรวจสอบสลิป</span>
              <CreditCard className="h-5 w-5 text-amber-400" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold text-neutral-100">
              {adminMetrics?.pendingPaymentsCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              <Link href="/admin/payments" className="text-amber-400 hover:underline">
                เปิดหน้าตรวจสลิป &rarr;
              </Link>
            </p>
          </div>
        </div>

        {/* Admin Navigation Hub Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Link
            href="/admin/users"
            className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition hover:border-amber-500/40 hover:bg-neutral-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-neutral-100 group-hover:text-amber-400 transition">
              จัดการสมาชิก (Members Management)
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              ดูรายชื่อสมาชิก เพิ่ม/ลดวันใช้งาน ปรับสถานะ VIP และจัดการสิทธิ์ผู้ใช้งานทั้งหมด
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
              เข้าสู่เมนูจัดการ &rarr;
            </span>
          </Link>

          <Link
            href="/admin/payments"
            className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition hover:border-emerald-500/40 hover:bg-neutral-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-neutral-100 group-hover:text-emerald-400 transition">
              ตรวจสอบสลิปโอนเงิน (Payments & Slips)
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              ตรวจสลิปการชำระเงินของสมาชิก กดอนุมัติเปิดสิทธิ์ใช้งาน VIP อัตโนมัติ
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
              เปิดตรวจสลิป &rarr;
            </span>
          </Link>

          <Link
            href="/admin/broadcast"
            className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition hover:border-sky-500/40 hover:bg-neutral-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition">
              <Send className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-neutral-100 group-hover:text-sky-400 transition">
              บรอดแคสต์สัญญาณ (Signal Broadcast)
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              ส่งแผนเทรดทองคำด่วน หรือประกาศสำคัญไปยังกลุ่ม Telegram VIP และ LINE สมาชิกทุกคน
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-400">
              เปิดหน้าส่งสัญญาณ &rarr;
            </span>
          </Link>
        </div>

        {/* Secondary Links */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/admin/affiliate-manager"
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
          >
            <span className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 text-amber-400" /> จัดการระบบ Affiliate (คอมมิชชั่น 35%)
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </Link>

          <Link
            href="/admin/settings"
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
          >
            <span className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-sky-400" /> ตั้งค่าลิงก์กลุ่ม VIP & บัญชีธนาคาร
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </Link>

          <Link
            href="/admin/profile"
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
          >
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-neutral-400" /> ข้อมูลบัญชีของฉัน (Profile)
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </Link>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: REGULAR VIP MEMBER HUB
  // =========================================================================
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900/80 to-[#121820] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> สมาชิก VIP Signal
              </span>
              {user?.daysRemaining !== null && user?.daysRemaining !== undefined && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono font-medium text-amber-400">
                  คงเหลือ {user.daysRemaining} วัน
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">
              ยินดีต้อนรับ, {user?.displayName || user?.email}
            </h1>
            <p className="mt-1 text-sm leading-6 text-neutral-400">
              สัญญาณเทรดทองคำสดส่งตรงเข้ามือถือของคุณผ่าน Telegram VIP & LINE Group ทันทีที่มีจังหวะเข้าทำกำไร
            </p>
          </div>

          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
          >
            <CreditCard className="h-4 w-4" /> ต่ออายุสมาชิก VIP
          </Link>
        </div>
      </div>

      {/* HIGHLIGHT: VIP COMMUNITY ACCESS BUTTONS */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-200">
          <Sparkles className="h-5 w-5 text-amber-400" />
          ช่องทางรับสัญญาณเทรดสดบนมือถือ (VIP Access)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Telegram VIP Card */}
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-6 transition hover:border-sky-500/50 hover:bg-sky-500/10">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
                <Send className="h-6 w-6" />
              </div>
              <span className="rounded-md border border-sky-500/30 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                แนะนำ · สัญญาณไวที่สุด
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-neutral-100">กลุ่ม VIP Telegram</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              รับสัญญาณเข้าออเดอร์ทองคำ Real-time พร้อมจุด Entry, SL, TP1, TP2 และเหตุผลวิเคราะห์จาก AI
            </p>
            <a
              href={telegramLink}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-md transition hover:bg-sky-400"
            >
              <Send className="h-4 w-4" /> กดเข้าร่วมกลุ่ม Telegram VIP <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* LINE VIP Card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 transition hover:border-emerald-500/50 hover:bg-emerald-500/10">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#06C755] text-white shadow-lg shadow-emerald-500/20">
                <MessageSquare className="h-6 w-6" />
              </div>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                LINE Official & Group
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-neutral-100">กลุ่ม VIP LINE</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              รับการแจ้งเตือนสรุปแผนประจำวัน และติดต่อสอบถามทีมงานดูแลสมาชิกแบบตัวต่อตัว
            </p>
            <a
              href={lineLink}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 text-sm font-semibold text-white shadow-md transition hover:bg-[#05b34c]"
            >
              <MessageSquare className="h-4 w-4" /> กดเข้าร่วมกลุ่ม LINE VIP <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* HOW TO SETUP MOBILE NOTIFICATIONS */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8">
        <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-100">
          <Smartphone className="h-5 w-5 text-amber-400" />
          วิธีตั้งค่าบนมือถือเพื่อให้ไม่พลาดทุกสัญญาณทองคำ
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="font-mono text-xs font-bold text-amber-400">ขั้นตอนที่ 1</span>
            <h4 className="mt-2 text-sm font-semibold text-neutral-200">เข้าร่วมกลุ่ม Telegram</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              กดปุ่มด้านบนเพื่อเข้าร่วมกลุ่ม VIP Telegram สัญญาณจะส่งเข้าที่นี่เป็นหลัก
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="font-mono text-xs font-bold text-amber-400">ขั้นตอนที่ 2</span>
            <h4 className="mt-2 text-sm font-semibold text-neutral-200">เปิดแจ้งเตือนแบบมีเสียง</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              กด Unmute กลุ่ม และเปิดการแจ้งเตือน Notification ในมือถือให้ส่งเสียงเตือนทันที
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="font-mono text-xs font-bold text-amber-400">ขั้นตอนที่ 3</span>
            <h4 className="mt-2 text-sm font-semibold text-neutral-200">เปิดแอปเทรดวางแผน</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              เมื่อมีข้อความแจ้งเตือน เปิด MT5/Exness วางคำสั่งตาม Entry, SL, TP ได้ทันที
            </p>
          </div>
        </div>
      </div>

      {/* AFFILIATE REFERRAL SECTION */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Wallet className="h-3.5 w-3.5" /> Affiliate Program · ค่าคอมมิชชั่น 35%
            </span>
            <h3 className="mt-2 text-xl font-bold text-neutral-100">
              ชวนเพื่อนรับสัญญาณทองคำ รับค่าคอม 35% ทุกยอดชำระ
            </h3>
            <p className="mt-2 text-xs leading-5 text-neutral-300">
              แชร์ลิงก์แนะนำเพื่อนของคุณ เมื่อเพื่อนสมัครและชำระค่าสมาชิก VIP คุณจะได้รับค่าคอมมิชชั่น 35% ทันที
            </p>
          </div>

          {user?.referralCode ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <button
                type="button"
                onClick={handleCopyReferral}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
              >
                {copiedLink ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'คัดลอกลิงก์สำเร็จแล้ว!' : 'คัดลอกลิงก์แนะนำเพื่อน'}
              </button>
              <Link
                href="/admin/affiliate"
                className="text-center text-xs font-medium text-amber-400 hover:underline"
              >
                ดูรายงานยอดรายได้แนะนำเพื่อน &rarr;
              </Link>
            </div>
          ) : (
            <Link
              href="/admin/affiliate"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
            >
              เปิดใช้งานระบบแนะนำเพื่อน
            </Link>
          )}
        </div>
      </div>

      {/* QUICK LINKS GRID */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/billing"
          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
        >
          <span className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-amber-400" /> ประวัติการชำระเงิน & ใบเสร็จ
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        </Link>

        <Link
          href="/admin/profile"
          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
        >
          <span className="flex items-center gap-2.5">
            <Settings className="h-4 w-4 text-sky-400" /> ข้อมูลบัญชี & รหัสผ่าน
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        </Link>

        <Link
          href="/admin/support"
          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-100"
        >
          <span className="flex items-center gap-2.5">
            <HelpCircle className="h-4 w-4 text-emerald-400" /> ติดต่อฝ่ายบริการลูกค้า
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        </Link>
      </div>
    </div>
  );
}
