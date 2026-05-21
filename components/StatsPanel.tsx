"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PokerEvent, StatusMap } from "@/lib/types";
import { eventKey } from "@/lib/eventKey";

function fmtUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function StatsPanel({
  events,
  statuses,
  username,
}: {
  events: PokerEvent[];
  statuses: StatusMap;
  username: string | null;
}) {
  const [open, setOpen] = useState(false);

  const byKey = new Map<string, PokerEvent>();
  for (const ev of events) byKey.set(eventKey(ev), ev);

  let planned = 0,
    played = 0,
    cashed = 0,
    skipped = 0;
  let buyIns = 0;
  let cashTotal = 0;

  for (const k of Object.keys(statuses)) {
    const s = statuses[k];
    if (s.status === "planned") planned++;
    else if (s.status === "played") played++;
    else if (s.status === "cashed") cashed++;
    else if (s.status === "skipped") skipped++;

    if (s.status === "played" || s.status === "cashed") {
      const ev = byKey.get(k);
      if (ev && typeof ev.b === "number") {
        buyIns += s.entries * ev.b;
      }
    }
    if (s.cash_amount != null) cashTotal += s.cash_amount;
  }

  const playedAll = played + cashed;
  const itm = playedAll > 0 ? (cashed / playedAll) * 100 : 0;
  const net = cashTotal - buyIns;

  return (
    <div
      className="rounded-md border mb-3"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            My stats
          </span>
          {username ? (
            <>
              <span className="text-stone-500">·</span>
              <span className="text-stone-300 tabular-nums">
                <span className="text-blue-400">{planned}</span> planned
              </span>
              <span className="text-stone-300 tabular-nums">
                <span className="text-stone-200">{playedAll}</span> played
              </span>
              <span className="text-stone-300 tabular-nums">
                <span className="text-emerald-400">{cashed}</span> cashed
              </span>
              <span className="hidden sm:inline text-stone-300 tabular-nums">
                net{" "}
                <span style={{ color: net >= 0 ? "#34d399" : "#f87171" }}>
                  {fmtUsd(net)}
                </span>
              </span>
            </>
          ) : (
            <span className="text-stone-500">sign in to track</span>
          )}
        </div>
        <ChevronDown
          size={14}
          className="text-stone-500 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && username && (
        <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Cell label="Planned" value={planned.toString()} color="#60a5fa" />
          <Cell label="Played" value={playedAll.toString()} sub={`${played} + ${cashed} ITM`} />
          <Cell label="Cashed" value={cashed.toString()} color="#34d399" sub={`${itm.toFixed(0)}% ITM`} />
          <Cell label="Skipped" value={skipped.toString()} />
          <Cell label="Buy-ins paid" value={fmtUsd(buyIns)} mono />
          <Cell label="Cashed" value={fmtUsd(cashTotal)} mono color="#34d399" />
          <Cell label="Net P&L" value={fmtUsd(net)} mono color={net >= 0 ? "#34d399" : "#f87171"} />
          <Cell label="ITM%" value={`${itm.toFixed(1)}%`} mono />
        </div>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  color,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
        {label}
      </div>
      <div
        className={`mt-0.5 text-base ${mono ? "tabular-nums" : ""}`}
        style={{ color: color ?? "#e7e5e4" }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}
