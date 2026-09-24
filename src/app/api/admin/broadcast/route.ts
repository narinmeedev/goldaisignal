import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification.service';
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

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) {
      return { success: true };
    }
    const errText = await res.text();
    return { success: false, error: errText };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { message, target } = await req.json(); // target: 'ALL' | 'TELEGRAM' | 'LINE'
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const cleanText = message.trim();
    const results: { line?: any; telegram?: any } = {};

    // 1. Fetch Telegram Credentials from settings or env
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] } },
    });
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const botToken = settingsMap.get('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = settingsMap.get('TELEGRAM_CHAT_ID') || process.env.TELEGRAM_CHAT_ID || '';

    // Send Telegram Broadcast
    if ((target === 'ALL' || target === 'TELEGRAM') && botToken && chatId) {
      const tgRes = await sendTelegramMessage(botToken, chatId, cleanText);
      results.telegram = tgRes;
    }

    // Send LINE Broadcast
    if (target === 'ALL' || target === 'LINE') {
      const lineRes = await NotificationService.sendNotification(cleanText);
      results.line = lineRes;
    }

    // Log Activity
    await prisma.activityLog.create({
      data: {
        userId: 'ADMIN',
        action: 'BROADCAST_SIGNAL',
        details: JSON.stringify({ target, messagePreview: cleanText.slice(0, 100), results }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความบรอดแคสต์เรียบร้อยแล้ว',
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to broadcast' }, { status: 500 });
  }
}
