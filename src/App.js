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
  ChevronLeft,
  ChevronRight,
  LogOut,
  PlusSquare,
  CalendarPlus,
  Repeat,
  Pencil,
  Check,
  X,
  Share2,
  StickyNote,
  Loader2,
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

// --- Small shared UI helpers ---

const ModeToggle = ({ mode, setMode, className = "" }) => (
  <div
    className={`inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm ${className}`}
  >
    <button
      type="button"
      onClick={() => setMode("available")}
      className={`px-4 py-2.5 sm:py-1.5 text-sm font-semibold rounded-full transition-colors ${
        mode === "available"
          ? "bg-blue-500 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      Available
    </button>
    <button
      type="button"
      onClick={() => setMode("unavailable")}
      className={`px-4 py-2.5 sm:py-1.5 text-sm font-semibold rounded-full transition-colors ${
        mode === "unavailable"
          ? "bg-red-500 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      Unavailable
    </button>
  </div>
);

// --- Helper Components ---

const WeeklyView = ({
  currentDate,
  setCurrentDate,
  allUsersAvailability,
  user,
  handleSlotClick,
  getUsersInSlot,
  handleDayClick,
  today,
  showFullDay,
  openCopyModal,
}) => {
  const scrollContainerRef = useRef(null);

  const daysOfWeek = useMemo(
    () =>
      Array(7)
        .fill(0)
        .map((_, i) => {
          const d = new Date(currentDate);
          d.setDate(d.getDate() - d.getDay() + i);
          return d;
        }),
    [currentDate]
  );

  const timeSlots = useMemo(() => {
    const allHours = Array(24)
      .fill(0)
      .map((_, i) => `${i.toString().padStart(2, "0")}:00`);
    return showFullDay ? allHours : allHours.slice(8);
  }, [showFullDay]);

  // When "Full Day" is switched on, jump the scroll position to a sensible
  // waking hour instead of dropping the user at midnight.
  useEffect(() => {
    if (showFullDay && scrollContainerRef.current) {
      const target = scrollContainerRef.current.querySelector(
        '[data-hour="08"]'
      );
      if (target) {
        target.scrollIntoView({ block: "start" });
      }
    }
  }, [showFullDay]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex justify-between items-center p-3 sm:p-4 border-b border-slate-200">
        <button
          onClick={() =>
            setCurrentDate((d) => new Date(d.setDate(d.getDate() - 7)))
          }
          className="p-2.5 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-sm sm:text-lg font-semibold text-center text-slate-800">
          {daysOfWeek[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}{" "}
          -{" "}
          {daysOfWeek[6].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <button
          onClick={() =>
            setCurrentDate((d) => new Date(d.setDate(d.getDate() + 7)))
          }
          className="p-2.5 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Next week"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: "calc(100vh - 380px)" }}
      >
        <div
          className="grid grid-cols-[auto_repeat(7,1fr)]"
          style={{ minWidth: "640px" }}
        >
          <div className="sticky top-0 left-0 bg-white z-10"></div>
          {daysOfWeek.map((day, i) => {
            const isPast = day < today;
            const isToday = day.toDateString() === new Date().toDateString();
            const dayString = day.toISOString().split("T")[0];
            const hasUserSlots =
              user &&
              allUsersAvailability[user.uid]?.slots.some((s) =>
                s.id.startsWith(dayString)
              );

            return (
              <div
                key={i}
                className={`sticky top-0 bg-white z-10 py-2 border-b-2 text-center transition-colors ${
                  isToday ? "border-blue-500" : "border-slate-100"
                } ${isPast ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <div
                    onClick={() => handleDayClick(day)}
                    className={`flex flex-col items-center px-1.5 py-1 rounded-lg ${
                      isPast
                        ? ""
                        : "cursor-pointer hover:bg-slate-100 active:bg-slate-200"
                    } ${isToday ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-semibold text-slate-500 text-[11px] sm:text-sm uppercase tracking-wide">
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p
                      className={`text-lg sm:text-2xl font-bold ${
                        isToday ? "text-blue-600" : "text-slate-800"
                      }`}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                  {hasUserSlots && !isPast && (
                    <button
                      onClick={() => openCopyModal(day)}
                      className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500"
                      aria-label="Copy this day's schedule"
                    >
                      <Repeat size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {timeSlots.map((time) => (
            <React.Fragment key={time}>
              <div
                data-hour={time.split(":")[0]}
                className="sticky left-0 bg-white text-[11px] sm:text-xs text-slate-400 flex items-center justify-center pl-2 pr-2 border-r border-t border-slate-100"
              >
                {time}
              </div>
              {daysOfWeek.map((day) => {
                const isPast = day < today;
                const usersInSlot = getUsersInSlot(day, time);
                const totalUsersInGroup =
                  Object.keys(allUsersAvailability).length;
                const isCurrentUserInSlot =
                  user &&
                  usersInSlot.some((u) => u.displayName === user.displayName);
                const isAnyoneUnavailable = usersInSlot.some(
                  (u) => u.type === "unavailable"
                );
                let bgColor = "bg-slate-50 hover:bg-slate-100";
                if (isPast) {
                  bgColor = "bg-slate-100";
                } else if (isAnyoneUnavailable) {
                  bgColor = "bg-red-100 hover:bg-red-200";
                } else if (
                  totalUsersInGroup > 0 &&
                  usersInSlot.length === totalUsersInGroup
                ) {
                  bgColor = "bg-green-200 hover:bg-green-300";
                } else if (isCurrentUserInSlot) {
                  bgColor = "bg-blue-100 hover:bg-blue-200";
                } else if (usersInSlot.length > 0) {
                  bgColor = "bg-amber-100 hover:bg-amber-200";
                }
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleSlotClick(day, time)}
                    className={`h-14 sm:h-16 border-t border-l border-slate-100 transition-colors ${bgColor} p-1 ${
                      isPast ? "pointer-events-none" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex -space-x-2">
                      {usersInSlot
                        .filter((u) => u.type === "available")
                        .slice(0, 3)
                        .map((u, i) => (
                          <img
                            key={i}
                            src={u.photoURL}
                            alt={u.displayName}
                            title={u.displayName}
                            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-white object-cover"
                          />
                        ))}
                      {isAnyoneUnavailable && (
                        <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-white bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                          !
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible gap-x-4 gap-y-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-blue-100 border border-slate-200"></div>
            <span>You're free</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-amber-100 border border-slate-200"></div>
            <span>Some free</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-green-200 border border-slate-200"></div>
            <span>Everyone free</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-100 border border-slate-200"></div>
            <span>Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MonthlyView = ({
  currentDate,
  setCurrentDate,
  allUsersAvailability,
  setView,
  today,
}) => {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ key: `blank-${i}`, blank: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ key: day, day, date: new Date(year, month, day) });
    }
    return days;
  }, [month, year, daysInMonth, firstDayOfMonth]);
  const dayHasActivity = (day) => {
    const dayString = day.toISOString().split("T")[0];
    const activity = { available: false, unavailable: false };
    Object.values(allUsersAvailability).forEach((userData) => {
      userData.slots?.forEach((slot) => {
        if (slot.id.startsWith(dayString)) {
          if (slot.type === "available") activity.available = true;
          if (slot.type === "unavailable") activity.unavailable = true;
        }
      });
    });
    return activity;
  };
  const handleDayClick = (date) => {
    setCurrentDate(date);
    setView("weekly");
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="p-2.5 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base sm:text-lg font-semibold text-center text-slate-800">
          {currentDate.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="p-2.5 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((dayInfo) => {
          if (dayInfo.blank) return <div key={dayInfo.key}></div>;
          const activity = dayHasActivity(dayInfo.date);
          const isToday =
            new Date().toDateString() === dayInfo.date.toDateString();
          const isPast = dayInfo.date < today;
          let dayBgColor = "hover:bg-slate-100";
          if (isPast) {
            dayBgColor = "bg-slate-100 opacity-50";
          } else if (activity.unavailable && activity.available) {
            dayBgColor = "bg-amber-50 hover:bg-amber-100";
          } else if (activity.unavailable) {
            dayBgColor = "bg-red-50 hover:bg-red-100";
          } else if (activity.available) {
            dayBgColor = "bg-green-50 hover:bg-green-100";
          }
          return (
            <div
              key={dayInfo.key}
              onClick={() => !isPast && handleDayClick(dayInfo.date)}
              className={`h-14 sm:h-24 p-1.5 sm:p-2 border rounded-xl transition-colors flex flex-col ${dayBgColor} ${
                isToday ? "border-blue-400 border-2" : "border-slate-100"
              } ${isPast ? "" : "cursor-pointer"}`}
            >
              <span
                className={`text-sm sm:text-base font-semibold ${
                  isToday ? "text-blue-600" : "text-slate-700"
                }`}
              >
                {dayInfo.day}
              </span>
              <div className="mt-auto flex gap-1">
                {activity.available && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                )}
                {activity.unavailable && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CopyScheduleModal = ({ sourceDate, onApply, onCancel }) => {
  const [duration, setDuration] = useState("month");
  const [overwrite, setOverwrite] = useState(true);

  const handleApply = () => {
    onApply({
      sourceDate,
      duration,
      overwrite,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full sm:max-w-sm max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-slate-900">Copy Schedule</h2>
        <p className="mb-4 text-slate-500 text-sm">
          Apply the schedule from{" "}
          <span className="font-semibold text-slate-700">
            {sourceDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>{" "}
          to future dates.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Apply to:
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="month">
                Every{" "}
                {sourceDate.toLocaleDateString(undefined, { weekday: "long" })}{" "}
                this month
              </option>
              <option value="3months">
                Every{" "}
                {sourceDate.toLocaleDateString(undefined, { weekday: "long" })}{" "}
                for 3 months
              </option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              <span className="text-sm text-slate-600">
                Overwrite existing entries on those days
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
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
  const [notification, setNotification] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("wayf_view") || "weekly";
    } catch (error) {
      return "weekly";
    }
  });
  const [selectionMode, setSelectionMode] = useState(() => {
    try {
      return localStorage.getItem("wayf_selectionMode") || "available";
    } catch (error) {
      return "available";
    }
  });
  const [showFullDay, setShowFullDay] = useState(() => {
    try {
      return localStorage.getItem("wayf_showFullDay") === "true";
    } catch (error) {
      return false;
    }
  });
  const [copyModalInfo, setCopyModalInfo] = useState({
    isOpen: false,
    sourceDate: null,
  });
  const [expandedNoteDate, setExpandedNoteDate] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Remember the person's last-used view / mode / full-day preference locally.
  useEffect(() => {
    try {
      localStorage.setItem("wayf_view", view);
    } catch (error) {
      // Ignore storage errors (e.g. private browsing).
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem("wayf_selectionMode", selectionMode);
    } catch (error) {
      // Ignore storage errors.
    }
  }, [selectionMode]);

  useEffect(() => {
    try {
      localStorage.setItem("wayf_showFullDay", String(showFullDay));
    } catch (error) {
      // Ignore storage errors.
    }
  }, [showFullDay]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
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
    const availabilityCollection = collection(
      db,
      "groups",
      groupId,
      "availability"
    );
    const q = query(availabilityCollection);
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const availabilityData = {};
        querySnapshot.forEach((doc) => {
          availabilityData[doc.id] = doc.data();
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
    const q = query(notesCollection);
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const notesData = {};
        querySnapshot.forEach((doc) => {
          notesData[doc.id] = doc.data();
        });
        setEventNotes(notesData);
      },
      (error) => {
        console.error("Error fetching event notes:", error);
      }
    );
    return () => unsubscribe();
  }, [isAuthReady, db, groupId]);

  const handleSignIn = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in failed:", error);
    }
  };
  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    setIsProfileOpen(false);
  };

  const handleSlotClick = async (day, time) => {
    if (day < today) return;
    if (!user) {
      handleSignIn();
      return;
    }
    if (!db || !groupId) return;
    const slotId = `${day.toISOString().split("T")[0]}T${time}`;
    const usersInSlot = getUsersInSlot(day, time);
    const unavailableUser = usersInSlot.find((u) => u.type === "unavailable");
    if (unavailableUser && unavailableUser.displayName !== user.displayName) {
      setNotification("This slot is blocked by another user.");
      setTimeout(() => setNotification(""), 2000);
      return;
    }
    const userDocRef = doc(db, "groups", groupId, "availability", user.uid);
    const currentUserData = allUsersAvailability[user.uid] || { slots: [] };
    const existingSlot = currentUserData.slots.find((s) => s.id === slotId);
    let newSlots;
    if (existingSlot) {
      if (existingSlot.type === selectionMode) {
        newSlots = currentUserData.slots.filter((s) => s.id !== slotId);
      } else {
        newSlots = currentUserData.slots.map((s) =>
          s.id === slotId ? { ...s, type: selectionMode } : s
        );
      }
    } else {
      newSlots = [
        ...currentUserData.slots,
        { id: slotId, type: selectionMode },
      ];
    }
    if (newSlots.length === 0) {
      await deleteDoc(userDocRef);
    } else {
      await setDoc(
        userDocRef,
        {
          slots: newSlots,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        { merge: true }
      );
    }
  };

  const handleDayClick = async (day) => {
    if (day < today) return;
    if (!user) {
      handleSignIn();
      return;
    }
    if (!db || !groupId) return;
    const dayString = day.toISOString().split("T")[0];
    const userDocRef = doc(db, "groups", groupId, "availability", user.uid);
    const currentUserData = allUsersAvailability[user.uid] || { slots: [] };
    const otherDaySlots = currentUserData.slots.filter(
      (slot) => !slot.id.startsWith(dayString)
    );
    const isDayAlreadySelected =
      currentUserData.slots.filter((slot) => slot.id.startsWith(dayString))
        .length === 24;
    let finalSlots;
    if (isDayAlreadySelected) {
      finalSlots = otherDaySlots;
    } else {
      const newDaySlots = Array(24)
        .fill(0)
        .map((_, i) => {
          const hour = i.toString().padStart(2, "0");
          return { id: `${dayString}T${hour}:00`, type: selectionMode };
        });
      finalSlots = [...otherDaySlots, ...newDaySlots];
    }
    if (finalSlots.length === 0) {
      await deleteDoc(userDocRef);
    } else {
      await setDoc(
        userDocRef,
        {
          slots: finalSlots,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        { merge: true }
      );
    }
  };

  const handleApplyCopy = async ({ sourceDate, duration, overwrite }) => {
    if (!user || !db || !groupId) return;

    const sourceDayString = sourceDate.toISOString().split("T")[0];
    const sourceSlots = (allUsersAvailability[user.uid]?.slots || []).filter(
      (s) => s.id.startsWith(sourceDayString)
    );
    if (sourceSlots.length === 0) return;

    const sourceDayOfWeek = sourceDate.getDay();
    const endDate = new Date(sourceDate);
    endDate.setMonth(endDate.getMonth() + (duration === "month" ? 1 : 3));

    const targetDates = [];
    let currentDateIterator = new Date(sourceDate);
    currentDateIterator.setDate(currentDateIterator.getDate() + 1); // Start from the next day

    while (currentDateIterator < endDate) {
      if (currentDateIterator.getDay() === sourceDayOfWeek) {
        targetDates.push(new Date(currentDateIterator));
      }
      currentDateIterator.setDate(currentDateIterator.getDate() + 1);
    }

    const currentUserData = allUsersAvailability[user.uid] || { slots: [] };
    let finalSlots = [...currentUserData.slots];

    if (overwrite) {
      const targetDateStrings = targetDates.map(
        (d) => d.toISOString().split("T")[0]
      );
      finalSlots = finalSlots.filter(
        (slot) =>
          !targetDateStrings.some((dateStr) => slot.id.startsWith(dateStr))
      );
    }

    targetDates.forEach((date) => {
      const targetDayString = date.toISOString().split("T")[0];
      sourceSlots.forEach((sourceSlot) => {
        const time = sourceSlot.id.split("T")[1];
        finalSlots.push({
          id: `${targetDayString}T${time}`,
          type: sourceSlot.type,
        });
      });
    });

    const userDocRef = doc(db, "groups", groupId, "availability", user.uid);
    await setDoc(
      userDocRef,
      {
        slots: finalSlots,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
      { merge: true }
    );

    setCopyModalInfo({ isOpen: false, sourceDate: null });
    setNotification("Schedule copied successfully!");
    setTimeout(() => setNotification(""), 2000);
  };

  const getUsersInSlot = (day, time) => {
    const slotId = `${day.toISOString().split("T")[0]}T${time}`;
    return Object.values(allUsersAvailability)
      .flatMap(
        (userData) =>
          userData.slots
            ?.filter((s) => s.id === slotId)
            .map((s) => ({ ...userData, type: s.type })) || []
      )
      .map((userData) => ({
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        type: userData.type,
      }));
  };

  // Dates where every current group member has marked themselves available
  // for at least one hour, excluding dates that have already passed.
  const bestTimes = useMemo(() => {
    const slots = {};
    const totalUsers = Object.keys(allUsersAvailability).length;
    if (totalUsers === 0) return [];
    Object.values(allUsersAvailability).forEach((userData) => {
      userData.slots?.forEach((slot) => {
        if (slot.type === "available") {
          slots[slot.id] = (slots[slot.id] || 0) + 1;
        } else {
          slots[slot.id] = -1;
        }
      });
    });
    const bestHourlySlots = Object.entries(slots)
      .filter(([id, count]) => count === totalUsers)
      .map(([id]) => id.split("T")[0]);
    const uniqueDates = [...new Set(bestHourlySlots)];
    return uniqueDates
      .map((dateString) => new Date(dateString.replace(/-/g, "/")))
      .filter((date) => date >= today)
      .sort((a, b) => a - b);
  }, [allUsersAvailability, today]);

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setNotification("Share link copied!");
      setTimeout(() => setNotification(""), 2000);
    });
  };

  const handleShare = async () => {
    setIsProfileOpen(false);
    const shareData = {
      title: "When Are You Free?",
      text: "Mark your availability so we can find a time to meet!",
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
    const newId = Math.random().toString(36).substring(2, 10);
    window.location.href = `${window.location.pathname}?id=${newId}`;
  };

  const generateGoogleCalendarLink = (date) => {
    const T = (n) => (n < 10 ? "0" + n : n);
    const d = new Date(date);
    const d2 = new Date(d);
    d2.setDate(d.getDate() + 1);
    const startDate = `${d.getFullYear()}${T(d.getMonth() + 1)}${T(
      d.getDate()
    )}`;
    const endDate = `${d2.getFullYear()}${T(d2.getMonth() + 1)}${T(
      d2.getDate()
    )}`;
    const dateString = d.toISOString().split("T")[0];
    const noteText = eventNotes[dateString]?.text;
    const details = noteText
      ? `${noteText} (Plan created using WhenAreYouFree.com)`
      : "Plan created using WhenAreYouFree.com";
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=Hangout+with+Friends&dates=${startDate}/${endDate}&details=${encodeURIComponent(
      details
    )}`;
    window.open(url, "_blank");
  };

  const openNoteEditor = (dateString) => {
    if (!user) {
      handleSignIn();
      return;
    }
    setExpandedNoteDate(dateString);
    setNoteDraft(eventNotes[dateString]?.text || "");
  };

  const closeNoteEditor = () => {
    setExpandedNoteDate(null);
    setNoteDraft("");
  };

  const saveEventNote = async (dateString) => {
    if (!user || !db || !groupId) return;
    const noteDocRef = doc(db, "groups", groupId, "eventNotes", dateString);
    const trimmed = noteDraft.trim();
    try {
      if (!trimmed) {
        await deleteDoc(noteDocRef);
      } else {
        await setDoc(
          noteDocRef,
          {
            text: trimmed,
            updatedBy: user.displayName,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
      closeNoteEditor();
    } catch (error) {
      console.error("Error saving event note:", error);
      setNotification("Couldn't save the note — check your connection.");
      setTimeout(() => setNotification(""), 2500);
    }
  };

  if (!isAuthReady || !groupId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Loading your calendar…</p>
        </div>
      </div>
    );
  }

  const totalMembers = Object.keys(allUsersAvailability).length;

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800 pb-24 sm:pb-6">
      {copyModalInfo.isOpen && (
        <CopyScheduleModal
          sourceDate={copyModalInfo.sourceDate}
          onApply={handleApplyCopy}
          onCancel={() => setCopyModalInfo({ isOpen: false, sourceDate: null })}
        />
      )}

      <header
        className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-screen-xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              When Are You Free?
            </h1>
            <p className="hidden sm:block text-slate-500 text-sm">
              Select a mode, then tap a time or day to mark it.
            </p>
          </div>
          <div className="shrink-0">
            {!user ? (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 bg-white text-slate-700 font-semibold py-2.5 px-4 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm"
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google icon"
                  className="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="rounded-full h-10 w-10 overflow-hidden border-2 border-transparent hover:border-blue-400 transition-colors"
                >
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://placehold.co/40x40/E2E8F0/4A5568?text=${
                        user.displayName?.charAt(0) || "U"
                      }`;
                    }}
                  />
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-bold truncate text-sm">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleNewCalendar}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <PlusSquare size={15} /> New Calendar
                    </button>
                    <button
                      onClick={handleShare}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Share2 size={15} /> Share Link
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 my-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-200/70 p-1 rounded-full">
              <button
                onClick={() => setView("monthly")}
                className={`px-4 py-2 sm:py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  view === "monthly"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setView("weekly")}
                className={`px-4 py-2 sm:py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  view === "weekly"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Weekly
              </button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-sm font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 px-3 py-2 sm:py-1.5 rounded-full transition-colors"
            >
              Today
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer order-last sm:order-none">
            <span>Full day</span>
            <input
              type="checkbox"
              checked={showFullDay}
              onChange={() => setShowFullDay(!showFullDay)}
              className="toggle-checkbox"
            />
          </label>

          <ModeToggle
            mode={selectionMode}
            setMode={setSelectionMode}
            className="hidden sm:inline-flex"
          />
        </div>

        {view === "weekly" ? (
          <WeeklyView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            allUsersAvailability={allUsersAvailability}
            user={user}
            handleSlotClick={handleSlotClick}
            getUsersInSlot={getUsersInSlot}
            handleDayClick={handleDayClick}
            today={today}
            showFullDay={showFullDay}
            openCopyModal={(date) =>
              setCopyModalInfo({ isOpen: true, sourceDate: date })
            }
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            allUsersAvailability={allUsersAvailability}
            setView={setView}
            today={today}
          />
        )}

        <footer className="mt-4 space-y-4">
          {bestTimes.length > 0 && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-base sm:text-lg mb-3 text-slate-800">
                Best Dates to Meet
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {bestTimes.map((date) => {
                  const dateString = date.toISOString().split("T")[0];
                  const note = eventNotes[dateString]?.text;
                  const isExpanded = expandedNoteDate === dateString;
                  return (
                    <div
                      key={dateString}
                      className="bg-green-50 text-green-900 p-3 rounded-xl border border-green-100"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm font-semibold">
                          {date.toLocaleString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              isExpanded
                                ? closeNoteEditor()
                                : openNoteEditor(dateString)
                            }
                            title={note ? "Edit note" : "Add a note"}
                            className="p-1.5 hover:bg-green-200/60 rounded-full transition-colors"
                          >
                            {note ? (
                              <Pencil size={14} />
                            ) : (
                              <StickyNote size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => generateGoogleCalendarLink(date)}
                            title="Add to Google Calendar"
                            className="p-1.5 hover:bg-green-200/60 rounded-full transition-colors"
                          >
                            <CalendarPlus size={14} />
                          </button>
                        </div>
                      </div>

                      {note && !isExpanded && (
                        <p className="text-xs text-green-800/80 mt-1.5 break-words">
                          {note}
                        </p>
                      )}

                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="What's the plan? (e.g. Dinner at Mike's, 7pm)"
                            maxLength={140}
                            rows={2}
                            className="w-full text-xs p-2 rounded-lg border border-green-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={closeNoteEditor}
                              className="p-1.5 hover:bg-green-200/60 rounded-full text-green-700 transition-colors"
                              aria-label="Cancel"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => saveEventNote(dateString)}
                              className="p-1.5 bg-green-600 hover:bg-green-700 rounded-full text-white transition-colors"
                              aria-label="Save note"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-base sm:text-lg mb-3 text-slate-800">
              Group Members ({totalMembers})
            </h3>
            {totalMembers === 0 ? (
              <p className="text-sm text-slate-500">
                No one's marked their availability yet. Share the link to get
                started!
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {Object.values(allUsersAvailability).map((u) => (
                  <div key={u.displayName} className="flex items-center gap-2">
                    <img
                      src={u.photoURL}
                      alt={u.displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="font-semibold text-sm">
                      {u.displayName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-400 pt-2">
            <p>
              All times are shown in your local timezone:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile-only floating availability toggle, kept within thumb's reach */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          paddingTop: "0.5rem",
        }}
      >
        <ModeToggle
          mode={selectionMode}
          setMode={setSelectionMode}
          className="pointer-events-auto shadow-lg"
        />
      </div>

      {notification && (
        <div className="fixed bottom-24 sm:bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-5 bg-slate-800 text-white py-2.5 px-4 rounded-full shadow-lg animate-fade-in-out text-sm max-w-[90vw] text-center z-50">
          {notification}
        </div>
      )}
      <style>{` @keyframes fade-in-out { 0%, 100% { opacity: 0; transform: translateY(10px); } 10%, 90% { opacity: 1; transform: translateY(0); } } .animate-fade-in-out { animation: fade-in-out 3s ease-in-out forwards; } .toggle-checkbox { appearance: none; width: 3rem; height: 1.5rem; background-color: #e2e8f0; border-radius: 9999px; position: relative; cursor: pointer; transition: background-color 0.2s ease-in-out; flex-shrink: 0; } .toggle-checkbox:checked { background-color: #3b82f6; } .toggle-checkbox::before { content: ''; position: absolute; width: 1.25rem; height: 1.25rem; background-color: white; border-radius: 9999px; top: 0.125rem; left: 0.125rem; transition: transform 0.2s ease-in-out; box-shadow: 0 1px 2px rgba(0,0,0,0.2); } .toggle-checkbox:checked::before { transform: translateX(1.5rem); } `}</style>
    </div>
  );
};

export default App;
