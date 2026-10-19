import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let root = "";

describe("mock Drive provider contract", () => {
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), "tripnest-drive-")); process.env.MOCK_DRIVE_PATH = root; await mkdir(root, { recursive: true }); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("creates idempotent folders and preserves uploaded bytes", async () => {
    const { MockDriveProvider } = await import("@/lib/drive/mock");
    const drive = new MockDriveProvider();
    const first = await drive.createFolder("mock-root-1", "user_demo", { tripnestUserId: "demo" });
    const second = await drive.createFolder("mock-root-1", "duplicate", { tripnestUserId: "demo" });
    expect(second.id).toBe(first.id);
    const session = await drive.createResumableUpload({ parentId: first.id, name: "note.txt", mimeType: "text/plain", size: 11, appProperties: { tripnestUploadId: "test-upload" } });
    expect((await drive.uploadChunk(session, new TextEncoder().encode("hello "), 0, 5, 11)).complete).toBe(false);
    expect(await drive.findFile(first.id, { tripnestUploadId: "test-upload" })).toBeNull();
    const complete = await drive.uploadChunk(session, new TextEncoder().encode("world"), 6, 10, 11);
    expect(complete.complete).toBe(true);
    expect((await drive.findFile(first.id, { tripnestUploadId: "test-upload" }))?.id).toBe(complete.file!.id);
    const download = await drive.downloadFile(complete.file!.id);
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("hello world");
  });
});
