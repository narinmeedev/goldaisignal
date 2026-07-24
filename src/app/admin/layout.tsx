'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CreditCard,
  History,
  Layers3,
  LifeBuoy,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldAlert,
  User,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

interface SessionUser {
  role: 'admin' | 'viewer';
  email: string;
  isAffiliate?: boolean;
  subscriptionPlan?: string;
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [price, setPrice] = useState<PriceState>({ price: null, bias: 'NEUTRAL', isLive: false, updatedAt: null });

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
        // The customer dashboard independently shows market-data degradation.
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

  const daysRemaining = user?.daysRemaining ?? null;

  const navItems = useMemo(() => {
    const customer = [
      { label: 'แผนเทรดทองคำ', href: '/admin', icon: Activity },
      { label: 'ประวัติแผน', href: '/admin/trades', icon: History },
      { label: 'ช่วยเหลือ', href: '/admin/support', icon: LifeBuoy },
      { label: 'การชำระเงิน', href: '/admin/billing', icon: CreditCard },
      { label: 'บัญชีของฉัน', href: '/admin/profile', icon: User },
    ];
    if (user?.isAffiliate) {
      customer.splice(2, 0, { label: 'รายได้แนะนำเพื่อน', href: '/admin/affiliate', icon: WalletCards });
    }
    if (user?.role !== 'admin') return customer;

    // For Admin: keep the detailed zones, performance, and management menus
    return [
      customer[0], // แผนเทรดทองคำ
      { label: 'แนวรับและแนวต้าน', href: '/admin/zones', icon: Layers3 },
      { label: 'ผลวัดประสิทธิภาพ', href: '/admin/performance', icon: BarChart3 },
      ...customer.slice(1),
      { label: 'จัดการผู้ใช้', href: '/admin/users', icon: Users },
      { label: 'ตรวจสอบการชำระเงิน', href: '/admin/payments', icon: CreditCard },
      { label: 'จัดการ Affiliate', href: '/admin/affiliate-manager', icon: WalletCards },
      { label: 'บันทึกระบบ', href: '/admin/logs', icon: History },
      { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
    ];
  }, [user?.isAffiliate, user?.role]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">กำลังตรวจสอบบัญชี</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {maintenanceMode && user?.role !== 'admin' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 p-5">
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-neutral-900 p-6 text-center">
            <ShieldAlert className="mx-auto h-9 w-9 text-amber-400" />
            <h2 className="mt-4 text-xl font-bold">ระบบอยู่ระหว่างตรวจสอบ</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">ทีมงานปิดการใช้งานแผนชั่วคราวเพื่อป้องกันการนำข้อมูลที่ยังไม่สมบูรณ์ไปเทรด กรุณากลับมาใหม่เมื่อการตรวจสอบเสร็จสิ้น</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 lg:hidden" aria-label="เปิดเมนู">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="min-w-0">
              <p className="truncate text-sm font-bold text-neutral-100">Gold AI Signal</p>
              <p className="text-xs text-neutral-500">XAUUSD Service</p>
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${price.isLive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-sm font-bold tabular-nums text-neutral-100">{formatPrice(price.price)}</span>
              </div>
              <p className="text-xs text-neutral-500">XAUUSD · {price.isLive ? 'LIVE' : 'DELAYED'}</p>
            </div>
            <div className="hidden border-l border-neutral-800 pl-5 sm:block">
              <p className="max-w-48 truncate text-sm text-neutral-300">{user?.email}</p>
              <p className="text-xs text-neutral-500">{user?.role === 'admin' ? 'ผู้ดูแลระบบ' : daysRemaining === null ? 'สมาชิก' : `เหลือ ${daysRemaining} วัน`}</p>
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-neutral-800 bg-neutral-950 lg:flex lg:flex-col">
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}>
                <Icon className="h-4 w-4 shrink-0" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-neutral-800 p-3">
          <button type="button" onClick={logout} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-rose-300">
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-neutral-800 bg-neutral-950">
            <div className="flex h-16 items-center justify-between border-b border-neutral-800 px-4">
              <span className="font-bold">Gold AI Signal</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800" aria-label="ปิดเมนู"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => {
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-300'}`}><Icon className="h-5 w-5" />{item.label}</Link>;
              })}
            </nav>
            <div className="border-t border-neutral-800 p-3"><button type="button" onClick={logout} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-rose-300"><LogOut className="h-5 w-5" />ออกจากระบบ</button></div>
          </aside>
        </div>
      )}

      <div className="pb-20 lg:ml-64 lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-neutral-800/80 bg-neutral-950 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <Link href="/admin#active-plan" className={`flex flex-col items-center gap-1 text-[11px] px-3 py-1 rounded-lg transition-colors ${pathname === '/admin' ? 'text-amber-300 bg-amber-500/10 font-bold' : 'text-neutral-500'}`}>
          <Activity className="h-5 w-5" />
          <span>แผนเทรด</span>
        </Link>

        <div className="flex items-center gap-3.5 text-xs pr-1">
          {/* Connection status circle & Bias */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {price.isLive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" title="MT5 LIVE"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" title="MT5 OFFLINE"></span>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] text-neutral-500 font-bold uppercase tracking-wider">มุมมอง:</span>
              <span className={`font-black text-[17px] leading-none px-2 py-0.5 rounded border transition-colors ${
                price.bias === 'BULLISH' || price.bias === 'BUY'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : price.bias === 'BEARISH' || price.bias === 'SELL'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
              }`}>
                {price.bias === 'BULLISH' || price.bias === 'BUY'
                  ? 'ขาขึ้น'
                  : price.bias === 'BEARISH' || price.bias === 'SELL'
                    ? 'ขาลง'
                    : price.bias === 'WAIT_AND_SEE'
                      ? 'รอดู'
                      : 'เป็นกลาง'}
              </span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-neutral-800" />

          {/* Refresh Button */}
          <button 
            type="button"
            onClick={() => window.location.reload()} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs font-semibold text-neutral-200 active:bg-neutral-800 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>อัปเดต</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
