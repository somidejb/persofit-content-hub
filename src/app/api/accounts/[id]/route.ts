export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toAccount } from "@/lib/adapters";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.accountId === "string") data.accountId = body.accountId;
  if (typeof body.accessToken === "string") data.accessToken = body.accessToken;
  if (typeof body.connected === "boolean") data.connected = body.connected;

  const account = await prisma.tiktokAccount.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { slideshows: true } } },
  });

  return NextResponse.json(toAccount(account));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.tiktokAccount.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
