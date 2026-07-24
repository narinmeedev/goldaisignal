/**
 * Trigger background refresh of the dashboard stats cache.
 * Hits the stats API with automation parameters to force a full recalculation.
 */
export function triggerDashboardCacheRefresh() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
  const automationUrl = `${appUrl}/api/admin/dashboard-stats?asset=XAUUSD&public=true&automation=mt5-m15-sync`;
  const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'GOLD_AI_SECRET';

  fetch(automationUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'x-plan-automation': 'mt5-m15-sync',
      'x-plan-automation-secret': secret,
    },
  }).catch((err) => {
    console.error('[Dashboard Cache] Trigger failed:', err);
  });
}
