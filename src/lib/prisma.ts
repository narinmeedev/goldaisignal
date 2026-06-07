import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { parse } from 'pg-connection-string';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const config = parse(connectionString);
const isLocalhost = config.host === "localhost" || config.host === "127.0.0.1";

const poolConfig = {
  ...(config as any),
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: isLocalhost ? 10 : 2, // Limit database connections in serverless production to prevent exhaustion
  idleTimeoutMillis: 15000,   // Close idle connections faster to free up resources
  connectionTimeoutMillis: 5000 // Fail fast if the database is busy
};

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

let prismaInstance: PrismaClient;

if (!globalForPrisma.prisma) {
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  globalForPrisma.prisma = new PrismaClient({ adapter });
}
prismaInstance = globalForPrisma.prisma;

export const prisma = prismaInstance;
export default prisma;
