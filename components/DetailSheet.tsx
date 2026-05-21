"use client";

import { useEffect, useState } from "react";
import type { EventStatus, PokerEvent, StatusKind } from "@/lib/types";
import { ALL_STATUSES, STATUS_META } from "./StatusPill";

export default function DetailSheet({
  open,
  ev,
  current,
  onSave,
  onClose,
}: {
  open: boolean;
  ev: PokerEvent | null;
  current?: EventStatus;
  onSave: (patch: {
    status: StatusKind;
    entries: number;
    cash_amount: number | null;
    notes: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<StatusKind>("planned");
  const [entries, setEntries] = useState<string>("1");
  const [cash, setCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(current?.status ?? "planned");
    setEntries(String(current?.entries ?? 1));
    setCash(current?.cash_amount != null ? String(current.cash_amount) : "");
    setNotes(current?.notes ?? "");
    setErr(null);
  }, [open, current]);

  if (!open || !ev) return null;

  const submit = () => {
    const n = Number(entries);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      setErr("Entries must be a whole number between 1 and 999.");
      return;
    }
    let cashNum: number | null = null;
    if (cash.trim() !== "") {
      const c = Number(cash);
      if (!Number.isFinite(c) || c < 0) {
        setErr("Cash amount must be a non-negative number.");
        return;
      }
      cashNum = Math.round(c * 100) / 100;
    }
    const trimmedNotes = notes.trim();
    onSave({
      status,
      entries: n,
      cash_amount: cashNum,
      notes: trimmedNotes.length === 0 ? null : trimmedNotes,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-xl sm:rounded-xl border border-stone-800 bg-stone-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
            {ev.d} · {ev.v}
          </p>
          <h3
            className="text-lg mt-0.5 tracking-tight"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            {ev.e}
          </h3>
          {ev.b != null && (
            <p className="text-xs text-amber-200/80 mt-0.5 tabular-nums">
              Buy-in ${ev.b.toLocaleString()}
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {ALL_STATUSES.map((k) => {
            const m = STATUS_META[k];
            const active = status === k;
            return (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className="px-2 py-2 rounded-md text-[11px] font-semibold border transition-colors flex flex-col items-center gap-1"
                style={{
                  background: active ? m.bg : "transparent",
                  color: active ? m.color : "#a3a3a3",
                  borderColor: active ? m.color : "rgba(255,255,255,0.1)",
                }}
              >
                <span className="text-base leading-none">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Entries
            </label>
            <input
              type="number"
              min={1}
              max={999}
              value={entries}
              onChange={(e) => setEntries(e.target.value)}
              className="w-full mt-1 bg-stone-900/60 border border-stone-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50 tabular-nums"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Cash won (USD)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="optional"
              className="w-full mt-1 bg-stone-900/60 border border-stone-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50 tabular-nums"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              rows={3}
              className="w-full mt-1 bg-stone-900/60 border border-stone-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>
        </div>

        {err && <p className="text-[11px] text-rose-400 mt-3">{err}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="text-xs text-stone-400 hover:text-stone-200 px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="text-xs font-semibold bg-amber-400 text-stone-950 hover:bg-amber-300 px-4 py-2 rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
