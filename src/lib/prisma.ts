import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export function createPrismaClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultPort = isProd ? '3306' : '3307';

  const configuredDatabaseUrl = process.env.DATABASE_URL;
  const isNextProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (!configuredDatabaseUrl && !isNextProductionBuild) {
    throw new Error('DATABASE_URL is required. Database credentials must not be embedded in source code.');
  }
  // Next evaluates route modules while collecting build metadata. This URL is
  // deliberately non-secret and must never be used outside that build phase.
  let connectionString = configuredDatabaseUrl || 'mysql://build:build@127.0.0.1:3306/build';
  
  // On local development, route through SSH Tunnel on port 3307 to access Cloud MySQL
  if (!isProd && connectionString.includes('127.0.0.1:3306')) {
    connectionString = connectionString.replace('127.0.0.1:3306', '127.0.0.1:3307');
  }

  if (!connectionString.includes('allowPublicKeyRetrieval')) {
    connectionString += connectionString.includes('?') ? '&allowPublicKeyRetrieval=true' : '?allowPublicKeyRetrieval=true';
  }
  if (!connectionString.includes('connectTimeout')) {
    connectionString += '&connectTimeout=3000&poolTimeout=2000&idleTimeout=2000&connectionLimit=10';
  }

  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
}

export function resetPrismaClient() {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[Prisma Auto-Healer] Resetting dead database connection pool...');
    globalForPrisma.prisma = createPrismaClient();
    return globalForPrisma.prisma;
  }
  return prisma;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
