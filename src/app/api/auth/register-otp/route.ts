import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signVerificationToken } from '@/lib/auth';
import { sendOtpEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Invalid email or password too short' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists. Please login instead.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    
    // Generate a 6-digit random code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    // Generate stateless verification token containing hashed password and OTP
    const verificationToken = await signVerificationToken({
      email,
      passwordHash,
      otpCode,
      otpExpiresAt,
    });

    // Send OTP email
    await sendOtpEmail(email, otpCode);

    return NextResponse.json({
      success: true,
      verificationToken,
      message: 'OTP sent successfully to your email.'
    });

  } catch (error) {
    console.error('Register OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
