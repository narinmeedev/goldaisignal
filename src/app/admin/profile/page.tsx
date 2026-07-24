'use client';

import React, { useState, useEffect } from 'react';
import { User, ShieldCheck, Mail, Lock, Landmark, Save, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');

  // Bank Info states
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status states
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [bankMsg, setBankMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setDisplayName(data.user.displayName || '');
            setEmail(data.user.email || '');
            setRole(data.user.role || '');
            setIsAffiliate(!!data.user.isAffiliate);
            setSubscriptionPlan(data.user.subscriptionPlan || '');
            setSubscriptionStatus(data.user.subscriptionStatus || '');
            setBankName(data.user.bankName || '');
            setBankAccount(data.user.bankAccount || '');
            setBankAccountName(data.user.bankAccountName || '');
          }
        }
      } catch (err) {
        setProfileMsg({ text: 'โหลดข้อมูลโปรไฟล์ล้มเหลว', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProfileMsg({ text: 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว', type: 'success' });
      } else {
        setProfileMsg({ text: data.error || 'ล้มเหลวในการอัปเดตโปรไฟล์', type: 'error' });
      }
    } catch {
      setProfileMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdateBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    setBankMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, bankAccount, bankAccountName }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBankMsg({ text: 'บันทึกข้อมูลบัญชีธนาคารสำหรับรับส่วนแบ่งฟีดสำเร็จ', type: 'success' });
      } else {
        setBankMsg({ text: data.error || 'ล้มเหลวในการบันทึกบัญชี', type: 'error' });
      }
    } catch {
      setBankMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ text: '', type: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'รหัสผ่านใหม่ไม่ตรงกัน', type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร', type: 'error' });
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordMsg({ text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ text: data.error || 'เปลี่ยนรหัสผ่านล้มเหลว', type: 'error' });
      }
    } catch {
      setPasswordMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-24 bg-neutral-950 min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-5 sm:px-6 lg:px-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
          <User className="h-6 w-6 text-amber-500" />
          ตั้งค่าบัญชี & โปรไฟล์ (Account Settings)
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          แก้ไขข้อมูลส่วนตัว ผูกบัญชีรับเงินของพาร์ทเนอร์ และตั้งรหัสผ่านใหม่
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Profile Info */}
        <div className="space-y-8">
          {/* Personal Info Card */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-neutral-850 pb-3">
              <Mail className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-neutral-100">ข้อมูลส่วนตัว (Personal Details)</h2>
            </div>

            {profileMsg.text && (
              <div className={`p-3.5 rounded-xl text-xs font-mono border ${
                profileMsg.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs text-neutral-400">ชื่อผู้ใช้งาน (Display Name)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                  placeholder="ชื่อเล่น หรือชื่อจริงของคุณ"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-neutral-400">อีเมลลงทะเบียน (Email)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50 font-mono"
                  placeholder="yourname@example.com"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  บันทึกข้อมูลส่วนตัว
                </button>
              </div>
            </form>
          </div>

          {/* Account Details View */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-neutral-850 pb-3">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-neutral-100">สถานะสมาชิก & บทบาท</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                <span className="text-[9px] text-neutral-500 uppercase block tracking-wider mb-1">สิทธิ์เข้าถึง</span>
                <span className="text-neutral-200 font-bold uppercase">{role}</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                <span className="text-[9px] text-neutral-500 uppercase block tracking-wider mb-1">แพ็กเกจ</span>
                <span className="text-amber-400 font-bold uppercase">{subscriptionPlan}</span>
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 col-span-2">
                <span className="text-[9px] text-neutral-500 uppercase block tracking-wider mb-1">สถานะผู้ใช้งาน</span>
                <span className={`inline-block font-extrabold uppercase mt-0.5 ${
                  subscriptionStatus === 'active' ? 'text-emerald-400' : 'text-rose-450'
                }`}>
                  {subscriptionStatus === 'active' ? 'Active (ใช้งานได้ปกติ)' : 'Expired (หมดอายุสัญญา)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Bank details & password change */}
        <div className="space-y-8">
          {/* Bank Info Card (Conditionally for Affiliates) */}
          {isAffiliate && (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-neutral-850 pb-3">
                <Landmark className="h-5 w-5 text-amber-500" />
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-neutral-100">บัญชีรับเงินแนะเพื่อน (Affiliate Bank Account)</h2>
                  <p className="text-[10px] text-emerald-400">ปลดล็อคแล้ว: ในฐานะพาร์ทเนอร์ผู้รับคอมมิชชัน</p>
                </div>
              </div>

              {bankMsg.text && (
                <div className={`p-3.5 rounded-xl text-xs font-mono border ${
                  bankMsg.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {bankMsg.text}
                </div>
              )}

              <form onSubmit={handleUpdateBankInfo} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-neutral-400">ธนาคาร (Bank Name)</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                    placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs text-neutral-400">เลขที่บัญชี (Account Number)</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50 font-mono"
                      placeholder="000-0-00000-0"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs text-neutral-400">ชื่อบัญชี (Account Holder's Name)</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                      placeholder="ชื่อ-นามสกุล สะกดภาษาไทย/อังกฤษ"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingBank}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    บันทึกบัญชีรับเงิน
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Change Password Card */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-neutral-850 pb-3">
              <Lock className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-neutral-100">เปลี่ยนรหัสผ่าน (Change Password)</h2>
            </div>

            {passwordMsg.text && (
              <div className={`p-3.5 rounded-xl text-xs font-mono border ${
                passwordMsg.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs text-neutral-400">รหัสผ่านปัจจุบัน (Current Password)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-neutral-400">รหัสผ่านใหม่ (New Password)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-neutral-400">ยืนยันรหัสผ่านใหม่ (Confirm New Password)</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingPassword || !currentPassword || !newPassword}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  อัปเดตรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
