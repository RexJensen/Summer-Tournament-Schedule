"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, ExternalLink, X } from "lucide-react";
import rawEvents from "@/data/events.json";
import type { EventStatus, PokerEvent, StatusKind, StatusMap } from "@/lib/types";
import { eventKey } from "@/lib/eventKey";
import UsernameModal from "@/components/UsernameModal";
import StatusPill from "@/components/StatusPill";
import DetailSheet from "@/components/DetailSheet";
import StatsPanel from "@/components/StatsPanel";

const EVENTS = rawEvents as PokerEvent[];

// ============ CONFIG ============
const VENUES: Record<string, { color: string; short: string; bg: string }> = {
  "WSOP":          { color: "#dc2626", short: "WSOP",     bg: "rgba(220, 38, 38, 0.12)"  },
  "Wynn":          { color: "#f59e0b", short: "Wynn",     bg: "rgba(245, 158, 11, 0.12)" },
  "Venetian":      { color: "#e11d48", short: "Venetian", bg: "rgba(225, 29, 72, 0.12)"  },
  "Aria":          { color: "#06b6d4", short: "Aria",     bg: "rgba(6, 182, 212, 0.12)"  },
  "PokerGo":       { color: "#a855f7", short: "PokerGo",  bg: "rgba(168, 85, 247, 0.14)" },
  "MGM":           { color: "#eab308", short: "MGM",      bg: "rgba(234, 179, 8, 0.12)"  },
  "Orleans":       { color: "#fb923c", short: "Orleans",  bg: "rgba(251, 146, 60, 0.12)" },
  "South Point":   { color: "#10b981", short: "S. Point", bg: "rgba(16, 185, 129, 0.12)" },
  "Golden Nugget": { color: "#facc15", short: "G.Nugget", bg: "rgba(250, 204, 21, 0.12)" },
};

const BUYIN_RANGES = [
  { label: "All",        min: 0,     max: Infinity },
  { label: "Under $500", min: 0,     max: 499      },
  { label: "$500-$1K",   min: 500,   max: 999      },
  { label: "$1K-$3K",    min: 1000,  max: 2999     },
  { label: "$3K-$10K",   min: 3000,  max: 9999     },
  { label: "$10K+",      min: 10000, max: Infinity },
];

const GAME_CATEGORIES: { label: string; test: (g?: string) => boolean }[] = [
  { label: "All",    test: () => true },
  { label: "NLH",    test: (g) => !!g && g.toUpperCase().startsWith("NLH") && !g.toUpperCase().includes("BOUNTY") },
  { label: "Bounty", test: (g) => !!g && g.toUpperCase().includes("BOUNTY") },
  { label: "PLO",    test: (g) => !!g && g.toUpperCase().includes("PLO") },
  { label: "Mixed",  test: (g) => !!g && /MIX|HORSE|TORSE|TOE|STUD|RAZZ|DRAW|BADUGI|O\/8|8-GAME|9-GAME|11-GAME|DEALERS/i.test(g) },
  { label: "Sat",    test: (g) => !!g && g.toUpperCase().includes("SAT") },
];

const MINE_FILTERS = ["off", "my", "played", "cashed"] as const;
type MineFilter = (typeof MINE_FILTERS)[number];

// ============ UTILITIES ============
const fmtMoney = (n: number | string | undefined | null): string | null => {
  if (n == null) return null;
  if (typeof n !== "number") return String(n);
  if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return "$" + n.toLocaleString();
};

const fmtMoneyFull = (n: number | string | undefined | null): string | null => {
  if (n == null) return null;
  if (typeof n !== "number") return String(n);
  return "$" + n.toLocaleString();
};

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    short: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    long: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    dayNum: d.getDate(),
    monthShort: d.toLocaleDateString("en-US", { month: "short" }),
  };
};

const STATUSES_STORAGE_PREFIX = "tournament_statuses:";

const loadLocalStatuses = (username: string): StatusMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATUSES_STORAGE_PREFIX + username);
    return raw ? (JSON.parse(raw) as StatusMap) : {};
  } catch {
    return {};
  }
};

const saveLocalStatuses = (username: string, statuses: StatusMap): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STATUSES_STORAGE_PREFIX + username,
      JSON.stringify(statuses)
    );
  } catch {
    /* quota exceeded or private mode — best effort */
  }
};

