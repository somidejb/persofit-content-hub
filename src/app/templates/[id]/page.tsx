import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TemplateDetailClient from "@/components/templates/TemplateDetailClient";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const template = await prisma.slideshowTemplate.findUnique({
    where: { id },
    include: {
      tiktokAccount: { select: { id: true, name: true } },
      templateSlides: { orderBy: { order: "asc" } },
      runs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!template) notFound();

  const accounts = await prisma.tiktokAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const serialized = {
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    runs: template.runs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    templateSlides: template.templateSlides,
  };

  return <TemplateDetailClient template={serialized} accounts={accounts} />;
}
