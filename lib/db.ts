import Client from "@replit/database";
import type { StatusMap } from "./types";

const STATUSES_KEY_PREFIX = "statuses:";

let cached: Client | null = null;

function client(): Client {
  if (!cached) cached = new Client();
  return cached;
}

export function isConfigured(): boolean {
  return !!process.env.REPLIT_DB_URL;
}

export async function getUserStatuses(username: string): Promise<StatusMap> {
  const result = await client().get(STATUSES_KEY_PREFIX + username);
  if (!result.ok) throw new Error(result.error.message);
  return (result.value as StatusMap | null) ?? {};
}

export async function setUserStatuses(
  username: string,
  statuses: StatusMap
): Promise<void> {
  const result = await client().set(STATUSES_KEY_PREFIX + username, statuses);
  if (!result.ok) throw new Error(result.error.message);
}
