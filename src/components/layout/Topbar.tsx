"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, Menu } from "lucide-react";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of your slideshows and activity" },
  "/slideshows": { title: "Slideshows", subtitle: "Build and manage TikTok slideshow content" },
  "/templates": { title: "Templates", subtitle: "Auto-generate and schedule content" },
  "/schedule": { title: "Schedule", subtitle: "Upcoming automated posts" },
  "/history": { title: "History", subtitle: "Log of everything that's been posted" },
  "/accounts": { title: "TikTok Accounts", subtitle: "Manage connected TikTok accounts" },
  "/settings": { title: "Settings", subtitle: "API keys and integrations" },
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const entry =
    Object.entries(TITLES).find(([href]) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href)
    )?.[1] ?? { title: "Persofit", subtitle: "" };

  const showNewSlideshow = pathname.startsWith("/slideshows") && !pathname.includes("/new");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-surface-border bg-background/80 px-4 backdrop-blur sm:h-16 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-lg p-1.5 text-zinc-400 hover:bg-surface-200 hover:text-white lg:hidden shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">{entry.title}</h1>
          <p className="hidden text-xs text-zinc-500 sm:block">{entry.subtitle}</p>
        </div>
      </div>
      {showNewSlideshow && (
        <Link href="/slideshows/new" className="btn-primary shrink-0 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2">
          <Plus size={15} />
          <span className="hidden xs:inline">New Slideshow</span>
          <span className="xs:hidden">New</span>
        </Link>
      )}
    </header>
  );
}
