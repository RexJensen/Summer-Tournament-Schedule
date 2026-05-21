export type StatusKind = "planned" | "played" | "cashed" | "skipped";

export type EventStatus = {
  event_key: string;
  status: StatusKind;
  entries: number;
  cash_amount: number | null;
  notes: string | null;
  updated_at?: string;
};

export type StatusMap = Record<string, EventStatus>;

export type PokerEvent = {
  d: string;
  v: string;
  s?: string;
  l?: string;
  g?: string;
  e: string;
  b?: number;
  r?: string;
  gu?: number | string;
  h?: string;
};
