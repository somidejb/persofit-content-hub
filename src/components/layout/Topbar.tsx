"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of your slideshows and activity" },
  "/slideshows": { title: "Slideshows", subtitle: "Build and manage TikTok slideshow content" },
  "/schedule": { title: "Schedule", subtitle: "Upcoming automated posts" },
  "/history": { title: "History", subtitle: "Log of everything that's been posted" },
  "/accounts": { title: "TikTok Accounts", subtitle: "Manage connected TikTok accounts" },
  "/settings": { title: "Settings", subtitle: "API keys and integrations" },
};

export default function Topbar() {
  const pathname = usePathname();
  const entry =
    Object.entries(TITLES).find(([href]) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href)
    )?.[1] ?? { title: "Persofit", subtitle: "" };

  const showNewSlideshow = pathname.startsWith("/slideshows") && !pathname.includes("/new");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-border bg-background/80 px-8 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-white">{entry.title}</h1>
        <p className="text-xs text-zinc-500">{entry.subtitle}</p>
      </div>
      {showNewSlideshow && (
        <Link href="/slideshows/new" className="btn-primary">
          <Plus size={16} />
          New Slideshow
        </Link>
      )}
    </header>
  );
}
