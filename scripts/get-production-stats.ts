import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.error('Failed to load .env file:', e);
}

async function run() {
  const { GET } = await import('../src/app/api/admin/dashboard-stats/route');
  const response = await GET();
  const data = await response.json();
  console.log('--- Current Live Dashboard Stats ---');
  console.log('Gold currentPrice:', data.marketIntelligence.XAUUSD.currentPrice);
  console.log('Gold bias:', data.marketIntelligence.XAUUSD.bias);
  console.log('Gold nearestSupport:', JSON.stringify(data.marketIntelligence.XAUUSD.nearestSupport));
  console.log('Gold nearestResistance:', JSON.stringify(data.marketIntelligence.XAUUSD.nearestResistance));
}

run()
  .catch(console.error);
