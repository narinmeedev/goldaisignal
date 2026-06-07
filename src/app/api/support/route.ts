import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { minisaas } from '@/lib/minisaas';

async function getUserEmail() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.email || null;
}

export async function GET() {
  const email = await getUserEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await minisaas.getSupportTickets(email);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to fetch tickets' }, { status: 500 });
    }
    return NextResponse.json({ success: true, tickets: result.tickets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const email = await getUserEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { subject, message, priority } = await req.json();
    if (!subject || !message || !priority) {
      return NextResponse.json({ error: 'Subject, message, and priority are required' }, { status: 400 });
    }

    const result = await minisaas.trackSupportTicket(subject, message, priority, email);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to submit ticket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
