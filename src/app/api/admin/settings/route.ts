import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getPaidDurationDays, getTrialDurationDays } from '@/lib/billing';
import { getJwtSecretKey } from '@/lib/auth';

const ALLOWED_SETTING_KEYS = new Set([
  'MAINTENANCE_MODE',
  'TRIAL_DURATION_DAYS',
  'PAID_DURATION_DAYS',
  'FUNDAMENTAL_BIAS_XAUUSD',
  'FUNDAMENTAL_NEWS_WARNING_XAUUSD',
  'LINE_CHANNEL_ID',
  'LINE_CHANNEL_SECRET',
]);

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
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: Array.from(ALLOWED_SETTING_KEYS) } },
    });
    // Convert array to object key-value pairs
    const config = settings.reduce((acc: Record<string, string>, curr) => {
      if (curr.key !== 'LINE_CHANNEL_SECRET') acc[curr.key] = curr.value;
      return acc;
    }, {});
    config.LINE_CHANNEL_SECRET_CONFIGURED = settings.some(
      (setting) => setting.key === 'LINE_CHANNEL_SECRET' && Boolean(setting.value.trim()),
    ) ? 'true' : 'false';
    
    return NextResponse.json({ success: true, settings: config });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const entries = body.settings && typeof body.settings === 'object'
      ? Object.entries(body.settings)
      : [[body.key, body.value]];
    if (!entries.length || entries.some(([key, value]) => !ALLOWED_SETTING_KEYS.has(String(key)) || value === undefined)) {
      return NextResponse.json({ error: 'Invalid setting key or value' }, { status: 400 });
    }

    const normalizedEntries = entries.map(([key, value]) => {
      const normalizedKey = String(key);
      const normalizedValue = normalizedKey === 'TRIAL_DURATION_DAYS'
        ? String(getTrialDurationDays(value))
        : normalizedKey === 'PAID_DURATION_DAYS'
          ? String(getPaidDurationDays(value))
          : String(value);
      return [normalizedKey, normalizedValue] as const;
    });

    await prisma.$transaction(normalizedEntries.map(([key, value]) => prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })));

    return NextResponse.json({ success: true, updatedKeys: normalizedEntries.map(([key]) => key) });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
