import React from 'react';
import { X } from 'lucide-react';

/* ---------------------------------- constants ---------------------------------- */

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const SUBJECT_COLORS = [
  '#F2B84B', '#34D399', '#5B8DEF', '#F2536B',
  '#B980F0', '#4FD1C5', '#FB923C', '#F472B6',
];

/* ---------------------------------- helpers ---------------------------------- */

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatDateLabel(key) {
  const d = fromKey(key);
  const today = startOfDay(new Date());
  const tmr = addDays(today, 1);
  if (toKey(d) === toKey(today)) return 'Today';
  if (toKey(d) === toKey(tmr)) return 'Tomorrow';
  return `${DAY_LABELS[d.getDay()]}, ${MONTH_LABELS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function normalizeAnswer(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"]/g, '');
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------------------------------- small UI atoms ---------------------------------- */

export function IconBtn({ onClick, children, className = '', label }) {
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

export function ModalShell({ children, onClose, title }) {
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

export function ConfirmModal({ title, body, confirmLabel, danger, onCancel, onConfirm }) {
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

export function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-[#8B92A3] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full bg-[#0F1218] border border-[#232733] rounded-xl px-3.5 py-2.5 text-sm text-[#F4F5F7] placeholder-[#5C6270] outline-none focus:border-[#F2B84B] transition-colors';

export function ProgressBar({ pct, color = '#F2B84B' }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="w-full h-2 rounded-full bg-[#1B2030] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

/* ---------------------------------- month calendar grid ---------------------------------- */
// Generic month grid. `eventsByDay` maps 'YYYY-MM-DD' -> array of { color } used to render
// up to 3 small dots per day cell. Caller renders its own list for the selected day.

export function MonthCalendarGrid({ monthCursor, setMonthCursor, selectedDay, setSelectedDay, eventsByDay, accentColor = '#F2B84B' }) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <IconBtn
          onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          label="Previous month"
          className="w-8 h-8 bg-[#12151C] border border-[#1E222C] text-[#8B92A3]"
        >
          <ChevronLeftIcon />
        </IconBtn>
        <h3 className="font-display text-sm font-semibold">
          {MONTH_LABELS[month]} {year}
        </h3>
        <IconBtn
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          label="Next month"
          className="w-8 h-8 bg-[#12151C] border border-[#1E222C] text-[#8B92A3]"
        >
          <ChevronRightIcon />
        </IconBtn>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] text-[#5C6270] font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dateKey = toKey(new Date(year, month, d));
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDay;
          const evs = eventsByDay[dateKey] || [];
          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDay(dateKey)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-colors ${
                isSelected ? '' : isToday ? 'bg-[#141822]' : ''
              }`}
              style={isSelected ? { background: `${accentColor}26`, border: `1px solid ${accentColor}` } : undefined}
            >
              <span className={`text-xs ${isToday && !isSelected ? 'font-semibold' : ''}`} style={isToday ? { color: accentColor } : undefined}>
                {d}
              </span>
              {evs.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {evs.slice(0, 3).map((e, idx) => (
                    <span key={idx} className="w-1 h-1 rounded-full" style={{ background: e.color }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="mt-6 text-center py-12 px-4 rounded-3xl bg-[#12151C] border border-[#1E222C]">
      {Icon && <Icon className="mx-auto text-[#8B92A3] mb-3" size={26} />}
      <p className="font-display text-base font-semibold mb-1">{title}</p>
      {body && <p className="text-[#8B92A3] text-sm">{body}</p>}
    </div>
  );
}
