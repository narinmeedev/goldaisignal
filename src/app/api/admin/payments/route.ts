import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { minisaas } from '@/lib/minisaas';
import { createCommissionFromPayment } from '@/lib/services/affiliate';
import { getPaidDurationDays } from '@/lib/billing';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET || 'gold-signal-fallback-secret-key-32-chars';
  return new TextEncoder().encode(secret);
};

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
    const payments = await prisma.payment.findMany({
      include: {
        user: {
          select: { email: true, subscriptionStatus: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, payments });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { paymentId, action } = await req.json(); // action = 'approve' | 'reject' | 'recheck'
    
    if (!paymentId || !['approve', 'reject', 'recheck'].includes(action)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Guard: Prevent double-processing an already approved payment
    if (payment.status === 'approved') {
      return NextResponse.json({ error: 'ชำระเงินเรียบร้อยแล้ว ไม่สามารถดำเนินการซ้ำได้' }, { status: 400 });
    }

    if (action === 'approve') {
      // 1. Update payment status
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'approved' }
      });

      // Sync payment order status and record revenue centrally
      const user = await prisma.user.findUnique({ where: { id: payment.userId } });
      minisaas.trackPaymentOrder({
        orderId: payment.id,
        userEmail: user?.email || "unknown@example.com",
        amount: payment.amount,
        currency: "THB",
        planName: "Premium VIP Monthly",
        slipUrl: payment.slipUrl,
        notes: payment.notes || "Approved manually by admin on SaaS client",
        status: "APPROVED"
      }).catch(err => console.error("Failed to sync manual approval to central:", err));

      // 2. Extend user subscription by PAID_DURATION_DAYS from settings
      const paidSetting = await prisma.systemSetting.findUnique({
        where: { key: 'PAID_DURATION_DAYS' }
      });
      const paidDays = getPaidDurationDays(paidSetting?.value);

      const now = new Date();
      let newEndDate = new Date(now.getTime() + paidDays * 24 * 60 * 60 * 1000);
      
      // If user already has active subscription in the future, extend from that date
      if (user?.subscriptionEndsAt && user.subscriptionEndsAt > now) {
        newEndDate = new Date(user.subscriptionEndsAt.getTime() + paidDays * 24 * 60 * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: payment.userId },
        data: { 
          subscriptionStatus: 'active',
          subscriptionPlan: 'monthly',
          subscriptionEndsAt: newEndDate,
          role: user?.role === 'admin' ? 'admin' : 'viewer' // keep existing role
        }
      });

      await prisma.activityLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_APPROVED',
          details: `Admin approved payment ${paymentId}`
        }
      });

      // Generate affiliate commission if applicable
      await createCommissionFromPayment(paymentId);
    } else if (action === 'reject') {
       await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'rejected' }
      });

      await prisma.activityLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_REJECTED',
          details: `Admin rejected payment ${paymentId}`
        }
      });

      // Optionally update user status if they have no other active subscriptions
      await prisma.user.update({
        where: { id: payment.userId },
        data: { subscriptionStatus: 'expired' }
      });
    } else if (action === 'recheck') {
      if (!payment.slipUrl) {
        return NextResponse.json({ error: 'ไม่พบลิงก์หรือข้อมูลสลิป' }, { status: 400 });
      }

      let buffer: Uint8Array;
      try {
        if (payment.slipUrl.startsWith('data:')) {
          const base64Data = payment.slipUrl.split(',')[1];
          const nodeBuffer = Buffer.from(base64Data, 'base64');
          buffer = new Uint8Array(nodeBuffer.buffer, nodeBuffer.byteOffset, nodeBuffer.byteLength);
        } else {
          const res = await fetch(payment.slipUrl);
          if (!res.ok) throw new Error(`Failed to fetch slip image: ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          buffer = new Uint8Array(arrayBuffer);
        }
      } catch (fetchErr: any) {
        console.error('Recheck image read error:', fetchErr);
        return NextResponse.json({ error: `ล้มเหลวในการอ่านรูปภาพสลิป: ${fetchErr.message}` }, { status: 500 });
      }


      const slipokKey = process.env.SLIPOK_API_KEY;
      const slipokBranchId = process.env.SLIPOK_BRANCH_ID;
      
      let isAutoApproved = false;
      let autoApproveNote = '';

      if (slipokKey) {
        try {
          const verifyUrl = slipokBranchId 
            ? `https://api.slipok.com/api/line/apikey/${slipokBranchId}` 
            : 'https://api.slipok.com/api/line/apikey';
          
          console.log(`Re-verifying slip via SlipOK API URL: ${verifyUrl}`);
          const slipokFormData = new FormData();
          const mimeType = payment.slipUrl.startsWith('data:') 
            ? (payment.slipUrl.split(';')[0].split(':')[1] || 'image/png')
            : 'image/png';
          const fileExt = mimeType.split('/')[1] || 'png';
          const blob = new Blob([buffer as any], { type: mimeType });
          slipokFormData.append('files', blob, `slip.${fileExt}`);

          const slipokRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
              'x-authorization': slipokKey,
            },
            body: slipokFormData,
          });

          if (slipokRes.ok) {
            const slipokData = await slipokRes.json();
            console.log('Recheck SlipOK response:', slipokData);
            if (slipokData.success && slipokData.data) {
              const transAmount = slipokData.data.amount;
              if (transAmount >= payment.amount) {
                isAutoApproved = true;
                autoApproveNote = `อนุมัติสำเร็จจากการ Recheck SlipOK (ยอดโอนจริง: ฿${transAmount})`;
              } else {
                autoApproveNote = `ยอดเงินไม่ตรง: โอนจริง ฿${transAmount} แต่แพ็กเกจต้องการ ฿${payment.amount}`;
              }
            } else {
              autoApproveNote = `SlipOK ตรวจสอบสลิปไม่ผ่าน: ${slipokData.message || 'ไม่มีรายละเอียดข้อมูล'}`;
            }
          } else {
            console.error('SlipOK API error status:', slipokRes.status);
            autoApproveNote = `ระบบตรวจสอบล้มเหลว: SlipOK API ตอบกลับสถานะ ${slipokRes.status}`;
          }
        } catch (err: any) {
          console.error('SlipOK connection error:', err);
          autoApproveNote = `ระบบเชื่อมต่อตรวจสอบผิดพลาด (SlipOK): ${err.message}`;
        }
      } else {
        autoApproveNote = 'ไม่พบ SlipOK API Key ในระบบ';
      }

      // Update payment record notes
      await prisma.payment.update({
        where: { id: paymentId },
        data: { notes: autoApproveNote }
      });

      if (isAutoApproved) {
        // Approve payment
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'approved' }
        });

        // Sync payment order status and record revenue centrally
        const user = await prisma.user.findUnique({ where: { id: payment.userId } });
        minisaas.trackPaymentOrder({
          orderId: payment.id,
          userEmail: user?.email || "unknown@example.com",
          amount: payment.amount,
          currency: "THB",
          planName: "Premium VIP Monthly",
          slipUrl: payment.slipUrl,
          notes: autoApproveNote,
          status: "APPROVED"
        }).catch(err => console.error("Failed to sync recheck approval to central:", err));

        // Extend user subscription
        const paidSetting = await prisma.systemSetting.findUnique({
          where: { key: 'PAID_DURATION_DAYS' }
        });
        const paidDays = getPaidDurationDays(paidSetting?.value);

        const now = new Date();
        let newEndDate = new Date(now.getTime() + paidDays * 24 * 60 * 60 * 1000);
        
        if (user?.subscriptionEndsAt && user.subscriptionEndsAt > now) {
          newEndDate = new Date(user.subscriptionEndsAt.getTime() + paidDays * 24 * 60 * 60 * 1000);
        }

        await prisma.user.update({
          where: { id: payment.userId },
          data: { 
            subscriptionStatus: 'active',
            subscriptionPlan: 'monthly',
            subscriptionEndsAt: newEndDate,
          }
        });

        await prisma.activityLog.create({
          data: {
            userId: payment.userId,
            action: 'PAYMENT_APPROVED',
            details: `SlipOK Auto-Approved via manual Recheck. ${autoApproveNote}`
          }
        });

        // Generate affiliate commission if applicable
        await createCommissionFromPayment(paymentId);

        return NextResponse.json({ success: true, verified: true, message: autoApproveNote });
      } else {
        return NextResponse.json({ success: true, verified: false, message: autoApproveNote });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Payment update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
