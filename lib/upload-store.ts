"use client";

export type SavedUpload = { key: string; uploadId: string; tripId: string; fileName: string; size: number; mimeType: string; uploadedBytes: number; updatedAt: number };
const DB_NAME = "tripnest-uploads";
const STORE = "sessions";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveUpload(value: SavedUpload) {
  const db = await database();
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  db.close();
}

export async function loadUpload(key: string) {
  const db = await database();
  const value = await new Promise<SavedUpload | undefined>((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  db.close(); return value;
}

export async function removeUpload(key: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  db.close();
}
