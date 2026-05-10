import { prisma } from "../helpers/testDb";

describe("Database Connection", () => {
  it("connects to Azure SQL successfully", async () => {
    await expect(prisma.$queryRaw`SELECT 1 AS connected`).resolves.toBeDefined();
  });

  it("all 17 tables are accessible", async () => {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.asset.count(),
      prisma.salesRequest.count(),
      prisma.requestExtension.count(),
      prisma.bomSet.count(),
      prisma.bomLineItem.count(),
      prisma.accessoryMaster.count(),
      prisma.deviceDeployment.count(),
      prisma.dispatchDocument.count(),
      prisma.inspectionRecord.count(),
      prisma.inspectionLineItem.count(),
      prisma.repairCase.count(),
      prisma.eventLog.count(),
      prisma.teamsAlertLog.count(),
      prisma.serviceContract.count(),
      prisma.aiPredictionLog.count(),
    ]);

    counts.forEach((count, i) => {
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  it("can write, read, and delete a record (accessory_master round-trip)", async () => {
    const created = await prisma.accessoryMaster.create({
      data: {
        accessory_code: "TEST-CONN-001",
        accessory_name: "Connection test item — safe to delete",
        is_active: true,
      },
    });

    expect(created.accessory_code).toBe("TEST-CONN-001");
    expect(created.accessory_id).toBeDefined();

    const fetched = await prisma.accessoryMaster.findUnique({
      where: { accessory_id: created.accessory_id },
    });
    expect(fetched).not.toBeNull();
    expect(fetched!.accessory_name).toBe("Connection test item — safe to delete");

    await prisma.accessoryMaster.delete({
      where: { accessory_id: created.accessory_id },
    });

    const gone = await prisma.accessoryMaster.findUnique({
      where: { accessory_id: created.accessory_id },
    });
    expect(gone).toBeNull();
  });
});
