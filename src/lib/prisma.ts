import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const prismaInstance = globalForPrisma.prisma ?? (() => {
  const connectionString = process.env.DATABASE_URL || "mysql://golduser:goldpass123@127.0.0.1:3306/goldaisig";
  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance;

export const prisma = prismaInstance;
export default prisma;
