import "server-only";
import type { CredentialProfile } from "@prisma/client";
import { MockDriveProvider } from "@/lib/drive/mock";
import { GoogleDriveProvider } from "@/lib/drive/google";
import type { DriveProvider } from "@/lib/drive/types";

export async function driveFor(profile: CredentialProfile): Promise<DriveProvider> {
  return profile.type === "MOCK" ? new MockDriveProvider() : GoogleDriveProvider.create(profile);
}
