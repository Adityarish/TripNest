import type { Readable } from "node:stream";

export type FolderProperties = Record<string, string>;

export interface FolderInfo {
  id: string;
  name: string;
  driveId?: string;
  storageType: "MY_DRIVE_FOLDER" | "SHARED_DRIVE" | "MOCK";
  writable: boolean;
}

export interface UploadedFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  md5Checksum?: string;
}

export interface DriveProvider {
  inspectFolder(folderId: string): Promise<FolderInfo>;
  findFolder(parentId: string, appProperties: FolderProperties): Promise<FolderInfo | null>;
  findFile(parentId: string, appProperties: FolderProperties): Promise<UploadedFileInfo | null>;
  createFolder(parentId: string, name: string, appProperties: FolderProperties): Promise<FolderInfo>;
  createResumableUpload(input: { parentId: string; name: string; mimeType: string; size: number; appProperties: FolderProperties }): Promise<string>;
  uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, end: number, total: number): Promise<{ complete: boolean; uploadedBytes: number; file?: UploadedFileInfo }>;
  downloadFile(fileId: string): Promise<{ stream: Readable; name: string; mimeType: string; size?: number }>;
  renameFile(fileId: string, name: string): Promise<void>;
  moveFile(fileId: string, oldParentId: string, newParentId: string): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
}
