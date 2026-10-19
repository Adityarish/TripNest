export function humanBytes(value: bigint | number) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function safeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 180) || "untitled";
}

export function tripFolderName(name: string, startDate: Date) {
  return `${safeFilename(name)} — ${startDate.toISOString().slice(0, 10)}`;
}
