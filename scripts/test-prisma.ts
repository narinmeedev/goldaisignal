import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('Success! Users count:', users.length);
  } catch (err) {
    console.error('Failed to query database:', err);
  }
}
main();
