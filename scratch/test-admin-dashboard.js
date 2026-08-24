import { signToken } from '../src/lib/jwt.ts';

async function main() {
  const token = await signToken({ userId: 'admin-test', role: 'admin' });
  console.log('Generated Admin Token:', token);
}

main().catch(console.error);
