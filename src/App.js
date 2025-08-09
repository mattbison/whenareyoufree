import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Copy, LogOut, PlusSquare } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyADkhtS4NSsWXd2tmjHtY5ogTsRcyzpDr0",
    authDomain: "whenareyoufree-a51fa.firebaseapp.com",
    projectId: "whenareyoufree-a51fa",
    storageBucket: "whenareyoufree-a51fa.firebasestorage.app",
    messagingSenderId: "810606897689",
    appId: "1:810606897689:web:0b96563fb9b40f6b5c9888",
    measurementId: "G-5GDTHC0GNV"
};

// --- Helper Components (Defined outside App to prevent re-creation on render) ---

const WeeklyView = ({ currentDate, setCurrentDate, allUsersAvailability, user, handleSlotClick, getUsersInSlot }) => {
    const daysOfWeek = useMemo(() => Array(7).fill(0).map((_, i) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - d.getDay() + i);
        return d;
    }), [currentDate]);

    const timeSlots = useMemo(() => Array(24).fill(0).map((_, i) => `${i.toString().padStart(2, '0')}:00`), []);

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-4 p-2 sm:p-4 border-b border-gray-200">
            <button onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() - 7)))} className="p-2 rounded-md hover:bg-gray-100"><ChevronLeft size={20} /></button>
            <h2 className="text-lg font-semibold text-center">{daysOfWeek[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} - {daysOfWeek[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
            <button onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() + 7)))} className="p-2 rounded-md hover:bg-gray-100"><ChevronRight size={20} /></button>
          </div>
          
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
            <div className="grid grid-cols-[auto_repeat(7,1fr)]" style={{minWidth: '700px'}}>
              <div className="sticky top-0 left-0 bg-white z-10"></div>
              {daysOfWeek.map((day, i) => (
                <div key={i} className="sticky top-0 bg-white z-10 py-2 border-b-2 border-gray-200 text-center">
                  <p className="font-semibold text-gray-600 text-xs sm:text-sm">{day.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">{day.getDate()}</p>
                </div>
              ))}

              {timeSlots.map(time => (
                <React.Fragment key={time}>
                  <div className="sticky left-0 bg-white text-xs text-gray-500 flex items-center justify-center pl-4 pr-2 border-r border-t border-gray-200">{time}</div>
                  {daysOfWeek.map(day => {
                    const usersInSlot = getUsersInSlot(day, time);
                    const totalUsersInGroup = Object.keys(allUsersAvailability).length;
                    const isCurrentUserInSlot = user && usersInSlot.some(u => u.displayName === user.displayName);
                    const isAnyoneUnavailable = usersInSlot.some(u => u.type === 'unavailable');

                    let bgColor = 'bg-gray-50 hover:bg-gray-200';
                    if (isAnyoneUnavailable) {
                        bgColor = 'bg-red-200 hover:bg-red-300';
                    } else if (totalUsersInGroup > 0 && usersInSlot.length === totalUsersInGroup) {
                        bgColor = 'bg-green-200 hover:bg-green-300';
                    } else if (isCurrentUserInSlot) {
                        bgColor = 'bg-blue-100 hover:bg-blue-200';
                    } else if (usersInSlot.length > 0) {
                        bgColor = 'bg-yellow-100 hover:bg-yellow-200';
                    }

                    return (
                      <div key={day.toISOString()} onClick={() => handleSlotClick(day, time)} className={`h-16 border-t border-l border-gray-200 cursor-pointer transition-colors ${bgColor} p-1`}>
                        <div className="flex -space-x-2">
                          {usersInSlot.filter(u => u.type === 'available').slice(0, 3).map((u, i) => (
                            <img key={i} src={u.photoURL} alt={u.displayName} title={u.displayName} className="h-6 w-6 rounded-full border-2 border-white object-cover"/>
                          ))}
                          {isAnyoneUnavailable && <div className="h-6 w-6 rounded-full border-2 border-white bg-red-500 flex items-center justify-center text-xs font-bold text-white">!</div>}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <footer className="text-sm text-gray-600 mt-4 p-4">
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-100 border"></div><span>You're Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-100 border"></div><span>Some Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-200 border"></div><span>All Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-200 border"></div><span>Unavailable</span></div>
            </div>
          </footer>
        </div>
    );
};

const MonthlyView = ({ currentDate, setCurrentDate, allUsersAvailability, setView }) => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const calendarDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) { days.push({ key: `blank-${i}`, blank: true }); }
        for (let day = 1; day <= daysInMonth; day++) { days.push({ key: day, day, date: new Date(year, month, day) }); }
        return days;
    }, [month, year, daysInMonth, firstDayOfMonth]);

    const dayHasActivity = (day) => {
        const dayString = day.toISOString().split('T')[0];
        const activity = { available: false, unavailable: false };
        Object.values(allUsersAvailability).forEach(userData => {
            userData.slots?.forEach(slot => {
                if (slot.id.startsWith(dayString)) {
                    if (slot.type === 'available') activity.available = true;
                    if (slot.type === 'unavailable') activity.unavailable = true;
                }
            });
        });
        return activity;
    };

    const handleDayClick = (date) => {
        setCurrentDate(date);
        setView('weekly');
    };

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 rounded-md hover:bg-gray-100"><ChevronLeft size={20} /></button>
                <h2 className="text-lg font-semibold text-center">{currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 rounded-md hover:bg-gray-100"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-gray-500 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map(dayInfo => {
                    if (dayInfo.blank) return <div key={dayInfo.key}></div>;
                    
                    const activity = dayHasActivity(dayInfo.date);
                    const isToday = new Date().toDateString() === dayInfo.date.toDateString();
                    
                    let dayBgColor = 'hover:bg-gray-100';
                    if (activity.unavailable) {
                        dayBgColor = 'bg-red-100 hover:bg-red-200';
                    } else if (activity.available) {
                        dayBgColor = 'bg-green-100 hover:bg-green-200';
                    }

                    return (
                        <div key={dayInfo.key} onClick={() => handleDayClick(dayInfo.date)} className={`h-16 sm:h-24 p-2 border rounded-lg cursor-pointer transition-colors flex flex-col ${dayBgColor}`}>
                            <span className={`font-semibold ${isToday ? 'text-blue-600' : ''}`}>{dayInfo.day}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main App Component ---
const App = () => {
  // --- State Management ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [allUsersAvailability, setAllUsersAvailability] = useState({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notification, setNotification] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [view, setView] = useState('weekly');
  const [selectionMode, setSelectionMode] = useState('available');

  // --- Group ID and Firebase Initialization ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get('id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      const newUrl = `${window.location.pathname}?id=${id}${window.location.hash}`;
      try {
        window.history.replaceState({ path: newUrl }, '', newUrl);
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

  // --- Real-time Data Fetching from Firestore ---
  useEffect(() => {
    if (!isAuthReady || !db || !groupId) return;

    const availabilityCollection = collection(db, 'groups', groupId, 'availability');
    const q = query(availabilityCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const availabilityData = {};
      querySnapshot.forEach((doc) => {
        availabilityData[doc.id] = doc.data();
      });
      setAllUsersAvailability(availabilityData);
    }, (error) => {
      console.error("Error fetching real-time availability:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, groupId]);

  // --- Authentication Handlers ---
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

  // --- Calendar and Availability Logic ---
  const handleSlotClick = async (day, time) => {
    if (!user) {
      handleSignIn();
      return;
    }
    if (!db || !groupId) return;

    const slotId = `${day.toISOString().split('T')[0]}T${time}`;
    
    const usersInSlot = getUsersInSlot(day, time);
    const unavailableUser = usersInSlot.find(u => u.type === 'unavailable');
    if (unavailableUser && unavailableUser.displayName !== user.displayName) {
        setNotification("This slot is blocked by another user.");
        setTimeout(() => setNotification(''), 2000);
        return;
    }

    const userDocRef = doc(db, 'groups', groupId, 'availability', user.uid);
    const currentUserData = allUsersAvailability[user.uid] || { slots: [] };
    const existingSlot = currentUserData.slots.find(s => s.id === slotId);

    let newSlots;
    if (existingSlot) {
        if (existingSlot.type === selectionMode) {
            newSlots = currentUserData.slots.filter(s => s.id !== slotId);
        } else {
            newSlots = currentUserData.slots.map(s => s.id === slotId ? { ...s, type: selectionMode } : s);
        }
    } else {
        newSlots = [...currentUserData.slots, { id: slotId, type: selectionMode }];
    }

    if (newSlots.length === 0) {
        await deleteDoc(userDocRef);
    } else {
        await setDoc(userDocRef, { 
            slots: newSlots, 
            displayName: user.displayName, 
            photoURL: user.photoURL 
        }, { merge: true });
    }
  };

  const getUsersInSlot = (day, time) => {
    const slotId = `${day.toISOString().split('T')[0]}T${time}`;
    return Object.values(allUsersAvailability)
      .flatMap(userData => userData.slots?.filter(s => s.id === slotId).map(s => ({ ...userData, type: s.type })) || [])
      .map(userData => ({ displayName: userData.displayName, photoURL: userData.photoURL, type: userData.type }));
  };
  
  // --- UI Helper Functions ---
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        setNotification('Share link copied!');
        setTimeout(() => setNotification(''), 2000);
    });
  };

  const handleNewCalendar = () => {
      // Generate a new random ID and reload the page with it.
      const newId = Math.random().toString(36).substring(2, 10);
      window.location.href = `${window.location.pathname}?id=${newId}`;
  };

  // --- RENDER ---
  if (!isAuthReady || !groupId) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-100"><p>Loading...</p></div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans text-gray-800 p-2 sm:p-4">
      <div className="max-w-screen-xl mx-auto">
        <header className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="w-full text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shared Availability</h1>
            <p className="text-gray-500 text-sm">Select a mode, then click to mark your time.</p>
          </div>
          <div className="w-full sm:w-auto flex justify-center sm:justify-end">
            {!user ? (
              <button onClick={handleSignIn} className="flex items-center gap-2 bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-100 transition-all">
                <img src="https://www.google.com/favicon.ico" alt="Google icon" className="w-5 h-5" />
                Sign in with Google
              </button>
            ) : (
              <div className="relative">
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="rounded-full h-10 w-10 overflow-hidden border-2 border-transparent hover:border-blue-500 transition">
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/40x40/E2E8F0/4A5568?text=${user.displayName?.charAt(0) || 'U'}`}} />
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-20 py-2">
                    <div className="px-4 py-2 border-b"><p className="font-bold truncate">{user.displayName}</p><p className="text-sm text-gray-500 truncate">{user.email}</p></div>
                    <button onClick={handleNewCalendar} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><PlusSquare size={14} /> New Calendar</button>
                    <button onClick={copyShareLink} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><Copy size={14} /> Copy Share Link</button>
                    <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><LogOut size={14} /> Sign Out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setView('monthly')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'monthly' ? 'bg-white shadow' : 'text-gray-600'}`}>Monthly</button>
                <button onClick={() => setView('weekly')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'weekly' ? 'bg-white shadow' : 'text-gray-600'}`}>Weekly</button>
            </div>
            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setSelectionMode('available')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${selectionMode === 'available' ? 'bg-blue-200' : 'text-gray-600'}`}>Available</button>
                <button onClick={() => setSelectionMode('unavailable')} className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${selectionMode === 'unavailable' ? 'bg-red-300' : 'text-gray-600'}`}>Unavailable</button>
            </div>
        </div>

        {view === 'weekly' ? 
            <WeeklyView currentDate={currentDate} setCurrentDate={setCurrentDate} allUsersAvailability={allUsersAvailability} user={user} handleSlotClick={handleSlotClick} getUsersInSlot={getUsersInSlot} /> : 
            <MonthlyView currentDate={currentDate} setCurrentDate={setCurrentDate} allUsersAvailability={allUsersAvailability} setView={setView} />
        }
      </div>

      {notification && (
        <div className="fixed bottom-5 right-5 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out">
          {notification}
        </div>
      )}
      <style>{`
        @keyframes fade-in-out {
          0%, 100% { opacity: 0; transform: translateY(10px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-out { animation: fade-in-out 3s ease-in-out forwards; }
      `}</style>
    </div>
  );
};

export default App;