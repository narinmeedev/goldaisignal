import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { readFileSync } from 'node:fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };
const HOSTINGER_RUNTIME_ENV_FILE = '/home/u286424856/domains/goldaisig.com/nodejs/.env';

const readDatabaseUrlFromRuntimeEnvFile = () => {
  try {
    // Hostinger immutable releases do not copy the private env file into each
    // version, so production reads it from this stable account-owned path.
    const line = readFileSync(HOSTINGER_RUNTIME_ENV_FILE, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith('DATABASE_URL='));
    if (!line) return undefined;
    const rawValue = line.slice(line.indexOf('=') + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    if (value) return value;
  } catch {
    // The normal local/runtime path is process.env.DATABASE_URL.
  }
  return undefined;
};

export function createPrismaClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultPort = isProd ? '3306' : '3307';

  const isNextProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const configuredDatabaseUrl = process.env.DATABASE_URL ||
    (!isNextProductionBuild ? readDatabaseUrlFromRuntimeEnvFile() : undefined);
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
