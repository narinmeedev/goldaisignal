import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyVerificationToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword, verificationToken } = await req.json();

    if (!email || !otp || !newPassword || !verificationToken) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Verify token
    const payload: any = await verifyVerificationToken(verificationToken);
    if (!payload) {
      return NextResponse.json(
        { error: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุการใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Check email and OTP matching
    if (payload.email !== email || payload.otpCode !== otp) {
      return NextResponse.json(
        { error: 'รหัสยืนยัน OTP ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check expiration
    if (payload.otpExpiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'รหัสยืนยัน OTP หมดอายุแล้ว' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ในระบบ' },
        { status: 404 }
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update the database
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'RESET_PASSWORD',
        details: 'User successfully reset password via OTP'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านบัญชีของคุณเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('Reset password verification error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}
