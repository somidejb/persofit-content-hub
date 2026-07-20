import { prisma } from "@/lib/prisma";
import { toAccount } from "@/lib/adapters";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

function maskKey(key: string | null) {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
}

export default async function SettingsPage() {
  const [settings, accounts] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.tiktokAccount.findMany({ include: { _count: { select: { slideshows: true } } } }),
  ]);

  return (
    <SettingsClient
      maskedKey={maskKey(settings?.openaiApiKey ?? null)}
      hasKey={!!settings?.openaiApiKey}
      initialImageModel={settings?.imageModel ?? "gpt-image-2"}
      initialImageQuality={settings?.imageQuality ?? "medium"}
      initialDefaultAspectRatio={settings?.defaultAspectRatio ?? "9:16"}
      initialDefaultOutputWidth={settings?.defaultOutputWidth ?? 1080}
      initialDefaultOutputHeight={settings?.defaultOutputHeight ?? 1920}
      accounts={accounts.map(toAccount)}
      initialTiktokClientKey={settings?.tiktokClientKey ?? null}
      initialTiktokRedirectUri={settings?.tiktokRedirectUri ?? null}
    />
  );
}
