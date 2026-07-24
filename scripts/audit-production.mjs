import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
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
const pool = new Pool({
  ...config,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  options: [config.options, '-c default_transaction_read_only=off'].filter(Boolean).join(' '),
  max: 1,
  connectionTimeoutMillis: 10_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const [
    paperBySymbol,
    signalsBySymbol,
    candlesBySymbol,
    zonesBySymbol,
    webhookTotal,
    webhookBtc,
    webhooksBySymbol,
    openTrades,
    planSettings,
    lineConfig,
    admins,
    customers,
  ] = await Promise.all([
    prisma.paperTrade.groupBy({ by: ['symbol', 'result'], _count: { _all: true } }),
    prisma.signal.groupBy({ by: ['symbol', 'status'], _count: { _all: true } }),
    prisma.candle.groupBy({ by: ['symbol'], _count: { _all: true }, _max: { time: true } }),
    prisma.zone.groupBy({ by: ['symbol'], _count: { _all: true } }),
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { symbol: { contains: 'BTC', mode: 'insensitive' } } }),
    prisma.webhookEvent.groupBy({
      by: ['symbol'],
      _count: { _all: true },
      _max: { receivedAt: true },
    }),
    prisma.paperTrade.findMany({
      where: { result: { in: ['PLAN', 'TESTING', 'OPEN'] } },
      orderBy: { openedAt: 'desc' },
      include: { signal: { select: { status: true, reason: true } } },
    }),
    prisma.systemSetting.findMany({ where: { key: { startsWith: 'ACTIVE_ORDER_PLAN_' } } }),
    prisma.systemSetting.findMany({
      where: { key: { in: ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET'] } },
      select: { key: true, value: true },
    }),
    prisma.user.findMany({ where: { role: 'admin' }, select: { email: true, lineId: true } }),
    prisma.user.findMany({
      where: { role: { not: 'admin' } },
      select: { lineId: true, subscriptionStatus: true, subscriptionEndsAt: true },
    }),
  ]);

  const now = new Date();
  const report = JSON.stringify({
    paperBySymbol,
    signalsBySymbol,
    candlesBySymbol,
    zonesBySymbol,
    webhookEvents: { total: webhookTotal, btc: webhookBtc, bySymbol: webhooksBySymbol },
    openTrades: openTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      result: trade.result,
      entry: trade.entry,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit2,
      openedAt: trade.openedAt,
      signalStatus: trade.signal?.status || null,
      trackingReason: trade.signal?.reason || null,
    })),
    activePlanKeys: planSettings.map((setting) => setting.key),
    lineConfig: Object.fromEntries(lineConfig.map((setting) => [setting.key, Boolean(setting.value)])),
    admins: admins.map((admin) => ({ email: admin.email, lineLinked: Boolean(admin.lineId) })),
    customers: {
      total: customers.length,
      lineLinked: customers.filter((user) => user.lineId).length,
      activeLineLinked: customers.filter((user) =>
        user.lineId &&
        user.subscriptionStatus === 'active' &&
        (!user.subscriptionEndsAt || user.subscriptionEndsAt > now)
      ).length,
    },
  }, null, 2);
  await new Promise((resolve, reject) => {
    process.stdout.write(`${report}\n`, (error) => error ? reject(error) : resolve());
  });
} finally {
  await prisma.$disconnect();
  await pool.end();
}
