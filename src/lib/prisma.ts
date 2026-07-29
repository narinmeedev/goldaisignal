import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || "mysql://u286424856_goldaisig:%40oibomiN42%40@127.0.0.1:3307/u286424856_goldaisig?allowPublicKeyRetrieval=true";
  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
