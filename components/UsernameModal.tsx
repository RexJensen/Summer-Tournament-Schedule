"use client";

import { useEffect, useState } from "react";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function UsernameModal({
  open,
  onSubmit,
  initial,
  onClose,
  canClose,
}: {
  open: boolean;
  onSubmit: (username: string) => void;
  initial?: string;
  onClose?: () => void;
  canClose?: boolean;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initial ?? "");
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = () => {
    const v = value.trim();
    if (!USERNAME_RE.test(v)) {
      setErr("3–20 characters: letters, numbers, underscore.");
      return;
    }
    onSubmit(v);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={() => canClose && onClose?.()}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-stone-800 bg-stone-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-xl mb-1 tracking-tight"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
        >
          Pick a username
        </h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-4">
          Your tracking handle
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. spaceyfcb"
          className="w-full bg-stone-900/60 border border-stone-800 rounded-md px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-400/50"
        />
        <p className="text-[11px] text-stone-500 mt-2">
          3–20 characters: letters, numbers, underscore. No password — anyone with your username can read and write your tracking data.
        </p>
        {err && <p className="text-[11px] text-rose-400 mt-2">{err}</p>}
        <div className="flex items-center justify-end gap-2 mt-4">
          {canClose && (
            <button
              onClick={() => onClose?.()}
              className="text-xs text-stone-400 hover:text-stone-200 px-3 py-2"
            >
              Cancel
            </button>
          )}
          <button
            onClick={submit}
            className="text-xs font-semibold bg-amber-400 text-stone-950 hover:bg-amber-300 px-4 py-2 rounded-md"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
