import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const prismaInstance = globalForPrisma.prisma ?? (() => {
  let connectionString = process.env.DATABASE_URL || "mysql://golduser:goldpass123@127.0.0.1:3306/goldaisig?allowPublicKeyRetrieval=true";
  if (!connectionString.includes('allowPublicKeyRetrieval')) {
    connectionString += connectionString.includes('?') ? '&allowPublicKeyRetrieval=true' : '?allowPublicKeyRetrieval=true';
  }
  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance;

export const prisma = prismaInstance;
export default prisma;
