import { prisma } from '../src/lib/prisma';
import { StrategyResearchService } from '../src/lib/services/strategy-research.service';

const symbols = ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSD.raw'];

const main = async () => {
try {
  const [m5, m15, h1] = await Promise.all([
    prisma.candle.findMany({ where: { symbol: { in: symbols }, timeframe: 'M5' }, orderBy: { time: 'desc' }, take: 9000 }),
    prisma.candle.findMany({ where: { symbol: { in: symbols }, timeframe: 'M15' }, orderBy: { time: 'desc' }, take: 3000 }),
    prisma.candle.findMany({ where: { symbol: { in: symbols }, timeframe: 'H1' }, orderBy: { time: 'desc' }, take: 1000 }),
  ]);

  const report = StrategyResearchService.researchStrategies('XAUUSD', m5, m15, h1);
  console.log(JSON.stringify({
    candleCounts: { M5: m5.length, M15: m15.length, H1: h1.length },
    candidates: report.candidates.map((candidate) => ({
      id: candidate.id,
      status: candidate.status,
      validationSamples: candidate.sampleSize,
      validationWinRate: candidate.winRate,
      validationNetR: candidate.netR,
      expectancyR: candidate.expectancyR,
      maxDrawdownR: candidate.maxDrawdownR,
      wilsonLowerBound: candidate.wilsonLowerBound,
      parameters: candidate.parameters,
    })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Strategy audit failed');
  process.exitCode = 1;
});
