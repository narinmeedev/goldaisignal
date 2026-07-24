import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { NotificationService } from '@/lib/services/notification.service';
import { prisma } from '@/lib/prisma';
import { getJwtSecretKey } from '@/lib/auth';

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.role !== 'admin' || typeof payload.userId !== 'string') return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function POST() {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const adminUser = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: { lineId: true },
    });
    if (!adminUser?.lineId) {
      const verification = await NotificationService.verifyConfiguration();
      if (!verification.success) {
        return NextResponse.json(
          { error: verification.error || 'LINE Messaging API เชื่อมต่อไม่สำเร็จ' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        sent: false,
        message: 'LINE Messaging API พร้อมใช้งาน แต่บัญชีแอดมินยังไม่ได้เชื่อม LINE จึงไม่มีข้อความทดสอบถูกส่ง',
      });
    }

    const message = `ทดสอบระบบแจ้งเตือน Gold AI Signal\n\nLINE Messaging API เชื่อมต่อกับบัญชีแอดมินเรียบร้อย\nเวลาทดสอบ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

    const result = await NotificationService.sendNotification(message, {
      testLineUserId: adminUser.lineId,
    });

    if (!result.lineUsers?.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.lineUsers?.error || 'LINE ไม่ตอบรับข้อความทดสอบ',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sent: true,
      message: 'ส่งข้อความทดสอบไปยัง LINE ที่เชื่อมกับบัญชีแอดมินแล้ว',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to trigger test notification: ${message}` }, { status: 500 });
  }
}
