'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, UploadCloud, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

export default function CheckoutPage() {
  const router = useRouter();
  const freeTrialBtnRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(1); // 1: Register/Login, 2: Payment & Slip, 3: Success
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Configuration (PromptPay)
  const [isTestMode, setIsTestMode] = useState(false);
  const AMOUNT = isTestMode ? 0.1 : 99;
  const PROMPTPAY_ID = "รอการตั้งค่าใน public/promptpay.jpg"; // Updated via static image
  const ACCOUNT_NAME = "นาย นรินทร์ จีรัตน์";

  const [canSkip, setCanSkip] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [isAutoApproved, setIsAutoApproved] = useState(false);

  useEffect(() => {
    // Check if already logged in
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setStep(2); // Skip to payment if logged in
        if (data.user?.subscriptionStatus === 'active') {
          setCanSkip(true);
        }
        if (data.user?.subscriptionPlan) {
          setUserPlan(data.user.subscriptionPlan);
        }
      }
    } catch (e) {
      // Not logged in
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (isLoginMode) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok) {
          setStep(2);
          if (data.user?.subscriptionPlan) {
            setUserPlan(data.user.subscriptionPlan);
          }
          if (data.user?.subscriptionStatus === 'active') {
            setCanSkip(true);
          }
        } else {
          setErrorMsg(data.error || 'Authentication failed');
        }
      } else {
        // Register Mode: Request OTP
        const res = await fetch('/api/auth/register-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok) {
          setVerificationToken(data.verificationToken);
          setIsOtpStep(true);
        } else {
          setErrorMsg(data.error || 'Failed to request OTP');
        }
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, otp, verificationToken }),
      });

      const data = await res.json();
      if (res.ok) {
        setStep(2);
        if (data.user?.subscriptionPlan) {
          setUserPlan(data.user.subscriptionPlan);
        }
        if (data.user?.subscriptionStatus === 'active') {
          setCanSkip(true);
        }
      } else {
        setErrorMsg(data.error || 'OTP Verification failed');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setSlipFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleSubmitSlip = async () => {
    if (!slipFile) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Upload to Supabase Storage (via our API route to keep it secure)
      const formData = new FormData();
      formData.append('file', slipFile);
      formData.append('amount', AMOUNT.toString());

      const res = await fetch('/api/payments/submit-slip', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAutoApproved(!!data.isAutoApproved);
        setStep(3); // Success!
      } else {
        setErrorMsg(data.error || 'Failed to submit slip');
      }
    } catch (err) {
      setErrorMsg('Network error while uploading slip');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center py-12 px-4 w-full overflow-x-hidden">
      
      <button 
        onClick={() => router.push('/pricing')}
        className="absolute top-8 left-8 flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" /> ย้อนกลับ
      </button>

      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
        
        {/* Step 2 Loading Overlay */}
        {step === 2 && isLoading && (
          <div className="absolute inset-0 z-50 bg-neutral-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <UploadCloud className="h-6 w-6 text-amber-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-neutral-100 animate-pulse">กำลังสแกนและตรวจสอบยอดเงิน...</h4>
              <p className="text-xs text-neutral-400 max-w-[280px] leading-relaxed">
                ระบบกำลังดึงข้อมูลภาพสลิปเพื่อเช็กรายการโอนเงินกับธนาคารโดยอัตโนมัติ โปรดถือสายรอสักครู่
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/50">
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            สมัครสมาชิก Gold AI <span className="text-amber-500">PRO</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            สิทธิ์ทดลองใช้งานฟรี 30 วันแรก และต่ออายุในราคาปกติ ฿99/เดือน
          </p>
        </div>

        {/* Step 1: Auth */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-medium text-neutral-200">
                {isOtpStep ? 'ยืนยันรหัส OTP' : (isLoginMode ? 'เข้าสู่ระบบ' : 'สร้างบัญชีผู้ใช้')}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                {isOtpStep ? 'รหัส OTP ถูกส่งไปทางอีเมลแล้ว' : 'คุณจำเป็นต้องมีบัญชีก่อนชำระเงิน'}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {isOtpStep ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    ระบบได้ส่งรหัส OTP 6 หลักไปที่ <span className="text-amber-500 font-bold">{email}</span> แล้ว <br/>
                    โปรดตรวจสอบกล่องข้อความในอีเมลของคุณ <br/>
                    <span className="text-[10px] text-neutral-500">(หากหาไม่พบกรุณาตรวจสอบในโฟลเดอร์ Junk/Spam)</span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider text-center">รหัสยืนยัน OTP (6 หลัก)</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 text-center text-2xl tracking-[10px] focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                    placeholder="000000"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOtpStep(false);
                    setOtp('');
                  }}
                  className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors text-center block mt-2"
                >
                  ย้อนกลับไปแก้ไขอีเมล
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 transition-colors"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:border-amber-500/50 transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'กำลังดำเนินการ...' : (isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก (รับ OTP)')}
                </button>
              </form>
            )}

            {!isOtpStep && (
              <div className="text-center text-sm text-neutral-400 mt-4">
                {isLoginMode ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'} {' '}
                <button 
                  type="button" 
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setIsOtpStep(false);
                    setErrorMsg('');
                  }} 
                  className="text-amber-500 hover:underline"
                >
                  {isLoginMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Payment & Slip */}
        {step === 2 && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-medium text-neutral-200">สแกนเพื่อชำระเงิน</h2>
              <p className="text-xs text-neutral-500 mt-1">PromptPay (พร้อมเพย์)</p>
            </div>

            {/* Free Trial Banner */}
            {canSkip && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  🎁 สิทธิ์พิเศษของคุณ
                </span>
                <p className="text-sm font-bold text-neutral-100 leading-relaxed">
                  ขณะนี้คุณได้สิทธิ์ทดลองใช้ฟรี... <br/>
                  <span className="text-emerald-400 font-black text-sm">ทดลองใช้งาน PRO ฟรี 30 วันแรก!</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    freeTrialBtnRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                >
                  รับสิทธิ์ใช้งานฟรี
                </button>
              </div>
            )}

            <div className="bg-white p-2 rounded-2xl w-48 h-auto mx-auto flex items-center justify-center overflow-hidden">
              <img src="/promptpay.jpg" alt="PromptPay QR Code" className="w-full h-auto object-contain" />
            </div>
            
            <div className="text-center space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <p className="text-neutral-400 text-sm">ชื่อบัญชี: <span className="text-neutral-100 font-medium">{ACCOUNT_NAME}</span></p>
              <p className="text-neutral-400 text-sm">ยอดที่ต้องชำระ: <span className="text-amber-500 font-bold text-lg">฿{AMOUNT}</span></p>
              
              <div className="pt-2 border-t border-white/5 flex items-center justify-center">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isTestMode}
                    onChange={(e) => setIsTestMode(e.target.checked)}
                    className="rounded border-neutral-800 text-amber-500 focus:ring-amber-500 bg-neutral-950 h-4 w-4"
                  />
                  <span className="text-[11px] text-neutral-400 font-medium">เปิดโหมดทดสอบระบบ SlipOK (ชำระ ฿0.10)</span>
                </label>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-300">แนบสลิปโอนเงิน</label>
              
              {!slipFile ? (
                <label 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                    isDragging 
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-[1.01]' 
                      : 'border-neutral-800 hover:bg-neutral-800/50 hover:border-amber-500/50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className={`w-8 h-8 mb-2 transition-transform ${isDragging ? 'text-amber-500 scale-110' : 'text-neutral-500'}`} />
                    <p className="text-sm text-neutral-400"><span className="font-semibold text-amber-500">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวางที่นี่</p>
                  </div>
                  <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} />
                </label>
              ) : (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative w-full h-48 rounded-xl overflow-hidden border transition-all duration-300 group ${
                    isDragging 
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                      : 'border-neutral-800'
                  }`}
                >
                  <img src={previewUrl || ''} alt="Slip preview" className="w-full h-full object-contain bg-neutral-950" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="bg-neutral-800 text-neutral-200 px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-neutral-700">
                      เปลี่ยนรูปภาพ (ลากวางได้)
                      <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitSlip}
                disabled={!slipFile || isLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-xl transition-colors disabled:opacity-50 mt-4"
              >
                {isLoading ? 'กำลังส่งข้อมูล...' : 'ส่งสลิปยืนยัน'}
              </button>

              {canSkip && (
                <button
                  ref={freeTrialBtnRef}
                  onClick={() => router.push('/admin')}
                  disabled={isLoading}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-emerald-400 font-bold py-3 rounded-xl transition-colors border border-emerald-500/30 mt-2 flex items-center justify-center gap-2 scroll-mt-6"
                >
                  <CheckCircle2 className="h-4 w-4" /> เข้าสู่หน้า Dashboard (สิทธิ์ทดลองใช้ฟรี)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="p-10 text-center space-y-6">
            {isAutoApproved ? (
              <>
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-pulse">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-bounce" />
                </div>
                
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase tracking-widest">
                    PRO ACTIVATED INSTANTLY
                  </span>
                  <h2 className="text-xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                    อนุมัติสมาชิก PRO สำเร็จ! 🎉
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed px-4">
                    ระบบได้ตรวจสอบสลิปโอนเงินพร้อมเพย์อัตโนมัติเสร็จเรียบร้อย <br/>
                    บัญชีของคุณได้รับการเปิดสิทธิ์ **PRO** และสามารถใช้งานสัญญาณเทรดสดทั้งหมดได้ทันทีครับ!
                  </p>
                </div>

                <button
                  onClick={() => {
                    router.push('/admin');
                    router.refresh();
                  }}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                >
                  เข้าสู่หน้า Dashboard (PRO)
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <CheckCircle2 className="h-10 w-10 text-amber-500" />
                </div>
                
                <div>
                  <h2 className="text-xl font-bold text-neutral-100 mb-2">ส่งสลิปเรียบร้อย!</h2>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    ระบบได้รับสลิปโอนเงินของคุณแล้ว <br/>
                    เนื่องจากต้องรอตรวจสอบโดยแอดมินด้วยตนเองเพื่อตรวจสอบความถูกต้อง <br/>
                    แอดมินจะดำเนินการอนุมัติวันใช้งานให้คุณใน 1-3 ชั่วโมงครับ
                  </p>
                </div>

                <button
                  onClick={() => {
                    router.push('/admin');
                    router.refresh();
                  }}
                  className="w-full bg-neutral-850 hover:bg-neutral-800 text-neutral-100 font-semibold py-3.5 rounded-2xl transition-colors border border-white/5"
                >
                  ไปที่หน้า Dashboard
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
