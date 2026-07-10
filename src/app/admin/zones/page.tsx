'use client';

import React, { useEffect, useState } from 'react';
import { Layers, RefreshCw, Star } from 'lucide-react';

interface Zone {
  id: string;
  symbol: string;
  timeframe: string;
  type: string;
  priceMin: number;
  priceMax: number;
  strength: number;
  touchCount: number;
  lastTouchedAt: string;
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/admin/zones');
      const data = await res.json();
      if (res.ok) {
        setZones(data);
      } else {
        setError(data.error || 'ไม่สามารถโหลดข้อมูลโซนแนวรับ/ต้านได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดเครือข่ายในการโหลดแนวรับ/ต้าน');
    } finally {
      setIsLoading(false);
    }
  };

  const scanZones = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/zones', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setZones(data.data);
      } else {
        setError(data.error || 'ไม่สามารถโหลดข้อมูลโซนแนวรับ/ต้านได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดเครือข่ายในการสแกนแนวรับ/ต้าน');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const filteredZones = zones.filter((z) => z.symbol.toUpperCase().includes('XAU'));


  const support = filteredZones.filter((z) => z.type === 'SUPPORT');
  const resistance = filteredZones.filter((z) => z.type === 'RESISTANCE');
  const liquidity = filteredZones.filter((z) => z.type === 'LIQUIDITY');

  const renderStrengthStars = (strength: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`h-3 w-3 ${i <= strength ? 'text-amber-500 fill-amber-500' : 'text-neutral-700'}`} 
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-sm text-amber-500 animate-pulse">
        <RefreshCw className="h-6 w-6 animate-spin" />
        กำลังสแกนหาจุดสวิงดัชนีระดับสูง/ต่ำ และประมวลผลความหนาแน่น...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            แผนภูมิโซนแนวรับ & แนวต้าน (Swing Extreme Zones)
          </h1>
          <p className="text-neutral-400 text-xs mt-1">
            โซนคัดกรองหนาแน่นซึ่งคำนวณโดยอัลกอริทึมมองหาราคาปิดที่มีนัยสำคัญระดับสวิงดัชนีผ่านกรอบเวลา H1 และ H4
          </p>
        </div>
        <button 
          onClick={scanZones}
          className="p-2 border border-neutral-850 rounded-xl bg-neutral-900/40 text-neutral-400 hover:text-neutral-100 hover:border-neutral-700 transition-all cursor-pointer self-end md:self-auto"
          title="สแกนและคำนวณโซนใหม่จากข้อมูลล่าสุด"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-900 w-full md:w-fit gap-1 text-xs overflow-x-auto hide-scrollbar">
        <div className="px-4 py-2 rounded-lg font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
          ทองคำ XAUUSD ({filteredZones.length})
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Support Column */}
        <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
            <h2 className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              แนวรับแข็งแกร่ง (Support Zones)
            </h2>
            <span className="text-[10px] text-neutral-500 font-mono font-bold">{support.length} แนว</span>
          </div>

          {support.length > 0 ? (
            <div className="space-y-4">
              {support.map((zone) => (
                <div key={zone.id} className="bg-neutral-900/50 border border-neutral-850 hover:border-emerald-500/20 rounded-xl p-4 transition-all space-y-3 relative group">
                  <div className="absolute top-4 right-4 text-[9px] font-mono text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 uppercase">
                    {zone.symbol} • {zone.timeframe}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">กรอบระดับราคา</span>
                    <span className="text-sm font-mono font-bold text-neutral-200">${zone.priceMin.toLocaleString()} - ${zone.priceMax.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">ความหนาแน่นระดับ</span>
                      {renderStrengthStars(zone.strength)}
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">จำนวนครั้งที่ราคาชน</span>
                      <span className="text-emerald-400 font-bold">{zone.touchCount} ครั้ง</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-600 font-mono text-xs italic">
              ไม่พบโซนแนวรับที่มีผลในดัชนีคัดกรองปัจจุบัน
            </div>
          )}
        </div>

        {/* Resistance Column */}
        <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
            <h2 className="text-xs font-extrabold text-rose-450 uppercase tracking-widest flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              แนวต้านแข็งแกร่ง (Resistance Zones)
            </h2>
            <span className="text-[10px] text-neutral-500 font-mono font-bold">{resistance.length} แนว</span>
          </div>

          {resistance.length > 0 ? (
            <div className="space-y-4">
              {resistance.map((zone) => (
                <div key={zone.id} className="bg-neutral-900/50 border border-neutral-850 hover:border-rose-500/20 rounded-xl p-4 transition-all space-y-3 relative group">
                  <div className="absolute top-4 right-4 text-[9px] font-mono text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 uppercase">
                    {zone.symbol} • {zone.timeframe}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">กรอบระดับราคา</span>
                    <span className="text-sm font-mono font-bold text-neutral-200">${zone.priceMin.toLocaleString()} - ${zone.priceMax.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">ความหนาแน่นระดับ</span>
                      {renderStrengthStars(zone.strength)}
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">จำนวนครั้งที่ราคาชน</span>
                      <span className="text-rose-450 font-bold">{zone.touchCount} ครั้ง</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-600 font-mono text-xs italic">
              ไม่พบโซนแนวต้านที่มีผลในดัชนีคัดกรองปัจจุบัน
            </div>
          )}
        </div>

        {/* Liquidity Column */}
        <div className="bg-neutral-900/20 border border-neutral-900 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
            <h2 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              แหล่งสภาพคล่อง (Liquidity Pools)
            </h2>
            <span className="text-[10px] text-neutral-500 font-mono font-bold">{liquidity.length} โซน</span>
          </div>

          {liquidity.length > 0 ? (
            <div className="space-y-4">
              {liquidity.map((zone) => (
                <div key={zone.id} className="bg-neutral-900/50 border border-neutral-850 hover:border-indigo-500/20 rounded-xl p-4 transition-all space-y-3 relative group">
                  <div className="absolute top-4 right-4 text-[9px] font-mono text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 uppercase">
                    {zone.symbol} • {zone.timeframe}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">กึ่งกลางสภาพคล่องจำลอง</span>
                    <span className="text-sm font-mono font-bold text-neutral-200">${((zone.priceMin + zone.priceMax) / 2).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">กลุ่มราคาหยุดสะสม</span>
                      <span className="text-indigo-400 font-bold text-[10px]">Stops Pool</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">สถานะอัปเดต</span>
                      <span className="text-neutral-400 text-[10px]">มีผลรุนแรง</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-600 font-mono text-xs italic">
              ไม่พบพื้นที่รวบรวม Stop Loss (Liquidity Pool)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
