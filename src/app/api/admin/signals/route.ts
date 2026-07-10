import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        paperTrades: true
      }
    });

    return NextResponse.json(signals);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve signals history.', details: err.message },
      { status: 500 }
    );
  }
}
