import { sql } from "@vercel/postgres";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

export async function resolveUserId(username: string): Promise<string> {
  // Upsert: insert if missing, return id either way.
  const result = await sql<{ id: string }>`
    insert into users (username)
    values (${username})
    on conflict (username) do update set username = excluded.username
    returning id
  `;
  return result.rows[0].id;
}

export type AuthOk = { ok: true; username: string; userId: string };
export type AuthErr = { ok: false; status: number; message: string };

export async function getCaller(req: Request): Promise<AuthOk | AuthErr> {
  const raw = req.headers.get("x-username");
  if (!raw) return { ok: false, status: 401, message: "Missing x-username header" };
  const username = raw.trim();
  if (!isValidUsername(username)) {
    return { ok: false, status: 400, message: "Invalid username (3-20 chars, [a-zA-Z0-9_])" };
  }
  const userId = await resolveUserId(username);
  return { ok: true, username, userId };
}
