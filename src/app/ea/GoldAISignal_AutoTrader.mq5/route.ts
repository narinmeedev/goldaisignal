import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'ea', 'GoldAISignal_AutoTrader.mq5');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="GoldAISignal_AutoTrader.mq5"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'EA file not found', details: err.message }, { status: 404 });
  }
}
