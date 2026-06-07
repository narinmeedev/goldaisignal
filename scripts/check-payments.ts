import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== CHECKING REMOTE PAYMENTS AND SLIPOK NOTES ===");
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: {
        select: { email: true }
      }
    }
  });

  console.log(`Found ${payments.length} recent payments:`);
  for (const p of payments) {
    console.log(`- ID: ${p.id}`);
    console.log(`  User: ${p.user.email}`);
    console.log(`  Amount: ${p.amount}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Slip URL: ${p.slipUrl.substring(0, 100)}${p.slipUrl.length > 100 ? "..." : ""}`);
    console.log(`  Notes: ${p.notes}`);
    console.log(`  Created At: ${p.createdAt.toISOString()}`);
    console.log("");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
