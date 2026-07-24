import pg from 'pg';
import { parse } from 'pg-connection-string';

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, or DATABASE_URL is required',
  );
}

const config = parse(connectionString);
const isLocalhost = config.host === 'localhost' || config.host === '127.0.0.1';
const pool = new pg.Pool({
  ...config,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  options: [config.options, '-c default_transaction_read_only=off'].filter(Boolean).join(' '),
  max: 1,
  connectionTimeoutMillis: 10_000,
});
async function withWritableTransaction(operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ WRITE');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

try {
  const records = await withWritableTransaction(async (client) => {
    const webhookEventsBefore = await client.query('SELECT COUNT(*)::int AS count FROM "WebhookEvent"');
    await client.query('TRUNCATE TABLE "WebhookEvent"');
    const btcPaperTrades = await client.query(`DELETE FROM "PaperTrade" WHERE UPPER(symbol) LIKE '%BTC%'`);
    const btcSignals = await client.query(`DELETE FROM "Signal" WHERE UPPER(symbol) LIKE '%BTC%'`);
    const btcCandles = await client.query(`DELETE FROM "Candle" WHERE UPPER(symbol) LIKE '%BTC%'`);
    const btcZones = await client.query(`DELETE FROM "Zone" WHERE UPPER(symbol) LIKE '%BTC%'`);
    const oldActivityLogs = await client.query(
      `DELETE FROM "ActivityLog" WHERE "createdAt" < NOW() - INTERVAL '90 days'`,
    );
    const oldPaperTrades = await client.query(
      `DELETE FROM "PaperTrade"
       WHERE result = ANY($1::text[])
       AND COALESCE("closedAt", "openedAt") < NOW() - INTERVAL '180 days'`,
      [['WIN', 'LOSS', 'BE', 'CANCELLED']],
    );
    const retiredSettings = await client.query(
      `DELETE FROM "SystemSetting" WHERE UPPER(key) LIKE '%BTC%' OR key = ANY($1::text[])`,
      [['LINE_NOTIFY_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']],
    );
    const unusedSignals = await client.query(
      `DELETE FROM "Signal" s
       WHERE (s.status = 'cancelled' OR (s.status = ANY($1::text[]) AND s."createdAt" < NOW() - INTERVAL '180 days'))
       AND NOT EXISTS (SELECT 1 FROM "PaperTrade" p WHERE p."signalId" = s.id)`,
      [['win', 'loss']],
    );
    await client.query('DROP TABLE IF EXISTS "AiReview"');
    await client.query('ALTER TABLE "Signal" ALTER COLUMN "screenshotUrl" DROP DEFAULT');
    return {
      webhookEvents: webhookEventsBefore.rows[0]?.count || 0,
      btcPaperTrades: btcPaperTrades.rowCount || 0,
      btcSignals: btcSignals.rowCount || 0,
      btcCandles: btcCandles.rowCount || 0,
      btcZones: btcZones.rowCount || 0,
      oldActivityLogs: oldActivityLogs.rowCount || 0,
      oldPaperTrades: oldPaperTrades.rowCount || 0,
      retiredSettings: retiredSettings.rowCount || 0,
      unusedSignals: unusedSignals.rowCount || 0,
    };
  });

  await withWritableTransaction(async (client) => {
    await client.query('CREATE INDEX IF NOT EXISTS "WebhookEvent_symbol_source_status_receivedAt_idx" ON "WebhookEvent" (symbol, source, status, "receivedAt")');
    await client.query('CREATE INDEX IF NOT EXISTS "Signal_symbol_status_createdAt_idx" ON "Signal" (symbol, status, "createdAt")');
    await client.query('CREATE INDEX IF NOT EXISTS "PaperTrade_symbol_result_openedAt_idx" ON "PaperTrade" (symbol, result, "openedAt")');
  });

  process.stdout.write(`${JSON.stringify({
    ...records,
  }, null, 2)}\n`);
} finally {
  await pool.end();
}
