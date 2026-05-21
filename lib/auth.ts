const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

export type AuthOk = { ok: true; username: string };
export type AuthErr = { ok: false; status: number; message: string };

export function getCaller(req: Request): AuthOk | AuthErr {
  const raw = req.headers.get("x-username");
  if (!raw) return { ok: false, status: 401, message: "Missing x-username header" };
  const username = raw.trim();
  if (!isValidUsername(username)) {
    return { ok: false, status: 400, message: "Invalid username (3-20 chars, [a-zA-Z0-9_])" };
  }
  return { ok: true, username };
}
