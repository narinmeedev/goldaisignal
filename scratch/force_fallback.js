const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { parse } = require('pg-connection-string');

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const config = parse(connectionString || '');
const poolConfig = {
  ...config,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000
};

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('Clearing WebhookEvent and Candle tables to force real public API fallback...');
    
    // Clear recent webhook events so the price is not considered "recent MT5 live feed"
    const delEvents = await prisma.webhookEvent.deleteMany({});
    console.log(`Deleted ${delEvents.count} webhook events.`);

    // Clear candles so the DB has less than 20 candles, triggering immediate public API fetch
    const delCandles = await prisma.candle.deleteMany({});
    console.log(`Deleted ${delCandles.count} cached candles.`);
    
    // Clear zones so new ones are generated from the fresh fallback candles
    const delZones = await prisma.zone.deleteMany({});
    console.log(`Deleted ${delZones.count} zones.`);

    console.log('SUCCESS! Next request to the local server will pull real-time market prices.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

run();