const vegasISO = (): string => {
  // Las Vegas is America/Los_Angeles (PST/PDT); honor that regardless of viewer's TZ.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  return `${m.year}-${m.month}-${m.day}`;
};

// Pre-computed lowercase searchable text per event: matches venue, event,
// game, buy-in (raw + $-prefixed), guarantee, ISO date, "June 5" / "Jun 5"
// / "6/5" / weekday.
const SEARCH_INDEX = EVENTS.map((ev) => {
  const parts: string[] = [];
  if (ev.v) parts.push(ev.v);
  if (ev.e) parts.push(ev.e);
  if (ev.g) parts.push(ev.g);
  if (typeof ev.b === "number") {
    parts.push(String(ev.b), "$" + ev.b);
    if (ev.b >= 1000 && ev.b % 1000 === 0) parts.push("$" + ev.b / 1000 + "k");
  }
  if (typeof ev.gu === "number") parts.push(String(ev.gu));
  if (ev.d) {
    const d = new Date(ev.d + "T12:00:00");
    parts.push(ev.d);
    parts.push(d.toLocaleDateString("en-US", { month: "long", day: "numeric" }));
    parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    parts.push(d.toLocaleDateString("en-US", { weekday: "long" }));
    parts.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return parts.join(" ").toLowerCase();
});

// Multi-flight tournaments (X 1A, X 1B, ...) repeat the same guarantee on
// each flight row. We dedupe them for the GTD pool total.
const FLIGHT_RE = /\s+(?:[1-5][A-Z]|Day\s*\d+|Final Table)\s*$/i;

// ============ COMPONENTS ============
function Chip({
  active,
  onClick,
  color,
  children,
  count,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
  count?: number;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative shrink-0 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? (color || "#d4af37") : "transparent",
        color: active ? "#0a0a0a" : (color || "#d4d4d4"),
        borderColor: active ? (color || "#d4af37") : "rgba(255,255,255,0.12)",
      }}
    >
      {children}
      {count != null && (
        <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>
      )}
    </button>
  );
}

