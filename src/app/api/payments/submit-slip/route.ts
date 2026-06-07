import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { minisaas } from '@/lib/minisaas';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET || 'gold-signal-fallback-secret-key-32-chars';
  return new TextEncoder().encode(secret);
};

async function getUserFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const amountStr = formData.get('amount') as string;
    
    if (!file || !amountStr) {
      return NextResponse.json({ error: 'Missing file or amount' }, { status: 400 });
    }

    const amount = parseFloat(amountStr);
    
    // Check if bucket exists, if not, try to create it (Admin key required usually, but we will try)
    // Actually, it's safer to just attempt upload and catch error.
    
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${user.userId}_${Date.now()}.${fileExt}`;
    const filePath = `payments/${fileName}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let slipUrl = '';

    // Check if Supabase keys are placeholders or missing
    const isSupabasePlaceholder = 
      !process.env.SUPABASE_URL || 
      process.env.SUPABASE_URL.includes('placeholder') || 
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder-anon-key');

    if (isSupabasePlaceholder) {
      console.log('Supabase storage is placeholder. Saving slip as Base64 Data URI...');
      const base64Data = buffer.toString('base64');
      const mimeType = file.type || 'image/png';
      slipUrl = `data:${mimeType};base64,${base64Data}`;
      console.log('Generated Base64 Data URI (length:', slipUrl.length, ')');
    } else {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slips')
        .upload(filePath, buffer, {
          contentType: file.type || 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        
        // Fallback: If bucket doesn't exist, we will try to create it or do Base64 fallback.
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('Invalid API key') || uploadError.message.includes('Invalid token')) {
          try {
            await supabase.storage.createBucket('slips', { public: true });
            // Retry
            const retry = await supabase.storage.from('slips').upload(filePath, buffer, { contentType: file.type });
            if (retry.error) {
              console.log('Failed retry. Saving as Base64 fallback...');
              const base64Data = buffer.toString('base64');
              const mimeType = file.type || 'image/png';
              slipUrl = `data:${mimeType};base64,${base64Data}`;
            } else {
              const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);
              slipUrl = publicUrlData.publicUrl;
            }
          } catch (bucketErr) {
            console.error('Error creating bucket, fallback to Base64:', bucketErr);
            const base64Data = buffer.toString('base64');
            const mimeType = file.type || 'image/png';
            slipUrl = `data:${mimeType};base64,${base64Data}`;
          }
        } else {
          // Fallback to Base64 on any other error
          console.log('Upload failed. Saving as Base64 fallback...');
          const base64Data = buffer.toString('base64');
          const mimeType = file.type || 'image/png';
          slipUrl = `data:${mimeType};base64,${base64Data}`;
        }
      } else {
        const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);
        slipUrl = publicUrlData.publicUrl;
      }
    }

    // --- AUTOMATED PROMPTPAY SLIP VERIFICATION ENGINE ---
    let isAutoApproved = false;
    let autoApproveNote = '';

    const slipokKey = process.env.SLIPOK_API_KEY;
    const slipokBranchId = process.env.SLIPOK_BRANCH_ID;
    const easyslipKey = process.env.EASYSLIP_API_KEY;

    if (slipokKey) {
      try {
        const verifyUrl = slipokBranchId 
          ? `https://api.slipok.com/api/line/apikey/${slipokBranchId}` 
          : 'https://api.slipok.com/api/line/apikey';
        
        console.log(`Verifying slip via SlipOK API URL: ${verifyUrl}`);
        const slipokFormData = new FormData();
        const blob = new Blob([buffer], { type: file.type || 'image/png' });
        slipokFormData.append('files', blob, file.name || 'slip.png');

        const slipokRes = await fetch(verifyUrl, {
          method: 'POST',
          headers: {
            'x-authorization': slipokKey,
          },
          body: slipokFormData,
        });

        if (slipokRes.ok) {
          const slipokData = await slipokRes.json();
          console.log('SlipOK response:', slipokData);
          if (slipokData.success && slipokData.data) {
            const transAmount = slipokData.data.amount;
            if (transAmount >= amount) {
              isAutoApproved = true;
              autoApproveNote = `อนุมัติอัตโนมัติโดย SlipOK (ยอดโอนจริง: ฿${transAmount})`;
            } else {
              autoApproveNote = `ยอดเงินไม่ตรง: โอนจริง ฿${transAmount} แต่แพ็กเกจต้องการ ฿${amount}`;
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
    } else if (easyslipKey) {
      try {
        console.log('Verifying slip via EasySlip API (URL)...', slipUrl);
        const easyslipRes = await fetch('https://developer.easyslip.com/api/v1/verify/url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${easyslipKey}`
          },
          body: JSON.stringify({ url: slipUrl }),
        });

        if (easyslipRes.ok) {
          const easyslipData = await easyslipRes.json();
          console.log('EasySlip response:', easyslipData);
          if (easyslipData.status === 200 && easyslipData.data) {
            const transAmount = easyslipData.data.amount?.amount || easyslipData.data.amount;
            if (transAmount >= amount) {
              isAutoApproved = true;
              autoApproveNote = `อนุมัติอัตโนมัติโดย EasySlip (ยอดโอนจริง: ฿${transAmount})`;
            } else {
              autoApproveNote = `ยอดเงินไม่ตรง: โอนจริง ฿${transAmount} แต่แพ็กเกจต้องการ ฿${amount}`;
            }
          } else {
            autoApproveNote = `EasySlip ตรวจสอบสลิปไม่ผ่าน: ${easyslipData.message || 'ไม่มีรายละเอียดข้อมูล'}`;
          }
        } else {
          console.error('EasySlip API error status:', easyslipRes.status);
          autoApproveNote = `ระบบตรวจสอบล้มเหลว: EasySlip API ตอบกลับสถานะ ${easyslipRes.status}`;
        }
      } catch (err: any) {
        console.error('EasySlip connection error:', err);
        autoApproveNote = `ระบบเชื่อมต่อตรวจสอบผิดพลาด (EasySlip): ${err.message}`;
      }
    } else {
      // --- SMART SIMULATOR MODE FALLBACK ---
      console.log('No Slip verification API keys found. Running in Smart Simulator Mode...');
      await new Promise((resolve) => setTimeout(resolve, 3500)); // Simulate bank api delay
      isAutoApproved = true;
      autoApproveNote = `อนุมัติอัตโนมัติ (โหมดทดสอบระบบ - ไม่พบ API Key ยืนยันสลิป)`;
    }

    // If SlipOK verified it, we auto-approve locally and centrally.
    let paymentStatus = 'pending';
    let localApproved = false;

    if (isAutoApproved) {
      paymentStatus = 'approved';
      localApproved = true;
    }

    // Create payment record in DB
    const payment = await prisma.payment.create({
      data: {
        userId: user.userId,
        amount,
        slipUrl,
        status: paymentStatus,
        notes: autoApproveNote,
      }
    });

    const userDb = await prisma.user.findUnique({ where: { id: user.userId } });

    if (localApproved) {
      // Fetch extension days setting
      const paidSetting = await prisma.systemSetting.findUnique({
        where: { key: 'PAID_DURATION_DAYS' }
      });
      const paidDays = paidSetting ? parseInt(paidSetting.value, 10) : 30;

      const now = new Date();
      let newEndDate = new Date(now.getTime() + paidDays * 24 * 60 * 60 * 1000);
      
      if (userDb?.subscriptionEndsAt && userDb.subscriptionEndsAt > now) {
        newEndDate = new Date(userDb.subscriptionEndsAt.getTime() + paidDays * 24 * 60 * 60 * 1000);
      }

      // Automatically upgrade user to active monthly plan
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          subscriptionStatus: 'active',
          subscriptionPlan: 'monthly',
          subscriptionEndsAt: newEndDate,
        }
      });

      // Report Payment Order to Mini SaaS Center as APPROVED (this also creates the RevenueEvent centrally)
      minisaas.trackPaymentOrder({
        orderId: payment.id,
        userEmail: user.email,
        amount: payment.amount,
        currency: "THB",
        planName: "Premium VIP Monthly",
        slipUrl: payment.slipUrl,
        notes: autoApproveNote,
        status: "APPROVED"
      }).catch(err => console.error("Failed to forward approved payment order to central:", err));

      await prisma.activityLog.create({
        data: {
          userId: user.userId,
          action: 'PAYMENT_APPROVED',
          details: `System automatically approved payment ${payment.id}: ${autoApproveNote}`
        }
      });
    } else {
      // Default fallback: Pending manual review locally in GoldaiSignal
      const now = new Date();
      const isCurrentlyActive = userDb?.subscriptionStatus === 'active' && userDb.subscriptionEndsAt && userDb.subscriptionEndsAt > now;

      // Only downgrade subscriptionStatus to pending if the user does NOT have an active subscription currently
      if (!isCurrentlyActive) {
        await prisma.user.update({
          where: { id: user.userId },
          data: { subscriptionStatus: 'pending' }
        });
      }

      // Report Payment Order to Mini SaaS Center including the SlipOK verification notes as PENDING
      minisaas.trackPaymentOrder({
        orderId: payment.id,
        userEmail: user.email,
        amount: payment.amount,
        currency: "THB",
        planName: "Premium VIP Monthly",
        slipUrl: payment.slipUrl,
        notes: autoApproveNote,
        status: "PENDING"
      }).catch(err => console.error("Failed to forward pending payment order to central:", err));

      await prisma.activityLog.create({
        data: {
          userId: user.userId,
          action: 'SUBMIT_PAYMENT',
          details: `Submitted slip for amount ${amount} (Pending review: ${autoApproveNote})`
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      payment, 
      isAutoApproved: localApproved 
    });

  } catch (err: any) {
    console.error('Payment submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
