'use client';

import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  Activity, 
  Zap, 
  RefreshCw,
  Brain,
  Crosshair,
  ShieldAlert,
  Terminal
} from 'lucide-react';

interface Trade {
  id: string;
  signalId?: string;
  signal?: Signal;
  symbol: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  result: string;
  rrResult: number;
  openedAt: string;
}

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  confidence: number;
  status: string;
  fakeoutScore: number;
  reason: string;
  createdAt: string;
}

interface Zone {
  id: string;
  symbol: string;
  timeframe: string;
  type: string;
  priceMin: number;
  priceMax: number;
  strength: number;
}

interface ProactivePlan {
  id: string;
  type: string;
  title: string;
  entry: number;
  entry1?: number;
  entry2?: number;
  entry3?: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  confidence: number;
}

interface MarketIntelligence {
  currentPrice: number;
  bias: string;
  trendStrength: number;
  volatility: string;
  nearestSupport: Zone[];
  nearestResistance: Zone[];
  dangerZones: Zone[];
  proactivePlans: ProactivePlan[];
}

interface Stats {
  totalSignals: number;
  totalTrades: number;
  openTradesCount: number;
  openTrades: Trade[];
  suggestedPlansCount: number;
  suggestedPlans: Trade[];
  latestSignals: Signal[];
  winRate: number;
  netR: number;
  bestSetup: string;
  worstSetup: string;
  zoneCount: number;
  winCount: number;
  lossCount: number;
  marketIntelligence: Record<string, MarketIntelligence>;
  mt5Connection?: {
    isLive: boolean;
    lastSyncAt: string | null;
    recentEvents?: {
      id: string;
      source: string;
      symbol: string;
      timeframe: string;
      receivedAt: string;
      status: string;
      errorMessage: string | null;
      payload: any;
    }[];
  };
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<'XAUUSD' | 'BTCUSD'>('XAUUSD');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simDirection, setSimDirection] = useState<'BUY'|'SELL'>('BUY');
  const [simPrice, setSimPrice] = useState<number>(4450.0);
  const [simStrategy, setSimStrategy] = useState('support_bounce');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [manualExitPrice, setManualExitPrice] = useState(0);

  // Market Session State (Moved above conditional returns to fix React Hook violation)
  const [currentSessions, setCurrentSessions] = useState<{name: string, active: boolean, color: string, time: string}[]>([]);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data);
        if (data.marketIntelligence && data.marketIntelligence[activeAsset]) {
           setSimPrice(data.marketIntelligence[activeAsset].currentPrice);
        }
      } else {
        setError(data.error || 'ไม่สามารถโหลดข้อมูลสถิติได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkSessions = () => {
      const now = new Date();
      // Get current hour in UTC
      const h = now.getUTCHours();
      
      const sydneyActive = h >= 21 || h < 6;
      const tokyoActive = h >= 0 && h < 9;
      const londonActive = h >= 8 && h < 17;
      const newyorkActive = h >= 13 && h < 22;

      const sessions = [
        { name: 'Sydney', active: sydneyActive, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30', time: '04:00 - 13:00 (TH)' },
        { name: 'Tokyo', active: tokyoActive, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30', time: '07:00 - 16:00 (TH)' },
        { name: 'London', active: londonActive, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', time: '15:00 - 00:00 (TH)' },
        { name: 'New York', active: newyorkActive, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30', time: '20:00 - 05:00 (TH)' }
      ];
      
      setCurrentSessions(sessions);

      if (londonActive && newyorkActive) {
        setOverlapWarning('🔥 ตลาด London & New York ซ้อนทับกัน (13:00-17:00 UTC) ความผันผวนสูงมาก ควรลด Lot Size!');
      } else if (tokyoActive && londonActive) {
        setOverlapWarning('⚠️ ตลาด Tokyo & London ซ้อนทับกัน ความผันผวนเริ่มสูงขึ้น');
      } else {
        setOverlapWarning(null);
      }
    };
    
    checkSessions();
    const interval = setInterval(checkSessions, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto refresh every 5 seconds for Real-Time MT5 Tick sync
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [activeAsset]);

  const handleMockWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/webhooks/tradingview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'GOLD_AI_SECRET',
          symbol: activeAsset,
          timeframe: 'M15',
          direction: simDirection,
          price: simPrice,
          strategy: simStrategy,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      setSimResult(data);
      fetchStats();
    } catch {
      setSimResult({ status: 'error', decision: 'NETWORK_FAILURE', error_message: 'ยิงสัญญาณทดสอบล้มเหลว' });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApprovePlan = async (id: string) => {
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_plan', tradeId: id }),
      });
      if (res.ok) fetchStats();
    } catch {
      alert('อนุมัติแผนล้มเหลว');
    }
  };

  const handleCreateProactivePlan = async (plan: ProactivePlan) => {
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_proactive_plan', 
          plan: { ...plan, symbol: activeAsset } 
        }),
      });
      if (res.ok) fetchStats();
    } catch {
      alert('สร้างแผนล้มเหลว');
    }
  };

  const handleCloseTrade = async (id: string, exitPrice: number) => {
    try {
      const res = await fetch('/api/admin/simulate-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_trade', tradeId: id, exitPrice }),
      });
      if (res.ok) {
        setClosingTradeId(null);
        fetchStats();
      }
    } catch {
      alert('ปิดออเดอร์ล้มเหลว');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-cyan-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        INITIALIZING COMMAND CENTER...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm shadow-[0_0_15px_rgba(244,63,94,0.2)]">
        {error}
      </div>
    );
  }

  const intelligence = stats?.marketIntelligence?.[activeAsset];

  return (
    <div className="space-y-6 font-sans text-neutral-200">
      
      {/* Persistent Risk Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-400">คำเตือนความเสี่ยงและข้อควรระวัง</h4>
          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
            ระวังเทรนด์เปลี่ยนเสมอ! ควรมีการควบคุม Lot Size และตั้งจุด SL ที่รับได้อย่างเคร่งครัด ยิ่งราคาเข้าใกล้แนวรับ-แนวต้านสำคัญ ยิ่งต้องระวังเป็นพิเศษ และควรเปิดกราฟดู Price Action หรือแพทเทิร์นประกอบการตัดสินใจด้วยเสมอ
          </p>
        </div>
      </div>

      {/* Market Sessions Widget */}
      <div className="bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-4 text-center md:text-left w-full">
          <div className="w-full flex flex-col items-center md:items-start">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mb-2 w-full text-center md:text-left">
              <Activity className="h-4 w-4 text-cyan-500" />
              สถานะตลาดโลก (Global Market Sessions)
            </h4>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 w-full">
              {currentSessions.map(s => (
                <div key={s.name} className={`flex-1 min-w-[80px] md:flex-initial px-3 py-1.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center ${s.active ? s.color + ' shadow-lg animate-pulse' : 'bg-neutral-900 border-neutral-800 text-neutral-600'}`}>
                  <div className="flex items-center gap-1.5 justify-center">
                    {s.active && <span className="h-1.5 w-1.5 rounded-full bg-current"></span>}
                    {s.name}
                  </div>
                  <span className="text-[9px] font-normal opacity-80 mt-0.5 font-mono">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
          
          {overlapWarning && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl max-w-sm w-full text-center">
              <p className="text-xs text-rose-400 font-bold leading-relaxed">
                {overlapWarning}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Top Navigation & Live Price */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
        <div className="flex gap-2 bg-neutral-900/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveAsset('XAUUSD')}
            className={`px-6 py-2 rounded-lg font-bold font-mono transition-all ${activeAsset === 'XAUUSD' ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] border border-amber-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            XAUUSD
          </button>
          <button 
            onClick={() => setActiveAsset('BTCUSD')}
            className={`px-6 py-2 rounded-lg font-bold font-mono transition-all ${activeAsset === 'BTCUSD' ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            BTCUSD
          </button>
        </div>

        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <div className="text-right flex flex-col items-end w-full md:w-auto mt-4 md:mt-0">
            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 mb-1">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">Live Market Price</span>
              {stats?.mt5Connection?.isLive ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> MT5 LIVE
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[8px] font-bold flex items-center gap-1" title="Data fetched from public API fallback">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> MT5 DISCONNECTED (PUBLIC API FALLBACK)
                </span>
              )}
            </div>
            <div className="text-3xl font-black font-mono tracking-tight flex items-center gap-3">
              {activeAsset === 'XAUUSD' ? (
                <span className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">${intelligence?.currentPrice?.toFixed(2) ?? '0.00'}</span>
              ) : (
                <span className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">${intelligence?.currentPrice?.toFixed(2) ?? '0.00'}</span>
              )}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Market Intelligence & Zones (Cyberpunk Glassmorphism) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Bias Radar */}
          <div className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              ศูนย์วิเคราะห์ตลาด (Market Intelligence)
            </h2>
            
            <div className="space-y-5">
              <div>
                <span className="text-[10px] text-neutral-500 font-mono">ทิศทางตลาด (DIRECTIONAL BIAS)</span>
                <div className={`text-2xl font-black tracking-widest mt-1 ${
                  intelligence?.bias === 'BULLISH' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                  intelligence?.bias === 'BEARISH' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
                  'text-neutral-400'
                }`}>
                  {intelligence?.bias === 'BULLISH' ? 'มองขึ้น (BULLISH)' : 
                   intelligence?.bias === 'BEARISH' ? 'มองลง (BEARISH)' : 
                   'ไซด์เวย์ (NEUTRAL)'}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
                  <span>ความแรงเทรนด์ (TREND STRENGTH)</span>
                  <span className="text-indigo-400 font-bold">{intelligence?.trendStrength}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
                    style={{ width: `${intelligence?.trendStrength}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-neutral-500 font-mono">ความผันผวน (VOLATILITY)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  intelligence?.volatility === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 
                  intelligence?.volatility === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {intelligence?.volatility === 'HIGH' ? 'สูงมาก (HIGH)' : 
                   intelligence?.volatility === 'MEDIUM' ? 'ปานกลาง (MEDIUM)' : 
                   'ต่ำ (LOW)'}
                </span>
              </div>
            </div>
          </div>

          {/* MT5 Sync Diagnostics Card */}
          <div className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-amber-500" />
                การเชื่อมต่อ METATRADER 5 (MT5 DIAGNOSTICS)
              </h2>
              <button 
                onClick={fetchStats}
                disabled={isLoading}
                className="p-1 hover:bg-white/10 rounded transition-all text-neutral-400 hover:text-white disabled:opacity-50"
                title="รีเฟรชข้อมูลสถานะ"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 font-mono">สถานะซิงค์เซิร์ฟเวอร์</span>
                {stats?.mt5Connection?.isLive ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> ปกติ (LIVE)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-450 animate-ping"></span> ขาดการซิงค์ (OFFLINE)
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 font-mono">
                <span className="text-[10px] text-neutral-500">ซิงค์ราคาล่าสุด</span>
                <span className="text-neutral-300 font-medium">${intelligence?.currentPrice?.toFixed(2) ?? 'N/A'}</span>
              </div>

              <div className="flex justify-between items-start text-xs border-t border-white/5 pt-2 font-mono">
                <span className="text-[10px] text-neutral-500">เวลาที่อัปเดตล่าสุด</span>
                <span className="text-neutral-300 font-medium text-right leading-relaxed max-w-[150px]">
                  {stats?.mt5Connection?.lastSyncAt 
                    ? new Date(stats.mt5Connection.lastSyncAt).toLocaleString('th-TH') 
                    : 'ยังไม่มีข้อมูลซิงค์'}
                </span>
              </div>

              <div className="text-[10px] leading-relaxed text-neutral-400 border-t border-white/5 pt-3 space-y-2">
                {stats?.mt5Connection?.isLive ? (
                  <p className="text-emerald-450 text-emerald-400 font-bold">
                    ✓ ระบบกำลังรับข้อมูลจาก MT5 บนคอมพิวเตอร์ของคุณแบบสดผ่าน EA Webhook
                  </p>
                ) : (
                  <>
                    <p className="text-rose-450 text-rose-400 font-bold">
                      ⚠️ สัญญาณขาดการซิงค์! ระบบกำลังใช้ราคาอ้างอิงสำรองชั่วคราว วิธีตรวจสอบแก้ไข:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-neutral-400 font-mono text-[9px]">
                      <li>ตรวจสอบว่าโปรแกรม MT5 บนคอมพิวเตอร์และกราฟทองคำเปิดอยู่</li>
                      <li>ตรวจสอบว่าใส่ EA <code className="text-amber-500 font-bold">MT5_Webhook_Sender</code> บนกราฟเรียบร้อย</li>
                      <li>ไปที่เมนู <code className="text-neutral-300">Tools &gt; Options &gt; Expert Advisors</code> ใน MT5</li>
                      <li>ติ๊กเลือก <code className="text-neutral-300">Allow WebRequest</code> และเพิ่ม URL: <br />
                        <code className="text-amber-400 select-all block bg-neutral-900 px-1 py-0.5 rounded border border-white/5 mt-1">https://goldaisig.com</code>
                      </li>
                      <li>ดูแถบ <code className="text-neutral-300">Journal / Experts</code> ใน MT5 ว่ารายงาน Error Code หรือไม่</li>
                    </ol>
                  </>
                )}
              </div>

              {/* Webhook Connection Log */}
              <div className="border-t border-white/5 pt-3 space-y-2">
                <span className="text-[10px] text-neutral-500 font-mono block">ประวัติการเชื่อมต่อ 10 รายการล่าสุด</span>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {stats?.mt5Connection?.recentEvents && stats.mt5Connection.recentEvents.length > 0 ? (
                    stats.mt5Connection.recentEvents.map((event, idx) => {
                      let typeLabel = 'Webhook';
                      let typeColor = 'text-neutral-400 bg-neutral-900 border-white/5';
                      let detailText = '';

                      if (event.source === 'mt5_sync') {
                        typeLabel = 'Candle Sync';
                        typeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                        detailText = `ซิงค์ ${event.payload?.count ?? 0} แท่งเทียน`;
                      } else if (event.source === 'mt5_sync_error') {
                        typeLabel = 'Sync Error';
                        typeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                        detailText = event.errorMessage || 'ซิงค์แท่งเทียนล้มเหลว';
                      } else if (event.source === 'tradingview') {
                        if (event.payload?.strategy === 'price_feed' || event.payload?.strategy === 'tick') {
                          typeLabel = 'Live Tick';
                          typeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                          detailText = `${event.symbol} $${event.payload?.price?.toFixed(2) ?? 'N/A'}`;
                        } else {
                          const direction = event.payload?.direction || 'NONE';
                          typeLabel = `Signal: ${direction}`;
                          typeColor = direction === 'BUY'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold'
                            : direction === 'SELL'
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold'
                              : 'text-neutral-400 bg-neutral-900 border-white/5';
                          detailText = `${event.symbol} @ $${event.payload?.price?.toFixed(2) ?? 'N/A'}`;
                        }
                      }

                      const eventTime = new Date(event.receivedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      return (
                        <div key={event.id || idx} className="flex items-center justify-between text-[9px] font-mono bg-white/5 rounded border border-white/5 px-2 py-1.5 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-1 rounded border text-[8px] whitespace-nowrap ${typeColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-neutral-300 truncate font-semibold">
                              {detailText}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-neutral-500 text-[8px]">
                              {eventTime}
                            </span>
                            {event.status === 'processed' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="สำเร็จ" />
                            ) : event.status === 'rejected' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" title={`ถูกปฏิเสธ: ${event.errorMessage || ''}`} />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" title={`ล้มเหลว: ${event.errorMessage || ''}`} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[9px] text-neutral-600 block py-2 text-center font-mono">ไม่มีประวัติการเชื่อมต่อข้อมูล</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Zone Radar */}
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
              เรดาร์สแกนโซน (Live Zone Radar)
            </h2>
            
            <div className="space-y-4">
              {/* Resistances */}
              <div>
                <span className="text-[9px] text-rose-500 font-mono uppercase tracking-widest block mb-2">แนวต้านที่ใกล้ที่สุด (Sell Zones)</span>
                {intelligence?.nearestResistance?.length ? intelligence.nearestResistance.map((z, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-mono bg-rose-500/5 border border-rose-500/10 rounded px-3 py-1.5 mb-1.5">
                    <span className="text-neutral-300">${z.priceMin?.toFixed(2) ?? '0.00'} - ${z.priceMax?.toFixed(2) ?? '0.00'}</span>
                    <span className="text-rose-400">ระยะ: +${(z.priceMin - (intelligence?.currentPrice || 0)).toFixed(2)}</span>
                  </div>
                )) : <span className="text-[10px] text-neutral-600">ไม่มีแนวต้านในระยะใกล้</span>}
              </div>

              {/* Current Price Line */}
              <div className="relative h-px bg-white/10 my-4">
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 bg-neutral-900 px-2 text-[10px] text-cyan-500 font-mono flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  ราคาปัจจุบัน
                </div>
              </div>

              {/* Supports */}
              <div>
                <span className="text-[9px] text-emerald-500 font-mono uppercase tracking-widest block mb-2 text-right">แนวรับที่ใกล้ที่สุด (Buy Zones)</span>
                {intelligence?.nearestSupport?.length ? intelligence.nearestSupport.map((z, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-mono bg-emerald-500/5 border border-emerald-500/10 rounded px-3 py-1.5 mb-1.5">
                    <span className="text-neutral-300">${z.priceMin?.toFixed(2) ?? '0.00'} - ${z.priceMax?.toFixed(2) ?? '0.00'}</span>
                    <span className="text-emerald-400">ระยะ: -${((intelligence?.currentPrice || 0) - z.priceMax).toFixed(2)}</span>
                  </div>
                )) : <span className="text-[10px] text-neutral-600 text-right block">ไม่มีแนวรับในระยะใกล้</span>}
              </div>

              {/* Danger Zones */}
              {intelligence?.dangerZones && intelligence.dangerZones.length > 0 && (
                <div className="pt-3 border-t border-white/5 mt-3">
                  <span className="text-[9px] text-amber-500 font-mono uppercase tracking-widest flex items-center gap-1 mb-2">
                    <ShieldAlert className="h-3 w-3" /> โซนอันตราย (ระวังสวิงกิน Stoploss)
                  </span>
                  <div className="text-xs font-mono bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 text-amber-400">
                    ${intelligence.dangerZones[0]?.priceMin?.toFixed(2) ?? '0.00'} - ${intelligence.dangerZones[0]?.priceMax?.toFixed(2) ?? '0.00'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Proactive Plans & Active Trades */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* AI Proactive Planner */}
          <div className="bg-black/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.05)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400 animate-pulse" />
                แผนการเทรดแนะนำจาก AI (Proactive Strategies)
              </h2>
              <span className="text-[10px] font-mono text-neutral-400">วิเคราะห์สดจากราคาปัจจุบัน ไม่ต้องรอสัญญาณ</span>
            </div>

            {intelligence?.proactivePlans && intelligence.proactivePlans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {intelligence.proactivePlans.map((plan) => {
                  const isScalp = plan.title.includes('Scalping') || plan.id.includes('scalp');
                  return (
                    <div 
                      key={plan.id} 
                      className={`group rounded-xl p-5 transition-all duration-300 border relative overflow-hidden ${
                        isScalp 
                          ? 'bg-gradient-to-br from-amber-500/15 via-neutral-950/95 to-orange-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                          : 'bg-neutral-900/50 border-white/5 hover:border-purple-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        {isScalp ? (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse">
                            ⚡ SCALPING
                          </span>
                        ) : (
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                            plan.type.includes('BUY') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {plan.type}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isScalp ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20' : 'text-indigo-300 bg-indigo-500/10'
                        }`}>
                          ความมั่นใจ {plan.confidence}%
                        </span>
                      </div>

                      <h3 className={`text-sm font-bold mb-2 ${isScalp ? 'text-amber-400 font-extrabold' : 'text-neutral-100'}`}>
                        {plan.title}
                      </h3>
                      <p className={`text-[10px] mb-4 h-8 overflow-hidden ${isScalp ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        {plan.reason}
                      </p>
                      
                      {plan.type !== 'WAIT' ? (
                        <div className="space-y-2 mb-4 font-mono text-xs">
                          {/* 3 Entry Points */}
                          <div className={`rounded-xl px-3 py-2 border ${isScalp ? 'bg-amber-500/10 border-amber-500/20' : 'bg-black/40 border-white/5'} space-y-1.5`}>
                            <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider block">แนวจุดเข้าแนะนำ (3 Entry Levels)</span>
                            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                              <div className="bg-black/25 rounded p-1.5">
                                <span className="text-[8px] text-neutral-500 block mb-0.5">Entry = จุดเข้า</span>
                                <span className="text-neutral-200 font-bold">${plan.entry1?.toFixed(2) ?? plan.entry?.toFixed(2) ?? '0.00'}</span>
                              </div>
                              <div className="bg-amber-500/5 rounded p-1.5 border border-amber-500/15">
                                <span className="text-[8px] text-amber-400/80 block mb-0.5">Entry 2 (แนะนำ)</span>
                                <span className="text-amber-400 font-black">${plan.entry2?.toFixed(2) ?? '0.00'}</span>
                              </div>
                              <div className="bg-emerald-500/5 rounded p-1.5 border border-emerald-500/15">
                                <span className="text-[8px] text-emerald-400/80 block mb-0.5">Entry 3 (ดีสุด)</span>
                                <span className="text-emerald-400 font-black">${plan.entry3?.toFixed(2) ?? '0.00'}</span>
                              </div>
                            </div>
                          </div>

                          {/* SL / TP Row */}
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-rose-950/20 rounded-xl px-3 py-2 border border-rose-500/10">
                              <span className="text-[8px] text-rose-500 block mb-0.5">ตัดขาดทุน (SL)</span>
                              <span className="text-rose-400 font-bold">${plan.stopLoss?.toFixed(2) ?? '0.00'}</span>
                            </div>
                            <div className="bg-emerald-950/20 rounded-xl px-3 py-2 border border-emerald-500/10">
                              <span className="text-[8px] text-emerald-500 block mb-0.5">ทำกำไร (TP)</span>
                              <span className="text-emerald-400 font-bold">${plan.takeProfit?.toFixed(2) ?? '0.00'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 text-center text-xs font-medium text-neutral-400 mb-4">
                          ⚠️ โปรดรอจังหวะราคาย่อตัวและเฝ้าสังเกตการณ์แนวรับถัดไป
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-[10px] font-mono text-neutral-500">รอข้อมูลราคาเพื่อสร้างแผนทางเลือก...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
