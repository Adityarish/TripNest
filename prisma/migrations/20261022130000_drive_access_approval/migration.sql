CREATE TYPE "DriveAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

CREATE TABLE "DriveAccessRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "googleEmail" TEXT NOT NULL,
  "status" "DriveAccessStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriveAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriveAccessRequest_userId_key" ON "DriveAccessRequest"("userId");
CREATE INDEX "DriveAccessRequest_status_createdAt_idx" ON "DriveAccessRequest"("status", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

ALTER TABLE "DriveAccessRequest" ADD CONSTRAINT "DriveAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
