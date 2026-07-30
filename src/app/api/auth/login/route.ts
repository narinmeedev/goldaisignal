import { NextResponse } from 'next/server';
import { prisma, resetPrismaClient } from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { minisaas } from '@/lib/minisaas';

const DATABASE_UNAVAILABLE_CODES = new Set([
  '57P01',
  '57P03',
  '08006',
  'XX000',
  'ECIRCUITBREAKER',
]);

function isDatabaseUnavailable(error: unknown) {
  const topLevel = error as {
    code?: unknown;
    message?: unknown;
    cause?: {
      code?: unknown;
      message?: unknown;
      originalCode?: unknown;
      originalMessage?: unknown;
    };
  };
  const details = [
    String(error),
    topLevel.code,
    topLevel.message,
    topLevel.cause?.code,
    topLevel.cause?.message,
    topLevel.cause?.originalCode,
    topLevel.cause?.originalMessage,
  ].join(' ');

  return (
    details.includes('Connection terminated') ||
    details.includes('connection timeout') ||
    [...DATABASE_UNAVAILABLE_CODES].some((code) => details.includes(code))
  );
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const client = attempt === 0 ? prisma : resetPrismaClient();
        user = await client.user.findFirst({
          where: { email: normalizedEmail },
        });
        break;
      } catch (err: any) {
        console.warn(`[Login DB Retry] Attempt ${attempt + 1} failed:`, err?.message || err);
        resetPrismaClient();
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login time and log activity safely
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          details: 'User logged in'
        }
      });
    } catch (logErr) {
      console.error('[Login DB Logging Failed - Ignored]:', logErr);
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Report user login to Mini SaaS Center
    minisaas.trackUsage("user.login", { email: user.email }).catch(() => {});

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

    // Set HTTP-only cookie
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
    console.error('Login error:', error);

    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        {
          error: 'ระบบฐานข้อมูลกำลังปรับปรุงชั่วคราว กรุณาลองเข้าสู่ระบบอีกครั้งภายหลัง',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    );
  }
}
