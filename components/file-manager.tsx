"use client";
/* eslint-disable @next/next/no-img-element -- Private Drive images must load through the authenticated content route. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, File, FileImage, FileText, Film, FolderInput, Grid2X2, Heart, MoreHorizontal, Pencil, Rows3, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { humanBytes } from "@/lib/storage-utils";
import { loadUpload, removeUpload, saveUpload } from "@/lib/upload-store";

type Media = { id: string; tripId: string; name: string; mimeType: string; sizeBytes: string; category: "PHOTOS" | "VIDEOS" | "DOCUMENTS" | "OTHER"; isFavorite: boolean; createdAt: string };
type UploadRow = { key: string; name: string; progress: number; status: "uploading" | "error"; message?: string };

function icon(category: Media["category"]) {
  return category === "PHOTOS" ? FileImage : category === "VIDEOS" ? Film : category === "DOCUMENTS" ? FileText : File;
}

export function FileManager({ tripId, tripName, trips, initialFiles }: { tripId: string; tripName: string; trips: Array<{ id: string; name: string }>; initialFiles: Media[] }) {
  const [category, setCategory] = useState<"ALL" | "FAVORITES" | Media["category"]>("ALL");
  const [view, setView] = useState<"grid" | "tiles">("grid");
  const [preview, setPreview] = useState<Media>();
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [localFiles, setLocalFiles] = useState(initialFiles);
  const [busy, setBusy] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => setLocalFiles(initialFiles), [initialFiles]);

  const files = useMemo(() => {
    if (category === "ALL") return localFiles;
    if (category === "FAVORITES") return localFiles.filter((file) => file.isFavorite);
    return localFiles.filter((file) => file.category === category);
  }, [category, localFiles]);

  async function uploadFile(file: globalThis.File) {
    const key = `${tripId}:${file.name}:${file.size}:${file.lastModified}`;
    setUploads((rows) => [...rows.filter((row) => row.key !== key), { key, name: file.name, progress: 0, status: "uploading" }]);
    try {
      const saved = await loadUpload(key);
      let uploadId = saved?.uploadId;
      let offset = saved?.uploadedBytes ?? 0;
      if (uploadId) {
        const status = await fetch(`/api/uploads/${uploadId}`).then((response) => response.ok ? response.json() : null);
        if (!status || ["EXPIRED", "FAILED", "CANCELLED"].includes(status.state)) { uploadId = undefined; offset = 0; }
        else if (status.state === "COMPLETED") { await removeUpload(key); setUploads((rows) => rows.filter((row) => row.key !== key)); router.refresh(); return; }
        else offset = Number(status.uploadedBytes);
      }
      if (!uploadId) {
        const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId, name: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not start upload");
        uploadId = result.id;
      }
      const chunkSize = 5 * 1024 * 1024;
      await saveUpload({ key, uploadId: uploadId!, tripId, fileName: file.name, size: file.size, mimeType: file.type, uploadedBytes: offset, updatedAt: Date.now() });
      while (offset < file.size) {
        const endExclusive = Math.min(offset + chunkSize, file.size);
        const response = await fetch(`/api/uploads/${uploadId}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${offset}-${endExclusive - 1}/${file.size}` }, body: file.slice(offset, endExclusive) });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409 && result.uploadedBytes !== undefined) { offset = Number(result.uploadedBytes); continue; }
          throw new Error(result.error ?? "Upload interrupted");
        }
        offset = Number(result.uploadedBytes);
        await saveUpload({ key, uploadId: uploadId!, tripId, fileName: file.name, size: file.size, mimeType: file.type, uploadedBytes: offset, updatedAt: Date.now() });
        setUploads((rows) => rows.map((row) => row.key === key ? { ...row, progress: Math.round(offset / file.size * 100) } : row));
      }
      await removeUpload(key);
      setUploads((rows) => rows.filter((row) => row.key !== key));
      router.refresh();
    } catch (error) {
      setUploads((rows) => rows.map((row) => row.key === key ? { ...row, status: "error", message: error instanceof Error ? error.message : "Upload failed" } : row));
    }
  }

  async function mutate(file: Media, action: "rename" | "move" | "delete") {
    setBusy(file.id);
    try {
      if (action === "delete") {
        if (!confirm(`Delete ${file.name}? This removes the original from Drive.`)) return;
        const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Delete failed");
      } else if (action === "rename") {
        const name = prompt("New file name", file.name)?.trim();
        if (!name || name === file.name) return;
        const response = await fetch(`/api/files/${file.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        if (!response.ok) throw new Error("Rename failed");
      } else {
        const destinationName = prompt(`Destination trip (${trips.map((trip) => trip.name).join(", ")})`, tripName)?.trim();
        if (!destinationName) return;
        const destination = trips.find((trip) => trip.name.toLowerCase() === destinationName.toLowerCase());
        if (!destination) throw new Error("Choose one of your listed trip names");
        const next = prompt("Destination category: photos, videos, documents, or other", file.category.toLowerCase())?.trim().toUpperCase();
        if (!next || (next === file.category && destination.id === file.tripId)) return;
        if (!["PHOTOS", "VIDEOS", "DOCUMENTS", "OTHER"].includes(next)) throw new Error("Choose photos, videos, documents, or other");
        const response = await fetch(`/api/files/${file.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: destination.id, category: next }) });
        if (!response.ok) throw new Error("Move failed");
      }
      router.refresh();
    } catch (error) { alert(error instanceof Error ? error.message : "File action failed"); }
    finally { setBusy(undefined); }
  }

  async function toggleFavorite(file: Media) {
    const nextFavorite = !file.isFavorite;
    setLocalFiles((current) => current.map((item) => item.id === file.id ? { ...item, isFavorite: nextFavorite } : item));
    setBusy(file.id);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: nextFavorite }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error ?? "Could not update favorite");
      }
      router.refresh();
    } catch (error) {
      setLocalFiles((current) => current.map((item) => item.id === file.id ? { ...item, isFavorite: file.isFavorite } : item));
      alert(error instanceof Error ? error.message : "Could not update favorite");
    } finally {
      setBusy(undefined);
    }
  }

  function previewTile(file: Media, compact = false) {
    const Icon = icon(file.category);
    if (file.category === "PHOTOS" && file.mimeType.startsWith("image/")) {
      return <button type="button" onClick={() => setPreview(file)} className={`group/preview relative shrink-0 overflow-hidden bg-sand text-left ${compact ? "size-20 rounded-xl" : "aspect-[4/3] w-full"}`} aria-label={`Open ${file.name}`}>
        <img src={`/api/files/${file.id}/content`} alt={file.name} loading="lazy" className="size-full object-cover transition duration-300 group-hover/preview:scale-[1.03]" />
      </button>;
    }
    return <a href={`/api/files/${file.id}/content`} target="_blank" rel="noreferrer" className={`grid shrink-0 place-items-center bg-sand ${compact ? "size-20 rounded-xl" : "aspect-[4/3] w-full"}`} aria-label={`Open ${file.name}`}><Icon className={compact ? "size-7 text-coral" : "size-10 text-coral"} /></a>;
  }

  function fileActions(file: Media) {
    return <div className="grid w-full grid-cols-5 gap-1">
      <button className="file-action" disabled={busy === file.id} onClick={() => toggleFavorite(file)} title={file.isFavorite ? "Remove from favorites" : "Add to favorites"} aria-label={`${file.isFavorite ? "Remove" : "Add"} ${file.name} ${file.isFavorite ? "from" : "to"} favorites`} aria-pressed={file.isFavorite}><Heart className={file.isFavorite ? "fill-coral text-coral" : undefined} /></button>
      <a className="file-action" href={`/api/files/${file.id}/content?download=1`} title="Download original" aria-label={`Download ${file.name}`}><Download /></a>
      <button className="file-action" disabled={busy === file.id} onClick={() => mutate(file, "rename")} title="Rename" aria-label={`Rename ${file.name}`}><Pencil /></button>
      <button className="file-action" disabled={busy === file.id} onClick={() => mutate(file, "move")} title="Move" aria-label={`Move ${file.name}`}><FolderInput /></button>
      <button className="file-action text-red-600" disabled={busy === file.id} onClick={() => mutate(file, "delete")} title="Delete" aria-label={`Delete ${file.name}`}><Trash2 /></button>
    </div>;
  }

  return <section className="mt-10">
    <input ref={input} type="file" multiple className="sr-only" onChange={(event) => { Array.from(event.target.files ?? []).forEach(uploadFile); event.target.value = ""; }} />
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Originals, untouched</p><h2 className="mt-2 font-display text-3xl">Your trip files</h2></div>
      <Button variant="coral" onClick={() => input.current?.click()}><UploadCloud className="size-4" /> Add files</Button>
    </div>
    {uploads.length > 0 && <div className="mt-5 space-y-2 rounded-2xl border border-ink/10 bg-white p-4">
      {uploads.map((upload) => <div key={upload.key} className="flex items-center gap-3 text-sm"><UploadCloud className="size-4 text-coral" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="truncate">{upload.name}</span><span>{upload.status === "error" ? "Needs attention" : `${upload.progress}%`}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8"><div className={`h-full rounded-full ${upload.status === "error" ? "bg-red-500" : "bg-coral"}`} style={{ width: `${Math.max(upload.progress, 2)}%` }} /></div>{upload.message && <p className="mt-1 text-xs text-red-700">{upload.message}. Select the same file to resume.</p>}</div><button onClick={() => setUploads((rows) => rows.filter((row) => row.key !== upload.key))} aria-label="Dismiss"><X className="size-4" /></button></div>)}
    </div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 overflow-x-auto pb-2">{(["ALL", "FAVORITES", "PHOTOS", "VIDEOS", "DOCUMENTS", "OTHER"] as const).map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide ${category === item ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink/60 hover:text-ink"}`}>{item[0] + item.slice(1).toLowerCase()}</button>)}</div><div className="flex rounded-xl border border-ink/10 bg-white p-1" aria-label="File view"><button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${view === "grid" ? "bg-ink text-white" : "text-ink/55 hover:text-ink"}`}><Grid2X2 className="size-3.5" /> Grid</button><button type="button" onClick={() => setView("tiles")} aria-pressed={view === "tiles"} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${view === "tiles" ? "bg-ink text-white" : "text-ink/55 hover:text-ink"}`}><Rows3 className="size-3.5" /> Tiles</button></div></div>
    {files.length === 0 ? category === "FAVORITES" ? <div className="mt-4 grid w-full place-items-center rounded-[2rem] border border-dashed border-ink/20 bg-white/55 py-16 text-center"><Heart className="size-8 text-coral" /><strong className="mt-4 font-display text-xl">No favorites yet</strong><span className="mt-1 text-sm text-ink/50">Use the heart on a file to keep it here.</span></div> : <button onClick={() => input.current?.click()} className="mt-4 grid w-full place-items-center rounded-[2rem] border border-dashed border-ink/20 bg-white/55 py-16 text-center hover:border-coral/60"><UploadCloud className="size-8 text-coral" /><strong className="mt-4 font-display text-xl">Drop memories here</strong><span className="mt-1 text-sm text-ink/50">Photos, videos, documents, and more</span></button> : view === "grid" ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file) => <article key={file.id} className="group overflow-hidden rounded-2xl border border-ink/9 bg-white shadow-[0_12px_40px_rgba(29,39,36,.04)]">
        {previewTile(file)}
        <div className="p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" title={file.name}>{file.name}</h3><div className="mt-1 flex flex-wrap items-center gap-2"><Badge>{file.category.toLowerCase()}</Badge><span className="text-xs text-ink/45">{humanBytes(BigInt(file.sizeBytes))}</span></div></div><MoreHorizontal className="size-4 shrink-0 text-ink/30" /></div><div className="mt-3 border-t border-ink/7 pt-2">{fileActions(file)}</div></div>
      </article>)}
    </div> : <div className="mt-4 space-y-3">
      {files.map((file) => <article key={file.id} className="flex flex-col gap-3 rounded-2xl border border-ink/9 bg-white p-3 shadow-[0_12px_40px_rgba(29,39,36,.04)] sm:flex-row sm:items-center">
        {previewTile(file, true)}
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" title={file.name}>{file.name}</h3><div className="mt-2 flex flex-wrap items-center gap-2"><Badge>{file.category.toLowerCase()}</Badge><span className="text-xs text-ink/45">{humanBytes(BigInt(file.sizeBytes))}</span><span className="text-xs text-ink/35">{new Date(file.createdAt).toLocaleDateString()}</span></div></div><div className="w-full sm:w-56">{fileActions(file)}</div>
      </article>)}
    </div>}
    {preview && <div role="dialog" aria-modal="true" aria-label={preview.name} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setPreview(undefined)}><div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-ink shadow-2xl"><div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white"><p className="truncate text-sm font-semibold">{preview.name}</p><div className="flex items-center gap-2"><a href={`/api/files/${preview.id}/content?download=1`} className="grid size-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label={`Download ${preview.name}`}><Download className="size-4" /></a><button type="button" onClick={() => setPreview(undefined)} className="grid size-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Close preview"><X className="size-5" /></button></div></div><div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-black/30 p-2"><img src={`/api/files/${preview.id}/content`} alt={preview.name} className="max-h-[calc(94vh-4.5rem)] max-w-full object-contain" /></div></div></div>}
  </section>;
}
