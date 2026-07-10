const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Status Check ---');
  try {
    const candleCount = await prisma.candle.count();
    console.log('Total candles in DB:', candleCount);

    const zoneCount = await prisma.zone.count();
    console.log('Total zones in DB:', zoneCount);

    const latestEvent = await prisma.webhookEvent.findFirst({
      orderBy: { receivedAt: 'desc' },
    });
    console.log('Latest WebhookEvent:', latestEvent);

    const latestCandlesXAU = await prisma.candle.findMany({
      where: { symbol: 'XAUUSD' },
      orderBy: { time: 'desc' },
      take: 5,
    });
    console.log('Latest XAUUSD candles:', latestCandlesXAU);

    const latestCandlesXAUiux = await prisma.candle.findMany({
      where: { symbol: 'XAUUSD.iux' },
      orderBy: { time: 'desc' },
      take: 5,
    });
    console.log('Latest XAUUSD.iux candles:', latestCandlesXAUiux);

    const btcCandles = await prisma.candle.findMany({
      where: { symbol: 'BTCUSD' },
      orderBy: { time: 'desc' },
      take: 5,
    });
    console.log('Latest BTCUSD candles:', btcCandles);

    const allZones = await prisma.zone.findMany({
      take: 10,
    });
    console.log('Sample zones in DB:', allZones);
  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
