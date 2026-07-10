import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken, signToken, verifyPassword, hashPassword } from '@/lib/auth';

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isAffiliate: true,
        bankName: true,
        bankAccount: true,
        bankAccountName: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Fetch profile API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId as string },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const {
      displayName,
      email,
      bankName,
      bankAccount,
      bankAccountName,
      currentPassword,
      newPassword,
    } = await req.json();

    const dataToUpdate: any = {};

    // 1. Email change validation
    if (email && email !== dbUser.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว' }, { status: 400 });
      }
      dataToUpdate.email = email;
    }

    // 2. Personal fields
    if (displayName !== undefined) dataToUpdate.displayName = displayName;

    // 3. Bank Account details for affiliates
    if (bankName !== undefined) dataToUpdate.bankName = bankName;
    if (bankAccount !== undefined) dataToUpdate.bankAccount = bankAccount;
    if (bankAccountName !== undefined) dataToUpdate.bankAccountName = bankAccountName;

    // 4. Password change handling
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสใหม่' }, { status: 400 });
      }
      const isPasswordValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
      }
      dataToUpdate.passwordHash = await hashPassword(newPassword);
    }

    // 5. Update database
    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: dataToUpdate,
    });

    // 6. Log activity
    await prisma.activityLog.create({
      data: {
        userId: dbUser.id,
        action: 'UPDATE_PROFILE',
        details: 'User updated profile details' + (newPassword ? ' and changed password' : ''),
      },
    });

    // 7. Re-sign token if email changed
    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: updatedUser.role,
        isAffiliate: updatedUser.isAffiliate,
        bankName: updatedUser.bankName,
        bankAccount: updatedUser.bankAccount,
        bankAccountName: updatedUser.bankAccountName,
        subscriptionPlan: updatedUser.subscriptionPlan,
        subscriptionStatus: updatedUser.subscriptionStatus,
      },
    });

    if (email && email !== dbUser.email) {
      const newToken = await signToken({
        userId: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      });

      response.cookies.set({
        name: 'auth_token',
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
      });
    }

    return response;
  } catch (error: any) {
    console.error('Update profile API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
