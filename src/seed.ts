import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'admin@goldsignal.ai';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('goldadmin123', 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'admin'
      }
    });
    console.log('Created default admin user');
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
