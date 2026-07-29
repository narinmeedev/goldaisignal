import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultPort = isProd ? '3306' : '3307';

  let connectionString = process.env.DATABASE_URL || `mysql://u286424856_goldaisig:%40oibomiN42%40@127.0.0.1:${defaultPort}/u286424856_goldaisig?allowPublicKeyRetrieval=true`;
  
  // On local development, route through SSH Tunnel on port 3307 to access Cloud MySQL
  if (!isProd && connectionString.includes('127.0.0.1:3306')) {
    connectionString = connectionString.replace('127.0.0.1:3306', '127.0.0.1:3307');
  }

  if (!connectionString.includes('allowPublicKeyRetrieval')) {
    connectionString += connectionString.includes('?') ? '&allowPublicKeyRetrieval=true' : '?allowPublicKeyRetrieval=true';
  }

  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
