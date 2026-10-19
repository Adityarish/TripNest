import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { DriveProvider, FolderInfo, FolderProperties, UploadedFileInfo } from "@/lib/drive/types";

type Meta = {
  id: string;
  name: string;
  kind: "folder" | "file";
  parentId?: string;
  mimeType?: string;
  size?: number;
  appProperties?: FolderProperties;
};

export class MockDriveProvider implements DriveProvider {
  private root = path.resolve(process.cwd(), env.MOCK_DRIVE_PATH);
  private metaDir = path.join(this.root, "metadata");
  private dataDir = path.join(this.root, "objects");
  private uploadDir = path.join(this.root, "uploads");

  private async prepare() {
    await Promise.all([this.metaDir, this.dataDir, this.uploadDir].map((dir) => mkdir(dir, { recursive: true })));
    const root = await this.readMeta("mock-root-1");
    if (!root) await this.writeMeta({ id: "mock-root-1", name: "Local demo root", kind: "folder" });
  }

  private metaPath(id: string) { return path.join(this.metaDir, `${id}.json`); }
  private objectPath(id: string) { return path.join(this.dataDir, id); }
  private uploadPath(id: string) { return path.join(this.uploadDir, `${id}.part`); }

  private async readMeta(id: string): Promise<Meta | null> {
    try { return JSON.parse(await readFile(this.metaPath(id), "utf8")) as Meta; } catch { return null; }
  }

  private async writeMeta(meta: Meta) {
    await mkdir(this.metaDir, { recursive: true });
    await writeFile(this.metaPath(meta.id), JSON.stringify(meta, null, 2), { mode: 0o600 });
  }

  async inspectFolder(folderId: string): Promise<FolderInfo> {
    await this.prepare();
    const meta = await this.readMeta(folderId);
    if (!meta || meta.kind !== "folder") throw new Error("Mock Drive folder was not found");
    return { id: meta.id, name: meta.name, storageType: "MOCK", writable: true };
  }

  async findFolder(parentId: string, appProperties: FolderProperties) {
    await this.prepare();
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(this.metaDir));
    for (const entry of entries) {
      const meta = await this.readMeta(entry.replace(/\.json$/, ""));
      if (meta?.kind === "folder" && meta.parentId === parentId && Object.entries(appProperties).every(([key, value]) => meta.appProperties?.[key] === value)) {
        return { id: meta.id, name: meta.name, storageType: "MOCK" as const, writable: true };
      }
    }
    return null;
  }

  async createFolder(parentId: string, name: string, appProperties: FolderProperties) {
    await this.prepare();
    const existing = await this.findFolder(parentId, appProperties);
    if (existing) return existing;
    const id = randomUUID();
    await this.writeMeta({ id, name, kind: "folder", parentId, appProperties });
    return { id, name, storageType: "MOCK" as const, writable: true };
  }

  async findFile(parentId: string, appProperties: FolderProperties): Promise<UploadedFileInfo | null> {
    await this.prepare();
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(this.metaDir));
    for (const entry of entries) {
      const meta = await this.readMeta(entry.replace(/\.json$/, ""));
      if (meta?.kind !== "file" || meta.parentId !== parentId || !Object.entries(appProperties).every(([key, value]) => meta.appProperties?.[key] === value)) continue;
      try {
        await stat(this.objectPath(meta.id));
        return { id: meta.id, name: meta.name, mimeType: meta.mimeType ?? "application/octet-stream", size: meta.size };
      } catch { return null; }
    }
    return null;
  }

  async createResumableUpload(input: { parentId: string; name: string; mimeType: string; size: number; appProperties: FolderProperties }) {
    await this.prepare();
    const id = randomUUID();
    await this.writeMeta({ id, name: input.name, kind: "file", parentId: input.parentId, mimeType: input.mimeType, size: input.size, appProperties: input.appProperties });
    await writeFile(this.uploadPath(id), new Uint8Array(), { mode: 0o600 });
    return `mock:${id}`;
  }

  async uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, end: number, total: number) {
    const id = sessionUrl.replace(/^mock:/, "");
    const handle = await open(this.uploadPath(id), "r+");
    try { await handle.write(chunk, 0, chunk.byteLength, start); } finally { await handle.close(); }
    const uploadedBytes = end + 1;
    if (uploadedBytes < total) return { complete: false, uploadedBytes };
    await rename(this.uploadPath(id), this.objectPath(id));
    const meta = await this.readMeta(id);
    const file: UploadedFileInfo = { id, name: meta?.name ?? "file", mimeType: meta?.mimeType ?? "application/octet-stream", size: total };
    return { complete: true, uploadedBytes, file };
  }

  async downloadFile(fileId: string) {
    const meta = await this.readMeta(fileId);
    if (!meta || meta.kind !== "file") throw new Error("File not found");
    return { stream: createReadStream(this.objectPath(fileId)), name: meta.name, mimeType: meta.mimeType ?? "application/octet-stream", size: meta.size };
  }

  async renameFile(fileId: string, name: string) {
    const meta = await this.readMeta(fileId);
    if (!meta) throw new Error("File not found");
    await this.writeMeta({ ...meta, name });
  }

  async moveFile(fileId: string, oldParentId: string, newParentId: string) {
    const meta = await this.readMeta(fileId);
    if (!meta || meta.parentId !== oldParentId) throw new Error("File parent mismatch");
    await this.writeMeta({ ...meta, parentId: newParentId });
  }

  async deleteFile(fileId: string) {
    await this.prepare();
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(this.metaDir));
    for (const entry of entries) {
      const childId = entry.replace(/\.json$/, "");
      const child = await this.readMeta(childId);
      if (child?.parentId === fileId) await this.deleteFile(childId);
    }
    await Promise.all([rm(this.metaPath(fileId), { force: true }), rm(this.objectPath(fileId), { force: true }), rm(this.uploadPath(fileId), { force: true })]);
  }
}
