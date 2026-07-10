import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('--- Checking Recent Signals & Trades ---');
  try {
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    console.log(`\nLast 10 Signals:`);
    for (const s of signals) {
      console.log(`Signal ID: ${s.id.slice(0, 8)}`);
      console.log(`  Symbol: ${s.symbol}, Timeframe: ${s.timeframe}`);
      console.log(`  Direction: ${s.direction}, Entry: ${s.entry}`);
      console.log(`  SL: ${s.stopLoss}, TP1: ${s.takeProfit1}, TP2: ${s.takeProfit2}`);
      console.log(`  Status: ${s.status}, Confidence: ${s.confidence}%, Fakeout Score: ${s.fakeoutScore}`);
      console.log(`  Created At: ${s.createdAt.toISOString()}`);
      console.log(`  Reason:`, s.reason);
      console.log('--------------------------------------------');
    }

    const trades = await prisma.paperTrade.findMany({
      orderBy: { openedAt: 'desc' },
      take: 10,
      include: { signal: true }
    });

    console.log(`\nLast 10 Trades:`);
    for (const t of trades) {
      console.log(`Trade ID: ${t.id.slice(0, 8)}`);
      console.log(`  Symbol: ${t.symbol}, Direction: ${t.direction}`);
      console.log(`  Entry: ${t.entry}, SL: ${t.stopLoss}, TP1: ${t.takeProfit1}, TP2: ${t.takeProfit2}`);
      console.log(`  Exit Price: ${t.exitPrice}, Result: ${t.result}, RR Result: ${t.rrResult}`);
      console.log(`  Opened At: ${t.openedAt.toISOString()}, Closed At: ${t.closedAt?.toISOString() || 'N/A'}`);
      console.log(`  Notes: ${t.notes}`);
      console.log('--------------------------------------------');
    }

  } catch (err) {
    console.error('Error querying signals:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
