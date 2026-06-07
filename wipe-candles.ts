import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.candle.deleteMany({});
  console.log(`Deleted ${result.count} candles`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
