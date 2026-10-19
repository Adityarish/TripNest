import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { ensureProvisioned } from "@/lib/services/provisioning";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export async function POST() {
  try {
    const user = await ensureProvisioned(await requireActor());
    return NextResponse.json({ state: user.provisioningState });
  } catch (error) { return apiError(error); }
}
