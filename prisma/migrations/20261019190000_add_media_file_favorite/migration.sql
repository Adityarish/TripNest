ALTER TABLE "MediaFile" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MediaFile_userId_tripId_isFavorite_idx" ON "MediaFile"("userId", "tripId", "isFavorite");
