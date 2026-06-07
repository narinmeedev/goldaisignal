import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const trades = await prisma.paperTrade.findMany({
      orderBy: { openedAt: 'desc' },
      include: {
        signal: true,
      },
    });

    return NextResponse.json(trades);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve paper trades log.', details: err.message },
      { status: 500 }
    );
  }
}
