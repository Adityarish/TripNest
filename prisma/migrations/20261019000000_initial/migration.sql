CREATE TYPE "ProvisioningState" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED');
CREATE TYPE "StorageType" AS ENUM ('MY_DRIVE_FOLDER', 'SHARED_DRIVE', 'MOCK');
CREATE TYPE "CredentialType" AS ENUM ('OAUTH', 'SERVICE_ACCOUNT', 'MOCK');
CREATE TYPE "HealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE');
CREATE TYPE "FileCategory" AS ENUM ('PHOTOS', 'VIDEOS', 'DOCUMENTS', 'OTHER');
CREATE TYPE "UploadState" AS ENUM ('CREATED', 'UPLOADING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "MigrationState" AS ENUM ('PENDING', 'COPYING', 'VERIFYING', 'COMPLETED', 'FAILED');

CREATE TABLE "CredentialProfile" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CredentialType" NOT NULL,
  "encryptedCredentials" TEXT,
  "googleAccountEmail" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CredentialProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageRoot" (
  "id" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "googleFolderId" TEXT NOT NULL,
  "folderUrl" TEXT,
  "storageType" "StorageType" NOT NULL,
  "credentialProfileId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "writable" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "assignedUserCount" INTEGER NOT NULL DEFAULT 0,
  "lastHealthStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  "lastHealthCheckedAt" TIMESTAMP(3),
  "lastHealthMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageRoot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "clerkUserId" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "storageRootId" UUID,
  "driveFolderId" TEXT,
  "provisioningState" "ProvisioningState" NOT NULL DEFAULT 'PENDING',
  "provisioningError" TEXT,
  "provisioningStartedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trip" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "description" TEXT,
  "location" TEXT,
  "coverFileId" UUID,
  "driveFolderId" TEXT NOT NULL,
  "photosFolderId" TEXT NOT NULL,
  "videosFolderId" TEXT NOT NULL,
  "documentsFolderId" TEXT NOT NULL,
  "otherFolderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaFile" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "driveFileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "category" "FileCategory" NOT NULL,
  "checksumMd5" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tripId" UUID NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "category" "FileCategory" NOT NULL,
  "state" "UploadState" NOT NULL DEFAULT 'CREATED',
  "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
  "remoteSessionUrlEnc" TEXT,
  "driveFileId" TEXT,
  "errorMessage" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RootMigration" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "sourceRootId" UUID NOT NULL,
  "destinationRootId" UUID NOT NULL,
  "state" "MigrationState" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "requestedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RootMigration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageRoot_googleFolderId_key" ON "StorageRoot"("googleFolderId");
CREATE INDEX "StorageRoot_enabled_writable_lastHealthStatus_assignedUserC_idx" ON "StorageRoot"("enabled", "writable", "lastHealthStatus", "assignedUserCount", "priority");
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE INDEX "User_storageRootId_idx" ON "User"("storageRootId");
CREATE UNIQUE INDEX "Trip_coverFileId_key" ON "Trip"("coverFileId");
CREATE UNIQUE INDEX "Trip_driveFolderId_key" ON "Trip"("driveFolderId");
CREATE INDEX "Trip_userId_startDate_idx" ON "Trip"("userId", "startDate");
CREATE UNIQUE INDEX "MediaFile_driveFileId_key" ON "MediaFile"("driveFileId");
CREATE INDEX "MediaFile_userId_tripId_category_idx" ON "MediaFile"("userId", "tripId", "category");
CREATE INDEX "UploadSession_userId_state_idx" ON "UploadSession"("userId", "state");

ALTER TABLE "StorageRoot" ADD CONSTRAINT "StorageRoot_credentialProfileId_fkey" FOREIGN KEY ("credentialProfileId") REFERENCES "CredentialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_storageRootId_fkey" FOREIGN KEY ("storageRootId") REFERENCES "StorageRoot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_coverFileId_fkey" FOREIGN KEY ("coverFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RootMigration" ADD CONSTRAINT "RootMigration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RootMigration" ADD CONSTRAINT "RootMigration_sourceRootId_fkey" FOREIGN KEY ("sourceRootId") REFERENCES "StorageRoot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RootMigration" ADD CONSTRAINT "RootMigration_destinationRootId_fkey" FOREIGN KEY ("destinationRootId") REFERENCES "StorageRoot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
