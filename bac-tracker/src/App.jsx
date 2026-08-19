import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Home, Users, Calendar as CalendarIcon, Wallet, Plus, X, Phone, MessageCircle,
  Check, XCircle, Clock, ChevronLeft, ChevronRight, Bell, MapPin, Edit2, Trash2,
  RotateCcw, CheckCircle2, AlertTriangle, TrendingUp, Ticket, ArrowUpRight,
  ArrowDownRight, CalendarPlus, BellRing, Sparkles, LogOut, Cloud, CloudOff, Mail, Lock
} from 'lucide-react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/* ---------------------------------- constants ---------------------------------- */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SUBJECT_COLORS = [
  '#F2B84B', '#34D399', '#5B8DEF', '#F2536B',
  '#B980F0', '#4FD1C5', '#FB923C', '#F472B6',
];

const STORAGE_KEY = 'bac-tracker-v1';

/* ---------------------------------- helpers ---------------------------------- */

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDZD(n) {
  const v = Math.round(n || 0);
  return `${v.toLocaleString('en-US')} DA`;
}

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateLabel(key) {
  const d = fromKey(key);
  const today = startOfDay(new Date());
  const tmr = addDays(today, 1);
  if (toKey(d) === toKey(today)) return 'Today';
  if (toKey(d) === toKey(tmr)) return 'Tomorrow';
  return `${DAY_LABELS[d.getDay()]}, ${MONTH_LABELS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function combineDateTime(dateKey, time) {
  const [h, m] = (time || '00:00').split(':').map(Number);
  const d = fromKey(dateKey);
  d.setHours(h, m, 0, 0);
  return d;
}

function normalizePhone(phone) {
  return (phone || '').replace(/[^\d+]/g, '');
}

/* ---------------------------------- storage ---------------------------------- */

async function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* no data yet */
  }
  return null;
}

async function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    /* best effort */
  }
}

/* ---------------------------------- session generation ---------------------------------- */

// Builds the combined, flattened list of session instances (recurring + one-off)
// for a date range, applying any stored overrides (attended / cancelled / rescheduled).
function generateSessions(teachers, overrides, oneOffs, rangeStart, rangeEnd) {
  const out = [];

  teachers.forEach((t) => {
    (t.weeklySlots || []).forEach((slot) => {
      let d = startOfDay(rangeStart);
      const end = startOfDay(rangeEnd);
      while (d <= end) {
        if (d.getDay() === slot.day) {
          const dateStr = toKey(d);
          const instId = `${t.id}_${slot.id}_${dateStr}`;
          const ov = overrides[instId];
          if (ov && ov.status === 'rescheduled' && ov.movedTo) {
            out.push({
              id: instId,
              teacherId: t.id,
              date: ov.movedTo.date,
              time: ov.movedTo.time,
              status: 'scheduled',
              rescheduledFrom: dateStr,
              source: 'recurring',
            });
          } else if (ov) {
            out.push({
              id: instId,
              teacherId: t.id,
              date: dateStr,
              time: slot.time,
              status: ov.status,
              source: 'recurring',
            });
          } else {
            out.push({
              id: instId,
              teacherId: t.id,
              date: dateStr,
              time: slot.time,
              status: 'scheduled',
              source: 'recurring',
            });
          }
        }
        d = addDays(d, 1);
      }
    });
  });

  oneOffs.forEach((s) => {
    const inRange = s.date >= toKey(rangeStart) && s.date <= toKey(rangeEnd);
    if (inRange) out.push({ ...s, source: 'oneoff' });
  });

  out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return out;
}

/* ---------------------------------- small UI atoms ---------------------------------- */

function IconBtn({ onClick, children, className = '', label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 ${className}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const map = {
    scheduled: { bg: 'bg-[#1B2030]', text: 'text-[#8B92A3]', label: 'Scheduled' },
    attended: { bg: 'bg-[#0F2E22]', text: 'text-[#34D399]', label: 'Attended' },
    cancelled: { bg: 'bg-[#2E1418]', text: 'text-[#F2536B]', label: 'Cancelled' },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// Signature element: a "ticket stub" style 4-segment pack tracker
function PackTicket({ count, color, size = 'md' }) {
  const segs = [0, 1, 2, 3];
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  return (
    <div className="flex items-center gap-1.5">
      {segs.map((i) => {
        const filled = i < count;
        return (
          <div
            key={i}
            className={`${dim} rounded-md border transition-all duration-300 flex items-center justify-center relative`}
            style={{
              borderColor: filled ? color : '#2A2F3B',
              background: filled ? `${color}26` : 'transparent',
              boxShadow: filled ? `0 0 10px ${color}55` : 'none',
            }}
          >
            {filled && (
              <div className="rounded-sm" style={{ width: '45%', height: '45%', background: color }} />
            )}
            {i < 3 && (
              <div
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
                style={{ background: '#0A0C10', border: '1px solid #2A2F3B' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  const [teachers, setTeachers] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [oneOffs, setOneOffs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState('home');
  const [teacherModal, setTeacherModal] = useState(null); // null | 'new' | teacherId
  const [confirmDelete, setConfirmDelete] = useState(null); // teacherId
  const [actionModal, setActionModal] = useState(null); // session obj
  const [rescheduleFor, setRescheduleFor] = useState(null); // session obj
  const [oneOffModal, setOneOffModal] = useState(null); // { date } | null
  const [payConfirm, setPayConfirm] = useState(null); // teacherId
  const [selectedDay, setSelectedDay] = useState(toKey(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [toast, setToast] = useState(null);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const notifiedRef = useRef(new Set());

  /* ---- auth state ---- */
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [syncState, setSyncState] = useState('idle'); // idle | synced | offline
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  /* ---- instant local cache while Firestore connects, so the UI isn't empty ---- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cached = await loadData();
      if (cached) {
        setTeachers(cached.teachers || []);
        setOverrides(cached.overrides || {});
        setOneOffs(cached.oneOffs || []);
        setPayments(cached.payments || []);
      }
    })();
  }, [user]);

  /* ---- live Firestore subscription — this is what keeps phones in sync ---- */
  useEffect(() => {
    if (!user) {
      setLoaded(false);
      return;
    }
    const ref = doc(db, 'households', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        remoteUpdateRef.current = true;
        setTeachers(data?.teachers || []);
        setOverrides(data?.overrides || {});
        setOneOffs(data?.oneOffs || []);
        setPayments(data?.payments || []);
        setLoaded(true);
        setSyncState('synced');
      },
      () => {
        setLoaded(true);
        setSyncState('offline');
      }
    );
    return unsub;
  }, [user]);

  /* ---- push local changes to Firestore (debounced), skip the echo from onSnapshot ---- */
  useEffect(() => {
    if (!loaded || !user) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      saveData({ teachers, overrides, oneOffs, payments });
      return;
    }
    const t = setTimeout(async () => {
      saveData({ teachers, overrides, oneOffs, payments });
      try {
        await setDoc(doc(db, 'households', user.uid), {
          teachers, overrides, oneOffs, payments, updatedAt: Date.now(),
        });
        setSyncState('synced');
      } catch (e) {
        setSyncState('offline');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [teachers, overrides, oneOffs, payments, loaded, user]);

  /* ---- toast auto-dismiss ---- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- generated sessions over a wide window ---- */
  const rangeStart = useMemo(() => addDays(new Date(), -60), []);
  const rangeEnd = useMemo(() => addDays(new Date(), 90), []);
  const allSessions = useMemo(
    () => generateSessions(teachers, overrides, oneOffs, rangeStart, rangeEnd),
    [teachers, overrides, oneOffs, rangeStart, rangeEnd]
  );

  const teacherMap = useMemo(() => {
    const m = {};
    teachers.forEach((t) => (m[t.id] = t));
    return m;
  }, [teachers]);

  const todayKey = toKey(new Date());
  const todaySessions = useMemo(
    () => allSessions.filter((s) => s.date === todayKey),
    [allSessions, todayKey]
  );

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return allSessions
      .filter((s) => s.status === 'scheduled' && combineDateTime(s.date, s.time) >= now)
      .slice(0, 8);
  }, [allSessions]);

  /* ---- reminder polling ---- */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      allSessions.forEach((s) => {
        if (s.status !== 'scheduled') return;
        const dt = combineDateTime(s.date, s.time);
        const diffMin = (dt - now) / 60000;
        [60, 30].forEach((mark) => {
          const key = `${s.id}_${mark}`;
          if (diffMin <= mark && diffMin > mark - 1 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            const teacher = teacherMap[s.teacherId];
            const msg = `${teacher ? teacher.subject + ' with ' + teacher.name : 'Session'} in ${mark} min`;
            setToast(msg);
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                new Notification('Upcoming session', { body: msg });
              } catch (e) {}
            }
          }
        });
      });
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [allSessions, teacherMap]);

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  /* ---- derived: due teachers ---- */
  const dueTeachers = useMemo(
    () =>
      teachers.filter((t) => {
        const count = t.packCount || 0;
        return t.dueTiming === 'first' ? count >= 1 : count >= 4;
      }),
    [teachers]
  );

  const totalSpent = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);
  const monthSpent = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return payments.filter((p) => p.date.startsWith(ym)).reduce((s, p) => s + p.amount, 0);
  }, [payments]);
  const unpaidSessionsCount = useMemo(
    () => teachers.reduce((s, t) => s + (t.packCount || 0), 0),
    [teachers]
  );
  const spentPerTeacher = useMemo(() => {
    const m = {};
    payments.forEach((p) => {
      m[p.teacherId] = (m[p.teacherId] || 0) + p.amount;
    });
    return m;
  }, [payments]);

  /* ---------------------------------- mutation handlers ---------------------------------- */

  function upsertTeacher(t) {
    setTeachers((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      if (exists) return prev.map((x) => (x.id === t.id ? t : x));
      return [...prev, t];
    });
  }

  function deleteTeacher(id) {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setOverrides((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (!k.startsWith(id + '_')) next[k] = v;
      });
      return next;
    });
    setOneOffs((prev) => prev.filter((s) => s.teacherId !== id));
    setConfirmDelete(null);
  }

  function applySessionStatus(session, newStatus) {
    const wasAttended = session.status === 'attended';
    const willAttend = newStatus === 'attended';

    if (session.source === 'recurring') {
      setOverrides((prev) => ({ ...prev, [session.id]: { status: newStatus } }));
    } else {
      setOneOffs((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, status: newStatus } : s))
      );
    }

    if (wasAttended !== willAttend) {
      setTeachers((prev) =>
        prev.map((t) => {
          if (t.id !== session.teacherId) return t;
          let count = t.packCount || 0;
          count = willAttend ? Math.min(4, count + 1) : Math.max(0, count - 1);
          return { ...t, packCount: count };
        })
      );
    }
    setActionModal(null);
  }

  function applyReschedule(session, newDate, newTime) {
    if (session.source === 'recurring') {
      const baseId = session.rescheduledFrom ? session.id : session.id;
      setOverrides((prev) => ({
        ...prev,
        [baseId]: { status: 'rescheduled', movedTo: { date: newDate, time: newTime } },
      }));
    } else {
      setOneOffs((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, date: newDate, time: newTime } : s))
      );
    }
    setRescheduleFor(null);
    setActionModal(null);
    setToast('Session rescheduled');
  }

  function addOneOff(session) {
    setOneOffs((prev) => [...prev, { id: uid(), status: 'scheduled', ...session }]);
    setOneOffModal(null);
    setToast('Session added');
  }

  function markPackPaid(teacherId) {
    const t = teacherMap[teacherId];
    if (!t) return;
    const amount = t.rateType === 'pack' ? t.fee : t.fee * 4;
    setPayments((prev) => [
      ...prev,
      { id: uid(), teacherId, amount, date: toKey(new Date()) },
    ]);
    setTeachers((prev) => prev.map((x) => (x.id === teacherId ? { ...x, packCount: 0 } : x)));
    setPayConfirm(null);
    setToast(`${formatDZD(amount)} logged for ${t.name}`);
  }

  /* ---------------------------------- render ---------------------------------- */

  if (!authChecked || (user && !loaded)) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#F2B84B] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div
      className="min-h-screen bg-[#0A0C10] text-[#F4F5F7] flex justify-center"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slideUp { animation: slideUp 0.25s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>

      <div className="w-full max-w-md min-h-screen relative pb-24 flex flex-col">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-slideUp">
            <div className="bg-[#171B24] border border-[#2A2F3B] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
              <BellRing size={18} className="text-[#F2B84B] shrink-0" />
              <span className="text-sm text-[#F4F5F7]">{toast}</span>
            </div>
          </div>
        )}

        {tab === 'home' && (
          <HomeView
            teachers={teachers}
            todaySessions={todaySessions}
            upcomingSessions={upcomingSessions}
            teacherMap={teacherMap}
            dueTeachers={dueTeachers}
            monthSpent={monthSpent}
            unpaidSessionsCount={unpaidSessionsCount}
            notifPermission={notifPermission}
            onRequestNotif={requestNotifPermission}
            onOpenSession={setActionModal}
            onGoTeachers={() => setTab('teachers')}
            onPay={(id) => setPayConfirm(id)}
            syncState={syncState}
            userEmail={user.email}
            onSignOut={() => signOut(auth)}
          />
        )}

        {tab === 'teachers' && (
          <TeachersView
            teachers={teachers}
            onAdd={() => setTeacherModal('new')}
            onEdit={(id) => setTeacherModal(id)}
            onDelete={(id) => setConfirmDelete(id)}
            onPay={(id) => setPayConfirm(id)}
          />
        )}

        {tab === 'calendar' && (
          <CalendarView
            monthCursor={monthCursor}
            setMonthCursor={setMonthCursor}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            allSessions={allSessions}
            teacherMap={teacherMap}
            onOpenSession={setActionModal}
            onAddOneOff={() => setOneOffModal({ date: selectedDay })}
            teachers={teachers}
          />
        )}

        {tab === 'ledger' && (
          <LedgerView
            totalSpent={totalSpent}
            monthSpent={monthSpent}
            unpaidSessionsCount={unpaidSessionsCount}
            teachers={teachers}
            spentPerTeacher={spentPerTeacher}
            payments={payments}
            teacherMap={teacherMap}
          />
        )}

        <BottomNav tab={tab} setTab={setTab} />

        {/* ---- modals ---- */}
        {teacherModal && (
          <TeacherFormModal
            teacher={teacherModal === 'new' ? null : teacherMap[teacherModal]}
            onClose={() => setTeacherModal(null)}
            onSave={(t) => {
              upsertTeacher(t);
              setTeacherModal(null);
            }}
          />
        )}

        {confirmDelete && (
          <ConfirmModal
            title="Delete teacher?"
            body={`This removes ${teacherMap[confirmDelete]?.name || 'this teacher'} and their session history. This can't be undone.`}
            confirmLabel="Delete"
            danger
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => deleteTeacher(confirmDelete)}
          />
        )}

        {payConfirm && teacherMap[payConfirm] && (
          <ConfirmModal
            title="Mark pack as paid?"
            body={`Log a payment of ${formatDZD(
              teacherMap[payConfirm].rateType === 'pack'
                ? teacherMap[payConfirm].fee
                : teacherMap[payConfirm].fee * 4
            )} for ${teacherMap[payConfirm].name} and reset the cycle to 0/4.`}
            confirmLabel="Mark paid"
            onCancel={() => setPayConfirm(null)}
            onConfirm={() => markPackPaid(payConfirm)}
          />
        )}

        {actionModal && (
          <SessionActionModal
            session={actionModal}
            teacher={teacherMap[actionModal.teacherId]}
            onClose={() => setActionModal(null)}
            onAttended={() => applySessionStatus(actionModal, 'attended')}
            onCancelled={() => applySessionStatus(actionModal, 'cancelled')}
            onUndo={() => applySessionStatus(actionModal, 'scheduled')}
            onReschedule={() => setRescheduleFor(actionModal)}
          />
        )}

        {rescheduleFor && (
          <RescheduleModal
            session={rescheduleFor}
            onClose={() => setRescheduleFor(null)}
            onSave={(date, time) => applyReschedule(rescheduleFor, date, time)}
          />
        )}

        {oneOffModal && (
          <OneOffModal
            defaultDate={oneOffModal.date}
            teachers={teachers}
            onClose={() => setOneOffModal(null)}
            onSave={addOneOff}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Home ---------------------------------- */

function HomeView({
  teachers, todaySessions, upcomingSessions, teacherMap, dueTeachers,
  monthSpent, unpaidSessionsCount, notifPermission, onRequestNotif,
  onOpenSession, onGoTeachers, onPay, syncState, userEmail, onSignOut,
}) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const [showAccount, setShowAccount] = useState(false);

  return (
    <div className="px-5 pt-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[#8B92A3] text-sm">{greeting}</p>
          <h1 className="font-display text-2xl font-semibold mt-0.5">Bac Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <IconBtn
              onClick={onRequestNotif}
              label="Enable notifications"
              className="w-10 h-10 bg-[#141822] border border-[#232733] text-[#F2B84B]"
            >
              <Bell size={18} />
            </IconBtn>
          )}
          <IconBtn
            onClick={() => setShowAccount(true)}
            label="Account"
            className="w-10 h-10 bg-[#141822] border border-[#232733]"
          >
            {syncState === 'synced' ? (
              <Cloud size={17} className="text-[#34D399]" />
            ) : (
              <CloudOff size={17} className="text-[#8B92A3]" />
            )}
          </IconBtn>
        </div>
      </div>

      {showAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 animate-fadeIn" onClick={() => setShowAccount(false)} />
          <div className="relative w-full max-w-sm bg-[#171B24] border border-[#232733] rounded-2xl p-5 animate-slideUp">
            <h3 className="font-display font-semibold text-base mb-1">Synced account</h3>
            <p className="text-sm text-[#8B92A3] mb-1">Signed in as</p>
            <p className="text-sm font-medium mb-4 break-all">{userEmail}</p>
            <p className="text-xs text-[#5C6270] mb-5">
              {syncState === 'synced'
                ? 'Data is syncing live. Sign in with this same email and password on another phone to see the same teachers, sessions, and payments there.'
                : "Couldn't reach the sync server — changes are saved on this phone and will sync once you're back online."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAccount(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#1B2030] text-[#F4F5F7] text-sm font-medium active:scale-95 transition-transform"
              >
                Close
              </button>
              <button
                onClick={onSignOut}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2E1418] text-[#F2536B] text-sm font-semibold active:scale-95 transition-transform"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {teachers.length === 0 ? (
        <div className="mt-10 text-center py-14 px-4 rounded-3xl bg-[#12151C] border border-[#1E222C]">
          <Sparkles className="mx-auto text-[#F2B84B] mb-3" size={28} />
          <p className="font-display text-lg font-semibold mb-1">Set up your first teacher</p>
          <p className="text-[#8B92A3] text-sm mb-5">Add a subject, a weekly slot, and a rate to start tracking sessions and payments.</p>
          <button
            onClick={onGoTeachers}
            className="px-5 py-2.5 rounded-xl bg-[#F2B84B] text-[#241A05] font-medium text-sm active:scale-95 transition-transform"
          >
            Add a teacher
          </button>
        </div>
      ) : (
        <>
          {dueTeachers.length > 0 && (
            <div className="mt-5 space-y-2">
              {dueTeachers.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl px-4 py-3 flex items-center justify-between border animate-slideUp"
                  style={{ background: '#2E1A14', borderColor: '#4A2A1F' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle size={18} className="text-[#F2896B] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#FFDCC9] truncate">Payment due &middot; {t.subject}</p>
                      <p className="text-xs text-[#C99A85] truncate">{t.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onPay(t.id)}
                    className="shrink-0 ml-2 px-3 py-1.5 rounded-lg bg-[#F2896B] text-[#2E1A14] text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Pay
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4">
              <p className="text-[#8B92A3] text-xs mb-1.5">Spent this month</p>
              <p className="font-mono text-lg font-semibold text-[#34D399]">{formatDZD(monthSpent)}</p>
            </div>
            <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4">
              <p className="text-[#8B92A3] text-xs mb-1.5">Unpaid sessions</p>
              <p className="font-mono text-lg font-semibold text-[#F2B84B]">{unpaidSessionsCount}</p>
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold">Today</h2>
              <span className="text-xs text-[#8B92A3]">{DAY_LABELS_FULL[now.getDay()]}, {MONTH_LABELS[now.getMonth()]} {now.getDate()}</span>
            </div>
            {todaySessions.length === 0 ? (
              <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-5 text-center">
                <p className="text-[#8B92A3] text-sm">No sessions scheduled today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todaySessions.map((s) => (
                  <SessionRow key={s.id} session={s} teacher={teacherMap[s.teacherId]} onClick={() => onOpenSession(s)} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-7">
            <h2 className="font-display text-base font-semibold mb-3">Coming up</h2>
            {upcomingSessions.filter((s) => s.date !== todayKeyFor(now)).length === 0 ? (
              <p className="text-[#8B92A3] text-sm px-1">Nothing else scheduled soon.</p>
            ) : (
              <div className="space-y-2">
                {upcomingSessions
                  .filter((s) => s.date !== todayKeyFor(now))
                  .slice(0, 5)
                  .map((s) => (
                    <SessionRow key={s.id} session={s} teacher={teacherMap[s.teacherId]} onClick={() => onOpenSession(s)} showDate />
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function todayKeyFor(now) {
  return toKey(now);
}

function SessionRow({ session, teacher, onClick, showDate }) {
  if (!teacher) return null;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl bg-[#12151C] border border-[#1E222C] p-3.5 text-left active:scale-[0.98] transition-transform"
    >
      <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: teacher.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{teacher.subject}</p>
          <StatusPill status={session.status} />
        </div>
        <p className="text-xs text-[#8B92A3] truncate mt-0.5">{teacher.name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm text-[#F4F5F7]">{formatTime12(session.time)}</p>
        {showDate && <p className="text-[10px] text-[#8B92A3] mt-0.5">{formatDateLabel(session.date)}</p>}
      </div>
    </button>
  );
}

/* ---------------------------------- Teachers ---------------------------------- */

function TeachersView({ teachers, onAdd, onEdit, onDelete, onPay }) {
  return (
    <div className="px-5 pt-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Teachers</h1>
        <IconBtn onClick={onAdd} label="Add teacher" className="w-10 h-10 bg-[#F2B84B] text-[#241A05]">
          <Plus size={20} />
        </IconBtn>
      </div>

      {teachers.length === 0 ? (
        <div className="mt-10 text-center py-14 px-4 rounded-3xl bg-[#12151C] border border-[#1E222C]">
          <Users className="mx-auto text-[#8B92A3] mb-3" size={28} />
          <p className="text-[#8B92A3] text-sm">No teachers yet. Tap + to add one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} onEdit={() => onEdit(t.id)} onDelete={() => onDelete(t.id)} onPay={() => onPay(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherCard({ teacher, onEdit, onDelete, onPay }) {
  const isDue = teacher.dueTiming === 'first' ? (teacher.packCount || 0) >= 1 : (teacher.packCount || 0) >= 4;
  const perSession = teacher.rateType === 'session' ? teacher.fee : teacher.fee / 4;

  return (
    <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 animate-slideUp">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-semibold text-sm shrink-0"
            style={{ background: `${teacher.color}22`, color: teacher.color }}
          >
            {teacher.subject.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{teacher.name}</p>
            <p className="text-xs text-[#8B92A3] truncate">{teacher.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn onClick={onEdit} label="Edit" className="w-8 h-8 text-[#8B92A3] hover:text-[#F4F5F7]">
            <Edit2 size={15} />
          </IconBtn>
          <IconBtn onClick={onDelete} label="Delete" className="w-8 h-8 text-[#8B92A3] hover:text-[#F2536B]">
            <Trash2 size={15} />
          </IconBtn>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <PackTicket count={teacher.packCount || 0} color={teacher.color} />
        <span className="font-mono text-xs text-[#8B92A3]">{teacher.packCount || 0}/4</span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-[#8B92A3]">
        <span className="font-mono">{formatDZD(perSession)}/session</span>
        {teacher.location && (
          <span className="flex items-center gap-1 truncate">
            <MapPin size={11} className="shrink-0" /> <span className="truncate">{teacher.location}</span>
          </span>
        )}
      </div>

      {isDue && (
        <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: '#2E1A14' }}>
          <span className="text-xs font-medium text-[#FFDCC9] flex items-center gap-1.5">
            <AlertTriangle size={13} /> Payment due
          </span>
          <button onClick={onPay} className="px-3 py-1 rounded-lg bg-[#F2896B] text-[#2E1A14] text-xs font-semibold active:scale-95 transition-transform">
            Mark paid
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {teacher.phone && (
          <>
            <a
              href={`tel:${normalizePhone(teacher.phone)}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#1B2030] text-[#F4F5F7] text-xs font-medium active:scale-95 transition-transform"
            >
              <Phone size={13} /> Call
            </a>
            <a
              href={`https://wa.me/${normalizePhone(teacher.phone).replace('+', '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#0F2E22] text-[#34D399] text-xs font-medium active:scale-95 transition-transform"
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Calendar ---------------------------------- */

function CalendarView({
  monthCursor, setMonthCursor, selectedDay, setSelectedDay,
  allSessions, teacherMap, onOpenSession, onAddOneOff, teachers,
}) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionsByDay = useMemo(() => {
    const m = {};
    allSessions.forEach((s) => {
      if (!m[s.date]) m[s.date] = [];
      m[s.date].push(s);
    });
    return m;
  }, [allSessions]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const selectedSessions = (sessionsByDay[selectedDay] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const todayKey = toKey(new Date());

  return (
    <div className="px-5 pt-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold">Calendar</h1>
        <IconBtn onClick={onAddOneOff} label="Add session" className="w-10 h-10 bg-[#F2B84B] text-[#241A05]" disabled={teachers.length === 0}>
          <CalendarPlus size={18} />
        </IconBtn>
      </div>

      <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4">
        <div className="flex items-center justify-between mb-4">
          <IconBtn
            onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
            label="Previous month"
            className="w-8 h-8 text-[#8B92A3] hover:text-[#F4F5F7]"
          >
            <ChevronLeft size={18} />
          </IconBtn>
          <p className="font-display font-semibold text-sm">{MONTH_LABELS[month]} {year}</p>
          <IconBtn
            onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
            label="Next month"
            className="w-8 h-8 text-[#8B92A3] hover:text-[#F4F5F7]"
          >
            <ChevronRight size={18} />
          </IconBtn>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] text-[#5C6270] font-medium py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = toKey(d);
            const daySessions = sessionsByDay[key] || [];
            const colors = [...new Set(daySessions.map((s) => teacherMap[s.teacherId]?.color).filter(Boolean))].slice(0, 3);
            const isSelected = key === selectedDay;
            const isToday = key === todayKey;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 ${
                  isSelected ? 'bg-[#F2B84B]' : isToday ? 'bg-[#1B2030]' : ''
                }`}
              >
                <span
                  className={`text-xs ${isSelected ? 'text-[#241A05] font-semibold' : isToday ? 'text-[#F2B84B] font-semibold' : 'text-[#C9CDD6]'}`}
                >
                  {d.getDate()}
                </span>
                {colors.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {colors.map((c, idx) => (
                      <div key={idx} className="w-1 h-1 rounded-full" style={{ background: isSelected ? '#241A05' : c }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-base font-semibold mb-3">{formatDateLabel(selectedDay)}</h2>
        {selectedSessions.length === 0 ? (
          <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-5 text-center">
            <p className="text-[#8B92A3] text-sm">No sessions this day</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedSessions.map((s) => (
              <SessionRow key={s.id} session={s} teacher={teacherMap[s.teacherId]} onClick={() => onOpenSession(s)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Ledger ---------------------------------- */

function LedgerView({ totalSpent, monthSpent, unpaidSessionsCount, teachers, spentPerTeacher, payments, teacherMap }) {
  const sortedPayments = useMemo(
    () => payments.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [payments]
  );

  return (
    <div className="px-5 pt-8 animate-fadeIn">
      <h1 className="font-display text-2xl font-semibold mb-5">Ledger</h1>

      <div className="rounded-2xl p-5 bg-gradient-to-br border" style={{ background: '#141822', borderColor: '#232733' }}>
        <p className="text-[#8B92A3] text-xs mb-1.5">Total spent</p>
        <p className="font-mono text-3xl font-semibold text-[#F4F5F7]">{formatDZD(totalSpent)}</p>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#232733]">
          <div className="flex-1">
            <p className="text-[10px] text-[#8B92A3] mb-1">This month</p>
            <p className="font-mono text-sm font-medium text-[#34D399]">{formatDZD(monthSpent)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[#8B92A3] mb-1">Unpaid sessions</p>
            <p className="font-mono text-sm font-medium text-[#F2B84B]">{unpaidSessionsCount}</p>
          </div>
        </div>
      </div>

      {teachers.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-base font-semibold mb-3">By teacher</h2>
          <div className="space-y-2">
            {teachers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl bg-[#12151C] border border-[#1E222C] p-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-[#8B92A3] truncate">{t.subject}</p>
                  </div>
                </div>
                <p className="font-mono text-sm shrink-0">{formatDZD(spentPerTeacher[t.id] || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 mb-4">
        <h2 className="font-display text-base font-semibold mb-3">Payment history</h2>
        {sortedPayments.length === 0 ? (
          <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-5 text-center">
            <p className="text-[#8B92A3] text-sm">No payments logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPayments.map((p) => {
              const t = teacherMap[p.teacherId];
              return (
                <div key={p.id} className="flex items-center justify-between rounded-2xl bg-[#12151C] border border-[#1E222C] p-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: '#0F2E2233' }}
                    >
                      <ArrowUpRight size={14} className="text-[#34D399]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t ? t.name : 'Deleted teacher'}</p>
                      <p className="text-xs text-[#8B92A3]">{formatDateLabel(p.date)}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-[#34D399] shrink-0">{formatDZD(p.amount)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Bottom nav ---------------------------------- */

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'teachers', icon: Users, label: 'Teachers' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'ledger', icon: Wallet, label: 'Ledger' },
  ];
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40">
      <div className="rounded-2xl bg-[#12151C]/95 backdrop-blur border border-[#1E222C] flex items-center justify-around py-2 shadow-2xl">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200"
            >
              <Icon size={20} className={active ? 'text-[#F2B84B]' : 'text-[#5C6270]'} strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[10px] font-medium ${active ? 'text-[#F2B84B]' : 'text-[#5C6270]'}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- Modal shell ---------------------------------- */

function ModalShell({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#12151C] border-t border-[#232733] rounded-t-3xl max-h-[88vh] overflow-y-auto animate-slideUp">
        <div className="sticky top-0 bg-[#12151C] flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#1E222C]">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <IconBtn onClick={onClose} label="Close" className="w-8 h-8 bg-[#1B2030] text-[#8B92A3]">
            <X size={16} />
          </IconBtn>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 animate-fadeIn" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[#171B24] border border-[#232733] rounded-2xl p-5 animate-slideUp">
        <h3 className="font-display font-semibold text-base mb-2">{title}</h3>
        <p className="text-sm text-[#8B92A3] mb-5">{body}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-[#1B2030] text-[#F4F5F7] text-sm font-medium active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform ${
              danger ? 'bg-[#F2536B] text-[#2E0F16]' : 'bg-[#F2B84B] text-[#241A05]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Form field atoms ---------------------------------- */

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-[#8B92A3] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-[#0F1218] border border-[#232733] rounded-xl px-3.5 py-2.5 text-sm text-[#F4F5F7] placeholder-[#5C6270] outline-none focus:border-[#F2B84B] transition-colors';

/* ---------------------------------- Teacher form modal ---------------------------------- */

function TeacherFormModal({ teacher, onClose, onSave }) {
  const [name, setName] = useState(teacher?.name || '');
  const [subject, setSubject] = useState(teacher?.subject || '');
  const [color, setColor] = useState(teacher?.color || SUBJECT_COLORS[0]);
  const [fee, setFee] = useState(teacher?.fee ?? '');
  const [rateType, setRateType] = useState(teacher?.rateType || 'session');
  const [location, setLocation] = useState(teacher?.location || '');
  const [dueTiming, setDueTiming] = useState(teacher?.dueTiming || 'last');
  const [phone, setPhone] = useState(teacher?.phone || '');
  const [slots, setSlots] = useState(teacher?.weeklySlots?.length ? teacher.weeklySlots : [{ id: uid(), day: 2, time: '17:00' }]);
  const [error, setError] = useState('');

  function addSlot() {
    setSlots((prev) => [...prev, { id: uid(), day: 2, time: '17:00' }]);
  }
  function updateSlot(id, patch) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSlot(id) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSave() {
    if (!name.trim() || !subject.trim()) {
      setError('Name and subject are required.');
      return;
    }
    if (!fee || Number(fee) <= 0) {
      setError('Enter a valid fee amount.');
      return;
    }
    if (slots.length === 0) {
      setError('Add at least one weekly slot.');
      return;
    }
    setError('');
    onSave({
      id: teacher?.id || uid(),
      name: name.trim(),
      subject: subject.trim(),
      color,
      fee: Number(fee),
      rateType,
      location: location.trim(),
      dueTiming,
      phone: phone.trim(),
      weeklySlots: slots,
      packCount: teacher?.packCount || 0,
    });
  }

  return (
    <ModalShell title={teacher ? 'Edit teacher' : 'Add teacher'} onClose={onClose}>
      <Field label="Teacher name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mr. Belkacem" />
      </Field>

      <Field label="Subject">
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
      </Field>

      <Field label="Subject color">
        <div className="flex items-center gap-2 flex-wrap">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-transform active:scale-90"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px #0A0C10, 0 0 0 4px ${c}` : 'none' }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fee amount (DZD)">
          <input className={inputCls} type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="1500" />
        </Field>
        <Field label="Rate type">
          <select className={inputCls} value={rateType} onChange={(e) => setRateType(e.target.value)}>
            <option value="session">Per session</option>
            <option value="pack">Per 4-session pack</option>
          </select>
        </Field>
      </div>

      <Field label="Location / address">
        <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Downtown center" />
      </Field>

      <Field label="Payment due">
        <select className={inputCls} value={dueTiming} onChange={(e) => setDueTiming(e.target.value)}>
          <option value="first">First session of pack</option>
          <option value="last">Last session of pack</option>
        </select>
      </Field>

      <Field label="Phone / WhatsApp number">
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+213 5xx xxx xxx" />
      </Field>

      <Field label="Weekly recurring slots">
        <div className="space-y-2">
          {slots.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <select
                className={inputCls + ' flex-1'}
                value={s.day}
                onChange={(e) => updateSlot(s.id, { day: Number(e.target.value) })}
              >
                {DAY_LABELS_FULL.map((d, idx) => (
                  <option key={idx} value={idx}>{d}</option>
                ))}
              </select>
              <input
                type="time"
                className={inputCls + ' w-28'}
                value={s.time}
                onChange={(e) => updateSlot(s.id, { time: e.target.value })}
              />
              <IconBtn onClick={() => removeSlot(s.id)} label="Remove slot" className="w-9 h-9 text-[#8B92A3] hover:text-[#F2536B] shrink-0">
                <X size={16} />
              </IconBtn>
            </div>
          ))}
        </div>
        <button onClick={addSlot} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#F2B84B]">
          <Plus size={14} /> Add another slot
        </button>
      </Field>

      {error && <p className="text-xs text-[#F2536B] mb-3">{error}</p>}

      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-[#F2B84B] text-[#241A05] font-semibold text-sm active:scale-[0.98] transition-transform mt-2"
      >
        {teacher ? 'Save changes' : 'Add teacher'}
      </button>
    </ModalShell>
  );
}

/* ---------------------------------- Session action modal ---------------------------------- */

function SessionActionModal({ session, teacher, onClose, onAttended, onCancelled, onUndo, onReschedule }) {
  if (!teacher) return null;
  const dt = combineDateTime(session.date, session.time);
  return (
    <ModalShell title="Session" onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-semibold text-sm shrink-0"
          style={{ background: `${teacher.color}22`, color: teacher.color }}
        >
          {teacher.subject.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{teacher.subject} &middot; {teacher.name}</p>
          <p className="text-xs text-[#8B92A3] flex items-center gap-1 mt-0.5">
            <Clock size={11} /> {formatDateLabel(session.date)} at {formatTime12(session.time)}
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <StatusPill status={session.status} />
        {session.rescheduledFrom && (
          <span className="text-[11px] text-[#8B92A3]">moved from {formatDateLabel(session.rescheduledFrom)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={onAttended}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#0F2E22] text-[#34D399] font-medium text-sm active:scale-95 transition-transform"
        >
          <CheckCircle2 size={20} /> Attended
        </button>
        <button
          onClick={onCancelled}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#2E1418] text-[#F2536B] font-medium text-sm active:scale-95 transition-transform"
        >
          <XCircle size={20} /> Cancelled
        </button>
      </div>
      <button
        onClick={onReschedule}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1B2030] text-[#F4F5F7] font-medium text-sm active:scale-95 transition-transform mb-2"
      >
        <RotateCcw size={16} /> Reschedule
      </button>
      {session.status !== 'scheduled' && (
        <button
          onClick={onUndo}
          className="w-full py-2.5 rounded-xl text-xs text-[#8B92A3] font-medium active:scale-95 transition-transform"
        >
          Undo &middot; set back to scheduled
        </button>
      )}
    </ModalShell>
  );
}

function RescheduleModal({ session, onClose, onSave }) {
  const [date, setDate] = useState(session.date);
  const [time, setTime] = useState(session.time);
  const [error, setError] = useState('');

  function handleSave() {
    if (!date || !time) {
      setError('Pick a date and time.');
      return;
    }
    onSave(date, time);
  }

  return (
    <ModalShell title="Reschedule session" onClose={onClose}>
      <Field label="New date">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="New time">
        <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      {error && <p className="text-xs text-[#F2536B] mb-3">{error}</p>}
      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-[#F2B84B] text-[#241A05] font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        Save new time
      </button>
      <p className="text-[11px] text-[#5C6270] mt-3 text-center">This only moves this one lesson &mdash; future recurring slots stay the same.</p>
    </ModalShell>
  );
}

/* ---------------------------------- Auth screen ---------------------------------- */

function AuthScreen() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const map = {
        'auth/invalid-email': 'That email address looks invalid.',
        'auth/user-not-found': 'No account with that email. Try creating one instead.',
        'auth/wrong-password': 'Wrong password.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/email-already-in-use': 'An account already exists with that email — sign in instead.',
        'auth/weak-password': 'Password needs at least 6 characters.',
      };
      setError(map[err.code] || 'Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#0A0C10] text-[#F4F5F7] flex justify-center"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
      `}</style>
      <div className="w-full max-w-md min-h-screen flex flex-col justify-center px-6">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F2B84B22] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-[#F2B84B]" size={26} />
          </div>
          <h1 className="font-display text-2xl font-semibold">Bac Tracker</h1>
          <p className="text-[#8B92A3] text-sm mt-1.5">
            {mode === 'signin' ? 'Sign in to sync your teachers and sessions.' : 'Create an account to sync across your phones.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-5">
          <Field label="Email">
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6270]" />
              <input
                type="email"
                autoComplete="email"
                className={inputCls + ' pl-10'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6270]" />
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className={inputCls + ' pl-10'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </Field>

          {error && <p className="text-xs text-[#F2536B] mb-3">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-[#F2B84B] text-[#241A05] font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
          className="mt-5 text-sm text-[#8B92A3] text-center"
        >
          {mode === 'signin' ? (
            <>No account yet? <span className="text-[#F2B84B] font-medium">Create one</span></>
          ) : (
            <>Already have an account? <span className="text-[#F2B84B] font-medium">Sign in</span></>
          )}
        </button>

        <p className="text-[11px] text-[#5C6270] text-center mt-6 leading-relaxed">
          Sign in with the same email and password on another phone to see the same data there, live.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- One-off session modal ---------------------------------- */

function OneOffModal({ defaultDate, teachers, onClose, onSave }) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('17:00');
  const [error, setError] = useState('');

  function handleSave() {
    if (!teacherId) {
      setError('Select a teacher.');
      return;
    }
    if (!date || !time) {
      setError('Pick a date and time.');
      return;
    }
    onSave({ teacherId, date, time });
  }

  if (teachers.length === 0) {
    return (
      <ModalShell title="Add session" onClose={onClose}>
        <p className="text-sm text-[#8B92A3]">Add a teacher first before scheduling a one-off session.</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Add one-off session" onClose={onClose}>
      <Field label="Teacher">
        <select className={inputCls} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name} &middot; {t.subject}</option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Time">
        <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      {error && <p className="text-xs text-[#F2536B] mb-3">{error}</p>}
      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-[#F2B84B] text-[#241A05] font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        Add session
      </button>
      <p className="text-[11px] text-[#5C6270] mt-3 text-center">This adds an extra lesson without changing the weekly template.</p>
    </ModalShell>
  );
}
