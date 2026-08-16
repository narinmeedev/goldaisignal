'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LayoutDashboard, LogIn, Menu, MessageCircle, X } from 'lucide-react';
import { TRIAL_DURATION_DAYS } from '@/lib/billing';

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ga-border/90 bg-ga-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-gold">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-ga-gold/35 bg-ga-canvas shadow-[0_0_24px_rgba(227,181,45,0.08)]">
            <Image src="/brand/ga-mark-flat.svg" alt="" width={34} height={34} priority />
          </span>
          <span className="hidden sm:block">
            <strong className="block text-[15px] font-semibold tracking-tight text-ga-text">Gold AI Signal</strong>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ga-muted">XAUUSD Decision Support</span>
          </span>
        </Link>

        <div className="hidden h-7 w-px bg-ga-border lg:block" />
        <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 lg:flex">
          <Link href="/#overview" className="public-nav-link">ภาพรวม</Link>
          <Link href="/#features" className="public-nav-link">ระบบวิเคราะห์</Link>
          <Link href="/#workflow" className="public-nav-link">วิธีทำงาน</Link>
          <Link href="/#gold-trading-guide" className="public-nav-link">คู่มือเทรดทอง</Link>
          <Link href="/pricing" className="public-nav-link">แพ็กเกจ</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 font-mono text-[10px] text-emerald-400 xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> MT5 DATA LIVE
          </span>
          <Link href="/login" aria-label="เข้าสู่ระบบ" title="เข้าสู่ระบบ" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-gold">
            <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">เข้าสู่ระบบ</span>
          </Link>
          <Link href="/checkout" className="public-button-primary min-h-11 px-4 text-sm">
            ทดลองฟรี {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-ga-border bg-ga-surface text-ga-muted transition-colors hover:bg-ga-elevated hover:text-ga-text lg:hidden"
            aria-label="เปิดเมนู"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-ga-border bg-ga-canvas px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2 font-medium">
            <Link href="/#overview" onClick={closeMenu} className="public-nav-link w-full py-2.5">ภาพรวม</Link>
            <Link href="/#features" onClick={closeMenu} className="public-nav-link w-full py-2.5">ระบบวิเคราะห์</Link>
            <Link href="/#workflow" onClick={closeMenu} className="public-nav-link w-full py-2.5">วิธีทำงาน</Link>
            <Link href="/#gold-trading-guide" onClick={closeMenu} className="public-nav-link w-full py-2.5">คู่มือเทรดทอง</Link>
            <Link href="/pricing" onClick={closeMenu} className="public-nav-link w-full py-2.5">แพ็กเกจราคา</Link>
            <div className="my-2 border-t border-ga-border" />
            <Link href="/login" onClick={closeMenu} className="flex min-h-11 items-center gap-2 rounded-lg bg-ga-surface px-4 text-sm font-medium text-ga-text">
              <LogIn className="h-4 w-4" /> เข้าสู่ระบบ
            </Link>
            <Link href="/checkout" onClick={closeMenu} className="public-button-primary min-h-11 px-4 text-sm">
              สมัครทดลองใช้ฟรี {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ga-border bg-[#0a1017]">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <Image src="/brand/ga-mark-flat.svg" alt="" width={24} height={24} />
            <strong className="text-sm font-semibold text-ga-text">Gold AI Signal</strong>
          </div>
          <p className="mt-3 text-sm leading-6 text-ga-muted">
            เครื่องมือช่วยวิเคราะห์ทางเทคนิคและจัดโครงสร้างแผนเทรด ไม่ใช่คำรับรองผลตอบแทน การเทรดทองคำมีความเสี่ยง ผู้ใช้ควรกำหนดขนาดความเสี่ยงและ Stop Loss ก่อนตัดสินใจทุกครั้ง
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 md:justify-end">
          <Link href="/admin" className="public-button-secondary min-h-11 px-4 text-sm"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>
          <a href="https://line.me/R/ti/p/@413aryiz" target="_blank" rel="noreferrer" className="public-button-secondary min-h-11 px-4 text-sm"><MessageCircle className="h-4 w-4" /> ติดต่อทีมงาน</a>
        </div>
      </div>
    </footer>
  );
}

export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-theme min-h-screen bg-ga-canvas text-ga-text">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
