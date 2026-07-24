import { NextResponse } from 'next/server';
import { runRetentionCleanup } from '@/lib/services/retention.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const result = await runRetentionCleanup();
    return NextResponse.json(
      { success: true, ...result },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error('[Retention] Cleanup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database cleanup is temporarily unavailable.',
      },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
