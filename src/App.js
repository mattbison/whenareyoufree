import React, { useState, useEffect, useMemo, useRef } from "react";
import "./styles.css";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  deleteDoc,
} from "firebase/firestore";
import {
  Ban,
  CalendarCheck2,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eraser,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Repeat,
  Share,
  StickyNote,
  Sun,
  X,
} from "lucide-react";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyADkhtS4NSsWXd2tmjHtY5ogTsRcyzpDr0",
  authDomain: "whenareyoufree.netlify.app",
  projectId: "whenareyoufree-a51fa",
  storageBucket: "whenareyoufree-a51fa.firebasestorage.app",
  messagingSenderId: "810606897689",
  appId: "1:810606897689:web:0b96563fb9b40f6b5c9888",
  measurementId: "G-5GDTHC0GNV",
};

// --- Shared class recipes (colors come from tokens in styles.css) ---
const CARD = "bg-surface border border-hairline rounded-card shadow-card";
const ICON_BTN =
  "inline-flex items-center justify-center h-10 w-10 rounded-full text-ink hover:bg-overlay active:bg-overlay-strong active:scale-95 transition";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-accent text-white text-[15px] font-semibold hover:brightness-110 active:scale-[0.97] active:brightness-95 transition disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-overlay text-ink text-sm font-semibold hover:bg-overlay-strong active:scale-[0.97] transition";

// Weekly grid shows 8 AM onward unless early hours are expanded.
const FIRST_WAKING_HOUR = 8;

// Cell tint per availability state. Shared by the grid and its legend so the
// two can never drift apart.
const SLOT_TINT = {
  empty: "",
  you: "bg-accent/15 dark:bg-accent/25",
  some: "bg-some/20",
  everyone: "bg-free/25 dark:bg-free/30",
  busy: "bg-busy/10 dark:bg-busy/20",
};

// --- Date & time helpers ---

// "YYYY-MM-DD" for the *local* calendar day. Slot and note IDs are keyed on
// this. Never use toISOString() for this: it converts to UTC, which shifts the
// date by a day in the evening (west of UTC) or all morning (east of UTC).
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const fromDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};

const slotIdFor = (day, hour) =>
  `${toDateKey(day)}T${String(hour).padStart(2, "0")}:00`;

// Locale-aware hour label: "8 AM" in en-US, "08" in 24-hour locales.
const formatHour = (hour) =>
  new Date(2000, 0, 1, hour % 24).toLocaleTimeString(undefined, {
    hour: "numeric",
  });

const formatRange = ([start, end]) =>
  `${formatHour(start)} – ${formatHour(end)}`;

const formatDay = (date, opts) => date.toLocaleDateString(undefined, opts);

// "Today", "Tomorrow", or the weekday name for anything later.
const relativeDayLabel = (date) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((date - start) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatDay(date, { weekday: "long" });
};

const firstName = (name) => name?.split(" ")[0] || "Someone";

const joinNames = (names) => {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
};

const newGroupId = () => Math.random().toString(36).substring(2, 10);

// Classifies one hour for one viewer. Busy wins, then "everyone", then the
// viewer's own entry, then other people.
const getSlotState = (people, uid, totalMembers) => {
  const free = people.filter((p) => p.type === "available");
  const busy = people.filter((p) => p.type === "unavailable");
  let state = "empty";
  if (busy.length) state = "busy";
  else if (totalMembers >= 2 && free.length === totalMembers) state = "everyone";
  else if (uid && free.some((p) => p.uid === uid)) state = "you";
  else if (free.length) state = "some";
  return { state, free, busy };
};

// --- Hooks ---

const useMediaQuery = (queryString) => {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(queryString).matches ?? false
  );
  useEffect(() => {
    const mql = window.matchMedia?.(queryString);
    if (!mql) return;
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [queryString]);
  return matches;
};

// Persists a string preference in localStorage, tolerating private browsing.
const useStoredState = (key, fallback) => {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (error) {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage errors (e.g. private browsing).
    }
  }, [key, value]);
  return [value, setValue];
};

// --- Small shared UI ---

const GoogleMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const AppMark = () => (
  <span className="inline-flex items-center justify-center h-8 w-8 rounded-[9px] bg-accent text-white shrink-0">
    <CalendarCheck2 size={18} strokeWidth={2.25} />
  </span>
);

