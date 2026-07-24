// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgConnectionString = (process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL) as string;
const mysqlConnectionString = process.env.MYSQL_URL as string;

if (!pgConnectionString) {
  console.error("Error: POSTGRES_PRISMA_URL or DATABASE_URL not set in .env");
  process.exit(1);
}

if (!mysqlConnectionString) {
  console.error("Error: MYSQL_URL not set in .env");
  process.exit(1);
}

async function main() {
  console.log("=== Database Migration: PostgreSQL to MySQL ===");
  console.log(`Source (Postgres): ${pgConnectionString.split('@')[1] || pgConnectionString}`);
  console.log(`Destination (MySQL): ${mysqlConnectionString.split('@')[1] || mysqlConnectionString}`);

  // 1. Initialize PostgreSQL Client
  const pgPool = new Pool({
    connectionString: pgConnectionString,
  });

  // 2. Initialize MySQL Prisma Client
  process.env.DATABASE_URL = mysqlConnectionString;
  const prisma = new PrismaClient();

  try {
    console.log("Connecting databases...");
    await pgPool.query('SELECT 1');
    await prisma.$connect();
    console.log("Databases connected successfully.");

    // Disable Foreign Key Checks in MySQL to avoid insertion order errors
    console.log("Disabling foreign key checks in MySQL...");
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    // Table List in Logical Order
    const tables = [
      { name: 'User', pgTable: '"User"', prismaModel: prisma.user },
      { name: 'ActivityLog', pgTable: '"ActivityLog"', prismaModel: prisma.activityLog },
      { name: 'SystemSetting', pgTable: '"SystemSetting"', prismaModel: prisma.systemSetting },
      { name: 'Payment', pgTable: '"Payment"', prismaModel: prisma.payment },
      { name: 'AffiliateCommission', pgTable: '"AffiliateCommission"', prismaModel: prisma.affiliateCommission },
      { name: 'WebhookEvent', pgTable: '"WebhookEvent"', prismaModel: prisma.webhookEvent },
      { name: 'Candle', pgTable: '"Candle"', prismaModel: prisma.candle },
      { name: 'Zone', pgTable: '"Zone"', prismaModel: prisma.zone },
      { name: 'Signal', pgTable: '"Signal"', prismaModel: prisma.signal },
      { name: 'PaperTrade', pgTable: '"PaperTrade"', prismaModel: prisma.paperTrade },
    ];

    for (const table of tables) {
      console.log(`\nMigrating table: ${table.name}...`);
      
      // Fetch all rows from PostgreSQL
      const pgResult = await pgPool.query(`SELECT * FROM ${table.pgTable}`);
      const rows = pgResult.rows;
      console.log(`Found ${rows.length} rows in PostgreSQL.`);

      if (rows.length === 0) {
        console.log(`Skipping empty table: ${table.name}`);
        continue;
      }

      // Clear existing records in MySQL table for idempotency
      console.log(`Clearing existing records in MySQL ${table.name}...`);
      await table.prismaModel.deleteMany({});

      // Insert rows into MySQL in chunks to avoid packet size issues
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        await table.prismaModel.createMany({
          data: chunk as any,
          skipDuplicates: true,
        });
        
        console.log(`Inserted rows ${i + 1} to ${Math.min(i + chunkSize, rows.length)} of ${rows.length}`);
      }

      console.log(`Successfully migrated table: ${table.name}`);
    }

    // Re-enable Foreign Key Checks
    console.log("\nRe-enabling foreign key checks in MySQL...");
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("Migration complete!");

  } catch (error) {
    console.error("Migration failed:", error);
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (_) {}
  } finally {
    await pgPool.end();
    await prisma.$disconnect();
  }
}

main();
