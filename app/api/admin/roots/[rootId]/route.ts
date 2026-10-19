import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ rootId: string }> }) {
  try {
    await requireAdmin();
    const input = z.object({ enabled: z.boolean().optional(), priority: z.number().int().min(0).max(10000).optional(), displayName: z.string().trim().min(1).max(100).optional() }).parse(await request.json());
    const current = await db.storageRoot.findUnique({ where: { id: (await params).rootId } });
    if (!current) return NextResponse.json({ error: "Storage root not found" }, { status: 404 });
    if (input.enabled && !current.writable) return NextResponse.json({ error: "Test write access before enabling this root" }, { status: 409 });
    return NextResponse.json(await db.storageRoot.update({ where: { id: current.id }, data: input }));
  } catch (error) { return apiError(error); }
}
