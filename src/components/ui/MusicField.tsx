"use client";

/**
 * Reusable TikTok sound field used in template creation/editing,
 * slideshow creation/editing. Accepts a full TikTok sound URL or
 * bare numeric ID, extracts the ID automatically, and shows a
 * "Listen on TikTok" preview link so the user can hear the sound
 * before saving.
 */

interface MusicFieldProps {
  value: string;
  onChange: (raw: string) => void;
  /** Resolved numeric ID — pass back up if needed, otherwise computed internally */
  className?: string;
}

/** Extracts a TikTok sound ID from a URL or returns the raw string if it's already an ID. */
export function extractMusicId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(\d{10,})(?:[^0-9].*)?$/);
  return match ? match[1] : trimmed;
}

export default function MusicField({ value, onChange, className = "" }: MusicFieldProps) {
  const resolvedId = extractMusicId(value);

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        TikTok Sound <span className="text-zinc-600">(optional)</span>
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm"
        placeholder="Paste TikTok sound URL or bare ID"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 min-h-[16px]">
        <p className="text-[11px] text-zinc-600">
          Paste the sound URL from TikTok — ID extracted automatically
          {resolvedId && (
            <span className="ml-1 font-mono text-zinc-500">({resolvedId})</span>
          )}
        </p>
        {resolvedId && (
          <a
            href={`https://www.tiktok.com/music/-${resolvedId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[11px] text-blue-400 hover:text-blue-300 underline"
          >
            Listen on TikTok ↗
          </a>
        )}
      </div>
    </div>
  );
}
