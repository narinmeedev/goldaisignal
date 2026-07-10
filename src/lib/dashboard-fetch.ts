type DashboardFetchOptions = {
  retries?: number;
  timeoutMs?: number;
  cacheBust?: boolean;
  public?: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchDashboardStats(
  asset: 'XAUUSD' = 'XAUUSD',
  options: DashboardFetchOptions = {},
) {
  const retries = options.retries ?? 1;
  const timeoutMs = options.timeoutMs ?? 12000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const cacheBuster = options.cacheBust ? `&ts=${Date.now()}` : '';
    const publicParam = options.public ? '&public=true' : '';

    try {
      const res = await fetch(`/api/admin/dashboard-stats?asset=${asset}${publicParam}${cacheBuster}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data) return data;
      lastError = new Error(data?.error || `Dashboard metrics request failed (${res.status})`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < retries) {
      await wait(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Dashboard metrics request failed');
}
