import TemplateForm from "@/components/templates/TemplateForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const accounts = await prisma.tiktokAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return <TemplateForm accounts={accounts} />;
}
