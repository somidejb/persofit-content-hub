"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, XCircle, Trash2, Images, RefreshCw, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { MockAccount } from "@/lib/types";

function tokenStatus(expiresAt: string | null): { label: string; color: string; urgent: boolean } {
  if (!expiresAt) return { label: "Unknown expiry", color: "text-zinc-500", urgent: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return { label: "Expired", color: "text-red-400", urgent: true };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 2) return { label: `Expires in ${Math.floor(ms / 60_000)}m`, color: "text-yellow-400", urgent: true };
  if (hours < 24) return { label: `Expires in ${hours}h`, color: "text-yellow-400", urgent: false };
  const days = Math.floor(hours / 24);
  return { label: `Expires in ${days}d`, color: "text-zinc-500", urgent: false };
}

export default function AccountsClient({ initialAccounts }: { initialAccounts: MockAccount[] }) {
  const [accounts, setAccounts] = useState<MockAccount[]>(initialAccounts);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Read ?connected=1 or ?error=... from URL after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      setFlashMessage("TikTok account connected successfully!");
      window.history.replaceState({}, "", "/accounts");
      fetch("/api/accounts")
        .then((r) => r.json())
        .then((data: MockAccount[]) => setAccounts(data))
        .catch(() => {});
    } else if (params.get("error")) {
      setError(decodeURIComponent(params.get("error")!));
      window.history.replaceState({}, "", "/accounts");
    }
  }, []);

  async function handleAdd() {
    if (!name || !accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, accountId, accessToken }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Failed to connect account."); return; }
      setAccounts((prev) => [...prev, body]);
      setModalOpen(false);
      setName(""); setAccountId(""); setAccessToken("");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/accounts/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleRefresh(id: string) {
    setRefreshing(id);
    try {
      const res = await fetch(`/api/accounts/${id}/refresh`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Refresh failed");
      // Re-fetch account list to get updated expiry
      const updated = await fetch("/api/accounts").then((r) => r.json());
      setAccounts(updated);
      setFlashMessage("Token refreshed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Success / error flash */}
      {flashMessage && (
        <div className="rounded-lg border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-neon flex justify-between">
          {flashMessage}
          <button onClick={() => setFlashMessage(null)} className="text-neon/60 hover:text-neon">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Use <strong className="text-zinc-400">Connect with TikTok</strong> for automatic OAuth, or paste a token manually.
        </p>
        <div className="flex gap-2">
          <a
            href="/api/auth/tiktok"
            className="btn-primary flex items-center gap-1.5 text-sm no-underline"
          >
            <ExternalLink size={15} /> Connect with TikTok
          </a>
          <button onClick={() => setModalOpen(true)} className="btn-secondary text-sm">
            <Plus size={15} /> Manual token
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-zinc-400">No TikTok accounts connected yet.</p>
          <p className="text-xs text-zinc-600">Click &ldquo;Connect with TikTok&rdquo; to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const ts = tokenStatus(acc.tokenExpiresAt);
            return (
              <div key={acc.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{acc.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">ID: {acc.accountId || "—"}</p>
                  </div>
                  {acc.connected ? (
                    <span className="flex items-center gap-1 rounded-full border border-neon/30 bg-neon/10 px-2 py-0.5 text-[11px] font-medium text-neon">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
                      <XCircle size={12} /> Disconnected
                    </span>
                  )}
                </div>

                {/* Token expiry row */}
                <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-200 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {ts.urgent && <AlertTriangle size={11} className={ts.color} />}
                    <span className={`text-[11px] ${ts.color}`}>{ts.label}</span>
                  </div>
                  {acc.hasRefreshToken && (
                    <button
                      onClick={() => handleRefresh(acc.id)}
                      disabled={refreshing === acc.id}
                      title="Refresh access token"
                      className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-neon disabled:opacity-40 transition"
                    >
                      {refreshing === acc.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      Refresh
                    </button>
                  )}
                  {!acc.hasRefreshToken && (
                    <a href="/api/auth/tiktok" className="text-[11px] text-zinc-500 hover:text-neon transition">
                      Re-connect →
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-surface-border pt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Images size={13} /> {acc.slideshowCount} slideshow{acc.slideshowCount === 1 ? "" : "s"}
                  </span>
                  <button onClick={() => handleRemove(acc.id)} className="text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual token modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Account (Manual Token)">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            Manual tokens expire in 24 hours. Use <strong>Connect with TikTok</strong> for automatic refresh.
          </p>
          <div>
            <label className="label-text mb-1.5 block">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="@persofit.daily" className="input-field" />
          </div>
          <div>
            <label className="label-text mb-1.5 block">TikTok account ID <span className="text-zinc-600">(optional)</span></label>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="7291002348851" className="input-field" />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Access token</label>
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste TikTok Content Posting API token"
              type="password"
              className="input-field"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={handleAdd} disabled={!name || !accessToken || saving} className="btn-primary mt-1">
            {saving ? "Connecting…" : "Connect Account"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
