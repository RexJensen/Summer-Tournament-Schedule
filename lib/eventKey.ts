import type { PokerEvent } from "./types";

export function eventKey(ev: Pick<PokerEvent, "d" | "v" | "e">): string {
  return `${ev.d}|${ev.v}|${ev.e}`;
}
