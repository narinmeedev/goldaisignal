import Link from 'next/link';
import { ArrowRight, LayoutDashboard, LogIn, MessageCircle } from 'lucide-react';
import { TRIAL_DURATION_DAYS } from '@/lib/billing';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ga-border/90 bg-ga-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-gold">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-ga-gold/35 bg-ga-gold/10 font-mono text-lg font-black text-ga-gold shadow-[0_0_24px_rgba(227,181,45,0.08)]">
            GA
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
          <Link href="/pricing" className="public-nav-link">แพ็กเกจ</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 font-mono text-[10px] text-emerald-400 xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> MT5 DATA LIVE
          </span>
          <Link href="/login" aria-label="เข้าสู่ระบบ" title="เข้าสู่ระบบ" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-gold">
            <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">เข้าสู่ระบบ</span>
          </Link>
          <Link href="/pricing" className="public-button-primary min-h-11 px-4 text-sm">
            ทดลอง {TRIAL_DURATION_DAYS} วัน <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ga-border bg-[#0a1017]">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-black text-ga-gold">GA</span>
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
