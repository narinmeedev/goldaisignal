import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function run() {
  console.log('Finding BTC signals and related trades...');
  
  // 1. Find all signals where symbol contains 'BTC'
  const btcSignals = await prisma.signal.findMany({
    where: {
      symbol: {
        contains: 'BTC',
      },
    },
    select: {
      id: true,
      symbol: true,
    },
  });

  const btcSignalIds = btcSignals.map((s) => s.id);
  console.log(`Found ${btcSignals.length} BTC signals:`, btcSignals.map(s => s.symbol));

  // 2. Delete all paper trades linked to these signals or having 'BTC' symbol
  const deletedTrades = await prisma.paperTrade.deleteMany({
    where: {
      OR: [
        {
          symbol: {
            contains: 'BTC',
          },
        },
        {
          signalId: {
            in: btcSignalIds,
          },
        },
      ],
    },
  });
  console.log(`Deleted ${deletedTrades.count} related paper trades.`);

  // 3. Delete BTC signals
  const deletedSignals = await prisma.signal.deleteMany({
    where: {
      id: {
        in: btcSignalIds,
      },
    },
  });
  console.log(`Deleted ${deletedSignals.count} BTC signals.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
