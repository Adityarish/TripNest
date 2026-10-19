import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if ((process.env.TRIPNEST_PROVIDER_MODE ?? (process.env.NODE_ENV === "production" ? "clerk-google" : "local")) !== "local") return;
  const credentials = await prisma.credentialProfile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "Local mock storage", type: "MOCK" },
  });
  await prisma.storageRoot.upsert({
    where: { googleFolderId: "mock-root-1" },
    update: { enabled: true, writable: true, lastHealthStatus: "HEALTHY" },
    create: {
      displayName: "Local demo root",
      googleFolderId: "mock-root-1",
      storageType: "MOCK",
      credentialProfileId: credentials.id,
      enabled: true,
      writable: true,
      priority: 1,
      lastHealthStatus: "HEALTHY",
      lastHealthCheckedAt: new Date(),
      lastHealthMessage: "Development-only filesystem simulation",
    },
  });
}

main().finally(() => prisma.$disconnect());
