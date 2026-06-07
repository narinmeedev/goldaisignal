import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, verifyVerificationToken } from '@/lib/auth';
import { minisaas } from '@/lib/minisaas';

export async function POST(req: Request) {
  try {
    const { email, password, otp, verificationToken, referralCode: incomingRefCode } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Invalid email or password too short' },
        { status: 400 }
      );
    }

    if (!verificationToken || !otp) {
      return NextResponse.json(
        { error: 'กรุณากรอกรหัส OTP ยืนยันตัวตน' },
        { status: 400 }
      );
    }

    const payload: any = await verifyVerificationToken(verificationToken);
    if (!payload || payload.email !== email) {
      return NextResponse.json(
        { error: 'โทเค็นสำหรับยืนยันตัวตนไม่ถูกต้องหรือหมดอายุ' },
        { status: 400 }
      );
    }

    if (payload.otpCode !== otp) {
      return NextResponse.json(
        { error: 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' },
        { status: 400 }
      );
    }

    if (Date.now() > payload.otpExpiresAt) {
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุแล้ว กรุณากดส่งรหัสใหม่อีกครั้ง' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists. Please login instead.' },
        { status: 400 }
      );
    }

    const passwordHash = payload.passwordHash;
    
    const trialSetting = await prisma.systemSetting.findUnique({
      where: { key: 'TRIAL_DURATION_DAYS' }
    });
    const trialDays = trialSetting ? parseInt(trialSetting.value, 10) : 30;

    let subscriptionPlan = 'trial';
    let subscriptionStatus = 'active';
    let subscriptionEndsAt = new Date();
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + trialDays);
    let details = `User registered for ${trialDays}-day free trial`;

    // Process Referral sponsor
    let referredById: string | null = null;
    if (incomingRefCode) {
      const sponsor = await prisma.user.findFirst({
        where: { referralCode: incomingRefCode.trim().toUpperCase() }
      });
      if (sponsor) {
        referredById = sponsor.id;
        details += ` (referred by user ID: ${sponsor.id})`;
      }
    }

    // Generate unique referral code for the new user
    const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Auto-create viewer user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'viewer',
        subscriptionStatus,
        subscriptionPlan,
        subscriptionEndsAt,
        referralCode,
        referredById,
      },
    });

    // Report user registration to Mini SaaS Center
    minisaas.trackUsage("user.register", { email: user.email }).catch(() => {});

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        details,
      }
    });

    // Auto-login
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json(
      { 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus
        } 
      },
      { status: 200 }
    );

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
