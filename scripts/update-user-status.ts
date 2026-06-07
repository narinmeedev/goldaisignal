import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== RESTORING USER TRIAL STATUS ===");
  
  // Find the viewer user (normally there is only one user for testing, or we find by email)
  const user = await prisma.user.findFirst({
    where: { role: "viewer" }
  });

  if (!user) {
    console.error("User not found!");
    return;
  }

  console.log(`Found user: ${user.email} (Current Status: ${user.subscriptionStatus})`);
  
  const now = new Date();
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 30); // 30 days from now

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "active",
      subscriptionEndsAt: trialEnds
    }
  });

  console.log(`Successfully restored status to: ${updated.subscriptionStatus}`);
  console.log(`Subscription ends at: ${updated.subscriptionEndsAt?.toISOString()}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
