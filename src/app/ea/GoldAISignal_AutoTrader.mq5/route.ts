import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const primaryPath = path.join(process.cwd(), 'public', 'ea', 'GoldAISignal_AutoTrader.mq5');
    let fileContent = '';
    if (fs.existsSync(primaryPath)) {
      fileContent = fs.readFileSync(primaryPath, 'utf-8');
    } else {
      const altPath = path.join(process.cwd(), '.next', 'standalone', 'public', 'ea', 'GoldAISignal_AutoTrader.mq5');
      fileContent = fs.readFileSync(altPath, 'utf-8');
    }

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="GoldAISignal_AutoTrader.mq5"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'EA file not found', details: err.message }, { status: 404 });
  }
}
