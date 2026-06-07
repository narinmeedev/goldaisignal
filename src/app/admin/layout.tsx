'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Layers, 
  Terminal, 
  Activity, 
  BookOpen, 
  User, 
  LogOut, 
  Zap, 
  RefreshCw,
  Coins,
  Menu,
  X,
  Users,
  CreditCard,
  Settings,
  History,
  ShieldAlert,
  LifeBuoy
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [userEmail, setUserEmail] = useState<string>('');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [goldPrice, setGoldPrice] = useState(4450.0);
  const [goldBias, setGoldBias] = useState('NEUTRAL');
  const [btcPrice, setBtcPrice] = useState(68450.0);
  const [btcBias, setBtcBias] = useState('NEUTRAL');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  useEffect(() => {
    // Fetch session details
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {

          const data = await res.json();
          if (data.authenticated) {
            // Admins can bypass subscription check
            if (data.user.role !== 'admin' && data.user.subscriptionStatus !== 'active') {
              router.push('/pricing');
              return;
            }
            setUserRole(data.user.role);
            setUserEmail(data.user.email);
            
            if (data.user.role !== 'admin' && data.user.subscriptionEndsAt) {
              const endsAt = new Date(data.user.subscriptionEndsAt);
              const now = new Date();
              const diffTime = endsAt.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              setDaysRemaining(diffDays);
            }
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    checkSession();

    // Fetch maintenance mode
    const fetchMaintenanceStatus = async () => {
      try {
        const res = await fetch('/api/system/status');
        if (res.ok) {
          const data = await res.json();
          setIsMaintenanceMode(data.maintenanceMode);
        }
      } catch (err) {
        // Silent fail
      }
    };
    
    fetchMaintenanceStatus();

    // Fetch real-time gold and bitcoin prices from database logs periodically
    const fetchLatestPrice = async () => {
      try {
        const res = await fetch('/api/admin/latest-price');
        const data = await res.json();
        if (data) {
          if (data.XAUUSD?.price) {
            setGoldPrice(data.XAUUSD.price);
            setGoldBias(data.XAUUSD.bias || 'NEUTRAL');
          }
          if (data.BTCUSD?.price) {
            setBtcPrice(data.BTCUSD.price);
            setBtcBias(data.BTCUSD.bias || 'NEUTRAL');
          }
        }
      } catch {
        // fallback silently
      }
    };

    fetchLatestPrice();
    const interval = setInterval(fetchLatestPrice, 4000);

    return () => clearInterval(interval);
  }, [router]);

  const handleSeedCandles = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_candles' }),
      });
      const data = await res.json();
      if (data.success) {
        setSeedResult('จำลองแท่งเทียนและโซนสำเร็จ!');
        // Refresh page to load new values
        window.location.reload();
      } else {
        setSeedResult('ล้มเหลวในการจำลองแท่งเทียน');
      }
    } catch {
      setSeedResult('ระบบเน็ตเวิร์กเกิดข้อผิดพลาด');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error(error);
    }
    localStorage.removeItem('userRole');
    router.push('/login');
    router.refresh();
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  const navItems = [
    { name: 'แผงควบคุมหลัก', href: '/admin', icon: Activity, roles: ['admin', 'viewer'] },
    { name: 'โซนแนวรับ/แนวต้าน', href: '/admin/zones', icon: Layers, roles: ['admin', 'viewer'] },
    { name: 'ระบบแนะนำเพื่อน (Affiliate)', href: '/admin/affiliate', icon: Coins, roles: ['admin', 'viewer'] },
    { name: 'ประวัติการชำระเงิน/บิล', href: '/admin/billing', icon: CreditCard, roles: ['admin', 'viewer'] },
    { name: 'ช่วยเหลือ/แจ้งปัญหา', href: '/admin/support', icon: LifeBuoy, roles: ['admin', 'viewer'] },
    { name: 'ระบบผู้ใช้งาน', href: '/admin/users', icon: Users, roles: ['admin'] },
    { name: 'การชำระเงิน', href: '/admin/payments', icon: CreditCard, roles: ['admin'] },
    { name: 'จัดการ Affiliate', href: '/admin/affiliate-manager', icon: Users, roles: ['admin'] },
    { name: 'ประวัติระบบ (Logs)', href: '/admin/logs', icon: History, roles: ['admin'] },
    { name: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings, roles: ['admin'] },
  ];


  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100 font-sans w-full overflow-x-hidden">
      {/* Maintenance Fullscreen Overlay for Non-Admins */}
      {isMaintenanceMode && !isAuthLoading && userRole !== 'admin' && (
        <div className="fixed inset-0 z-[9999] bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900/95 border border-neutral-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500"></div>
            
            <div className="mx-auto h-16 w-16 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-2xl flex items-center justify-center">
              <Settings className="h-8 w-8 text-rose-500 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-neutral-100">ขออภัย ระบบอยู่ระหว่างปรับปรุง</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                ขณะนี้อยู่ในช่วงปรับปรุงระบบวิเคราะห์และสัญญาณเทรดทองคำ <br />
                เพื่อความปลอดภัย โปรดงดการคัดลอกแผนหรือนำสัญญาณไปใช้งานชั่วคราว
              </p>
            </div>

            <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-left space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <p className="text-xs text-neutral-300">งดการซิงค์ข้อมูลและหยุดส่งสัญญาณชั่วคราวจากเซิร์ฟเวอร์หลัก</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p className="text-xs text-neutral-300">ระบบวิเคราะห์จะกลับมาทำงานปกติทันทีเมื่อเสร็จสิ้นการปรับปรุง</p>
              </div>
            </div>

            <div className="pt-2 text-xs text-neutral-500">
              ติดต่อแอดมินหรือรอรับการแจ้งเตือนเมื่อระบบเปิดให้บริการปกติอีกครั้ง
            </div>
          </div>
        </div>
      )}

      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col justify-between 
        bg-neutral-950/95 lg:bg-neutral-950/80 backdrop-blur-md border-r border-neutral-900 
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          {/* Logo / Brand header */}
          <div className="p-6 flex items-center justify-between lg:justify-start gap-3 border-b border-neutral-900">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10 shrink-0">
                <Coins className="h-5 w-5 text-amber-500 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent truncate block">GOLD AI SIGNAL LAB</span>
                <p className="text-[10px] text-amber-500 font-mono tracking-widest uppercase">ห้องควบคุมระบบ</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={closeSidebar}
              className="lg:hidden p-2 text-neutral-400 hover:text-white rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.filter(item => item.roles.includes(userRole)).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner'
                      : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Sidebar Footer */}
        <div className="p-4 border-t border-neutral-900 bg-neutral-950/50 space-y-3">
          {/* Active status */}
          <div className="px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              สมองกลทำงานอยู่
            </span>
            <span className="text-[9px] text-neutral-500 font-mono">M15/H1/H4</span>
          </div>

          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800">
                <User className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-200 truncate w-28">{userEmail || 'กำลังโหลด...'}</p>
                <p className="text-[9px] text-neutral-500 uppercase">{userRole}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full overflow-x-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-neutral-950 bg-neutral-950/90 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20 w-full overflow-hidden">
          <div className="flex items-center gap-3 lg:gap-8 min-w-0 overflow-hidden">
            {/* Hamburger Menu Toggle (Mobile) */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Price Tickers Container */}
            <div className="flex items-center gap-2 lg:gap-8 overflow-x-auto hide-scrollbar whitespace-nowrap">
              {/* Gold Live Price Ticker */}
              <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">ทองคำ XAUUSD:</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/5 border border-amber-500/15 rounded-full shadow-inner">
                <span className="text-xs font-mono font-bold text-amber-400">${goldPrice.toFixed(2)}</span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center">
                  ▲ +0.14%
                </span>
              </div>
            </div>

              {/* Bitcoin Live Price Ticker */}
              <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">บิตคอยน์ BTCUSD:</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/5 border border-amber-500/15 rounded-full shadow-inner">
                <span className="text-xs font-mono font-bold text-amber-400">${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center">
                  ▲ +1.82%
                </span>
              </div>
            </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            {seedResult && (
              <span className="text-xs font-medium text-emerald-400 font-mono animate-fade-in">
                {seedResult}
              </span>
            )}
            {userRole === 'admin' && (
              <button
                onClick={handleSeedCandles}
                disabled={isSeeding}
                className="flex items-center justify-center gap-2 px-3 py-2 lg:px-4 lg:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-xs font-bold text-black transition-all shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSeeding ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">{isSeeding ? 'กำลังประมวลผลโซน...' : 'รีเซ็ตและสร้างแท่งเทียนทดสอบ'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Pages Root */}
        <main className="flex-1 p-4 lg:p-8 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 overflow-x-hidden w-full">
          {isMaintenanceMode && (
            <div className="mb-6 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
              <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-rose-400">🛠️ แจ้งปรับปรุงเซิร์ฟเวอร์ / อัปเดตระบบ</h4>
                <p className="text-xs text-rose-200 mt-0.5">ท่านอาจไม่ได้รับสัญญาณชั่วคราว โปรดเทรดด้วยความระมัดระวัง</p>
              </div>
            </div>
          )}

          {daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0 && (
            <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-500 animate-pulse" />
                <p className="text-sm text-amber-100">
                  แพ็กเกจของคุณจะหมดอายุในอีก <span className="font-bold text-amber-500">{daysRemaining} วัน</span> กรุณาต่ออายุเพื่อรับสัญญาณการลงทุนอย่างต่อเนื่อง
                </p>
              </div>
              <Link href="/checkout" className="shrink-0 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg transition-colors">
                ต่ออายุตอนนี้
              </Link>
            </div>
          )}

          {isAuthLoading ? (
            <div className="flex items-center justify-center h-full text-neutral-500 font-mono animate-pulse">Authenticating...</div>
          ) : (
            children
          )}
        </main>

        {/* Sticky Footer Menu for Mobile Market Bias */}
        <div className="lg:hidden sticky bottom-0 z-40 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-900 px-4 py-3 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase">XAUUSD Live</span>
            <span className="text-sm font-bold text-amber-400 font-mono">${goldPrice.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase">Bias Status</span>
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
              goldBias === 'BULLISH'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : goldBias === 'BEARISH'
                ? 'bg-rose-500/10 text-rose-450 border-rose-500/20'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}>
              {goldBias === 'BULLISH' ? 'มองขึ้น (BUY)' : goldBias === 'BEARISH' ? 'มองลง (SELL)' : 'ไซด์เวย์'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
