'use client';

import React from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  Target, 
  Brain, 
  Zap, 
  ShieldCheck, 
  ChevronRight,
  Activity,
  BarChart3,
  Crosshair,
  Lock,
  UserPlus,
  LogIn,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import LiveMarketPreview from '@/components/LiveMarketPreview';

export default function LandingPage() {
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/dashboard-stats?symbol=XAUUSD');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 pb-20 md:pb-0 w-full overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent leading-tight">GOLD AI SIGNAL</span>
              <span className="text-[8px] sm:text-[10px] tracking-widest text-amber-500/80 uppercase font-mono leading-tight mt-0.5">Intelligence Lab</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/login" className="text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors">
              เข้าสู่ระบบ
            </Link>
            <Link 
              href="/pricing" 
              className="px-3 py-2 sm:px-5 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:-translate-y-0.5"
            >
              ทดลองฟรี
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-20 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-amber-500/10 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-neutral-900/80 border border-neutral-800 mb-6 sm:mb-8 backdrop-blur-sm mx-auto">
            <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-xs font-mono text-neutral-300">ระบบ AI วิเคราะห์ตลาดทำงานแบบ Real-time 24/7</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 sm:mb-8 leading-tight">
            เทรดทองคำอย่างมั่นใจ <br className="hidden sm:block" />
            ด้วย <span className="bg-gradient-to-r from-amber-300 via-amber-500 to-orange-500 bg-clip-text text-transparent">สมองกลอัจฉริยะ</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed px-2">
            เลิกเดาทางตลาด! ให้ AI ช่วยวิเคราะห์แนวโน้ม สแกนโซนรับต้าน และวางแผนการเทรด (Entry, SL, TP) ให้คุณแบบอัตโนมัติ แม่นยำ และรู้ทันทุกความผันผวน
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Link 
              href="/pricing" 
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold rounded-2xl transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] hover:-translate-y-1 flex items-center justify-center gap-2 text-base sm:text-lg"
            >
              เริ่มต้นทดลองใช้งานฟรี <ChevronRight className="h-5 w-5" />
            </Link>
            <Link 
              href="#features" 
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-medium rounded-2xl transition-all flex items-center justify-center text-base sm:text-lg"
            >
              ดูฟีเจอร์ทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* Live Market Preview Section */}
      <section className="pb-16 sm:pb-24 relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <LiveMarketPreview stats={stats} loading={loading} />
        </div>
      </section>

      {/* Feature Showcase */}
      <section id="features" className="py-16 sm:py-24 bg-neutral-950 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">ฟีเจอร์ระดับโปร <br className="sm:hidden"/>ในราคาที่จับต้องได้</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg px-2">เครื่องมือวิเคราะห์ตลาดครบวงจร ที่ถูกออกแบบมาเพื่อนักเทรดทองคำโดยเฉพาะ</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Feature 1: Market Intelligence */}
            {(() => {
              const xauIntel = stats?.marketIntelligence?.XAUUSD;
              const goldBias = xauIntel?.bias || 'NEUTRAL';
              const goldTrendStrength = xauIntel?.trendStrength || 50;
              return (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 hover:border-amber-500/50 transition-colors group">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border ${
                    loading 
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-500' 
                      : goldBias === 'BULLISH' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : goldBias === 'BEARISH' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  }`}>
                    <Activity className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">ศูนย์วิเคราะห์ตลาด <br/><span className="text-sm font-mono text-neutral-500 font-normal">MARKET INTELLIGENCE</span></h3>
                  <p className="text-neutral-400 mb-8 leading-relaxed">
                    รู้ทิศทางตลาด (Directional Bias) ก่อนใคร พร้อมมาตรวัดความแรงเทรนด์ (Trend Strength) และประเมินความผันผวน (Volatility) แบบเรียลไทม์
                  </p>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-500">ทิศทางตลาด</span>
                      {loading ? (
                        <span className="text-xs text-neutral-500 animate-pulse font-mono">กำลังประมวลผล...</span>
                      ) : (
                        <span className={`font-bold font-sans text-xs ${
                          goldBias === 'BULLISH' 
                            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' 
                            : goldBias === 'BEARISH' 
                            ? 'text-rose-450 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                            : 'text-neutral-400'
                        }`}>
                          {goldBias === 'BULLISH' ? 'มองขึ้น (BULLISH)' : goldBias === 'BEARISH' ? 'มองลง (BEARISH)' : 'ไซด์เวย์ (NEUTRAL)'}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">ความแรงเทรนด์</span>
                        <span className="text-xs font-bold text-indigo-400">
                          {loading ? '...' : `${goldTrendStrength}%`}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-1.5">
                        <div 
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${loading ? 50 : goldTrendStrength}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Feature 2: Zone Radar */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 hover:border-amber-500/50 transition-colors group">
              <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Crosshair className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">เรดาร์สแกนโซน <br/><span className="text-sm font-mono text-neutral-500 font-normal">LIVE ZONE RADAR</span></h3>
              <p className="text-neutral-400 mb-8 leading-relaxed">
                สแกนหาแนวรับ-แนวต้านที่แข็งแกร่งที่สุด พร้อมบอกระยะห่างจากราคาปัจจุบัน ให้คุณรู้จุดเข้าทำกำไรที่ได้เปรียบที่สุด
              </p>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="text-[10px] text-rose-500 font-mono mb-2">แนวต้าน (SELL ZONES)</div>
                <div className="flex justify-between bg-rose-500/5 border border-rose-500/10 p-2 rounded-lg text-xs font-mono">
                  <span className="text-neutral-300">$4466.20 - $4467.20</span>
                  <span className="text-rose-400">+$13.95</span>
                </div>
                <div className="text-[10px] text-emerald-500 font-mono mt-4 mb-2">แนวรับ (BUY ZONES)</div>
                <div className="flex justify-between bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg text-xs font-mono">
                  <span className="text-neutral-300">$4447.06 - $4448.06</span>
                  <span className="text-emerald-400">-$4.19</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Proactive Strategies */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 hover:border-amber-500/50 transition-colors group">
              <div className="h-14 w-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Brain className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">แผนเทรดแนะนำ <br/><span className="text-sm font-mono text-neutral-500 font-normal">PROACTIVE STRATEGIES</span></h3>
              <p className="text-neutral-400 mb-8 leading-relaxed">
                AI คำนวณจุดเข้า (Entry), จุดตัดขาดทุน (SL), และจุดทำกำไร (TP) ให้เสร็จสรรพ พร้อมบอกเปอร์เซ็นต์ความมั่นใจในแต่ละแผน
              </p>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-1 bg-rose-500/20 text-rose-400 rounded">SELL_MARKET</span>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">ความมั่นใจ 89%</span>
                </div>
                <p className="text-sm font-bold mb-4">ขายตามน้ำ (Follow Trend)</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-neutral-900 p-2 rounded-lg">
                    <div className="text-[9px] text-neutral-500 mb-1">ENTRY</div>
                    <div>$4452.84</div>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2 rounded-lg">
                    <div className="text-[9px] mb-1">SL</div>
                    <div>$4460.84</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                    <div className="text-[9px] mb-1">TP</div>
                    <div>$4436.84</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-amber-500/5" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <ShieldCheck className="h-12 w-12 sm:h-16 sm:w-16 text-amber-500 mx-auto mb-4 sm:mb-6" />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">เริ่มต้นปั้นพอร์ตทองคำวันนี้</h2>
          <p className="text-base sm:text-xl text-neutral-400 mb-8 sm:mb-10 px-2">ระบบพรีเมียมในราคาที่ทุกคนเข้าถึงได้ ไม่มีค่าธรรมเนียมแอบแฝง</p>
          
          <div className="bg-neutral-900/80 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 sm:p-8 md:p-12 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-left w-full">
                <h3 className="text-xl sm:text-2xl font-bold mb-2">สมาชิกรายเดือน PRO (PRO Plan)</h3>
                <p className="text-sm sm:text-base text-neutral-400">เข้าถึงทุกฟีเจอร์ AI วิเคราะห์และส่งสัญญาณแบบไร้ขีดจำกัด</p>
                <ul className="mt-6 space-y-3">
                  {['อัปเดตสถานะตลาดเรียลไทม์ 24/7', 'สแกนโซนรับ-ต้านอัตโนมัติข้าม Timeframe (MTF)', 'แผนการเทรดละเอียด (Entry, SL, TP)', 'ระบบแจ้งเตือนจุดเข้าซื้อขายผ่าน Line/Telegram'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs sm:text-sm text-neutral-300">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="text-center md:text-right shrink-0 w-full md:w-auto border-t md:border-t-0 border-neutral-800 pt-6 md:pt-0">
                <div className="flex flex-col md:items-end justify-center mb-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-500">
                    ฿99
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">ต่อเดือน</span>
                </div>
                <div className="text-xs sm:text-sm text-neutral-400 mb-3 font-mono">
                  (ทดลองใช้ PRO ฟรี 30 วันแรก)
                </div>
                <p className="text-emerald-400 text-[10px] sm:text-xs font-bold mb-4 leading-relaxed">
                  สิทธิ์การทดลองใช้งาน 30 วัน <br />
                  จะถูกมอบให้บัญชีใหม่ทุกบัญชีโดยอัตโนมัติเมื่อสมัครใช้งานสำเร็จ!
                </p>
                <Link 
                  href="/pricing" 
                  className="inline-block w-full px-6 sm:px-8 py-3.5 sm:py-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-base sm:text-lg font-bold rounded-xl transition-transform hover:-translate-y-1 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                  เริ่มต้นทดลองใช้ฟรี 30 วัน
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-12 text-center text-neutral-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-500" />
          <span className="font-bold text-white">GOLD AI SIGNAL LAB</span>
        </div>
        <p>© {new Date().getFullYear()} Gold AI Signal Lab. All rights reserved.</p>
        <p className="mt-2 text-xs text-neutral-600 max-w-lg mx-auto">
          การลงทุนมีความเสี่ยง ข้อมูลที่ให้เป็นเพียงการวิเคราะห์ทางสถิติและ AI ไม่ใช่คำแนะนำทางการเงิน ผู้ลงทุนควรศึกษาข้อมูลก่อนตัดสินใจลงทุน
        </p>
      </footer>

      {/* Mobile Sticky Footer Menu - Golden Theme */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-xl border-t border-amber-500/20 md:hidden shadow-[0_-10px_40px_rgba(245,158,11,0.15)]">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto relative z-10">
          <Link href="/pricing" className="flex flex-col items-center justify-center gap-1 text-amber-200/50 hover:text-amber-400 transition-all hover:-translate-y-0.5">
            <UserPlus className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">สมัคร</span>
          </Link>
          <Link href="/login" className="flex flex-col items-center justify-center gap-1 text-amber-200/50 hover:text-amber-400 transition-all hover:-translate-y-0.5">
            <LogIn className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">เข้าสู่ระบบ</span>
          </Link>
          <Link href="/checkout" className="flex flex-col items-center justify-center gap-1 text-amber-200/50 hover:text-amber-400 transition-all hover:-translate-y-0.5">
            <CreditCard className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">ชำระเงิน</span>
          </Link>
          <a href="https://line.me/ti/p/~" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 text-amber-200/50 hover:text-amber-400 transition-all hover:-translate-y-0.5">
            <MessageCircle className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">ติดต่อเรา</span>
          </a>
        </div>
        {/* iOS Safe Area spacing */}
        <div className="h-safe-bottom"></div>
      </div>
    </div>
  );
}
