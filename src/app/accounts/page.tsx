import { prisma } from "@/lib/prisma";
import { toAccount } from "@/lib/adapters";
import AccountsClient from "@/components/settings/AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.tiktokAccount.findMany({
    include: { _count: { select: { slideshows: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <AccountsClient initialAccounts={accounts.map(toAccount)} />;
}
