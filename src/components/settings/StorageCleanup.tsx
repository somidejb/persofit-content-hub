"use client";

import { useState } from "react";
import { HardDrive, Loader2, Trash2, RefreshCw } from "lucide-react";

type OrphanBlob = { url: string; size: number; uploadedAt: string };
type BlobCleanupReport = {
  totalBlobCount: number;
  totalBlobBytes: number;
  referencedCount: number;
  orphans: OrphanBlob[];
  orphanCount: number;
  orphanBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function StorageCleanup() {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<BlobCleanupReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setError(null);
    setDeleteResult(null);
    try {
      const res = await fetch("/api/admin/blob-cleanup");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Scan failed");
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete() {
    if (!report || report.orphanCount === 0) return;
    if (
      !confirm(
        `Permanently delete ${report.orphanCount} unused file(s), freeing ${formatBytes(report.orphanBytes)}? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blob-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: report.orphans.map((o) => o.url) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      setDeleteResult(`Deleted ${body.deleted} file(s), freeing ${formatBytes(report.orphanBytes)}.`);
      setReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
          <HardDrive size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Storage Cleanup</h2>
          <p className="text-xs text-zinc-500">
            Find and remove generated images no longer used by anything (old regenerations, previews, deleted slideshows).
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      {deleteResult && (
        <p className="mb-3 rounded-lg border border-neon/20 bg-neon/5 px-3 py-2 text-xs text-neon">{deleteResult}</p>
      )}

      {!report ? (
        <button onClick={handleScan} disabled={scanning} className="btn-secondary">
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {scanning ? "Scanning…" : "Scan Storage"}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Total Files</p>
              <p className="mt-1 text-lg font-bold text-white">{report.totalBlobCount}</p>
            </div>
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Total Size</p>
              <p className="mt-1 text-lg font-bold text-white">{formatBytes(report.totalBlobBytes)}</p>
            </div>
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Unused Files</p>
              <p className="mt-1 text-lg font-bold text-neon">{report.orphanCount}</p>
            </div>
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Reclaimable</p>
              <p className="mt-1 text-lg font-bold text-neon">{formatBytes(report.orphanBytes)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleScan} disabled={scanning} className="btn-secondary">
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Re-scan
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || report.orphanCount === 0}
              className="btn-danger"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {report.orphanCount === 0
                ? "Nothing to delete"
                : `Delete ${report.orphanCount} unused file(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