function EventCard({
  ev,
  status,
  hasUser,
  onSet,
  onClear,
  onEditDetails,
  onRequireUser,
}: {
  ev: PokerEvent;
  status?: EventStatus;
  hasUser: boolean;
  onSet: (s: StatusKind) => void;
  onClear: () => void;
  onEditDetails: () => void;
  onRequireUser: () => void;
}) {
  const venue = VENUES[ev.v] || { color: "#888", short: ev.v, bg: "rgba(136,136,136,0.1)" };
  const hasLink = Boolean(ev.h);

  const body = (
    <div className="flex-1 min-w-0 px-3 py-2.5">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-[11px] font-semibold tabular-nums text-stone-400 shrink-0 w-[3rem]">
          {ev.s || "—"}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          style={{ color: venue.color, background: venue.bg }}
        >
          {venue.short}
        </span>
        <span className="text-sm text-stone-100 flex-1 min-w-0 truncate font-medium">
          {ev.e}
          {hasLink && (
            <ExternalLink
              className="inline-block ml-1.5 -translate-y-0.5 opacity-40 group-hover:opacity-90 transition-opacity"
              size={11}
            />
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 tabular-nums pl-[3.5rem]">
        {ev.b != null && (
          <span className="text-amber-200/90 font-semibold">
            {fmtMoneyFull(ev.b)}
          </span>
        )}
        {ev.gu != null && typeof ev.gu === "number" && (
          <span>
            <span className="text-stone-600">GTD</span> {fmtMoney(ev.gu)}
          </span>
        )}
        {ev.gu != null && typeof ev.gu !== "number" && (
          <span className="text-stone-400">{ev.gu}</span>
        )}
        {ev.l && (
          <span>
            <span className="text-stone-600">LR</span> {ev.l}
          </span>
        )}
        {ev.r && (
          <span>
            <span className="text-stone-600">RE</span> {ev.r}
          </span>
        )}
        {ev.g && (
          <span className="text-stone-500/80">{ev.g}</span>
        )}
        {status?.notes && (
          <span className="text-amber-200/60 italic truncate max-w-full">
            “{status.notes}”
          </span>
        )}
      </div>
    </div>
  );

  const linkWrapper = hasLink ? (
    <a
      href={ev.h}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-stretch flex-1 min-w-0 hover:brightness-125 transition-all"
    >
      {body}
    </a>
  ) : (
    <div className="flex items-stretch flex-1 min-w-0 opacity-90">{body}</div>
  );

  return (
    <div
      className="group relative flex items-stretch rounded-lg overflow-hidden transition-all duration-150 border"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderColor: status
          ? "rgba(212, 175, 55, 0.18)"
          : "rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="w-1 shrink-0 transition-all group-hover:w-1.5"
        style={{ background: venue.color }}
      />
      {linkWrapper}
      <StatusPill
        status={status}
        onSet={onSet}
        onClear={onClear}
        onEditDetails={onEditDetails}
        hasUser={hasUser}
        onRequireUser={onRequireUser}
      />
    </div>
  );
}

function DayBlock({
  date,
  events,
  stickyTop,
  statuses,
  hasUser,
  onSet,
  onClear,
  onEditDetails,
  onRequireUser,
}: {
  date: string;
  events: PokerEvent[];
  stickyTop: number;
  statuses: StatusMap;
  hasUser: boolean;
  onSet: (ev: PokerEvent, s: StatusKind) => void;
  onClear: (ev: PokerEvent) => void;
  onEditDetails: (ev: PokerEvent) => void;
  onRequireUser: () => void;
}) {
  const d = fmtDate(date);
  const today = vegasISO();
  const isToday = date === today;
  const isPast = date < today;

  return (
    <section className="mb-6">
      <div
        className="sticky z-10 flex items-baseline gap-3 py-2.5 mb-2 px-1"
        style={{
          top: stickyTop + "px",
          background: "linear-gradient(to bottom, #050605 80%, rgba(5,6,5,0))",
        }}
      >
        <div className="flex items-baseline gap-2">
          <span
            className="text-2xl font-light tabular-nums tracking-tight"
            style={{
              color: isToday ? "#d4af37" : isPast ? "#525252" : "#e7e5e4",
              fontFamily: "'Instrument Serif', Georgia, serif",
            }}
          >
            {d.dayNum}
          </span>
          <span
            className="text-xs uppercase tracking-[0.2em] font-medium"
            style={{ color: isToday ? "#d4af37" : "#737373" }}
          >
            {d.monthShort} · {d.weekday}
          </span>
          {isToday && (
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 ml-1">
              Today
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-stone-900" />
        <span className="text-[11px] text-stone-600 tabular-nums">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {events.map((ev, i) => {
          const k = eventKey(ev);
          return (
            <EventCard
              key={i}
              ev={ev}
              status={statuses[k]}
              hasUser={hasUser}
              onSet={(s) => onSet(ev, s)}
              onClear={() => onClear(ev)}
              onEditDetails={() => onEditDetails(ev)}
              onRequireUser={onRequireUser}
            />
          );
        })}
      </div>
    </section>
  );
}

// ============ MAIN ============
export default function PokerSchedule() {
  const [search, setSearch] = useState("");
  const [selectedVenues, setSelectedVenues] = useState(new Set(Object.keys(VENUES)));
  const [buyinRange, setBuyinRange] = useState(0);
  const [gameCategory, setGameCategory] = useState(0);
  const [showLinkedOnly, setShowLinkedOnly] = useState(false);
  const [mineFilter, setMineFilter] = useState<MineFilter>("off");
  const [filterBarH, setFilterBarH] = useState(140);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // ---- Username + statuses ----
  const [username, setUsername] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [editingEvent, setEditingEvent] = useState<PokerEvent | null>(null);

  // Load username from localStorage on mount, prompt if missing.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("username") : null;
    if (stored) {
      setUsername(stored);
    } else {
      setUserModalOpen(true);
    }
  }, []);

  // Load statuses when username available. localStorage is the source of
  // truth so the app works on any host without a database; the API is a
  // best-effort sync layer that, when reachable, merges remote data in.
  useEffect(() => {
    if (!username) {
      setStatuses({});
      return;
    }
    setStatuses(loadLocalStatuses(username));

    let cancelled = false;
    fetch("/api/me/statuses", { headers: { "x-username": username } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: StatusMap) => {
        if (cancelled || !data || Object.keys(data).length === 0) return;
        setStatuses((prev) => {
          const merged = { ...prev, ...data };
          saveLocalStatuses(username, merged);
          return merged;
        });
      })
      .catch(() => {
        /* no DB / offline — localStorage already loaded */
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const handleUsernameSubmit = (name: string) => {
    localStorage.setItem("username", name);
    setUsername(name);
    setUserModalOpen(false);
  };

  const handleSwitchUser = () => {
    localStorage.removeItem("username");
    setUsername(null);
    setStatuses({});
    setUserModalOpen(true);
  };

  // ---- Optimistic status updates ----
  const applyStatus = useCallback(
    (
      ev: PokerEvent,
      patch: {
        status: StatusKind;
        entries?: number;
        cash_amount?: number | null;
        notes?: string | null;
      }
    ) => {
      if (!username) {
        setUserModalOpen(true);
        return;
      }
      const k = eventKey(ev);
      const prior = statuses[k];
      const optimistic: EventStatus = {
        event_key: k,
        status: patch.status,
        entries: patch.entries ?? prior?.entries ?? 1,
        cash_amount:
          patch.cash_amount !== undefined
            ? patch.cash_amount
            : prior?.cash_amount ?? null,
        notes: patch.notes !== undefined ? patch.notes : prior?.notes ?? null,
      };
      setStatuses((prev) => {
        const next = { ...prev, [k]: optimistic };
        saveLocalStatuses(username, next);
        return next;
      });

      fetch("/api/me/statuses", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-username": username,
        },
        body: JSON.stringify({
          event_key: k,
          status: optimistic.status,
          entries: optimistic.entries,
          cash_amount: optimistic.cash_amount,
          notes: optimistic.notes,
        }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((row: EventStatus) => {
          setStatuses((prev) => {
            const next = { ...prev, [k]: row };
            saveLocalStatuses(username, next);
            return next;
          });
        })
        .catch(() => {
          /* no DB — localStorage already has the optimistic value */
        });
    },
    [statuses, username]
  );

  const clearStatus = useCallback(
    (ev: PokerEvent) => {
      if (!username) {
        setUserModalOpen(true);
        return;
      }
      const k = eventKey(ev);
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[k];
        saveLocalStatuses(username, next);
        return next;
      });
      fetch(`/api/me/statuses?event_key=${encodeURIComponent(k)}`, {
        method: "DELETE",
        headers: { "x-username": username },
      }).catch(() => {
        /* no DB — localStorage already cleared */
      });
    },
    [username]
  );

  // Measure filter bar height for sticky date header offset
  useEffect(() => {
    if (!filterBarRef.current) return;
    const el = filterBarRef.current;
    const update = () => setFilterBarH(el.offsetHeight || 140);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter events
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const range = BUYIN_RANGES[buyinRange];
    const cat = GAME_CATEGORIES[gameCategory];

    const out: PokerEvent[] = [];
    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i];
      if (!selectedVenues.has(ev.v)) continue;
      if (showLinkedOnly && !ev.h) continue;
      if (q && !SEARCH_INDEX[i].includes(q)) continue;
      if (typeof ev.b === "number") {
        if (ev.b < range.min || ev.b > range.max) continue;
      } else if (range.min > 0) {
        continue;
      }
      if (!cat.test(ev.g)) continue;
      if (mineFilter !== "off") {
        const s = statuses[eventKey(ev)];
        if (!s) continue;
        if (mineFilter === "played" && !(s.status === "played" || s.status === "cashed")) continue;
        if (mineFilter === "cashed" && s.status !== "cashed") continue;
      }
      out.push(ev);
    }
    return out;
  }, [search, selectedVenues, buyinRange, gameCategory, showLinkedOnly, mineFilter, statuses]);

  // Group by date
  const grouped = useMemo(() => {
    const byDate = new Map<string, PokerEvent[]>();
    for (const ev of filtered) {
      if (!ev.d) continue;
      if (!byDate.has(ev.d)) byDate.set(ev.d, []);
      byDate.get(ev.d)!.push(ev);
    }
    for (const evs of byDate.values()) {
      evs.sort((a, b) => (a.s || "").localeCompare(b.s || ""));
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Venue event counts (total, independent of venue filter)
  const venueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of Object.keys(VENUES)) counts[v] = 0;
    for (const ev of EVENTS) {
      if (ev.v in counts) counts[ev.v]++;
    }
    return counts;
  }, []);

  const toggleVenue = (v: string) => {
    const next = new Set(selectedVenues);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSelectedVenues(next);
  };

  const allVenuesSelected = selectedVenues.size === Object.keys(VENUES).length;

  // Scroll to today on mount
  useEffect(() => {
    const t = setTimeout(() => {
      const todayEl = document.getElementById("today-anchor");
      if (todayEl) todayEl.scrollIntoView({ block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Deduped guarantee pool. Multi-flight tournaments list the same guarantee
  // on every flight; count one per tournament *instance*. Each "1A" within a
  // (venue, base name, guarantee) group marks the start of a new instance, so
  // a weekly recurring 1A–1F tournament gets counted once per week.
  const totalGuarantee = useMemo(() => {
    const ONE_A_RE = /^1A$/i;
    const groups = new Map<string, { gu: number; flights: string[] }>();
    let total = 0;
    for (const ev of filtered) {
      if (typeof ev.gu !== "number") continue;
      const name = ev.e || "";
      const m = name.match(/\s+([1-5][A-Z]|Day\s*\d+|Final Table)\s*$/i);
      if (!m) {
        total += ev.gu;
        continue;
      }
      const flight = m[1].trim();
      const base = name.replace(FLIGHT_RE, "").trim();
      const key = `${ev.v}|${base}|${ev.gu}`;
      let g = groups.get(key);
      if (!g) {
        g = { gu: ev.gu, flights: [] };
        groups.set(key, g);
      }
      g.flights.push(flight);
    }
    for (const { gu, flights } of groups.values()) {
      const oneAs = flights.filter((f) => ONE_A_RE.test(f)).length;
      total += gu * Math.max(1, oneAs);
    }
    return total;
  }, [filtered]);

  const hasUser = !!username;
  const requireUser = () => setUserModalOpen(true);

  return (
    <div
      className="min-h-screen w-full text-stone-200"
      style={{
        background: "radial-gradient(ellipse at top, #0f1410 0%, #050605 60%)",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.3); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { scrollbar-width: none; }
      `}</style>

      {/* HEADER */}
      <header className="px-4 pt-6 pb-4 max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="text-3xl sm:text-4xl tracking-tight leading-none"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Vegas Summer 2026
              <span className="text-amber-400 italic"> ·</span>
            </h1>
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mt-2">
              Tournament Schedule · May 18 – Aug 2
            </p>
          </div>
          <div className="text-right text-xs tabular-nums">
            <div className="text-stone-400">
              <span className="text-amber-300 font-semibold">
                {filtered.length.toLocaleString()}
              </span>
              <span className="text-stone-600"> / {EVENTS.length.toLocaleString()} events</span>
            </div>
            {totalGuarantee > 0 && (
              <div className="text-stone-500 mt-0.5">
                <span className="text-stone-600">GTD pool </span>
                <span className="text-stone-300">${(totalGuarantee / 1e6).toFixed(1)}M</span>
              </div>
            )}
            <div className="mt-1.5 text-[11px] flex items-center justify-end gap-1.5">
              {username ? (
                <>
                  <span className="text-stone-500">@</span>
                  <span className="text-stone-300">{username}</span>
                  <button
                    onClick={handleSwitchUser}
                    className="ml-1 text-stone-500 hover:text-amber-300 underline underline-offset-2"
                  >
                    switch
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setUserModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      <div
        ref={filterBarRef}
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: "rgba(5, 6, 5, 0.85)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-2.5">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venue, event, date, buy-in (try 'wynn', 'june 5', '600', '2-7')"
              className="w-full bg-stone-900/60 border border-stone-800 rounded-md pl-9 pr-9 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-400/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Venue chips */}
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
            <Chip
              active={allVenuesSelected}
              onClick={() => {
                if (allVenuesSelected) setSelectedVenues(new Set());
                else setSelectedVenues(new Set(Object.keys(VENUES)));
              }}
              color="#d4af37"
            >
              All venues
            </Chip>
            {Object.entries(VENUES).map(([name, { color, short }]) => (
              <Chip
                key={name}
                active={selectedVenues.has(name)}
                onClick={() => toggleVenue(name)}
                color={color}
                count={venueCounts[name]}
              >
                {short}
              </Chip>
            ))}
          </div>

          {/* Buyin + game category */}
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {BUYIN_RANGES.map((r, i) => (
              <Chip
                key={r.label}
                active={buyinRange === i}
                onClick={() => setBuyinRange(i)}
                color="#fbbf24"
              >
                {r.label}
              </Chip>
            ))}
            <div className="w-px shrink-0 bg-stone-800 mx-1 self-stretch" />
            {GAME_CATEGORIES.map((c, i) => (
              <Chip
                key={c.label}
                active={gameCategory === i}
                onClick={() => setGameCategory(i)}
                color="#a3a3a3"
              >
                {c.label}
              </Chip>
            ))}
            <div className="w-px shrink-0 bg-stone-800 mx-1 self-stretch" />
            <Chip
              active={showLinkedOnly}
              onClick={() => setShowLinkedOnly(!showLinkedOnly)}
              color="#10b981"
            >
              Has structure
            </Chip>
            <div className="w-px shrink-0 bg-stone-800 mx-1 self-stretch" />
            <Chip
              active={mineFilter === "my"}
              onClick={() => setMineFilter(mineFilter === "my" ? "off" : "my")}
              color="#d4af37"
              disabled={!hasUser}
            >
              My events
            </Chip>
            <Chip
              active={mineFilter === "played"}
              onClick={() => setMineFilter(mineFilter === "played" ? "off" : "played")}
              color="#a3a3a3"
              disabled={!hasUser}
            >
              Played
            </Chip>
            <Chip
              active={mineFilter === "cashed"}
              onClick={() => setMineFilter(mineFilter === "cashed" ? "off" : "cashed")}
              color="#34d399"
              disabled={!hasUser}
            >
              Cashes
            </Chip>
          </div>
        </div>
      </div>

      {/* EVENTS */}
      <main className="max-w-5xl mx-auto px-4 pt-4 pb-20">
        <StatsPanel events={EVENTS} statuses={statuses} username={username} />

        {grouped.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <div className="text-4xl mb-3 opacity-50">∅</div>
            <p className="text-sm">No events match these filters.</p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedVenues(new Set(Object.keys(VENUES)));
                setBuyinRange(0);
                setGameCategory(0);
                setShowLinkedOnly(false);
                setMineFilter("off");
              }}
              className="mt-4 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-4"
            >
              Reset filters
            </button>
          </div>
        ) : (
          grouped.map(([date, events]) => {
            const isToday = date === vegasISO();
            return (
              <div key={date} id={isToday ? "today-anchor" : undefined}>
                <DayBlock
                  date={date}
                  events={events}
                  stickyTop={filterBarH}
                  statuses={statuses}
                  hasUser={hasUser}
                  onSet={(ev, s) => applyStatus(ev, { status: s })}
                  onClear={clearStatus}
                  onEditDetails={(ev) => setEditingEvent(ev)}
                  onRequireUser={requireUser}
                />
              </div>
            );
          })
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-5xl mx-auto px-4 pb-8 pt-2 border-t border-stone-900/80 mt-8">
        <p className="text-[10px] text-stone-600 leading-relaxed">
          Data compiled by{" "}
          <a
            href="https://x.com/SpaceyFCB/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-amber-400 underline underline-offset-2"
          >
            @SpaceyFCB
          </a>
          . Event links open official structure sheets. Schedules subject to last-minute changes by operators.
          Click venue tabs to filter, search by event name, or pick a buy-in range.{" "}
          {EVENTS.filter((e) => e.h).length.toLocaleString()} structures linked.
        </p>
      </footer>

      <UsernameModal
        open={userModalOpen}
        initial={username ?? ""}
        canClose={!!username}
        onClose={() => setUserModalOpen(false)}
        onSubmit={handleUsernameSubmit}
      />

      <DetailSheet
        open={editingEvent != null}
        ev={editingEvent}
        current={editingEvent ? statuses[eventKey(editingEvent)] : undefined}
        onClose={() => setEditingEvent(null)}
        onSave={(patch) => {
          if (editingEvent) {
            applyStatus(editingEvent, patch);
          }
          setEditingEvent(null);
        }}
      />
    </div>
  );
}
