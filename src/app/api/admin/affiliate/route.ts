import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getJwtSecretKey } from '@/lib/auth';

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // 1. Fetch all users who are referrers (have referees) or have commissions
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { referees: { some: {} } },
          { commissions: { some: {} } }
        ]
      },
      select: {
        id: true,
        email: true,
        affiliateRate: true,
        createdAt: true,
        referees: {
          select: {
            id: true,
            email: true,
            subscriptionStatus: true,
            subscriptionPlan: true
          }
        },
        commissions: {
          include: {
            referred: { select: { email: true } },
            payment: { select: { amount: true, createdAt: true } }
          }
        }
      }
    });

    // 2. Format the response
    const affiliates = users.map(user => {
      let pendingCommission = 0;
      let paidCommission = 0;
      let totalRevenue = 0;

      user.commissions.forEach(c => {
        if (c.status === 'pending') {
          pendingCommission += c.amount;
        } else if (c.status === 'paid') {
          paidCommission += c.amount;
        }
        totalRevenue += c.payment.amount;
      });

      const totalSignups = user.referees.length;
      const activeReferees = user.referees.filter(
        r => r.subscriptionStatus === 'active' && r.subscriptionPlan === 'monthly'
      ).length;

      return {
        id: user.id,
        email: user.email,
        affiliateRate: user.affiliateRate,
        createdAt: user.createdAt,
        totalSignups,
        activeReferees,
        totalRevenue,
        pendingCommission,
        paidCommission,
        commissions: user.commissions.map(c => ({
          id: c.id,
          referredEmail: c.referred.email,
          paymentAmount: c.payment.amount,
          commissionAmount: c.amount,
          status: c.status,
          createdAt: c.createdAt
        }))
      };
    });

    return NextResponse.json({ success: true, affiliates });
  } catch (err: any) {
    console.error('Admin affiliate GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, userId, rate } = await req.json();

    if (!action || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'update-rate') {
      if (rate === undefined || typeof rate !== 'number' || rate < 0 || rate > 1) {
        return NextResponse.json({ error: 'Invalid commission rate. Must be between 0 and 1.' }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { affiliateRate: rate }
      });

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'PAYMENT_APPROVED', // System log action
          details: `Admin updated affiliate rate to ${(rate * 100).toFixed(0)}%`
        }
      });

      return NextResponse.json({ success: true, message: `อัปเดตอัตราส่วนแบ่งคอมมิชชั่นเป็น ${(rate * 100).toFixed(0)}% สำเร็จ` });

    } else if (action === 'payout-cutoff') {
      // Find all pending commissions for this user
      const pendingCommissions = await prisma.affiliateCommission.findMany({
        where: { referrerId: userId, status: 'pending' }
      });

      if (pendingCommissions.length === 0) {
        return NextResponse.json({ error: 'ไม่มีค่าคอมมิชชั่นที่ค้างชำระสำหรับผู้ใช้นี้' }, { status: 400 });
      }

      const totalPayoutAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);

      // Mark all as paid
      await prisma.affiliateCommission.updateMany({
        where: { referrerId: userId, status: 'pending' },
        data: { status: 'paid' }
      });

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'PAYMENT_APPROVED',
          details: `Admin executed payout cutoff: Marked ฿${totalPayoutAmount.toFixed(2)} as PAID (bank transfer)`
        }
      });

      return NextResponse.json({
        success: true,
        message: `ตัดยอดการจ่ายเงินสำเร็จ! บันทึกยอดจ่าย ฿${totalPayoutAmount.toFixed(2)} เรียบร้อยแล้ว`
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (err: any) {
    console.error('Admin affiliate POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
