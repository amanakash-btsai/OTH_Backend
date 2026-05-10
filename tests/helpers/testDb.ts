import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function connectTestDb(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };

// Run standalone: npx ts-node -r tsconfig-paths/register tests/helpers/testDb.ts
if (require.main === module) {
  (async () => {
    console.log("Connecting to Azure SQL...");
    try {
      await prisma.$connect();
      console.log("✅ Database connection successful");

      const tableChecks = await Promise.all([
        prisma.user.count(),
        prisma.asset.count(),
        prisma.salesRequest.count(),
      ]);

      console.log(`✅ Tables reachable — users: ${tableChecks[0]}, assets: ${tableChecks[1]}, sales_requests: ${tableChecks[2]}`);
    } catch (err) {
      console.error("❌ Connection failed:", err);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
