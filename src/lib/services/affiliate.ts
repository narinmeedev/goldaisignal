import { prisma } from '../prisma';

/**
 * Automatically creates a pending affiliate commission when a payment is approved.
 * Only applies if the paying user was referred by another user.
 */
export async function createCommissionFromPayment(paymentId: string) {
  try {
    // 1. Fetch the payment record and its associated user
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    });

    if (!payment) {
      console.warn(`[Affiliate] Payment ${paymentId} not found. Skipping commission.`);
      return { success: false, error: 'Payment not found' };
    }

    // 2. Check if the paying user has a referrer
    if (!payment.user.referredById) {
      // User was not referred by anyone, skip commission
      return { success: true, reason: 'No referrer' };
    }

    // 3. Find the referrer user to get their custom commission rate
    const referrer = await prisma.user.findUnique({
      where: { id: payment.user.referredById }
    });

    if (!referrer) {
      console.warn(`[Affiliate] Referrer user ID ${payment.user.referredById} not found. Skipping.`);
      return { success: false, error: 'Referrer not found' };
    }

    // 4. Guard: Check if a commission is already recorded for this payment (Prevent duplication)
    const existingCommission = await prisma.affiliateCommission.findFirst({
      where: { paymentId: payment.id }
    });

    if (existingCommission) {
      console.log(`[Affiliate] Commission for payment ${payment.id} already exists. Skipping duplicate.`);
      return { success: true, reason: 'Commission already exists', commission: existingCommission };
    }

    // 5. Calculate commission amount based on referrer's affiliateRate (default is 15% / 0.15)
    const commissionAmount = payment.amount * referrer.affiliateRate;

    // 6. Create the pending AffiliateCommission record
    const commission = await prisma.affiliateCommission.create({
      data: {
        referrerId: referrer.id,
        referredId: payment.userId,
        paymentId: payment.id,
        amount: commissionAmount,
        status: 'pending' // pending until paid out at the end of the month
      }
    });

    // 7. Log activity for the referrer
    await prisma.activityLog.create({
      data: {
        userId: referrer.id,
        action: 'PAYMENT_APPROVED', // We use this or custom log
        details: `ได้รับค่าคอมมิชชั่นแนะนำเพื่อน ฿${commissionAmount.toFixed(2)} (15% หรือตามเรทส่วนตัว) จากผู้ใช้ ${payment.user.email} (เลขอ้างอิงออเดอร์: ${paymentId})`
      }
    });

    console.log(`[Affiliate] Successfully generated commission for referrer ${referrer.email} (Amount: ฿${commissionAmount.toFixed(2)} from payment ฿${payment.amount})`);
    return { success: true, commission };

  } catch (error: any) {
    console.error(`[Affiliate] Error in createCommissionFromPayment for payment ${paymentId}:`, error);
    return { success: false, error: error.message };
  }
}
