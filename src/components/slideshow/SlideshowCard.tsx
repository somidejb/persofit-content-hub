import Link from "next/link";
import { Images, Calendar, Eye, Heart, User } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { MockSlideshow } from "@/lib/types";

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function SlideshowCard({ slideshow }: { slideshow: MockSlideshow }) {
  const doneSlides = slideshow.slides.filter((s) => s.status === "done").length;
  const progressPct = slideshow.slides.length
    ? Math.round((doneSlides / slideshow.slides.length) * 100)
    : 0;

  return (
    <Link
      href={`/slideshows/${slideshow.id}`}
      className="card group flex flex-col overflow-hidden p-4 transition hover:border-neon/40 hover:shadow-neon"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-neon">
          {slideshow.name}
        </h3>
        <StatusBadge status={slideshow.status} />
      </div>

      <div className="mb-3 flex -space-x-3">
        {slideshow.slides.slice(0, 5).map((slide, i) => {
          const thumb = slide.finalImagePath || slide.generatedImagePath || slide.referenceImagePath;
          return (
            <div
              key={slide.id}
              className="h-14 w-11 flex-shrink-0 overflow-hidden rounded-md border-2 border-surface-100 bg-surface-200"
              style={{ zIndex: 5 - i }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-600">
                  <Images size={14} />
                </div>
              )}
            </div>
          );
        })}
        {slideshow.slides.length > 5 && (
          <div className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-md border-2 border-surface-100 bg-surface-300 text-[11px] font-medium text-zinc-400">
            +{slideshow.slides.length - 5}
          </div>
        )}
      </div>

      {slideshow.status === "GENERATING" && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
            <span>Generating slides</span>
            <span>{doneSlides}/{slideshow.slides.length}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-300">
            <div
              className="h-full rounded-full bg-neon transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1.5 border-t border-surface-border pt-3 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <User size={12} />
          <span>{slideshow.tiktokAccountName ?? "No account assigned"}</span>
        </div>
        {slideshow.nextPostDate && (
          <div className="flex items-center gap-1.5">
            <Calendar size={12} />
            <span>
              Next post {formatDate(slideshow.nextPostDate)} at {slideshow.postTime}
            </span>
          </div>
        )}
        {slideshow.status === "POSTED" && (
          <div className="flex items-center gap-3 pt-0.5">
            <span className="flex items-center gap-1">
              <Eye size={12} /> {slideshow.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={12} /> {slideshow.likes.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
