"use client";

import { useEffect, useRef, useState } from "react";
import type { EventStatus, StatusKind } from "@/lib/types";

const STATUS_META: Record<
  StatusKind,
  { label: string; icon: string; color: string; bg: string }
> = {
  planned: { label: "Planned", icon: "📌", color: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  played:  { label: "Played",  icon: "▶️", color: "#a3a3a3", bg: "rgba(163,163,163,0.14)" },
  cashed:  { label: "Cashed",  icon: "💰", color: "#34d399", bg: "rgba(52,211,153,0.18)" },
  skipped: { label: "Skipped", icon: "⏭️", color: "#737373", bg: "rgba(115,115,115,0.12)" },
};

export const ALL_STATUSES: StatusKind[] = ["planned", "played", "cashed", "skipped"];
export { STATUS_META };

export default function StatusPill({
  status,
  onSet,
  onClear,
  onEditDetails,
  hasUser,
  onRequireUser,
}: {
  status?: EventStatus;
  onSet: (s: StatusKind) => void;
  onClear: () => void;
  onEditDetails: () => void;
  hasUser: boolean;
  onRequireUser: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const meta = status ? STATUS_META[status.status] : null;

  return (
    <div ref={rootRef} className="relative shrink-0 flex items-stretch">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!hasUser) {
            onRequireUser();
            return;
          }
          setOpen((v) => !v);
        }}
        className="self-stretch px-2.5 flex items-center justify-center text-[11px] font-semibold tracking-wide border-l border-stone-800/80 hover:bg-white/5 transition-colors"
        style={
          meta
            ? { color: meta.color, background: meta.bg, minWidth: "5.5rem" }
            : { color: "#737373", minWidth: "2.5rem" }
        }
        aria-label={meta ? `Status: ${meta.label}` : "Set status"}
      >
        {meta ? (
          <span className="flex items-center gap-1">
            <span>{meta.icon}</span>
            <span className="hidden sm:inline">{meta.label}</span>
            {status?.cash_amount != null && status.status === "cashed" && (
              <span className="tabular-nums opacity-80 text-[10px]">
                ${status.cash_amount.toLocaleString()}
              </span>
            )}
          </span>
        ) : (
          <span className="text-base leading-none">+</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-52 rounded-md border border-stone-800 bg-stone-950 shadow-xl p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {ALL_STATUSES.map((k) => {
            const m = STATUS_META[k];
            const active = status?.status === k;
            return (
              <button
                key={k}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (active) onClear();
                  else onSet(k);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs hover:bg-white/5 transition-colors"
                style={{ color: active ? m.color : "#d4d4d4" }}
              >
                <span>{m.icon}</span>
                <span className="flex-1 text-left">{m.label}</span>
                {active && <span className="text-[10px] opacity-70">tap to unmark</span>}
              </button>
            );
          })}
          <div className="my-1 border-t border-stone-800/70" />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditDetails();
              setOpen(false);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded text-xs text-amber-300 hover:bg-white/5"
          >
            Edit details…
          </button>
        </div>
      )}
    </div>
  );
}
