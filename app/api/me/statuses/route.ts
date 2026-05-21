import { NextResponse } from "next/server";
import { getCaller } from "@/lib/auth";
import { getUserStatuses, isConfigured, setUserStatuses } from "@/lib/db";
import type { EventStatus, StatusKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_KINDS: ReadonlySet<StatusKind> = new Set([
  "planned",
  "played",
  "cashed",
  "skipped",
]);

function notConfigured() {
  return NextResponse.json(
    { error: "Database not configured (REPLIT_DB_URL missing)" },
    { status: 503 }
  );
}

export async function GET(req: Request) {
  if (!isConfigured()) return notConfigured();
  const auth = getCaller(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const statuses = await getUserStatuses(auth.username);
  return NextResponse.json(statuses);
}

export async function PUT(req: Request) {
  if (!isConfigured()) return notConfigured();
  const auth = getCaller(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const event_key = typeof body?.event_key === "string" ? body.event_key.trim() : "";
  if (!event_key || event_key.length > 300) {
    return NextResponse.json({ error: "Invalid event_key" }, { status: 400 });
  }
  const status = body?.status;
  if (!STATUS_KINDS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let entries = 1;
  if (body?.entries !== undefined && body?.entries !== null) {
    const n = Number(body.entries);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      return NextResponse.json({ error: "Invalid entries (1-999)" }, { status: 400 });
    }
    entries = n;
  }

  let cash_amount: number | null = null;
  const cashRaw = body?.cash_amount;
  if (cashRaw !== undefined && cashRaw !== null && cashRaw !== "") {
    const n = Number(cashRaw);
    if (!Number.isFinite(n) || n < 0 || n > 9_999_999) {
      return NextResponse.json({ error: "Invalid cash_amount" }, { status: 400 });
    }
    cash_amount = Math.round(n * 100) / 100;
  }

  let notes: string | null = null;
  if (typeof body?.notes === "string") {
    const trimmed = body.notes.trim();
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: "Notes too long" }, { status: 400 });
    }
    notes = trimmed.length === 0 ? null : trimmed;
  }

  const row: EventStatus = {
    event_key,
    status,
    entries,
    cash_amount,
    notes,
    updated_at: new Date().toISOString(),
  };

  // Read-modify-write. Single-player tooling, so concurrent writes within a
  // user are unlikely; last writer wins.
  const current = await getUserStatuses(auth.username);
  current[event_key] = row;
  await setUserStatuses(auth.username, current);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  if (!isConfigured()) return notConfigured();
  const auth = getCaller(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const event_key = url.searchParams.get("event_key");
  if (!event_key) return NextResponse.json({ error: "Missing event_key" }, { status: 400 });

  const current = await getUserStatuses(auth.username);
  if (current[event_key]) {
    delete current[event_key];
    await setUserStatuses(auth.username, current);
  }
  return NextResponse.json({ ok: true });
}
