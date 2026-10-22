import "server-only";
import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { decryptSecret } from "@/lib/crypto";
import { env, googleOAuthRedirectUri } from "@/lib/env";
import type { CredentialProfile } from "@prisma/client";
import type { DriveProvider, FolderInfo, FolderProperties } from "@/lib/drive/types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

async function clientFor(profile: CredentialProfile) {
  if (profile.type === "OAUTH") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !profile.encryptedCredentials) throw new Error("OAuth storage profile is incomplete");
    const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, googleOAuthRedirectUri);
    auth.setCredentials(JSON.parse(decryptSecret(profile.encryptedCredentials)));
    return auth;
  }
  if (profile.type === "SERVICE_ACCOUNT") {
    const raw = profile.encryptedCredentials
      ? decryptSecret(profile.encryptedCredentials)
      : env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ? Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8") : null;
    if (!raw) throw new Error("Service-account credentials are missing");
    return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: [DRIVE_SCOPE] });
  }
  throw new Error("Mock credentials cannot be used with Google Drive");
}

function q(value: string) { return value.replace(/['\\]/g, "\\$&"); }

export class GoogleDriveProvider implements DriveProvider {
  private constructor(private drive: drive_v3.Drive, private authClient: Awaited<ReturnType<typeof clientFor>>) {}

  static async create(profile: CredentialProfile) {
    const authClient = await clientFor(profile);
    return new GoogleDriveProvider(google.drive({ version: "v3", auth: authClient }), authClient);
  }

  async inspectFolder(folderId: string): Promise<FolderInfo> {
    const { data } = await this.drive.files.get({ fileId: folderId, fields: "id,name,mimeType,driveId,capabilities(canAddChildren)", supportsAllDrives: true });
    if (data.mimeType !== "application/vnd.google-apps.folder") throw new Error("The URL does not identify a Google Drive folder");
    return {
      id: data.id!, name: data.name ?? "Drive folder", driveId: data.driveId ?? undefined,
      storageType: data.driveId ? "SHARED_DRIVE" : "MY_DRIVE_FOLDER",
      writable: data.capabilities?.canAddChildren === true,
    };
  }

  async findFolder(parentId: string, appProperties: FolderProperties) {
    const properties = Object.entries(appProperties).map(([key, value]) => `appProperties has { key='${q(key)}' and value='${q(value)}' }`).join(" and ");
    const parent = await this.inspectFolder(parentId);
    const { data } = await this.drive.files.list({
      q: `'${q(parentId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and ${properties}`,
      fields: "files(id,name,driveId,capabilities(canAddChildren))", spaces: "drive", supportsAllDrives: true, includeItemsFromAllDrives: true,
      corpora: parent.driveId ? "drive" : "user", driveId: parent.driveId,
    });
    const file = data.files?.[0];
    return file ? { id: file.id!, name: file.name!, driveId: file.driveId ?? undefined, storageType: file.driveId ? "SHARED_DRIVE" as const : "MY_DRIVE_FOLDER" as const, writable: file.capabilities?.canAddChildren === true } : null;
  }

  async createFolder(parentId: string, name: string, appProperties: FolderProperties): Promise<FolderInfo> {
    const existing = await this.findFolder(parentId, appProperties);
    if (existing) return existing;
    const { data } = await this.drive.files.create({
      supportsAllDrives: true,
      requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId], appProperties },
      fields: "id,name,driveId,capabilities(canAddChildren)",
    });
    return { id: data.id!, name: data.name!, driveId: data.driveId ?? undefined, storageType: data.driveId ? "SHARED_DRIVE" : "MY_DRIVE_FOLDER", writable: true };
  }

  async findFile(parentId: string, appProperties: FolderProperties) {
    const properties = Object.entries(appProperties).map(([key, value]) => `appProperties has { key='${q(key)}' and value='${q(value)}' }`).join(" and ");
    const parent = await this.inspectFolder(parentId);
    const { data } = await this.drive.files.list({
      q: `'${q(parentId)}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false and ${properties}`,
      fields: "files(id,name,mimeType,size,md5Checksum)", spaces: "drive", supportsAllDrives: true, includeItemsFromAllDrives: true,
      corpora: parent.driveId ? "drive" : "user", driveId: parent.driveId,
    });
    const file = data.files?.[0];
    return file ? { id: file.id!, name: file.name!, mimeType: file.mimeType!, size: file.size ? Number(file.size) : undefined, md5Checksum: file.md5Checksum ?? undefined } : null;
  }

  async createResumableUpload(input: { parentId: string; name: string; mimeType: string; size: number; appProperties: FolderProperties }) {
    const tokenResult = await this.authClient.getAccessToken();
    const token = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
    if (!token) throw new Error("Google access token is unavailable");
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": input.mimeType, "X-Upload-Content-Length": String(input.size) },
      body: JSON.stringify({ name: input.name, mimeType: input.mimeType, parents: [input.parentId], appProperties: input.appProperties }),
    });
    const location = response.headers.get("location");
    if (!response.ok || !location) throw new Error(`Google Drive could not start the upload (${response.status})`);
    return location;
  }

  async uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, end: number, total: number) {
    const response = await fetch(sessionUrl, { method: "PUT", headers: { "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${total}` }, body: Buffer.from(chunk) });
    if (response.status === 308) {
      const range = response.headers.get("range");
      const uploadedBytes = range ? Number(range.split("-").at(-1)) + 1 : end + 1;
      return { complete: false, uploadedBytes };
    }
    if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
    const file = await response.json() as { id: string; name: string; mimeType: string; size?: string; md5Checksum?: string };
    return { complete: true, uploadedBytes: total, file: { ...file, size: file.size ? Number(file.size) : total } };
  }

  async downloadFile(fileId: string) {
    const [metadata, content] = await Promise.all([
      this.drive.files.get({ fileId, fields: "name,mimeType,size", supportsAllDrives: true }),
      this.drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" }),
    ]);
    return { stream: content.data as Readable, name: metadata.data.name!, mimeType: metadata.data.mimeType!, size: Number(metadata.data.size ?? 0) };
  }

  async renameFile(fileId: string, name: string) { await this.drive.files.update({ fileId, supportsAllDrives: true, requestBody: { name } }); }
  async moveFile(fileId: string, oldParentId: string, newParentId: string) { await this.drive.files.update({ fileId, supportsAllDrives: true, addParents: newParentId, removeParents: oldParentId }); }
  async deleteFile(fileId: string) { await this.drive.files.delete({ fileId, supportsAllDrives: true }); }
}
