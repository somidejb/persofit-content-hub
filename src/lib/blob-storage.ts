import path from "path";
import { unlink } from "fs/promises";
import { del } from "@vercel/blob";

/**
 * Deletes a stored image regardless of where it lives — a Vercel Blob URL
 * in production, or a local /uploads/... file in dev. Safe to call on paths
 * that no longer exist (e.g. already deleted) or that are null/empty.
 *
 * IMPORTANT: this is the only place image deletion should happen. The
 * earlier attempt at cleanup (in the template-run reject route) called
 * fs `unlink` unconditionally, which silently no-ops against Vercel Blob
 * URLs in production — exactly why storage kept growing unchecked.
 */
export async function deleteStoredImage(imagePath: string | null | undefined): Promise<void> {
  if (!imagePath) return;

  try {
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      await del(imagePath);
    } else {
      await unlink(path.join(process.cwd(), "public", imagePath.replace(/^\//, "")));
    }
  } catch {
    // Already gone, or never existed locally — not worth failing the caller over.
  }
}

/** Deletes several images, tolerating individual failures. */
export async function deleteStoredImages(imagePaths: (string | null | undefined)[]): Promise<void> {
  await Promise.allSettled(imagePaths.map((p) => deleteStoredImage(p)));
}
