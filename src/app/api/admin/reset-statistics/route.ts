import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const CONFIRM_PHRASE = 'RESET_XAU_STATS';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return false;

  const payload = await verifyToken(token);
  return payload?.role === 'admin';
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: noStoreHeaders });
  }

  const body = await req.json().catch(() => null);
  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Missing confirmation phrase: ${CONFIRM_PHRASE}` },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const xauFilter = { symbol: { contains: 'XAU' } };
  const resetAt = new Date();
  const [
    paperTradesBefore,
    signalsBefore,
    reviewsBefore,
    activePlansBefore,
    researchBefore,
  ] = await Promise.all([
    prisma.paperTrade.count({ where: xauFilter }),
    prisma.signal.count({ where: xauFilter }),
    prisma.aiReview.count(),
    prisma.systemSetting.count({ where: { key: 'ACTIVE_ORDER_PLAN_XAUUSD' } }),
    prisma.systemSetting.count({ where: { key: 'STRATEGY_RESEARCH_XAUUSD' } }),
  ]);

  await prisma.$transaction([
    prisma.paperTrade.deleteMany({ where: xauFilter }),
    prisma.signal.deleteMany({ where: xauFilter }),
    prisma.aiReview.deleteMany({}),
    prisma.systemSetting.deleteMany({
      where: {
        key: {
          in: [
            'ACTIVE_ORDER_PLAN_XAUUSD',
            'STRATEGY_RESEARCH_XAUUSD',
          ],
        },
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: 'STATS_RESET_XAUUSD' },
      update: {
        value: JSON.stringify({
          resetAt: resetAt.toISOString(),
          scope: 'signals,paperTrades,aiReviews,activePlan,strategyResearch',
        }),
      },
      create: {
        key: 'STATS_RESET_XAUUSD',
        value: JSON.stringify({
          resetAt: resetAt.toISOString(),
          scope: 'signals,paperTrades,aiReviews,activePlan,strategyResearch',
        }),
      },
    }),
  ]);

  return NextResponse.json(
    {
      success: true,
      message: 'รีเซ็ตสถิติรอบใหม่สำเร็จ เริ่มเก็บผลสัญญาณและแผนเทรด XAUUSD ใหม่ได้แล้ว',
      resetAt: resetAt.toISOString(),
      cleared: {
        paperTrades: paperTradesBefore,
        signals: signalsBefore,
        aiReviews: reviewsBefore,
        activePlans: activePlansBefore,
        strategyResearchReports: researchBefore,
      },
      preserved: [
        'MT5 candles',
        'webhook events',
        'zones',
        'users',
        'payments',
        'subscription revenue',
        'billing settings',
      ],
    },
    { headers: noStoreHeaders },
  );
}
