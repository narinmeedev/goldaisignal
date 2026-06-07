import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'MAINTENANCE_MODE' }
    });
    
    return NextResponse.json({ 
      maintenanceMode: setting?.value === 'true' 
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
