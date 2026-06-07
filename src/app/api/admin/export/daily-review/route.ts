import { NextResponse } from 'next/server';
import { ReviewService } from '@/lib/services/review.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get date from query string, or default to today's date in local time YYYY-MM-DD
    let dateStr = searchParams.get('date');
    if (!dateStr) {
      const today = new Date();
      // Format as YYYY-MM-DD
      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset * 60 * 1000));
      dateStr = localToday.toISOString().split('T')[0];
    }

    // Generate or fetch daily review
    const review = await ReviewService.generateDailyReview(dateStr);

    return NextResponse.json(review);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to export daily review.', details: err.message },
      { status: 500 }
    );
  }
}
