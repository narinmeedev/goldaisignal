import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.userId as string;

    // 1. Fetch user subscription details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Double check expiration on server side
    let currentStatus = user.subscriptionStatus;
    if (currentStatus === 'active' && user.subscriptionEndsAt && user.subscriptionEndsAt < new Date()) {
      currentStatus = 'expired';
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: 'expired' }
      });
    }

    // 2. Fetch payments for this user
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan,
        status: currentStatus,
        endsAt: user.subscriptionEndsAt ? user.subscriptionEndsAt.toISOString() : null,
      },
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        slipUrl: p.slipUrl,
        status: p.status,
        notes: p.notes,
        createdAt: p.createdAt.toISOString()
      }))
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch billing details', details: err.message },
      { status: 500 }
    );
  }
}
