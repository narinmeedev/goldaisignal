'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CreditCard,
  History,
  Layers3,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Sparkles,
  User,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

interface SessionUser {
  role: 'admin' | 'viewer';
  email: string;
  isAffiliate?: boolean;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string | null;
  daysRemaining?: number | null;
}

interface PriceState {
  price: number | null;
  bias: string;
  isLive: boolean;
  updatedAt: string | null;
}

const formatPrice = (price: number | null) => {
  if (price === null || !Number.isFinite(price)) return 'รอข้อมูล';
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUpdateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [price, setPrice] = useState<PriceState>({ price: null, bias: 'NEUTRAL', isLive: false, updatedAt: null });
  const [isQwenAnalyzing, setIsQwenAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (!active) return;
        if (!data?.authenticated) {
          router.replace('/login');
          return;
        }
        if (data.user.role !== 'admin' && data.user.subscriptionStatus !== 'active') {
          router.replace('/pricing');
          return;
        }
        const endsAt = data.user.subscriptionEndsAt ? new Date(data.user.subscriptionEndsAt).getTime() : null;
        setUser({
          ...data.user,
          daysRemaining: endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 86_400_000)) : null,
        });
      } catch {
        if (active) router.replace('/login');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    loadSession();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/system/status', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (active) setMaintenanceMode(Boolean(data?.maintenanceMode));
      } catch {
        // The dashboard shows live-feed degradation independently.
      }
    };
    loadStatus();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPrice = async () => {
      try {
        const response = await fetch('/api/admin/latest-price', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (!active || !data?.XAUUSD) return;
        setPrice({
          price: typeof data.XAUUSD.price === 'number' ? data.XAUUSD.price : null,
          bias: data.XAUUSD.bias || 'NEUTRAL',
          isLive: Boolean(data.XAUUSD.isLive),
          updatedAt: data.XAUUSD.updatedAt || null,
        });
      } catch {
        if (active) setPrice((current) => ({ ...current, isLive: false }));
      }
    };
    loadPrice();
    const timer = window.setInterval(loadPrice, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const navItems = useMemo(() => {
    const customer = [
      { label: 'ภาพรวม', href: '/admin', icon: Activity },
      { label: 'แผนเทรด', href: '/admin#active-plan', icon: BarChart3 },
      { label: 'ประวัติ', href: '/admin/trades', icon: History },
      { label: 'ช่วยเหลือ', href: '/admin/support', icon: LifeBuoy },
    ];
    return customer;
  }, []);

  const moreItems = useMemo(() => {
    const customer = [
      { label: 'การชำระเงิน', href: '/admin/billing', icon: CreditCard },
      { label: 'บัญชีของฉัน', href: '/admin/profile', icon: User },
    ];
    if (user?.isAffiliate) customer.unshift({ label: 'รายได้แนะนำเพื่อน', href: '/admin/affiliate', icon: WalletCards });
    if (user?.role !== 'admin') return customer;
    return [
      { label: 'แนวรับและแนวต้าน', href: '/admin/zones', icon: Layers3 },
      { label: 'ผลวัดประสิทธิภาพ', href: '/admin/performance', icon: BarChart3 },
      ...customer,
      { label: 'จัดการผู้ใช้', href: '/admin/users', icon: Users },
      { label: 'ตรวจสอบการชำระเงิน', href: '/admin/payments', icon: CreditCard },
      { label: 'จัดการ Affiliate', href: '/admin/affiliate-manager', icon: WalletCards },
      { label: 'บันทึกระบบ', href: '/admin/logs', icon: History },
      { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
    ];
  }, [user?.isAffiliate, user?.role]);

  const isActive = (href: string, label: string) => {
    if (href === '/admin') return pathname === '/admin';
    if (label === 'แผนเทรด') return false;
    return pathname.startsWith(href);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  const syncPrice = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/admin/candles/sync', { cache: 'no-store' });
      const response = await fetch('/api/admin/latest-price', { cache: 'no-store' });
      const data = response.ok ? await response.json() : null;
      if (data?.XAUUSD) {
        setPrice({
          price: typeof data.XAUUSD.price === 'number' ? data.XAUUSD.price : null,
          bias: data.XAUUSD.bias || 'NEUTRAL',
          isLive: Boolean(data.XAUUSD.isLive),
          updatedAt: data.XAUUSD.updatedAt || null,
        });
      }
      router.refresh();
    } finally {
      setIsSyncing(false);
    }
  };

  const runQwen = async () => {
    setIsQwenAnalyzing(true);
    try {
      await fetch('/api/admin/qwen-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'GOLD#' }),
      });
      window.location.reload();
    } finally {
      setIsQwenAnalyzing(false);
    }
  };

  const resetStats = async () => {
    if (!confirm('ยืนยันการรีเซ็ตสถิติวัดผลทั้งหมดเพื่อเริ่มนับใหม่?')) return;
    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/trades', { method: 'DELETE' });
      if (response.ok) window.location.reload();
    } finally {
      setIsResetting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0e14] text-[14px] text-[#929ca8]">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-amber-400" /> กำลังตรวจสอบบัญชี
      </div>
    );
  }

  const daysRemaining = user?.daysRemaining ?? null;

  return (
    <div className="admin-shell min-h-screen bg-[#0b0e14] text-[#f4f6f8]">
      {maintenanceMode && user?.role !== 'admin' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0e14] p-5">
          <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-[#111820] p-6 text-center">
            <Settings className="mx-auto h-8 w-8 text-amber-400" />
            <h2 className="mt-4 text-[20px] font-semibold">ระบบอยู่ระหว่างตรวจสอบ</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#9ba5b0]">ทีมงานปิดการใช้งานแผนชั่วคราวเพื่อป้องกันการนำข้อมูลที่ยังไม่สมบูรณ์ไปเทรด</p>
          </div>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col border-r border-[#252e38] bg-[#0c1219] lg:flex">
        <Link href="/admin" aria-label="Gold AI Signal" className="flex h-[76px] items-center justify-center border-b border-[#252e38]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/60 bg-[#0b0e14]"><Image src="/brand/ga-mark-flat.svg" alt="" width={35} height={35} priority /></span>
        </Link>
        <nav className="flex flex-1 flex-col py-3" aria-label="เมนูหลัก">
          {navItems.map((item) => {
            const active = isActive(item.href, item.label);
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`relative flex min-h-[86px] flex-col items-center justify-center gap-2 px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${active ? 'bg-[#111923] text-amber-400 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber-400' : 'text-[#8f99a5] hover:bg-[#111923] hover:text-white'}`}>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-4">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#252e38] py-2">
          <button type="button" onClick={() => setAccountOpen((open) => !open)} className="flex min-h-[70px] w-full flex-col items-center justify-center gap-2 text-[#8f99a5] hover:bg-[#111923] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400">
            <Settings className="h-5 w-5" />
            <span className="text-[10px]">ตั้งค่า</span>
          </button>
          <button type="button" onClick={logout} className="flex min-h-[70px] w-full flex-col items-center justify-center gap-2 text-[#8f99a5] hover:bg-[#111923] hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400">
            <LogOut className="h-5 w-5" />
            <span className="text-[10px]">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 h-[76px] border-b border-[#252e38] bg-[#0b1118]/95 backdrop-blur lg:left-20">
        <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:gap-6">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2a3440] text-[#aab2bc] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="hidden text-[17px] font-semibold text-[#f4f6f8] sm:block">Gold AI Signal</Link>
            <span className="hidden h-8 w-px bg-[#2a3440] sm:block" />
            <div className="flex items-baseline gap-3">
              <span className="hidden font-mono text-[15px] font-medium text-[#e6eaee] md:inline">XAUUSD</span>
              <strong className="font-mono text-[22px] font-semibold tabular-nums text-amber-400">{formatPrice(price.price)}</strong>
              <span className="hidden text-[11px] text-[#9ba5b0] md:inline">USD</span>
            </div>
            <div className="hidden items-center gap-2 text-[12px] text-[#aeb6c0] xl:flex">
              <span className={`h-2 w-2 rounded-full ${price.isLive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              ข้อมูลสดจาก MT5
              <span className={`rounded px-2 py-1 font-mono text-[10px] ${price.isLive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{price.isLive ? 'LIVE' : 'DELAYED'}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <p className="hidden text-right text-[11px] leading-5 text-[#8f99a5] md:block">อัปเดต {formatUpdateTime(price.updatedAt)} น.</p>
            <button type="button" onClick={syncPrice} disabled={isSyncing} aria-label="ซิงค์ข้อมูลล่าสุด" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#9fa8b3] hover:bg-[#17202a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50">
              <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <span className="hidden h-8 w-px bg-[#2a3440] sm:block" />
            <button type="button" onClick={() => setAccountOpen((open) => !open)} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-left hover:bg-[#17202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#697482] text-[#cbd2d9]"><User className="h-4 w-4" /></span>
              <span className="hidden max-w-44 truncate text-[12px] text-[#cbd2d9] xl:block">{user?.email}</span>
            </button>
          </div>
        </div>
      </header>

      {accountOpen && (
        <div className="fixed right-4 top-[68px] z-[60] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#2b3540] bg-[#111820] shadow-2xl lg:right-6">
          <div className="border-b border-[#29323c] p-4">
            <p className="truncate text-[13px] font-medium text-[#eef1f4]">{user?.email}</p>
            <p className="mt-1 text-[11px] text-[#8f99a5]">{user?.role === 'admin' ? 'ผู้ดูแลระบบ' : daysRemaining === null ? 'สมาชิก' : `สมาชิก · เหลือ ${daysRemaining} วัน`}</p>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setAccountOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[12px] text-[#bdc5ce] hover:bg-[#19222c] hover:text-white"><Icon className="h-4 w-4 text-[#87929e]" />{item.label}</Link>;
            })}
            {user?.role === 'admin' && (
              <div className="mt-2 border-t border-[#29323c] pt-2">
                <button type="button" onClick={runQwen} disabled={isQwenAnalyzing} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-[#bdc5ce] hover:bg-[#19222c] hover:text-white disabled:opacity-50"><Sparkles className="h-4 w-4 text-amber-400" />วิเคราะห์แผนด้วย Qwen</button>
                <button type="button" onClick={resetStats} disabled={isResetting} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"><History className="h-4 w-4" />รีเซ็ตสถิติวัดผล</button>
              </div>
            )}
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/70" />
          <aside className="relative h-full w-[min(320px,86vw)] overflow-y-auto border-r border-[#29323c] bg-[#0c1219] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#29323c] pb-4">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/60 bg-[#0b0e14]"><Image src="/brand/ga-mark-flat.svg" alt="" width={32} height={32} /></span><span className="text-[16px] font-semibold">Gold AI Signal</span></div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#9ca6b1] hover:bg-[#19222c]"><X className="h-5 w-5" /></button>
            </div>
            <nav className="mt-4 space-y-1" aria-label="เมนูมือถือ">
              {[...navItems, ...moreItems].filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href && candidate.label === item.label) === index).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.label);
                return <Link key={`${item.label}-${item.href}`} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-[13px] ${active ? 'bg-amber-400/10 text-amber-400' : 'text-[#b8c0c9] hover:bg-[#19222c] hover:text-white'}`}><Icon className="h-5 w-5" />{item.label}</Link>;
              })}
            </nav>
            <button type="button" onClick={logout} className="mt-4 flex min-h-12 w-full items-center gap-3 border-t border-[#29323c] px-3 pt-4 text-[13px] text-rose-400"><LogOut className="h-5 w-5" />ออกจากระบบ</button>
          </aside>
        </div>
      )}

      <main className="min-h-screen px-3 pb-8 pt-[88px] sm:px-4 lg:pl-[96px] lg:pr-4 xl:px-5 xl:pb-10 xl:pl-[100px] xl:pt-[94px]">
        {children}
      </main>
    </div>
  );
}
