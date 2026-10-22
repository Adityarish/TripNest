ALTER TABLE "Trip" ADD COLUMN "storageRootId" UUID;

UPDATE "Trip" AS trip
SET "storageRootId" = users."storageRootId"
FROM "User" AS users
WHERE trip."userId" = users."id";

CREATE INDEX "Trip_storageRootId_idx" ON "Trip"("storageRootId");
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_storageRootId_fkey" FOREIGN KEY ("storageRootId") REFERENCES "StorageRoot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
