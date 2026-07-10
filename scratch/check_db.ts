import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('--- DB Status Check ---');
  try {
    const candleCount = await prisma.candle.count();
    console.log('Total candles in DB:', candleCount);

    const xau_m15 = await prisma.candle.count({ where: { symbol: 'XAUUSD', timeframe: 'M15' } });
    const xau_h1 = await prisma.candle.count({ where: { symbol: 'XAUUSD', timeframe: 'H1' } });
    console.log('XAUUSD M15 count:', xau_m15, 'H1 count:', xau_h1);

    const xauiux_m15 = await prisma.candle.count({ where: { symbol: 'XAUUSD.iux', timeframe: 'M15' } });
    const xauiux_h1 = await prisma.candle.count({ where: { symbol: 'XAUUSD.iux', timeframe: 'H1' } });
    console.log('XAUUSD.iux M15 count:', xauiux_m15, 'H1 count:', xauiux_h1);

    const btc_m15 = await prisma.candle.count({ where: { symbol: 'BTCUSD', timeframe: 'M15' } });
    const btc_h1 = await prisma.candle.count({ where: { symbol: 'BTCUSD', timeframe: 'H1' } });
    console.log('BTCUSD M15 count:', btc_m15, 'H1 count:', btc_h1);

    const btciux_m15 = await prisma.candle.count({ where: { symbol: 'BTCUSD.iux', timeframe: 'M15' } });
    const btciux_h1 = await prisma.candle.count({ where: { symbol: 'BTCUSD.iux', timeframe: 'H1' } });
    console.log('BTCUSD.iux M15 count:', btciux_m15, 'H1 count:', btciux_h1);

    const zoneCount = await prisma.zone.count();
    console.log('Total zones in DB:', zoneCount);

    const latestEvent = await prisma.webhookEvent.findFirst({
      orderBy: { receivedAt: 'desc' },
    });
    console.log('Latest WebhookEvent:', latestEvent);

  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
