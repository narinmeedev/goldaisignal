import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { role: true, subscriptionStatus: true, subscriptionEndsAt: true },
    });
    const expired = user?.subscriptionEndsAt && user.subscriptionEndsAt < new Date();
    if (!user || (user.role !== 'admin' && (user.subscriptionStatus !== 'active' || expired))) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const trades = await prisma.paperTrade.findMany({
      where: { symbol: { contains: 'XAU' } },
      orderBy: { openedAt: 'desc' },
      include: {
        signal: true,
      },
    });

    return NextResponse.json(trades);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve paper trades log.', details: err.message },
      { status: 500 }
    );
  }
}