// Profile photo with a quiet initials fallback when the photo is missing or
// fails to load. Google photo URLs can 403 when a referrer is sent.
const Avatar = ({ src, name, size = 32, className = "", ring = false }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const ringClass = ring ? "ring-2 ring-surface" : "";
  if (!src || failed) {
    return (
      <span
        style={{ ...style, fontSize: Math.max(9, size * 0.42) }}
        className={`inline-flex items-center justify-center rounded-full bg-overlay-strong text-muted font-semibold shrink-0 ${ringClass} ${className}`}
        title={name}
        aria-hidden="true"
      >
        {(name || "?").charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      title={name}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`rounded-full object-cover shrink-0 ${ringClass} ${className}`}
    />
  );
};

// Two-to-three option segmented control with a sliding indicator.
const Segmented = ({ options, value, onChange, label, className = "" }) => {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const active = options[index];
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid grid-flow-col auto-cols-fr bg-overlay rounded-full p-1 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 bottom-1 left-1 rounded-full shadow-sm transition-transform duration-200 ease-out ${
          active.indicatorClass || "bg-surface dark:bg-white/20"
        }`}
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => {
        const isActive = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={isActive}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
              isActive ? o.activeTextClass || "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {Icon && <Icon size={15} strokeWidth={2.5} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

const ModeToggle = ({ mode, setMode, className = "" }) => (
  <Segmented
    label="What tapping an hour marks"
    value={mode}
    onChange={setMode}
    className={className}
    options={[
      {
        value: "available",
        label: "I'm free",
        icon: Check,
        indicatorClass: "bg-accent",
        activeTextClass: "text-white",
      },
      {
        value: "unavailable",
        label: "I'm busy",
        icon: Ban,
        indicatorClass: "bg-busy",
        activeTextClass: "text-white",
      },
    ]}
  />
);

// Bottom sheet on phones, centered dialog on larger screens.
const Sheet = ({ title, subtitle, onClose, children }) => {
  const panelRef = useRef(null);
  // Ref so a parent re-render (e.g. a live Firestore update) doesn't re-run
  // the effect below and yank focus back to the panel.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-sm max-h-[90dvh] overflow-y-auto bg-surface rounded-t-[24px] sm:rounded-card shadow-float p-5 pt-3 sm:pt-5 animate-sheet-in focus:outline-none"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className="sm:hidden mx-auto mb-3 h-1 w-9 rounded-full bg-overlay-strong"
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ICON_BTN} -mr-2 -mt-1 text-muted`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const LegendItem = ({ swatch, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`h-3 w-3 rounded-[4px] border border-hairline ${swatch}`} />
    {label}
  </span>
);

// --- Weekly view ---

const WeeklyView = ({
  weekStart,
  today,
  user,
  slotIndex,
  totalMembers,
  showFullDay,
  setShowFullDay,
  onPrevWeek,
  onNextWeek,
  onSlotClick,
  onDayClick,
  mySlotDays,
}) => {
  const isWide = useMediaQuery("(min-width: 640px)");
  const maxAvatars = isWide ? 3 : 2;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => h).filter(
        (h) => showFullDay || h >= FIRST_WAKING_HOUR
      ),
    [showFullDay]
  );
  const gridCols =
    "grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] sm:grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]";
  const weekEnd = days[6];

  return (
    // overflow-clip (not hidden) keeps the rounded corners without creating a
    // scroll container, so the header below can stick to the viewport.
    <section className={`${CARD} overflow-clip`} aria-label="Week">
      <div
        className="sticky z-20 bg-surface border-b border-hairline"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-2 pt-2">
          <button onClick={onPrevWeek} className={ICON_BTN} aria-label="Previous week">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-[15px] sm:text-base font-semibold text-ink tabular-nums">
            {formatDay(weekStart, { month: "short", day: "numeric" })} –{" "}
            {formatDay(weekEnd, {
              month: weekEnd.getMonth() === weekStart.getMonth() ? undefined : "short",
              day: "numeric",
            })}
            <span className="text-muted font-medium">
              {", "}
              {weekEnd.getFullYear()}
            </span>
          </h2>
          <button onClick={onNextWeek} className={ICON_BTN} aria-label="Next week">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className={`${gridCols} pb-1.5`}>
          <div />
          {days.map((day) => {
            const isPast = day < today;
            const isToday = day.getTime() === today.getTime();
            const hasMine = mySlotDays.has(toDateKey(day));
            return (
              <button
                key={day.getTime()}
                type="button"
                disabled={isPast}
                onClick={() => onDayClick(day)}
                aria-label={`${formatDay(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })} — whole-day options`}
                className="group flex flex-col items-center gap-0.5 py-1 rounded-xl hover:bg-overlay active:bg-overlay-strong transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    isToday ? "text-accent" : "text-muted"
                  }`}
                >
                  {formatDay(day, { weekday: "short" })}
                </span>
                <span
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-[17px] font-semibold tabular-nums ${
                    isToday ? "bg-accent text-white" : "text-ink"
                  }`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${hasMine ? "bg-accent" : "bg-transparent"}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowFullDay(!showFullDay)}
        aria-expanded={showFullDay}
        className="w-full flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-muted hover:text-ink hover:bg-overlay transition border-b border-hairline"
      >
        {showFullDay ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showFullDay
          ? "Hide early hours"
          : `Show ${formatHour(0)} – ${formatHour(FIRST_WAKING_HOUR - 1)}`}
      </button>

      <div className={gridCols} role="group" aria-label="Hourly availability">
        {hours.map((hour) => (
          <React.Fragment key={hour}>
            <div
              className="flex items-center justify-end pr-1.5 sm:pr-2 text-[10px] sm:text-[11px] font-medium text-muted tabular-nums whitespace-nowrap"
              aria-hidden="true"
            >
              {formatHour(hour)}
            </div>
            {days.map((day) => {
              const isPast = day < today;
              const people = slotIndex[slotIdFor(day, hour)] || [];
              const { state, free, busy } = getSlotState(
                people,
                user?.uid,
                totalMembers
              );
              const nameOf = (p) => (p.uid === user?.uid ? "You" : firstName(p.displayName));
              const summary = busy.length
                ? `busy: ${joinNames(busy.map(nameOf))}`
                : state === "everyone"
                ? "everyone free"
                : free.length
                ? `free: ${joinNames(free.map(nameOf))}`
                : "no one yet";
              const overflow = free.length > maxAvatars;
              const shown = overflow ? free.slice(0, maxAvatars - 1) : free;
              return (
                <button
                  key={day.getTime()}
                  type="button"
                  disabled={isPast}
                  onClick={() => onSlotClick(day, hour)}
                  aria-label={`${formatDay(day, { weekday: "long" })} ${formatHour(hour)}: ${summary}`}
                  className={`relative h-11 sm:h-12 border-t border-l border-hairline p-1 flex items-center justify-center transition-colors ${
                    isPast
                      ? "bg-overlay/50 cursor-default"
                      : `${SLOT_TINT[state]} ${
                          state === "empty" ? "hover:bg-overlay" : "hover:brightness-[0.97] dark:hover:brightness-110"
                        } active:brightness-90`
                  }`}
                >
                  {(shown.length > 0 || busy.length > 0) && (
                    <span className="flex -space-x-1.5">
                      {shown.map((p) => (
                        <Avatar
                          key={p.uid}
                          src={p.photoURL}
                          name={p.displayName}
                          size={isWide ? 22 : 18}
                          ring
                          className="animate-pop"
                        />
                      ))}
                      {overflow && (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-ink text-surface ring-2 ring-surface text-[9px] font-bold tabular-nums animate-pop"
                          style={{ width: isWide ? 22 : 18, height: isWide ? 22 : 18 }}
                        >
                          +{free.length - shown.length}
                        </span>
                      )}
                      {busy.length > 0 && (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-busy text-white ring-2 ring-surface animate-pop"
                          style={{ width: isWide ? 22 : 18, height: isWide ? 22 : 18 }}
                        >
                          <Ban size={isWide ? 12 : 10} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="border-t border-hairline px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        <LegendItem swatch={SLOT_TINT.you} label="You're free" />
        <LegendItem swatch={SLOT_TINT.some} label="Others free" />
        <LegendItem swatch={SLOT_TINT.everyone} label="Everyone free" />
        <LegendItem swatch={SLOT_TINT.busy} label="Someone's busy" />
      </div>
    </section>
  );
};

// --- Monthly view ---

const MonthlyView = ({
  currentDate,
  setCurrentDate,
  today,
  dayActivity,
  bestDateKeys,
  onPickDay,
}) => {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const cells = useMemo(() => {
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1)),
    ];
  }, [month, year]);
  // Locale weekday initials, starting Sunday (Jan 1 2023 was a Sunday).
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        formatDay(new Date(2023, 0, 1 + i), { weekday: "short" })
      ),
    []
  );

  return (
    <section className={`${CARD} p-2 sm:p-4`} aria-label="Month">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className={ICON_BTN}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-[15px] sm:text-base font-semibold text-ink">
          {formatDay(currentDate, { month: "long", year: "numeric" })}
        </h2>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className={ICON_BTN}
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1" aria-hidden="true">
        {weekdayLabels.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />;
          const key = toDateKey(date);
          const isPast = date < today;
          const isToday = date.getTime() === today.getTime();
          const isBest = bestDateKeys.has(key);
          const activity = dayActivity[key] || {};
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => onPickDay(date)}
              aria-label={`${formatDay(date, { weekday: "long", month: "long", day: "numeric" })}${
                isBest ? ", everyone free" : ""
              }`}
              className={`h-14 sm:h-20 rounded-xl flex flex-col items-center sm:items-start justify-between p-1.5 sm:p-2 transition disabled:opacity-35 active:scale-95 ${
                isBest ? `${SLOT_TINT.everyone} hover:brightness-95` : "hover:bg-overlay"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold tabular-nums ${
                  isToday ? "bg-accent text-white" : isBest ? "text-free-ink" : "text-ink"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="flex gap-1 h-1.5 sm:pl-1.5" aria-hidden="true">
                {activity.you && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                {activity.others && <span className="h-1.5 w-1.5 rounded-full bg-some" />}
                {activity.busy && <span className="h-1.5 w-1.5 rounded-full bg-busy" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-hairline mt-3 pt-3 px-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        <LegendItem swatch={SLOT_TINT.everyone} label="Everyone free" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> You
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-some" /> Others
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-busy" /> Busy
        </span>
      </div>
    </section>
  );
};

// --- Whole-day actions (replaces the old tap-to-fill + copy modal) ---

const DaySheet = ({ day, hasSlots, onSetDay, onRepeat, onClose }) => {
  const [showRepeat, setShowRepeat] = useState(false);
  const [duration, setDuration] = useState("month");
  const [overwrite, setOverwrite] = useState(true);
  const weekday = formatDay(day, { weekday: "long" });

  const rowClass =
    "w-full flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] font-medium text-ink hover:bg-overlay active:bg-overlay-strong transition text-left";
  const iconWrap = "inline-flex items-center justify-center h-8 w-8 rounded-full";

  return (
    <Sheet
      title={formatDay(day, { weekday: "long", month: "long", day: "numeric" })}
      subtitle="Set the whole day at once"
      onClose={onClose}
    >
      <div className="space-y-1 -mx-1">
        <button className={rowClass} onClick={() => onSetDay(day, "available")}>
          <span className={`${iconWrap} bg-accent/15 text-accent`}>
            <Check size={17} strokeWidth={2.5} />
          </span>
          Free all day
        </button>
        <button className={rowClass} onClick={() => onSetDay(day, "unavailable")}>
          <span className={`${iconWrap} bg-busy/15 text-busy-ink`}>
            <Ban size={16} strokeWidth={2.5} />
          </span>
          Busy all day
        </button>
        {hasSlots && (
          <>
            <button className={rowClass} onClick={() => onSetDay(day, null)}>
              <span className={`${iconWrap} bg-overlay text-muted`}>
                <Eraser size={16} />
              </span>
              Clear my day
            </button>
            <button
              className={rowClass}
              onClick={() => setShowRepeat(!showRepeat)}
              aria-expanded={showRepeat}
            >
              <span className={`${iconWrap} bg-overlay text-muted`}>
                <Repeat size={16} />
              </span>
              <span className="flex-1">Repeat every {weekday}</span>
              <ChevronDown
                size={18}
                className={`text-muted transition-transform ${showRepeat ? "rotate-180" : ""}`}
              />
            </button>
          </>
        )}
      </div>

      {showRepeat && (
        <div className="mt-3 p-4 rounded-2xl bg-overlay space-y-4 animate-fade-in">
          <p className="text-sm text-muted">
            Copies this {weekday}'s hours onto upcoming {weekday}s.
          </p>
          <Segmented
            label="How far ahead"
            value={duration}
            onChange={setDuration}
            className="w-full"
            options={[
              { value: "month", label: "Next month" },
              { value: "3months", label: "Next 3 months" },
            ]}
          />
          <label className="flex items-start gap-3 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--accent))] shrink-0"
            />
            <span>
              Replace anything already on those days
              <span className="block text-muted text-xs mt-0.5">
                Off keeps existing hours and only fills gaps.
              </span>
            </span>
          </label>
          <button
            className={`${BTN_PRIMARY} w-full`}
            onClick={() => onRepeat({ sourceDate: day, duration, overwrite })}
          >
            <Repeat size={16} /> Repeat schedule
          </button>
        </div>
      )}
    </Sheet>
  );
};

// --- Account menu ---

const AccountMenu = ({ user, themePref, setThemePref, onNewCalendar, onSignOut }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const itemClass =
    "w-full flex items-center gap-3 h-11 px-4 text-sm text-ink hover:bg-overlay active:bg-overlay-strong transition text-left";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full p-0.5 hover:ring-2 hover:ring-accent/40 active:scale-95 transition"
      >
        <Avatar src={user.photoURL} name={user.displayName} size={36} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className={`absolute right-0 mt-2 w-64 ${CARD} shadow-float z-40 py-2 animate-menu-in`}
          >
            <div className="px-4 pt-1 pb-3 flex items-center gap-3 border-b border-hairline">
              <Avatar src={user.photoURL} name={user.displayName} size={36} />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink truncate">{user.displayName}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>
            </div>
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-xs font-medium text-muted mb-2">Appearance</p>
              <Segmented
                label="Appearance"
                value={themePref}
                onChange={setThemePref}
                className="w-full"
                options={[
                  { value: "system", icon: Monitor, ariaLabel: "Match system" },
                  { value: "light", icon: Sun, ariaLabel: "Light" },
                  { value: "dark", icon: Moon, ariaLabel: "Dark" },
                ]}
              />
            </div>
            <div className="pt-1">
              <button role="menuitem" className={itemClass} onClick={onNewCalendar}>
                <Plus size={17} className="text-muted" /> New calendar
              </button>
              <button role="menuitem" className={itemClass} onClick={onSignOut}>
                <LogOut size={17} className="text-muted" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- "When everyone's free" ---

const BestTimes = ({
  bestTimes,
  totalMembers,
  eventNotes,
  canEditNotes,
  onEditNoteRequest,
  onSaveNote,
  onAddToCalendar,
  onJumpTo,
  onInvite,
}) => {
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");

  const startEditing = (dateKey) => {
    if (!canEditNotes) {
      onEditNoteRequest();
      return;
    }
    setEditingKey(dateKey);
    setDraft(eventNotes[dateKey]?.text || "");
  };
  const save = async (dateKey) => {
    if (await onSaveNote(dateKey, draft)) setEditingKey(null);
  };

  return (
    <section className={`${CARD} p-4`}>
      <h3 className="text-base font-bold text-ink flex items-center gap-2">
        When everyone's free
        {bestTimes.length > 0 && (
          <span className="text-xs font-semibold text-free-ink bg-free/15 rounded-full px-2 py-0.5 tabular-nums">
            {bestTimes.length}
          </span>
        )}
      </h3>

      {totalMembers < 2 ? (
        <div className="mt-2">
          <p className="text-sm text-muted">
            Once two or more people add their hours, the times that work for
            everyone show up here.
          </p>
          {onInvite && (
            <button className={`${BTN_SECONDARY} mt-3`} onClick={onInvite}>
              <Share size={15} /> Invite friends
            </button>
          )}
        </div>
      ) : bestTimes.length === 0 ? (
        <p className="text-sm text-muted mt-2">
          No hour works for everyone yet. Matches appear here automatically as
          people add their times.
        </p>
      ) : (
        <ul className="mt-2 -mx-1 divide-y divide-hairline">
          {bestTimes.map(({ date, dateKey, ranges }) => {
            const note = eventNotes[dateKey]?.text;
            const isEditing = editingKey === dateKey;
            return (
              <li key={dateKey} className="py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onJumpTo(date)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl px-1 py-1 hover:bg-overlay active:bg-overlay-strong transition"
                  >
                    <span className="flex flex-col items-center justify-center h-12 w-11 rounded-xl bg-free/15 text-free-ink shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
                        {formatDay(date, { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-tight tabular-nums">
                        {date.getDate()}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-ink truncate">
                        {relativeDayLabel(date)}
                      </span>
                      <span className="block text-sm text-muted tabular-nums truncate">
                        {ranges.map(formatRange).join(", ")}
                      </span>
                      {note && !isEditing && (
                        <span className="mt-1 flex items-start gap-1.5 text-sm text-ink">
                          <StickyNote size={14} className="mt-0.5 shrink-0 text-muted" />
                          <span className="break-words">{note}</span>
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => (isEditing ? setEditingKey(null) : startEditing(dateKey))}
                      className={`${ICON_BTN} text-muted`}
                      aria-label={note ? "Edit plan note" : "Add a plan note"}
                      title={note ? "Edit plan note" : "Add a plan note"}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      onClick={() => onAddToCalendar(date, ranges)}
                      className={`${ICON_BTN} text-muted`}
                      aria-label="Add to Google Calendar"
                      title="Add to Google Calendar"
                    >
                      <CalendarPlus size={17} />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    className="mt-2 ml-1 space-y-2 animate-fade-in"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save(dateKey);
                    }}
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          save(dateKey);
                        } else if (e.key === "Escape") {
                          setEditingKey(null);
                        }
                      }}
                      placeholder="What's the plan? e.g. Dinner at Mike's, 7pm"
                      aria-label="Plan note"
                      maxLength={140}
                      rows={2}
                      autoFocus
                      className="w-full text-base sm:text-sm p-3 rounded-xl border border-hairline bg-canvas text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted tabular-nums">
                        {draft.length}/140
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          onClick={() => setEditingKey(null)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className={`${BTN_PRIMARY} h-10 px-4 text-sm`}>
                          Save
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// --- Main App Component ---
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [allUsersAvailability, setAllUsersAvailability] = useState({});
  const [eventNotes, setEventNotes] = useState({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [daySheetDate, setDaySheetDate] = useState(null);
  const [view, setView] = useStoredState("wayf_view", "weekly");
  const [selectionMode, setSelectionMode] = useStoredState(
    "wayf_selectionMode",
    "available"
  );
  const [showFullDayRaw, setShowFullDayRaw] = useStoredState(
    "wayf_showFullDay",
    "false"
  );
  const showFullDay = showFullDayRaw === "true";
  const setShowFullDay = (v) => setShowFullDayRaw(String(v));
  // "system" follows the OS; "light"/"dark" are explicit overrides. The same
  // logic runs in an inline script in index.html so there's no flash on load.
  const [themePref, setThemePref] = useStoredState("wayf_theme", "system");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const isDark = themePref === "dark" || (themePref === "system" && systemDark);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Single toast timer so a new message isn't cut short by an older one's
  // timeout. Toasts with an action (e.g. Undo) stay up a little longer.
  const toastTimerRef = useRef(null);
  const notify = (message, action) => {
    clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, action });
    toastTimerRef.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
  };
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", isDark ? "#000000" : "#f5f5f7"));
  }, [isDark]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("id");
    if (!id) {
      id = newGroupId();
      const newUrl = `${window.location.pathname}?id=${id}${window.location.hash}`;
      try {
        window.history.replaceState({ path: newUrl }, "", newUrl);
      } catch (error) {
        console.warn("Could not update URL.", error);
      }
    }
    setGroupId(id);
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      setDb(firestore);
      setAuth(authInstance);
      const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db || !groupId) return;
    const availabilityCollection = collection(db, "groups", groupId, "availability");
    const unsubscribe = onSnapshot(
      query(availabilityCollection),
      (querySnapshot) => {
        const availabilityData = {};
        querySnapshot.forEach((d) => {
          availabilityData[d.id] = d.data();
        });
        setAllUsersAvailability(availabilityData);
      },
      (error) => {
        console.error("Error fetching real-time availability:", error);
      }
    );
    return () => unsubscribe();
  }, [isAuthReady, db, groupId]);

  // Real-time listener for optional per-date event notes/descriptions.
  useEffect(() => {
    if (!isAuthReady || !db || !groupId) return;
    const notesCollection = collection(db, "groups", groupId, "eventNotes");
    const unsubscribe = onSnapshot(
      query(notesCollection),
      (querySnapshot) => {
        const notesData = {};
        querySnapshot.forEach((d) => {
          notesData[d.id] = d.data();
        });
        setEventNotes(notesData);
      },
      (error) => {
        console.error("Error fetching event notes:", error);
      }
    );
    return () => unsubscribe();
  }, [isAuthReady, db, groupId]);

  // --- Derived data ---

  const totalMembers = Object.keys(allUsersAvailability).length;
  const mySlots = useMemo(
    () => (user && allUsersAvailability[user.uid]?.slots) || [],
    [allUsersAvailability, user]
  );
  const mySlotDays = useMemo(
    () => new Set(mySlots.map((s) => s.id.split("T")[0])),
    [mySlots]
  );

  // slotId -> people in that hour. Built once per snapshot instead of
  // scanning every member's slots for every cell.
  const slotIndex = useMemo(() => {
    const index = {};
    Object.entries(allUsersAvailability).forEach(([uid, userData]) => {
      (userData.slots || []).forEach((slot) => {
        (index[slot.id] ||= []).push({
          uid,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          type: slot.type,
        });
      });
    });
    return index;
  }, [allUsersAvailability]);

  // Per-day summary for the month view dots.
  const dayActivity = useMemo(() => {
    const activity = {};
    Object.entries(slotIndex).forEach(([slotId, people]) => {
      const key = slotId.split("T")[0];
      const a = (activity[key] ||= {});
      people.forEach((p) => {
        if (p.type === "unavailable") a.busy = true;
        else if (p.uid === user?.uid) a.you = true;
        else a.others = true;
      });
    });
    return activity;
  }, [slotIndex, user]);

  // Upcoming dates with at least one hour where every member (2+) is free,
  // each with its contiguous free ranges as [startHour, endHour) pairs.
  const bestTimes = useMemo(() => {
    if (totalMembers < 2) return [];
    const todayKey = toDateKey(today);
    const hoursByDate = {};
    Object.entries(slotIndex).forEach(([slotId, people]) => {
      const [dateKey, time] = slotId.split("T");
      if (dateKey < todayKey) return;
      const freeUids = new Set(
        people.filter((p) => p.type === "available").map((p) => p.uid)
      );
      if (freeUids.size === totalMembers) {
        (hoursByDate[dateKey] ||= []).push(Number(time.split(":")[0]));
      }
    });
    return Object.keys(hoursByDate)
      .sort()
      .map((dateKey) => {
        const hours = [...new Set(hoursByDate[dateKey])].sort((a, b) => a - b);
        const ranges = [];
        hours.forEach((h) => {
          const last = ranges[ranges.length - 1];
          if (last && last[1] === h) last[1] = h + 1;
          else ranges.push([h, h + 1]);
        });
        return { date: fromDateKey(dateKey), dateKey, ranges };
      });
  }, [slotIndex, totalMembers, today]);
  const bestDateKeys = useMemo(
    () => new Set(bestTimes.map((b) => b.dateKey)),
    [bestTimes]
  );

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const isViewingToday =
    view === "weekly"
      ? today >= weekStart && today < addDays(weekStart, 7)
      : currentDate.getMonth() === today.getMonth() &&
        currentDate.getFullYear() === today.getFullYear();

  // --- Actions ---

  const handleSignIn = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        return;
      }
      console.error("Google sign-in failed:", error);
      notify(
        error.code === "auth/popup-blocked"
          ? "Pop-up blocked. Allow pop-ups for this site to sign in."
          : "Couldn't sign in. Please try again."
      );
    }
  };
  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  // Writes the signed-in user's full slot list (or removes them from the
  // group when it's empty). Returns false and shows a toast on failure.
  const saveMySlots = async (slots) => {
    const userDocRef = doc(db, "groups", groupId, "availability", user.uid);
    try {
      if (slots.length === 0) {
        await deleteDoc(userDocRef);
      } else {
        await setDoc(
          userDocRef,
          {
            slots,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
          { merge: true }
        );
      }
      return true;
    } catch (error) {
      console.error("Error saving availability:", error);
      notify("Couldn't save your changes. Check your connection.");
      return false;
    }
  };

  // Saves a bulk change and offers to put the previous slots back.
  const saveWithUndo = async (nextSlots, message) => {
    const previous = mySlots;
    if (!(await saveMySlots(nextSlots))) return false;
    notify(message, {
      label: "Undo",
      onClick: async () => {
        if (await saveMySlots(previous)) notify("Change undone.");
      },
    });
    return true;
  };

  const handleSlotClick = async (day, hour) => {
    if (day < today) return;
    if (!user) {
      handleSignIn();
      return;
    }
    if (!db || !groupId) return;
    const slotId = slotIdFor(day, hour);
    const existingSlot = mySlots.find((s) => s.id === slotId);
    // Someone else blocking a slot stops you adding to it, but you can always
    // change or clear your own entry.
    const blocker = (slotIndex[slotId] || []).find(
      (p) => p.type === "unavailable" && p.uid !== user.uid
    );
    if (blocker && !existingSlot) {
      notify(`${firstName(blocker.displayName)} is busy then.`);
      return;
    }
    let newSlots;
    if (existingSlot) {
      newSlots =
        existingSlot.type === selectionMode
          ? mySlots.filter((s) => s.id !== slotId)
          : mySlots.map((s) => (s.id === slotId ? { ...s, type: selectionMode } : s));
    } else {
      newSlots = [...mySlots, { id: slotId, type: selectionMode }];
    }
    await saveMySlots(newSlots);
  };

  const handleDayClick = (day) => {
    if (day < today) return;
    if (!user) {
      handleSignIn();
      return;
    }
    setDaySheetDate(day);
  };

  // type: "available" | "unavailable" | null (clear).
  const handleSetDay = async (day, type) => {
    if (!user || !db || !groupId) return;
    const dayKey = toDateKey(day);
    const otherDays = mySlots.filter((s) => !s.id.startsWith(dayKey));
    const dayLabel = formatDay(day, { weekday: "long" });
    const next = type
      ? [
          ...otherDays,
          ...Array.from({ length: 24 }, (_, h) => ({ id: slotIdFor(day, h), type })),
        ]
      : otherDays;
    setDaySheetDate(null);
    await saveWithUndo(
      next,
      type === "available"
        ? `${dayLabel} marked free all day.`
        : type === "unavailable"
        ? `${dayLabel} marked busy all day.`
        : `${dayLabel} cleared.`
    );
  };

  const handleRepeatDay = async ({ sourceDate, duration, overwrite }) => {
    if (!user || !db || !groupId) return;
    const sourceDayKey = toDateKey(sourceDate);
    const sourceSlots = mySlots.filter((s) => s.id.startsWith(sourceDayKey));
    if (sourceSlots.length === 0) return;

    const endDate = new Date(sourceDate);
    endDate.setMonth(endDate.getMonth() + (duration === "month" ? 1 : 3));
    const targetDates = [];
    for (let d = addDays(sourceDate, 7); d < endDate; d = addDays(d, 7)) {
      targetDates.push(d);
    }

    let finalSlots = [...mySlots];
    if (overwrite) {
      const targetKeys = targetDates.map(toDateKey);
      finalSlots = finalSlots.filter(
        (slot) => !targetKeys.some((key) => slot.id.startsWith(key))
      );
    }
    // Without overwrite, keep existing entries and skip ones already present
    // so the same slot never appears twice (which would double-count it).
    const existingIds = new Set(finalSlots.map((slot) => slot.id));
    targetDates.forEach((date) => {
      const targetKey = toDateKey(date);
      sourceSlots.forEach((sourceSlot) => {
        const id = `${targetKey}T${sourceSlot.id.split("T")[1]}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        finalSlots.push({ id, type: sourceSlot.type });
      });
    });

    setDaySheetDate(null);
    const weekday = formatDay(sourceDate, { weekday: "long" });
    await saveWithUndo(
      finalSlots,
      `Copied to the next ${targetDates.length} ${weekday}s.`
    );
  };

  const copyShareLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => notify("Invite link copied. Paste it in your group chat."))
      .catch(() => notify("Couldn't copy. Copy the address bar instead."));
  };

  const handleShare = async () => {
    const shareData = {
      title: "When Are You Free?",
      text: "Add your free times so we can find a day that works for everyone.",
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // The user cancelled the native share sheet — nothing to do.
      }
    } else {
      copyShareLink();
    }
  };

  const handleNewCalendar = () => {
    window.location.href = `${window.location.pathname}?id=${newGroupId()}`;
  };

  // Opens Google Calendar pre-filled with the longest window everyone's free,
  // in the viewer's own timezone.
  const addToGoogleCalendar = (date, ranges) => {
    const [start, end] = ranges.reduce((best, r) =>
      r[1] - r[0] > best[1] - best[0] ? r : best
    );
    const stamp = (hour) => {
      const d = addDays(date, Math.floor(hour / 24));
      return `${toDateKey(d).replace(/-/g, "")}T${String(hour % 24).padStart(2, "0")}0000`;
    };
    const noteText = eventNotes[toDateKey(date)]?.text;
    const details = noteText
      ? `${noteText}\n\nPlanned with When Are You Free?: ${window.location.href}`
      : `Planned with When Are You Free?: ${window.location.href}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: noteText || "Hangout with friends",
      dates: `${stamp(start)}/${stamp(end)}`,
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      details,
    });
    window.open(
      `https://calendar.google.com/calendar/render?${params}`,
      "_blank",
      "noopener"
    );
  };

  const saveEventNote = async (dateKey, text) => {
    if (!user || !db || !groupId) return false;
    const noteDocRef = doc(db, "groups", groupId, "eventNotes", dateKey);
    const trimmed = text.trim();
    try {
      if (!trimmed) {
        await deleteDoc(noteDocRef);
      } else {
        await setDoc(
          noteDocRef,
          { text: trimmed, updatedBy: user.displayName, updatedAt: Date.now() },
          { merge: true }
        );
      }
      return true;
    } catch (error) {
      console.error("Error saving event note:", error);
      notify("Couldn't save the note. Check your connection.");
      return false;
    }
  };

  const jumpToDay = (date) => {
    setCurrentDate(date);
    setView("weekly");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isAuthReady || !groupId) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-canvas">
        <div className="flex flex-col items-center gap-3 text-muted">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Loading calendar…</p>
        </div>
      </div>
    );
  }

  const members = Object.entries(allUsersAvailability);

  return (
    <div className="bg-canvas min-h-dvh font-sans text-ink pb-28 sm:pb-10">
      {daySheetDate && (
        <DaySheet
          day={daySheetDate}
          hasSlots={mySlotDays.has(toDateKey(daySheetDate))}
          onSetDay={handleSetDay}
          onRepeat={handleRepeatDay}
          onClose={() => setDaySheetDate(null)}
        />
      )}

      <header style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <AppMark />
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-ink truncate">
              When Are You Free?
            </h1>
          </div>
          {user ? (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleShare} className={`${BTN_SECONDARY} h-9 px-3.5`}>
                <Share size={15} /> Invite
              </button>
              <AccountMenu
                user={user}
                themePref={themePref}
                setThemePref={setThemePref}
                onNewCalendar={handleNewCalendar}
                onSignOut={handleSignOut}
              />
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="shrink-0 text-sm font-semibold text-accent h-9 px-3 rounded-full hover:bg-accent/10 active:scale-95 transition"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-4">
        {!user && (
          <section className={`${CARD} p-5`}>
            {members.length > 0 && (
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex -space-x-2">
                  {members.slice(0, 4).map(([uid, m]) => (
                    <Avatar key={uid} src={m.photoURL} name={m.displayName} size={28} ring />
                  ))}
                </span>
                <span className="text-sm text-muted">
                  {joinNames(members.map(([, m]) => firstName(m.displayName)))}{" "}
                  {members.length === 1 ? "has" : "have"} added their times
                </span>
              </div>
            )}
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Find a time that works for everyone
            </h2>
            <p className="text-[15px] text-muted mt-1">
              Sign in to add when you're free. Everyone in this calendar sees
              updates instantly.
            </p>
            <button
              onClick={handleSignIn}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-11 px-5 rounded-full bg-surface border border-hairline text-ink text-[15px] font-semibold shadow-sm hover:bg-overlay active:scale-[0.98] transition"
            >
              <GoogleMark /> Continue with Google
            </button>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Segmented
              label="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: "weekly", label: "Week" },
                { value: "monthly", label: "Month" },
              ]}
            />
            <button
              onClick={() => setCurrentDate(new Date())}
              className={`text-sm font-semibold text-accent h-9 px-3 rounded-full hover:bg-accent/10 active:scale-95 transition ${
                isViewingToday ? "invisible" : ""
              }`}
            >
              Today
            </button>
          </div>
          {user && (
            <ModeToggle
              mode={selectionMode}
              setMode={setSelectionMode}
              className="hidden sm:grid"
            />
          )}
        </div>

        {user && mySlots.length === 0 && view === "weekly" && (
          <p className="text-sm text-muted px-1">
            Tap the hours you're free. Tap a date for whole-day options.
          </p>
        )}

        {view === "weekly" ? (
          <WeeklyView
            weekStart={weekStart}
            today={today}
            user={user}
            slotIndex={slotIndex}
            totalMembers={totalMembers}
            showFullDay={showFullDay}
            setShowFullDay={setShowFullDay}
            onPrevWeek={() => setCurrentDate((d) => addDays(d, -7))}
            onNextWeek={() => setCurrentDate((d) => addDays(d, 7))}
            onSlotClick={handleSlotClick}
            onDayClick={handleDayClick}
            mySlotDays={mySlotDays}
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            today={today}
            dayActivity={dayActivity}
            bestDateKeys={bestDateKeys}
            onPickDay={jumpToDay}
          />
        )}

        <BestTimes
          bestTimes={bestTimes}
          totalMembers={totalMembers}
          eventNotes={eventNotes}
          canEditNotes={!!user}
          onEditNoteRequest={handleSignIn}
          onSaveNote={saveEventNote}
          onAddToCalendar={addToGoogleCalendar}
          onJumpTo={jumpToDay}
          onInvite={user ? handleShare : null}
        />

        <section className={`${CARD} p-4`}>
          <h3 className="text-base font-bold text-ink">
            People <span className="text-muted font-semibold tabular-nums">{totalMembers}</span>
          </h3>
          {totalMembers === 0 ? (
            <p className="text-sm text-muted mt-2">
              No one's added their times yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map(([uid, m]) => (
                <li
                  key={uid}
                  className="inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-overlay"
                >
                  <Avatar src={m.photoURL} name={m.displayName} size={28} />
                  <span className="text-sm font-medium text-ink">
                    {firstName(m.displayName)}
                    {uid === user?.uid && <span className="text-muted"> (you)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-muted pt-1">
          Times shown in your timezone ·{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}
        </p>
      </main>

      {/* Phone: the free/busy switch lives in thumb reach. */}
      {user && (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none px-4"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <ModeToggle
            mode={selectionMode}
            setMode={setSelectionMode}
            className="pointer-events-auto bg-surface/90 backdrop-blur-xl border border-hairline shadow-float"
          />
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 max-w-md bg-ink text-surface text-sm font-medium pl-4 pr-2 py-2 min-h-[44px] rounded-full shadow-float animate-toast-in"
          >
            <span className={toast.action ? "" : "pr-2"}>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  setToast(null);
                  toast.action.onClick();
                }}
                className="shrink-0 h-8 px-3 rounded-full font-semibold text-accent bg-surface/10 hover:bg-surface/20 active:scale-95 transition"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
