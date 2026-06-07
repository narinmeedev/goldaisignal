import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  await prisma.candle.deleteMany({});
  await prisma.webhookEvent.deleteMany({});
  await prisma.zone.deleteMany({});
  await prisma.signal.deleteMany({});
  await prisma.paperTrade.deleteMany({});
  return NextResponse.json({ success: true, message: 'All candles, webhooks, zones, signals, and paper trades totally wiped' });
}

