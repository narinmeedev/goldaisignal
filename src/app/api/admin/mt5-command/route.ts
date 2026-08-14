import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'MT5_PENDING_COMMAND' },
    });
    return NextResponse.json({
      pendingCommand: setting?.value || null,
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
    }

    const body = await req.json();
    let commandStr = body.command || '';

    if (body.autoExecuteActivePlan) {
      const activePlanSetting = await prisma.systemSetting.findUnique({
        where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' },
      });
      if (activePlanSetting?.value) {
        const plan = JSON.parse(activePlanSetting.value);
        if (plan && plan.type && plan.entry && plan.stopLoss && plan.takeProfit) {
          commandStr = `${plan.type} ${plan.entry} ${plan.stopLoss} ${plan.takeProfit}`;
        }
      }
    }

    if (!commandStr || commandStr.trim() === '') {
      return NextResponse.json({ error: 'No active plan or command provided.' }, { status: 400, headers: noStoreHeaders });
    }

    await prisma.systemSetting.upsert({
      where: { key: 'MT5_PENDING_COMMAND' },
      update: { value: commandStr },
      create: { key: 'MT5_PENDING_COMMAND', value: commandStr },
    });

    console.log(`[MT5 COMMAND API] Queued command: ${commandStr}`);

    return NextResponse.json({
      success: true,
      message: `ส่งคำสั่งเข้าออเดอร์ไปยัง MT5 EA เรียบร้อยแล้ว: ${commandStr}`,
      queuedCommand: commandStr,
    }, { headers: noStoreHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: noStoreHeaders });
  }
}
