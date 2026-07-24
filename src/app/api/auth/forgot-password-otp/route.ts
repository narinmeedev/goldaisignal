import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signVerificationToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomInt } from 'node:crypto';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'กรุณาระบุอีเมล' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    // Generate a 6-digit random code
    const otpCode = randomInt(100000, 1_000_000).toString();
    const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    // Generate stateless verification token containing email and OTP
    const verificationToken = await signVerificationToken({
      email,
      otpCode,
      otpExpiresAt,
    });

    // Send OTP email
    await sendPasswordResetEmail(email, otpCode);

    return NextResponse.json({
      success: true,
      verificationToken,
      message: 'รหัส OTP ถูกส่งไปทางอีเมลเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('Forgot password OTP request error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}
