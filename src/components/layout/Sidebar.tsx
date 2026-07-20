"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Images,
  CalendarClock,
  History,
  Users,
  Settings,
  Zap,
  LayoutTemplate,
} from "lucide-react";

const STATIC_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/slideshows", label: "Slideshows", icon: Images },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/history", label: "History", icon: History },
  { href: "/accounts", label: "TikTok Accounts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/templates/pending-count");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setPendingCount(data.count ?? 0);
      } catch {
        // silently ignore
      }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-surface-border bg-surface px-4 py-5">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon shadow-neon-sm">
          <Zap size={18} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Persofit</p>
          <p className="text-[11px] leading-tight text-zinc-500">Content Hub</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {STATIC_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isTemplates = item.href === "/templates";
          const badge = isTemplates && pendingCount > 0 ? pendingCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-neon/10 text-neon"
                  : "text-zinc-400 hover:bg-surface-200 hover:text-white"
              }`}
            >
              <Icon
                size={18}
                strokeWidth={2}
                className={active ? "text-neon" : "text-zinc-500 group-hover:text-white"}
              />
              {item.label}
              {badge > 0 && (
                <span className="ml-auto rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {badge}
                </span>
              )}
              {active && badge === 0 && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-neon shadow-neon-sm" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-lg border border-surface-border bg-surface-200 p-3">
        <p className="text-xs font-semibold text-zinc-300">GPT Image 2</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Powering slide generation via OpenAI
        </p>
      </div>
    </aside>
  );
}
