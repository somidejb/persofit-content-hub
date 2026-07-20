import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toAccount } from "@/lib/adapters";

export async function GET() {
  const accounts = await prisma.tiktokAccount.findMany({
    include: { _count: { select: { slideshows: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(accounts.map(toAccount));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, accountId, accessToken } = body;

  if (!name || !accessToken) {
    return NextResponse.json({ error: "name and accessToken are required" }, { status: 400 });
  }

  const account = await prisma.tiktokAccount.create({
    data: {
      name,
      accountId: accountId || "",
      accessToken,
      connected: true,
    },
    include: { _count: { select: { slideshows: true } } },
  });

  return NextResponse.json(toAccount(account), { status: 201 });
}
