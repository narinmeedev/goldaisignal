'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import PublicShell from '@/components/PublicShell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: request OTP, 2: reset password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotVerificationToken, setForgotVerificationToken] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setForgotSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('userRole', data.user.role);
        
        // Background prefetch to warm up the in-memory cache for instant dashboard load
        fetch('/api/admin/dashboard-stats?asset=XAUUSD', { cache: 'no-store' }).catch(() => {});

        router.push('/admin');
        router.refresh();
      } else {
        setErrorMsg(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setForgotSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/forgot-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setForgotVerificationToken(data.verificationToken);
        setForgotStep(2);
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาดในการส่ง OTP');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: forgotOtp,
          newPassword: forgotNewPassword,
          verificationToken: forgotVerificationToken
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setForgotSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
        setIsForgotMode(false);
        // Clear inputs
        setForgotEmail('');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotVerificationToken('');
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicShell>
    <main className="relative flex min-h-[calc(100vh-72px)] w-full flex-col items-center justify-center overflow-hidden bg-neutral-950 p-6 font-sans">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(39,49,59,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(39,49,59,0.18)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />

      {/* Main Container */}
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-ga-gold/35 bg-ga-canvas">
            <Image src="/brand/ga-mark-flat.svg" alt="Gold AI Signal" width={38} height={38} priority />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ga-text">
            Gold AI Signal
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            เข้าสู่ระบบเพื่อดูแผนวิเคราะห์ XAUUSD
          </p>
        </div>

        {/* Login Card */}
        <div className="public-panel relative p-6 sm:p-8">
          
          {isForgotMode ? (
            forgotStep === 1 ? (
              <>
                <h2 className="text-xl font-bold text-neutral-100 mb-2 text-center">
                  ลืมรหัสผ่าน
                </h2>
                <p className="text-xs text-neutral-400 mb-6 text-center">
                  กรอกอีเมลของคุณเพื่อขอรหัส OTP ในการตั้งรหัสผ่านใหม่
                </p>

                {errorMsg && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-mono">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleRequestForgotOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 font-mono">
                      อีเมลที่สมัครสมาชิก (Email)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="public-button-primary min-h-12 w-full px-5 text-sm"
                  >
                    {isLoading ? 'กำลังส่งรหัส OTP...' : 'ส่งรหัส OTP'}
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </button>

                  <div className="text-center text-xs pt-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsForgotMode(false);
                        setErrorMsg(null);
                      }}
                      className="text-amber-500 hover:text-amber-405 hover:underline transition-colors font-bold"
                    >
                      ย้อนกลับไปหน้าเข้าสู่ระบบ
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-neutral-100 mb-2 text-center">
                  ตั้งรหัสผ่านใหม่
                </h2>
                <p className="text-xs text-neutral-400 mb-6 text-center leading-relaxed">
                  ระบุรหัส OTP 6 หลักที่ได้รับในอีเมล <span className="text-amber-400 font-bold">{forgotEmail}</span> และตั้งรหัสผ่านใหม่ของคุณ
                </p>

                {errorMsg && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-mono">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                  {/* OTP input */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 font-mono text-center">
                      รหัสยืนยัน OTP (6 หลัก)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 text-center text-xl tracking-[8px] focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                      placeholder="000000"
                    />
                  </div>

                  {/* New Password input */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 font-mono">
                      รหัสผ่านใหม่ (New Password)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
                      <input
                        type="password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || forgotOtp.length < 6}
                    className="public-button-primary min-h-12 w-full px-5 text-sm"
                  >
                    {isLoading ? 'กำลังบันทึกรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}
                  </button>

                  <div className="text-center text-xs pt-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsForgotMode(false);
                        setForgotStep(1);
                        setErrorMsg(null);
                      }}
                      className="text-amber-500 hover:text-amber-405 hover:underline transition-colors font-bold"
                    >
                      ย้อนกลับไปหน้าเข้าสู่ระบบ
                    </button>
                  </div>
                </form>
              </>
            )
          ) : (
            <>
              <h2 className="text-xl font-bold text-neutral-100 mb-6 text-center">
                เข้าสู่ระบบบัญชีผู้ใช้งาน
              </h2>

              {forgotSuccessMsg && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-bold text-center">
                  {forgotSuccessMsg}
                </div>
              )}

              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-mono">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email input */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 font-mono">
                    อีเมลผู้ใช้งาน (Email)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 font-mono">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                      placeholder="••••••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Verification Links */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsForgotMode(true);
                      setForgotStep(1);
                      setErrorMsg(null);
                      setForgotSuccessMsg(null);
                    }}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                  <Link 
                    href="/pricing" 
                    className="text-amber-500 hover:text-amber-400 font-bold transition-colors"
                  >
                    สมัครสมาชิกใหม่
                  </Link>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="public-button-primary min-h-12 w-full px-5 text-sm"
                >
                  {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-neutral-600 mt-8 font-mono">
          ระบบผู้ช่วยอัจฉริยะสำหรับการเทรดทองคำ เวอร์ชั่น 1
        </p>
      </div>
    </main>
    </PublicShell>
  );
}
