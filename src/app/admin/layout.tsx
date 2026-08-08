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
  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
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

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 font-black">
                GA
              </div>
              <div>
                <p className="truncate text-sm font-bold text-neutral-100">Gold AI Signal</p>
                <p className="text-[10px] text-amber-400/80 font-mono">XAUUSD Live Scalp Engine</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${price.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-sm font-bold tabular-nums text-neutral-100">{formatPrice(price.price)}</span>
              </div>
              <p className="text-[11px] text-neutral-400">GOLD# · {price.isLive ? 'LIVE' : 'DELAYED'}</p>
            </div>
            <div className="hidden border-l border-neutral-800 pl-5 sm:block">
              <p className="max-w-48 truncate text-sm text-neutral-300">{user?.email}</p>
              <p className="text-xs text-neutral-500">{user?.role === 'admin' ? 'ผู้ดูแลระบบ' : daysRemaining === null ? 'สมาชิก' : `เหลือ ${daysRemaining} วัน`}</p>
            </div>
            <button
              type="button"
              onClick={() => setFooterMenuOpen(!footerMenuOpen)}
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">เมนูระบบเพิ่มเติม</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Width Content (No 64px sidebar offset!) */}
      <main className="w-full pb-24 p-4 lg:p-6">{children}</main>

      {/* Collapsible Footer Drawer Drop Bar (Floating at Bottom) */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        {/* Footer Drawer Backdrop when Open */}
        {footerMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setFooterMenuOpen(false)}
          />
        )}

        {/* Collapsible Content Grid */}
        <div
          className={`relative border-t border-neutral-800/90 bg-neutral-950/95 backdrop-blur-md transition-all duration-300 ease-in-out shadow-[0_-8px_30px_rgba(0,0,0,0.8)] ${
            footerMenuOpen ? 'max-h-[85vh] overflow-y-auto p-5' : 'max-h-12 overflow-hidden px-4 py-2'
          }`}
        >
          {/* Header Toggle Line */}
          <button
            type="button"
            onClick={() => setFooterMenuOpen(!footerMenuOpen)}
            className="flex h-8 w-full items-center justify-between font-bold text-xs text-neutral-300 hover:text-amber-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>📂 เมนูระบบเพิ่มเติม (คลิกเพื่อ{footerMenuOpen ? 'ปิด' : 'เปิดดูเมนูทั้งหมด'})</span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 font-mono">
                {navItems.length} เมนู
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400 font-extrabold">
              <span>{footerMenuOpen ? 'ซ่อนเมนู ▲' : 'เปิดเมนู ▼'}</span>
            </div>
          </button>

          {/* Expanded Drawer Links Grid */}
          {footerMenuOpen && (
            <div className="mt-4 border-t border-neutral-800/80 pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {navItems.map((item) => {
                  const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setFooterMenuOpen(false)}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                        active
                          ? 'border-amber-400/60 bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'border-neutral-800/80 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100'
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-amber-400/20 text-amber-300' : 'bg-neutral-800 text-neutral-400'}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs font-bold text-rose-300 hover:bg-rose-900/40 transition-all"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                    <LogOut className="h-4 w-4 shrink-0" />
                  </div>
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
