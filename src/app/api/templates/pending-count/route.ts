import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.slideshowTemplateRun.count({
    where: { status: "AWAITING_APPROVAL" },
  });
  return NextResponse.json({ count });
}
