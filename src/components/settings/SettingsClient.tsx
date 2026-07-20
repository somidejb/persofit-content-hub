"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Users, ArrowUpRight, CheckCircle2, Ratio, Music2 } from "lucide-react";
import { ASPECT_RATIO_PRESETS, findAspectRatioPreset } from "@/lib/aspect-ratio-presets";
import type { MockAccount } from "@/lib/types";

const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];
const IMAGE_QUALITIES = ["low", "medium", "high", "auto"];

export default function SettingsClient({
  maskedKey,
  hasKey,
  initialImageModel,
  initialImageQuality,
  initialDefaultAspectRatio,
  initialDefaultOutputWidth,
  initialDefaultOutputHeight,
  accounts,
  initialTiktokClientKey,
  initialTiktokRedirectUri,
}: {
  maskedKey: string | null;
  hasKey: boolean;
  initialImageModel: string;
  initialImageQuality: string;
  initialDefaultAspectRatio: string;
  initialDefaultOutputWidth: number;
  initialDefaultOutputHeight: number;
  accounts: MockAccount[];
  initialTiktokClientKey: string | null;
  initialTiktokRedirectUri: string | null;
}) {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tiktokClientKey, setTiktokClientKey] = useState(initialTiktokClientKey ?? "");
  const [tiktokClientSecret, setTiktokClientSecret] = useState("");
  const [tiktokRedirectUri, setTiktokRedirectUri] = useState(initialTiktokRedirectUri ?? "");
  const [savingTiktok, setSavingTiktok] = useState(false);
  const [tiktokSaved, setTiktokSaved] = useState(false);

  const [imageModel, setImageModel] = useState(initialImageModel);
  const [imageQuality, setImageQuality] = useState(initialImageQuality);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(initialDefaultAspectRatio);
  const [defaultOutputWidth, setDefaultOutputWidth] = useState(initialDefaultOutputWidth);
  const [defaultOutputHeight, setDefaultOutputHeight] = useState(initialDefaultOutputHeight);
  const [savingImageSettings, setSavingImageSettings] = useState(false);
  const [imageSettingsSaved, setImageSettingsSaved] = useState(false);

  async function handleSaveKey() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey }),
      });
      if (res.ok) {
        setSaved(true);
        setOpenaiApiKey("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to save key.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAspectRatioChange(value: string) {
    setDefaultAspectRatio(value);
    const preset = findAspectRatioPreset(value);
    if (preset && value !== "custom") {
      setDefaultOutputWidth(preset.width);
      setDefaultOutputHeight(preset.height);
    }
  }

  async function handleSaveTiktok() {
    setSavingTiktok(true);
    setTiktokSaved(false);
    try {
      const payload: Record<string, string> = { tiktokClientKey, tiktokRedirectUri };
      if (tiktokClientSecret) payload.tiktokClientSecret = tiktokClientSecret;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setTiktokSaved(true);
        setTiktokClientSecret("");
      }
    } finally {
      setSavingTiktok(false);
    }
  }

  async function handleSaveImageSettings() {
    setSavingImageSettings(true);
    setImageSettingsSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageModel,
          imageQuality,
          defaultAspectRatio,
          defaultOutputWidth,
          defaultOutputHeight,
        }),
      });
      if (res.ok) setImageSettingsSaved(true);
    } finally {
      setSavingImageSettings(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
            <KeyRound size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">OpenAI API Key</h2>
            <p className="text-xs text-zinc-500">Used to call GPT Image 2 for slide generation</p>
          </div>
        </div>
        {hasKey && (
          <p className="mb-2 text-xs text-zinc-500">
            Current key: <span className="font-mono text-zinc-300">{maskedKey}</span>
          </p>
        )}
        <label className="label-text mb-1.5 block">{hasKey ? "Replace key" : "API Key"}</label>
        <input
          value={openaiApiKey}
          onChange={(e) => setOpenaiApiKey(e.target.value)}
          placeholder="sk-••••••••••••••••••••••••"
          type="password"
          className="input-field"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={handleSaveKey} disabled={!openaiApiKey || saving} className="btn-primary">
            {saving ? "Saving…" : "Save Key"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-neon">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
            <Ratio size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Image Generation Defaults</h2>
            <p className="text-xs text-zinc-500">Model, quality, and default output format for new slideshows</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text mb-1.5 block">Image Model</label>
            <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="input-field">
              {IMAGE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text mb-1.5 block">Image Quality</label>
            <select value={imageQuality} onChange={(e) => setImageQuality(e.target.value)} className="input-field">
              {IMAGE_QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {q[0].toUpperCase() + q.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="label-text mb-1.5 block">Default Aspect Ratio</label>
          <select
            value={defaultAspectRatio}
            onChange={(e) => handleAspectRatioChange(e.target.value)}
            className="input-field"
          >
            {ASPECT_RATIO_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="label-text mb-1.5 block">Output Width</label>
            <input
              type="number"
              value={defaultOutputWidth}
              disabled={defaultAspectRatio !== "custom"}
              onChange={(e) => setDefaultOutputWidth(parseInt(e.target.value) || 0)}
              className="input-field disabled:opacity-50"
            />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Output Height</label>
            <input
              type="number"
              value={defaultOutputHeight}
              disabled={defaultAspectRatio !== "custom"}
              onChange={(e) => setDefaultOutputHeight(parseInt(e.target.value) || 0)}
              className="input-field disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={handleSaveImageSettings} disabled={savingImageSettings} className="btn-primary">
            {savingImageSettings ? "Saving…" : "Save Image Settings"}
          </button>
          {imageSettingsSaved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-neon">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* TikTok OAuth Integration */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
            <Music2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">TikTok Integration</h2>
            <p className="text-xs text-zinc-500">
              Required for the &ldquo;Connect with TikTok&rdquo; OAuth button on the Accounts page
            </p>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-zinc-700 bg-surface-200 px-3 py-2.5 text-[11px] text-zinc-400 leading-relaxed">
          Get these from{" "}
          <a href="https://developers.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-neon hover:underline">
            developers.tiktok.com
          </a>
          {" "}→ My Apps → your app → Keys &amp; Credentials. The Redirect URI must match exactly what you register there.
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="label-text mb-1.5 block">Client Key</label>
            <input
              value={tiktokClientKey}
              onChange={(e) => setTiktokClientKey(e.target.value)}
              placeholder="aw1234567890abcd"
              className="input-field font-mono text-sm"
            />
          </div>
          <div>
            <label className="label-text mb-1.5 block">
              Client Secret <span className="text-zinc-600">(leave blank to keep existing)</span>
            </label>
            <input
              value={tiktokClientSecret}
              onChange={(e) => setTiktokClientSecret(e.target.value)}
              placeholder="••••••••••••••••"
              type="password"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Redirect URI</label>
            <input
              value={tiktokRedirectUri}
              onChange={(e) => setTiktokRedirectUri(e.target.value)}
              placeholder="https://yourdomain.com/api/auth/tiktok/callback"
              className="input-field font-mono text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={handleSaveTiktok} disabled={savingTiktok} className="btn-primary">
            {savingTiktok ? "Saving…" : "Save TikTok Settings"}
          </button>
          {tiktokSaved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-neon">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Connected TikTok Accounts</h2>
              <p className="text-xs text-zinc-500">{accounts.length} account(s) connected</p>
            </div>
          </div>
          <Link href="/accounts" className="flex items-center gap-1 text-xs font-medium text-neon hover:underline">
            Manage <ArrowUpRight size={13} />
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="text-xs text-zinc-500">No accounts connected yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between rounded-lg bg-surface-200 px-3 py-2 text-xs">
                <span className="text-zinc-300">{acc.name}</span>
                <span className={acc.connected ? "text-neon" : "text-red-400"}>
                  {acc.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
