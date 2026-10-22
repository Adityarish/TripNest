ALTER TABLE "CredentialProfile" ADD COLUMN "ownerUserId" UUID;
ALTER TABLE "StorageRoot" ADD COLUMN "ownerUserId" UUID;

CREATE UNIQUE INDEX "CredentialProfile_ownerUserId_key" ON "CredentialProfile"("ownerUserId");
CREATE UNIQUE INDEX "StorageRoot_ownerUserId_key" ON "StorageRoot"("ownerUserId");

ALTER TABLE "CredentialProfile" ADD CONSTRAINT "CredentialProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorageRoot" ADD CONSTRAINT "StorageRoot_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
