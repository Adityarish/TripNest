import { z } from "zod";

export const tripInput = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: z.coerce.date(),
  endDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().optional().nullable()),
  description: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(2000).optional().nullable()),
  location: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(180).optional().nullable()),
}).refine((value) => !value.endDate || value.endDate >= value.startDate, { message: "End date cannot be before start date", path: ["endDate"] });

export const uploadInput = z.object({
  tripId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(200).default("application/octet-stream"),
  sizeBytes: z.coerce.bigint().positive(),
});

export const filePatchInput = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  tripId: z.string().uuid().optional(),
  category: z.enum(["PHOTOS", "VIDEOS", "DOCUMENTS", "OTHER"]).optional(),
  isFavorite: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "At least one change is required");

export const rootInput = z.object({
  displayName: z.string().trim().min(1).max(100),
  folderUrl: z.string().url(),
  credentialProfileId: z.string().uuid(),
  enabled: z.boolean().default(false),
  priority: z.number().int().min(0).max(10000).default(100),
});

export function categoryForMime(mimeType: string) {
  if (mimeType.startsWith("image/")) return "PHOTOS" as const;
  if (mimeType.startsWith("video/")) return "VIDEOS" as const;
  if (/^(application\/(pdf|msword|vnd\.|rtf|json|xml)|text\/)/.test(mimeType)) return "DOCUMENTS" as const;
  return "OTHER" as const;
}

export function extractDriveFolderId(url: string) {
  const parsed = new URL(url);
  if (!["drive.google.com", "www.drive.google.com"].includes(parsed.hostname)) throw new Error("Use a Google Drive folder URL");
  const folderMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const id = folderMatch?.[1] ?? parsed.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error("Could not extract a valid Google Drive folder ID");
  return id;
}
