import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCommissionFromPayment } from '@/lib/services/affiliate';

export async function POST(req: Request) {
  // 1. Authenticate using the Mini SaaS Center API Key
  const authHeader = req.headers.get("Authorization");
  const localApiKey = process.env.MINISAAS_CENTER_API_KEY;
  if (!localApiKey) {
    console.error("MINISAAS_CENTER_API_KEY is not configured.");
    return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${localApiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId, status } = await req.json(); // status = 'approved' | 'rejected'

    if (!orderId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Find the local pending payment record
    const payment = await prisma.payment.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Guard: Prevent duplicate processing for already resolved payments
    if (payment.status === 'approved') {
      console.log(`Webhook received approval for order ${orderId} but payment is already approved locally. Skipping.`);
      return NextResponse.json({ success: true, message: "Payment already approved" });
    }
    if (payment.status === 'rejected') {
      console.log(`Webhook received update for order ${orderId} but payment is already rejected locally. Skipping.`);
      return NextResponse.json({ success: true, message: "Payment already rejected" });
    }

    if (status === 'approved') {
      // 1. Update payment status to approved
      await prisma.payment.update({
        where: { id: orderId },
        data: { status: 'approved' }
      });

      // 2. Calculate subscription extension days
      const paidSetting = await prisma.systemSetting.findUnique({
        where: { key: 'PAID_DURATION_DAYS' }
      });
      const paidDays = paidSetting ? parseInt(paidSetting.value, 10) : 30;

      const now = new Date();
      let newEndDate = new Date(now.getTime() + paidDays * 24 * 60 * 60 * 1000);
      
      // If user has active subscription in the future, extend from that date
      if (payment.user.subscriptionEndsAt && payment.user.subscriptionEndsAt > now) {
        newEndDate = new Date(payment.user.subscriptionEndsAt.getTime() + paidDays * 24 * 60 * 60 * 1000);
      }

      // 3. Update user subscription status
      await prisma.user.update({
        where: { id: payment.userId },
        data: {
          subscriptionStatus: 'active',
          subscriptionPlan: 'monthly',
          subscriptionEndsAt: newEndDate,
        }
      });

      // 4. Log activity
      await prisma.activityLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_APPROVED',
          details: `Approved centrally via Mini SaaS Center webhook (Order ID: ${orderId})`
        }
      });

      // Generate affiliate commission if applicable
      await createCommissionFromPayment(orderId);

      console.log(`Payment order ${orderId} successfully approved and active VIP subscription applied to user ${payment.user.email}`);

    } else if (status === 'rejected') {
      // 1. Update payment status to rejected
      await prisma.payment.update({
        where: { id: orderId },
        data: { status: 'rejected' }
      });

      // 2. Mark user subscription as expired/inactive if pending
      if (payment.user.subscriptionStatus === 'pending') {
        await prisma.user.update({
          where: { id: payment.userId },
          data: { subscriptionStatus: 'expired' }
        });
      }

      // 3. Log activity
      await prisma.activityLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_REJECTED',
          details: `Rejected centrally via Mini SaaS Center webhook (Order ID: ${orderId})`
        }
      });

      console.log(`Payment order ${orderId} rejected and user ${payment.user.email} marked expired`);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Payment approval webhook exception error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
