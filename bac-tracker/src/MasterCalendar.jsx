import React, { useState, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { toKey, MonthCalendarGrid, EmptyState } from './shared.jsx';
import { SUBJECTS } from './subjects';

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

const STATUS_LABEL = { scheduled: 'Scheduled', attended: 'Attended', cancelled: 'Cancelled' };

export default function MasterCalendar({ allSessions, teacherMap, payments, subjectsData }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(toKey(new Date()));

  const events = useMemo(() => {
    const out = [];

    allSessions.forEach((s) => {
      const teacher = teacherMap[s.teacherId];
      if (!teacher) return;
      out.push({
        id: `session_${s.id}`,
        date: s.date,
        color: teacher.color,
        category: 'Tutor session',
        label: `${teacher.subject} · ${teacher.name}`,
        detail: `${formatTime12(s.time)} · ${STATUS_LABEL[s.status] || s.status}`,
      });
    });

    payments.forEach((p) => {
      const teacher = teacherMap[p.teacherId];
      out.push({
        id: `payment_${p.id}`,
        date: p.date,
        color: '#F2B84B',
        category: 'Payment',
        label: `${formatDZD(p.amount)} paid${teacher ? ' · ' + teacher.name : ''}`,
        detail: 'Pack payment logged',
      });
    });

    SUBJECTS.forEach((subj) => {
      const log = subjectsData?.[subj.key]?.log || [];
      log.forEach((e) => {
        out.push({
          id: `study_${subj.key}_${e.id}`,
          date: e.date,
          color: subj.color,
          category: subj.label,
          label: e.label,
          detail: subj.label,
        });
      });
    });

    return out;
  }, [allSessions, teacherMap, payments, subjectsData]);

  const eventsByDay = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      if (!m[e.date]) m[e.date] = [];
      m[e.date].push({ color: e.color });
    });
    return m;
  }, [events]);

  const dayEvents = events.filter((e) => e.date === selectedDay).sort((a, b) => (a.category > b.category ? 1 : -1));

  return (
    <div className="px-5 pt-8 animate-fadeIn pb-28">
      <h1 className="font-display text-2xl font-semibold mb-1">Master Calendar</h1>
      <p className="text-[#8B92A3] text-sm mb-5">Tutor sessions, payments, and study activity in one place.</p>

      <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 mb-4">
        <MonthCalendarGrid
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          eventsByDay={eventsByDay}
          accentColor="#F2B84B"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        <LegendChip color="#F2B84B" label="Payment" />
        <LegendChip color="#8B92A3" label="Tutor session (teacher color)" />
        {SUBJECTS.map((s) => (
          <LegendChip key={s.key} color={s.color} label={s.short} />
        ))}
      </div>

      <h3 className="font-display text-sm font-semibold mb-3">{selectedDay}</h3>
      {dayEvents.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing on this day" body="Tutor sessions, payments, and study activity will show up here." />
      ) : (
        <div className="space-y-2">
          {dayEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-[#12151C] border border-[#1E222C] px-3.5 py-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.label}</p>
                <p className="text-xs text-[#8B92A3] truncate mt-0.5">{e.category}{e.detail ? ` · ${e.detail}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendChip({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#12151C] border border-[#1E222C]">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[10px] text-[#8B92A3] font-medium">{label}</span>
    </div>
  );
}
