import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    const res = NextResponse.json({ authenticated: false }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res;
  }

  const payload = await verifyToken(token);

  if (!payload) {
    const res = NextResponse.json({ authenticated: false }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId as string }
  });

  if (!dbUser) {
    const res = NextResponse.json({ authenticated: false }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res;
  }

  let currentStatus = dbUser.subscriptionStatus;
  
  if (currentStatus === 'active' && dbUser.subscriptionEndsAt && dbUser.subscriptionEndsAt < new Date()) {
    currentStatus = 'expired';
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { subscriptionStatus: 'expired' }
    });
  }

  // Fetch VIP community invite links from system settings
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['TELEGRAM_VIP_LINK', 'LINE_VIP_LINK'] } }
  });
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  const telegramVipLink = settingsMap.get('TELEGRAM_VIP_LINK') || 'https://t.me/+GoldAISignalVIP';
  const lineVipLink = settingsMap.get('LINE_VIP_LINK') || 'https://line.me/R/ti/p/@413aryiz';

  const response = NextResponse.json({
    authenticated: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName || dbUser.email.split('@')[0],
      role: dbUser.role,
      subscriptionPlan: dbUser.subscriptionPlan,
      subscriptionStatus: currentStatus,
      subscriptionEndsAt: dbUser.subscriptionEndsAt,
      isAffiliate: dbUser.isAffiliate,
      referralCode: dbUser.referralCode,
      telegramVipLink,
      lineVipLink,
    }
  }, { status: 200 });

  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return response;
}
