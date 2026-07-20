import { prisma } from "@/lib/prisma";
import TemplatesClient from "@/components/templates/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.slideshowTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tiktokAccount: { select: { id: true, name: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          createdAt: true,
          slideshowId: true,
          errorMessage: true,
        },
      },
    },
  });

  const serialized = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    runs: t.runs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  }));

  return <TemplatesClient templates={serialized} />;
}
