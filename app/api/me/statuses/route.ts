import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCaller } from "@/lib/auth";
import type { EventStatus, StatusKind, StatusMap } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_KINDS: ReadonlySet<StatusKind> = new Set([
  "planned",
  "played",
  "cashed",
  "skipped",
]);

type Row = {
  event_key: string;
  status: StatusKind;
  entries: number;
  cash_amount: string | null;
  notes: string | null;
  updated_at: string;
};

function rowToStatus(row: Row): EventStatus {
  return {
    event_key: row.event_key,
    status: row.status,
    entries: row.entries,
    cash_amount: row.cash_amount == null ? null : Number(row.cash_amount),
    notes: row.notes,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  const auth = await getCaller(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { rows } = await sql<Row>`
    select event_key, status, entries, cash_amount, notes, updated_at
    from event_status
    where user_id = ${auth.userId}
  `;
  const map: StatusMap = {};
  for (const row of rows) map[row.event_key] = rowToStatus(row);
  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const auth = await getCaller(req);
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

  const entriesRaw = body?.entries;
  let entries = 1;
  if (entriesRaw !== undefined && entriesRaw !== null) {
    const n = Number(entriesRaw);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      return NextResponse.json({ error: "Invalid entries (1-999)" }, { status: 400 });
    }
    entries = n;
  }

  const cashRaw = body?.cash_amount;
  let cash_amount: number | null = null;
  if (cashRaw !== undefined && cashRaw !== null && cashRaw !== "") {
    const n = Number(cashRaw);
    if (!Number.isFinite(n) || n < 0 || n > 9_999_999) {
      return NextResponse.json({ error: "Invalid cash_amount" }, { status: 400 });
    }
    cash_amount = Math.round(n * 100) / 100;
  }

  const notesRaw = body?.notes;
  let notes: string | null = null;
  if (typeof notesRaw === "string") {
    const trimmed = notesRaw.trim();
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: "Notes too long" }, { status: 400 });
    }
    notes = trimmed.length === 0 ? null : trimmed;
  }

  const { rows } = await sql<Row>`
    insert into event_status (user_id, event_key, status, entries, cash_amount, notes, updated_at)
    values (${auth.userId}, ${event_key}, ${status}, ${entries}, ${cash_amount}, ${notes}, now())
    on conflict (user_id, event_key) do update set
      status = excluded.status,
      entries = excluded.entries,
      cash_amount = excluded.cash_amount,
      notes = excluded.notes,
      updated_at = now()
    returning event_key, status, entries, cash_amount, notes, updated_at
  `;
  return NextResponse.json(rowToStatus(rows[0]));
}

export async function DELETE(req: Request) {
  const auth = await getCaller(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const event_key = url.searchParams.get("event_key");
  if (!event_key) return NextResponse.json({ error: "Missing event_key" }, { status: 400 });

  await sql`
    delete from event_status
    where user_id = ${auth.userId} and event_key = ${event_key}
  `;
  return NextResponse.json({ ok: true });
}
