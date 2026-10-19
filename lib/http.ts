import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function apiError(error: unknown) {
  if (error instanceof Response) return NextResponse.json({ error: (await error.text()) || error.statusText || "Request failed" }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
  const message = error instanceof Error ? error.message : "";
  let safeMessage = "The operation could not be completed. Please retry.";
  let status = 500;
  if (/storageQuotaExceeded|insufficientStorage|storage quota|not enough storage|\b507\b/i.test(message)) {
    safeMessage = "The storage account is full. Ask the owner to free space or configure another storage pool.";
    status = 507;
  } else if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded|\b429\b/i.test(message)) {
    safeMessage = "Google Drive is temporarily rate-limiting uploads. Please retry later.";
    status = 429;
  } else if (/No healthy writable storage root/.test(message)) {
    safeMessage = "No writable storage root is available. Ask the owner to check storage settings.";
    status = 503;
  } else if (/Google Drive upload failed \(404\)|upload session.*expired/i.test(message)) {
    safeMessage = "The upload session expired. Select the same file to start a new upload.";
    status = 410;
  }
  console.error("API request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: safeMessage }, { status });
}
