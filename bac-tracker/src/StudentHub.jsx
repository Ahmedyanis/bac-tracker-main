import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, BookMarked, ListChecks, CalendarDays, Check,
} from 'lucide-react';
import {
  uid, toKey, normalizeAnswer, shuffle, pickRandom,
  IconBtn, Field, inputCls, ProgressBar, EmptyState, MonthCalendarGrid,
} from './shared.jsx';
import { SUBJECTS, subjectByKey } from './subjects';

const MATH_SYMBOLS = ['√', 'x²', 'xⁿ', 'π', '∫', '∑', '÷', '∞', '±', '≤', '≥', '≠', 'θ', '×', '→'];

function emptySubjectData() {
  return { items: [], curriculum: [], log: [], quizAttempts: [] };
}

/* ================================================================== */
/*  Top-level Student Hub                                              */
/* ================================================================== */

export default function StudentHub({ subjectsData, setSubjectsData }) {
  const [selected, setSelected] = useState(SUBJECTS[0].key);
  const [subTab, setSubTab] = useState('practice'); // practice | curriculum | calendar

  const subject = subjectByKey(selected);
  const data = subjectsData?.[selected] || emptySubjectData();

  function updateData(updater) {
    setSubjectsData((prev) => {
      const prevData = prev[selected] || emptySubjectData();
      return { ...prev, [selected]: updater(prevData) };
    });
  }

  function addItem(item) {
    updateData((d) => ({ ...d, items: [...d.items, { id: uid(), ...item }] }));
  }
  function deleteItem(id) {
    updateData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  }
  function recordAttempt(mode, correct) {
    const today = toKey(new Date());
    updateData((d) => ({
      ...d,
      quizAttempts: [...d.quizAttempts, { id: uid(), date: today, mode, correct }],
      log: [...d.log, { id: uid(), date: today, type: 'quiz', label: `Quiz · ${mode}` }],
    }));
  }

  function addLesson(unit, lesson) {
    updateData((d) => ({
      ...d,
      curriculum: [...d.curriculum, { id: uid(), unit, lesson, completed: false, understanding: 0, dateCompleted: '' }],
    }));
  }
  function toggleLesson(id, completed) {
    const today = toKey(new Date());
    updateData((d) => ({
      ...d,
      curriculum: d.curriculum.map((c) =>
        c.id === id ? { ...c, completed, dateCompleted: completed ? (c.dateCompleted || today) : c.dateCompleted } : c
      ),
      log: completed
        ? [...d.log, { id: uid(), date: today, type: 'lesson', label: `Lesson done · ${d.curriculum.find((c) => c.id === id)?.lesson || ''}` }]
        : d.log,
    }));
  }
  function updateUnderstanding(id, val) {
    updateData((d) => ({ ...d, curriculum: d.curriculum.map((c) => (c.id === id ? { ...c, understanding: val } : c)) }));
  }
  function updateDateCompleted(id, date) {
    updateData((d) => ({ ...d, curriculum: d.curriculum.map((c) => (c.id === id ? { ...c, dateCompleted: date } : c)) }));
  }
  function deleteLesson(id) {
    updateData((d) => ({ ...d, curriculum: d.curriculum.filter((c) => c.id !== id) }));
  }

  return (
    <div className="px-5 pt-8 animate-fadeIn pb-28">
      <h1 className="font-display text-2xl font-semibold mb-4">Student Hub</h1>

      {/* Subject nav */}
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
        {SUBJECTS.map((s) => {
          const Icon = s.icon;
          const active = s.key === selected;
          return (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border"
              style={
                active
                  ? { background: `${s.color}22`, borderColor: s.color, color: s.color }
                  : { background: '#12151C', borderColor: '#1E222C', color: '#8B92A3' }
              }
            >
              <Icon size={14} />
              {s.short}
            </button>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#12151C] border border-[#1E222C] mb-5">
        {[
          { id: 'practice', label: 'Practice', icon: ListChecks },
          { id: 'curriculum', label: 'Curriculum', icon: BookMarked },
          { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        ].map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={active ? { background: '#1B2030', color: subject.color } : { color: '#5C6270' }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'practice' && (
        <PracticeRouter subjectKey={selected} color={subject.color} items={data.items} addItem={addItem} deleteItem={deleteItem} quizAttempts={data.quizAttempts} recordAttempt={recordAttempt} />
      )}

      {subTab === 'curriculum' && (
        <CurriculumTracker
          curriculum={data.curriculum}
          color={subject.color}
          onAdd={addLesson}
          onToggle={toggleLesson}
          onUnderstanding={updateUnderstanding}
          onDateCompleted={updateDateCompleted}
          onDelete={deleteLesson}
        />
      )}

      {subTab === 'calendar' && (
        <SubjectCalendarView log={data.log} color={subject.color} subjectLabel={subject.label} />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Shared quiz UI                                                     */
/* ================================================================== */

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F1218] border border-[#1E222C] mb-4">
      {['add', 'quiz'].map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === m ? 'bg-[#1B2030] text-[#F4F5F7]' : 'text-[#5C6270]'}`}
        >
          {m === 'add' ? 'Add items' : 'Quiz'}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0"
      style={active ? { background: `${color}22`, borderColor: color, color } : { background: 'transparent', borderColor: '#232733', color: '#8B92A3' }}
    >
      {children}
    </button>
  );
}

function ItemRow({ title, subtitle, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#0F1218] border border-[#1E222C] px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && <p className="text-xs text-[#8B92A3] truncate mt-0.5 font-mono">{subtitle}</p>}
      </div>
      <IconBtn onClick={onDelete} label="Delete" className="w-8 h-8 shrink-0 text-[#8B92A3] hover:text-[#F2536B]">
        <Trash2 size={14} />
      </IconBtn>
    </div>
  );
}

function AnalyticsPanel({ quizAttempts, color }) {
  const total = quizAttempts.length;
  const correct = quizAttempts.filter((a) => a.correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  let streak = 0;
  for (let i = quizAttempts.length - 1; i >= 0; i--) {
    if (quizAttempts[i].correct) streak++;
    else break;
  }
  const byMode = {};
  quizAttempts.forEach((a) => {
    byMode[a.mode] = byMode[a.mode] || { correct: 0, total: 0 };
    byMode[a.mode].total++;
    if (a.correct) byMode[a.mode].correct++;
  });
  const modeEntries = Object.entries(byMode).map(([mode, v]) => ({ mode, acc: Math.round((v.correct / v.total) * 100), total: v.total }));
  const weakest = modeEntries.filter((m) => m.total >= 2).sort((a, b) => a.acc - b.acc)[0];

  return (
    <div className="mt-5 rounded-2xl bg-[#12151C] border border-[#1E222C] p-4">
      <h3 className="font-display text-sm font-semibold mb-3">Scoring & analytics</h3>
      {total === 0 ? (
        <p className="text-xs text-[#8B92A3]">Answer a few quiz questions to see your accuracy and streak here.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniStat label="Accuracy" value={`${accuracy}%`} color={color} />
            <MiniStat label="Streak" value={streak} color={color} />
            <MiniStat label="Attempts" value={total} color={color} />
          </div>
          {weakest && (
            <p className="text-xs text-[#F2896B]">
              Weak area: <span className="font-medium">{weakest.mode}</span> ({weakest.acc}% over {weakest.total} tries)
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-xl bg-[#0F1218] border border-[#1E222C] p-2.5 text-center">
      <p className="font-mono text-base font-semibold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#8B92A3] mt-0.5">{label}</p>
    </div>
  );
}

function SymbolKeypadInput({ value, onChange, symbols, placeholder }) {
  const [showSymbols, setShowSymbols] = useState(false);
  const ref = useRef(null);

  function insertSymbol(sym) {
    const el = ref.current;
    if (!el) {
      onChange(value + sym);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + sym + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + sym.length;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-[#8B92A3]">Formula</label>
        <button
          type="button"
          onClick={() => setShowSymbols((s) => !s)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${showSymbols ? 'bg-[#5B8DEF33] text-[#5B8DEF]' : 'bg-[#1B2030] text-[#8B92A3]'}`}
        >
          {showSymbols ? 'Symbol pad on' : 'Symbol pad off'}
        </button>
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls + ' font-mono'}
      />
      {showSymbols && (
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {symbols.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => insertSymbol(s)}
              className="py-2 rounded-lg bg-[#1B2030] text-sm font-medium active:scale-90 transition-transform"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic quiz card: handles mcq / typed / selfgrade question types.
function QuizCard({ question, onResult, onNext, accent }) {
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  useEffect(() => {
    setSelected(null);
    setTyped('');
    setRevealed(false);
    setLocked(false);
    setIsCorrect(null);
  }, [question]);

  if (!question) {
    return <EmptyState icon={ListChecks} title="Add a few items first" body="You need at least a couple of entries in this subject before a quiz can be generated." />;
  }

  function chooseOption(opt) {
    if (locked) return;
    const correct = opt === question.correctAnswer;
    setSelected(opt);
    setLocked(true);
    setIsCorrect(correct);
    onResult(correct);
  }

  function checkTypedAnswer() {
    if (locked || !typed.trim()) return;
    const correct = question.checkTyped ? question.checkTyped(typed) : normalizeAnswer(typed) === normalizeAnswer(question.correctAnswer);
    setLocked(true);
    setRevealed(true);
    setIsCorrect(correct);
    onResult(correct);
  }

  function selfGrade(correct) {
    setLocked(true);
    setIsCorrect(correct);
    onResult(correct);
  }

  return (
    <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 animate-slideUp">
      <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: accent }}>{question.modeLabel}</p>
      <p className="text-sm font-medium mb-4 whitespace-pre-line">{question.prompt}</p>
      {question.hint && <p className="text-xs text-[#8B92A3] mb-3">{question.hint}</p>}

      {question.type === 'mcq' && (
        <div className="space-y-2">
          {question.options.map((opt, i) => {
            let cls = 'bg-[#0F1218] border-[#232733] text-[#F4F5F7]';
            if (locked) {
              if (opt === question.correctAnswer) cls = 'bg-[#0F2E22] border-[#34D399] text-[#34D399]';
              else if (opt === selected) cls = 'bg-[#2E1418] border-[#F2536B] text-[#F2536B]';
              else cls = 'bg-[#0F1218] border-[#232733] text-[#5C6270]';
            }
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => chooseOption(opt)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'typed' && (
        <div>
          {question.keypad ? (
            <SymbolKeypadInput value={typed} onChange={setTyped} symbols={question.keypad} placeholder="Type your answer" />
          ) : (
            <input
              type={question.inputMode || 'text'}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={locked}
              className={inputCls}
              placeholder="Type your answer"
            />
          )}
          {!locked && (
            <button
              onClick={checkTypedAnswer}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#F2B84B] text-[#241A05] font-semibold text-sm active:scale-95 transition-transform"
            >
              Check answer
            </button>
          )}
          {revealed && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${isCorrect ? 'bg-[#0F2E22] text-[#34D399]' : 'bg-[#2E1418] text-[#F2536B]'}`}>
              {isCorrect ? 'Correct!' : (
                <>Not quite. Correct answer: <span className="font-mono">{question.correctAnswer}</span></>
              )}
            </div>
          )}
        </div>
      )}

      {question.type === 'selfgrade' && (
        <div>
          <textarea
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={revealed}
            rows={3}
            className={inputCls}
            placeholder="Type your answer (optional), then reveal to check yourself"
          />
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#1B2030] text-[#F4F5F7] font-medium text-sm active:scale-95 transition-transform"
            >
              Reveal answer
            </button>
          )}
          {revealed && !locked && (
            <div>
              <div className="mt-3 rounded-xl p-3 text-sm bg-[#141822] text-[#F4F5F7]">
                <span className="text-[#8B92A3]">Correct answer: </span>{question.correctAnswer}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => selfGrade(true)} className="flex-1 py-2.5 rounded-xl bg-[#0F2E22] text-[#34D399] font-medium text-sm active:scale-95 transition-transform">
                  I got it right
                </button>
                <button onClick={() => selfGrade(false)} className="flex-1 py-2.5 rounded-xl bg-[#2E1418] text-[#F2536B] font-medium text-sm active:scale-95 transition-transform">
                  I got it wrong
                </button>
              </div>
            </div>
          )}
          {locked && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${isCorrect ? 'bg-[#0F2E22] text-[#34D399]' : 'bg-[#2E1418] text-[#F2536B]'}`}>
              {isCorrect ? 'Marked correct' : 'Marked incorrect — this one will show up as a weak area'}
            </div>
          )}
        </div>
      )}

      {locked && (
        <button
          onClick={onNext}
          className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
          style={{ background: accent, color: '#0A0C10' }}
        >
          Next question
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Practice router                                                    */
/* ================================================================== */

function PracticeRouter({ subjectKey, ...props }) {
  switch (subjectKey) {
    case 'history': return <HistoryPractice {...props} />;
    case 'math': return <MathPractice {...props} />;
    case 'physics': return <PhysicsPractice {...props} />;
    case 'science': return <SciencePractice {...props} />;
    case 'english': return <EnglishPractice {...props} />;
    case 'cs': return <CSPractice {...props} />;
    default: return <IslamicPractice {...props} />;
  }
}

/* ---------------------------------- Islamic Education ---------------------------------- */

function IslamicPractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [question, setQuestion] = useState(null);

  function handleAdd() {
    if (!term.trim() || !definition.trim()) return;
    addItem({ kind: 'definition', term: term.trim(), definition: definition.trim() });
    setTerm('');
    setDefinition('');
  }

  function generateQuestion() {
    if (items.length === 0) { setQuestion(null); return; }
    const t = pickRandom(items);
    setQuestion({ modeLabel: 'Terms & definitions', type: 'selfgrade', prompt: `Define / explain: ${t.term}`, correctAnswer: t.definition });
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, items.length]);

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <Field label="Term, verse, or concept">
            <input className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Zakat" />
          </Field>
          <Field label="Definition / explanation">
            <textarea rows={2} className={inputCls} value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="What it means" />
          </Field>
          <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
          </button>
          <div className="space-y-2">
            {items.map((i) => (
              <ItemRow key={i.id} title={i.term} subtitle={i.definition} onDelete={() => deleteItem(i.id)} />
            ))}
          </div>
        </div>
      ) : (
        <QuizCard question={question} onResult={(c) => recordAttempt('Terms & definitions', c)} onNext={generateQuestion} accent={color} />
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- History ---------------------------------- */

function HistoryPractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [addKind, setAddKind] = useState('date_event');
  const [quizMode, setQuizMode] = useState('date_event');
  const [question, setQuestion] = useState(null);

  const [date, setDate] = useState('');
  const [event, setEvent] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');

  const dateEvents = items.filter((i) => i.kind === 'date_event');
  const personalities = items.filter((i) => i.kind === 'personality');
  const definitions = items.filter((i) => i.kind === 'definition');

  function handleAdd() {
    if (addKind === 'date_event') {
      if (!date || !event.trim()) return;
      addItem({ kind: 'date_event', date, event: event.trim() });
      setDate(''); setEvent('');
    } else if (addKind === 'personality') {
      if (!name.trim() || !role.trim()) return;
      addItem({ kind: 'personality', name: name.trim(), role: role.trim() });
      setName(''); setRole('');
    } else {
      if (!term.trim() || !definition.trim()) return;
      addItem({ kind: 'definition', term: term.trim(), definition: definition.trim() });
      setTerm(''); setDefinition('');
    }
  }

  function generateQuestion() {
    if (quizMode === 'date_event') {
      if (dateEvents.length < 2) { setQuestion(null); return; }
      const target = pickRandom(dateEvents);
      const direction = Math.random() < 0.5 ? 'date_to_event' : 'event_to_date';
      const distractors = shuffle(dateEvents.filter((d) => d.id !== target.id)).slice(0, 3);
      const options = shuffle([target, ...distractors]).map((o) => (direction === 'date_to_event' ? o.event : o.date));
      setQuestion({
        modeLabel: 'Date ↔ Event',
        type: 'mcq',
        prompt: direction === 'date_to_event' ? `What happened on ${target.date}?` : `When did this happen: "${target.event}"?`,
        options,
        correctAnswer: direction === 'date_to_event' ? target.event : target.date,
      });
    } else if (quizMode === 'personality') {
      if (personalities.length < 2) { setQuestion(null); return; }
      const target = pickRandom(personalities);
      const distractors = shuffle(personalities.filter((p) => p.id !== target.id)).slice(0, 3);
      const options = shuffle([target, ...distractors]).map((o) => o.role);
      setQuestion({ modeLabel: 'Personality tester', type: 'mcq', prompt: `What role did ${target.name} play?`, options, correctAnswer: target.role });
    } else {
      if (definitions.length === 0) { setQuestion(null); return; }
      const target = pickRandom(definitions);
      setQuestion({ modeLabel: 'Terminology recall', type: 'selfgrade', prompt: `Define: ${target.term}`, correctAnswer: target.definition });
    }
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, quizMode, items.length]);

  const addKinds = [
    { id: 'date_event', label: 'Dates & Events' },
    { id: 'personality', label: 'Personalities & Roles' },
    { id: 'definition', label: 'Definitions' },
  ];
  const quizModes = [
    { id: 'date_event', label: 'Date ↔ Event' },
    { id: 'personality', label: 'Personality tester' },
    { id: 'definition', label: 'Terminology recall' },
  ];

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
            {addKinds.map((k) => (
              <Chip key={k.id} active={addKind === k.id} onClick={() => setAddKind(k.id)} color={color}>{k.label}</Chip>
            ))}
          </div>

          {addKind === 'date_event' && (
            <>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Event"><input className={inputCls} value={event} onChange={(e) => setEvent(e.target.value)} placeholder="What happened" /></Field>
            </>
          )}
          {addKind === 'personality' && (
            <>
              <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Personality name" /></Field>
              <Field label="Role"><input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Their role" /></Field>
            </>
          )}
          {addKind === 'definition' && (
            <>
              <Field label="Term"><input className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" /></Field>
              <Field label="Definition"><textarea rows={2} className={inputCls} value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Meaning" /></Field>
            </>
          )}
          <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
          </button>

          <div className="space-y-2">
            {addKind === 'date_event' && dateEvents.map((i) => <ItemRow key={i.id} title={i.event} subtitle={i.date} onDelete={() => deleteItem(i.id)} />)}
            {addKind === 'personality' && personalities.map((i) => <ItemRow key={i.id} title={i.name} subtitle={i.role} onDelete={() => deleteItem(i.id)} />)}
            {addKind === 'definition' && definitions.map((i) => <ItemRow key={i.id} title={i.term} subtitle={i.definition} onDelete={() => deleteItem(i.id)} />)}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
            {quizModes.map((q) => (
              <Chip key={q.id} active={quizMode === q.id} onClick={() => setQuizMode(q.id)} color={color}>{q.label}</Chip>
            ))}
          </div>
          <QuizCard question={question} onResult={(c) => recordAttempt(quizModes.find((q) => q.id === quizMode).label, c)} onNext={generateQuestion} accent={color} />
        </div>
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- Math ---------------------------------- */

function MathPractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [question, setQuestion] = useState(null);

  function handleAdd() {
    if (!name.trim() || !formula.trim()) return;
    addItem({ name: name.trim(), formula: formula.trim() });
    setName(''); setFormula('');
  }

  function generateQuestion() {
    if (items.length === 0) { setQuestion(null); return; }
    const target = pickRandom(items);
    setQuestion({
      modeLabel: 'Formula recall',
      type: 'typed',
      prompt: `Write the formula for: ${target.name}`,
      correctAnswer: target.formula,
      keypad: MATH_SYMBOLS,
      checkTyped: (v) => v.replace(/\s+/g, '') === target.formula.replace(/\s+/g, ''),
    });
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, items.length]);

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <Field label="Formula name / context"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quadratic formula" /></Field>
          <SymbolKeypadInput value={formula} onChange={setFormula} symbols={MATH_SYMBOLS} placeholder="e.g. x = (-b ± √(b²-4ac)) ÷ 2a" />
          <button onClick={handleAdd} className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
          </button>
          <div className="space-y-2">
            {items.map((i) => <ItemRow key={i.id} title={i.name} subtitle={i.formula} onDelete={() => deleteItem(i.id)} />)}
          </div>
        </div>
      ) : (
        <QuizCard question={question} onResult={(c) => recordAttempt('Formula recall', c)} onNext={generateQuestion} accent={color} />
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- Physics ---------------------------------- */

function PhysicsPractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [addKind, setAddKind] = useState('formula');
  const [quizMode, setQuizMode] = useState('formula');
  const [question, setQuestion] = useState(null);

  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [toUnit, setToUnit] = useState('');
  const [factor, setFactor] = useState('');

  const formulas = items.filter((i) => i.kind === 'formula');
  const units = items.filter((i) => i.kind === 'unit');

  function handleAdd() {
    if (addKind === 'formula') {
      if (!name.trim() || !formula.trim()) return;
      addItem({ kind: 'formula', name: name.trim(), formula: formula.trim() });
      setName(''); setFormula('');
    } else {
      if (!quantity.trim() || !unit.trim() || !toUnit.trim() || !factor) return;
      addItem({ kind: 'unit', quantity: quantity.trim(), unit: unit.trim(), toUnit: toUnit.trim(), factor: parseFloat(factor) });
      setQuantity(''); setUnit(''); setToUnit(''); setFactor('');
    }
  }

  function generateQuestion() {
    if (quizMode === 'formula') {
      if (formulas.length === 0) { setQuestion(null); return; }
      const target = pickRandom(formulas);
      setQuestion({
        modeLabel: 'Formula recall',
        type: 'typed',
        prompt: `Write the formula for: ${target.name}`,
        correctAnswer: target.formula,
        keypad: MATH_SYMBOLS,
        checkTyped: (v) => v.replace(/\s+/g, '') === target.formula.replace(/\s+/g, ''),
      });
    } else if (quizMode === 'unit') {
      if (units.length < 2) { setQuestion(null); return; }
      const target = pickRandom(units);
      const distractors = shuffle(units.filter((u) => u.id !== target.id)).slice(0, 3);
      const options = shuffle([target, ...distractors]).map((o) => o.unit);
      setQuestion({ modeLabel: 'Unit matching', type: 'mcq', prompt: `Which unit is used for: ${target.quantity}?`, options, correctAnswer: target.unit });
    } else {
      if (units.length === 0) { setQuestion(null); return; }
      const target = pickRandom(units);
      const value = Math.floor(Math.random() * 90) + 10;
      const correct = value * target.factor;
      setQuestion({
        modeLabel: 'Unit conversion',
        type: 'typed',
        inputMode: 'number',
        prompt: `Convert ${value} ${target.unit} to ${target.toUnit}`,
        hint: `1 ${target.unit} = ${target.factor} ${target.toUnit}`,
        correctAnswer: String(Math.round(correct * 100) / 100),
        checkTyped: (v) => {
          const n = parseFloat(v);
          if (Number.isNaN(n)) return false;
          return Math.abs(n - correct) <= Math.max(0.01, Math.abs(correct) * 0.01);
        },
      });
    }
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, quizMode, items.length]);

  const addKinds = [{ id: 'formula', label: 'Formulas' }, { id: 'unit', label: 'Quantities & Units' }];
  const quizModes = [
    { id: 'formula', label: 'Formula recall' },
    { id: 'unit', label: 'Unit matching' },
    { id: 'conversion', label: 'Unit conversion' },
  ];

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
            {addKinds.map((k) => <Chip key={k.id} active={addKind === k.id} onClick={() => setAddKind(k.id)} color={color}>{k.label}</Chip>)}
          </div>
          {addKind === 'formula' ? (
            <>
              <Field label="Formula name / context"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Newton's second law" /></Field>
              <SymbolKeypadInput value={formula} onChange={setFormula} symbols={MATH_SYMBOLS} placeholder="e.g. F = m × a" />
              <button onClick={handleAdd} className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
                <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
              </button>
            </>
          ) : (
            <>
              <Field label="Physical quantity"><input className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. Force" /></Field>
              <Field label="Unit"><input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. N" /></Field>
              <Field label="Convert to"><input className={inputCls} value={toUnit} onChange={(e) => setToUnit(e.target.value)} placeholder="e.g. dyn" /></Field>
              <Field label="Conversion factor (1 unit = ? convert-to)"><input type="number" className={inputCls} value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="e.g. 100000" /></Field>
              <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
                <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
              </button>
            </>
          )}
          <div className="space-y-2">
            {addKind === 'formula' && formulas.map((i) => <ItemRow key={i.id} title={i.name} subtitle={i.formula} onDelete={() => deleteItem(i.id)} />)}
            {addKind === 'unit' && units.map((i) => <ItemRow key={i.id} title={i.quantity} subtitle={`${i.unit} → ${i.toUnit} (×${i.factor})`} onDelete={() => deleteItem(i.id)} />)}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
            {quizModes.map((q) => <Chip key={q.id} active={quizMode === q.id} onClick={() => setQuizMode(q.id)} color={color}>{q.label}</Chip>)}
          </div>
          <QuizCard question={question} onResult={(c) => recordAttempt(quizModes.find((q) => q.id === quizMode).label, c)} onNext={generateQuestion} accent={color} />
        </div>
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- Science ---------------------------------- */

function SciencePractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState(['', '']);
  const [question, setQuestion] = useState(null);

  function updateStep(i, val) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  }
  function addStepField() { setSteps((prev) => [...prev, '']); }
  function removeStepField(i) { setSteps((prev) => prev.filter((_, idx) => idx !== i)); }

  function handleAdd() {
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!title.trim() || cleanSteps.length < 2) return;
    addItem({ title: title.trim(), steps: cleanSteps });
    setTitle('');
    setSteps(['', '']);
  }

  function generateQuestion() {
    const eligible = items.filter((i) => i.steps.length >= 2);
    if (eligible.length === 0) { setQuestion(null); return; }
    const target = pickRandom(eligible);
    const idx = Math.floor(Math.random() * target.steps.length);
    const rendered = target.steps.map((s, i) => (i === idx ? `${i + 1}. ?????` : `${i + 1}. ${s}`)).join('\n');
    setQuestion({
      modeLabel: 'Step recall',
      type: 'selfgrade',
      prompt: `${target.title}\n${rendered}\n\nWhat is the missing step (#${idx + 1})?`,
      correctAnswer: target.steps[idx],
    });
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, items.length]);

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <Field label="Process / structure name"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mitosis" /></Field>
          <label className="block text-xs font-medium text-[#8B92A3] mb-1.5">Steps / labels in order</label>
          <div className="space-y-2 mb-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls} value={s} onChange={(e) => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}`} />
                {steps.length > 2 && (
                  <IconBtn onClick={() => removeStepField(i)} label="Remove step" className="w-9 h-9 shrink-0 text-[#8B92A3] hover:text-[#F2536B]">
                    <Trash2 size={14} />
                  </IconBtn>
                )}
              </div>
            ))}
          </div>
          <button onClick={addStepField} className="text-xs font-medium mb-4" style={{ color }}>+ Add another step</button>
          <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add process
          </button>
          <div className="space-y-2">
            {items.map((i) => <ItemRow key={i.id} title={i.title} subtitle={`${i.steps.length} steps`} onDelete={() => deleteItem(i.id)} />)}
          </div>
        </div>
      ) : (
        <QuizCard question={question} onResult={(c) => recordAttempt('Step recall', c)} onNext={generateQuestion} accent={color} />
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- English ---------------------------------- */

function EnglishPractice({ items, addItem, deleteItem, quizAttempts, recordAttempt, color }) {
  const [mode, setMode] = useState('add');
  const [word, setWord] = useState('');
  const [arabic, setArabic] = useState('');
  const [question, setQuestion] = useState(null);

  function handleAdd() {
    if (!word.trim() || !arabic.trim()) return;
    addItem({ word: word.trim(), arabic: arabic.trim() });
    setWord(''); setArabic('');
  }

  function generateQuestion() {
    if (items.length === 0) { setQuestion(null); return; }
    const target = pickRandom(items);
    const enToAr = Math.random() < 0.5;
    if (items.length >= 4) {
      const distractors = shuffle(items.filter((i) => i.id !== target.id)).slice(0, 3);
      const options = shuffle([target, ...distractors]).map((o) => (enToAr ? o.arabic : o.word));
      setQuestion({
        modeLabel: enToAr ? 'English → Arabic' : 'Arabic → English',
        type: 'mcq',
        prompt: enToAr ? `What is the Arabic meaning of: "${target.word}"?` : `What English word means: "${target.arabic}"?`,
        options,
        correctAnswer: enToAr ? target.arabic : target.word,
      });
    } else {
      setQuestion({
        modeLabel: enToAr ? 'English → Arabic' : 'Arabic → English',
        type: 'selfgrade',
        prompt: enToAr ? `What is the Arabic meaning of: "${target.word}"?` : `What English word means: "${target.arabic}"?`,
        correctAnswer: enToAr ? target.arabic : target.word,
      });
    }
  }

  useEffect(() => { if (mode === 'quiz') generateQuestion(); /* eslint-disable-next-line */ }, [mode, items.length]);

  return (
    <div>
      <ModeSwitch mode={mode} setMode={setMode} />
      {mode === 'add' ? (
        <div>
          <Field label="English word"><input className={inputCls} value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. Diligent" /></Field>
          <Field label="Arabic definition"><input dir="rtl" className={inputCls} value={arabic} onChange={(e) => setArabic(e.target.value)} placeholder="المعنى بالعربية" /></Field>
          <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform mb-5" style={{ background: color, color: '#0A0C10' }}>
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add
          </button>
          <div className="space-y-2">
            {items.map((i) => <ItemRow key={i.id} title={i.word} subtitle={i.arabic} onDelete={() => deleteItem(i.id)} />)}
          </div>
        </div>
      ) : (
        <QuizCard question={question} onResult={(c) => recordAttempt(question?.modeLabel || 'Vocabulary', c)} onNext={generateQuestion} accent={color} />
      )}
      <AnalyticsPanel quizAttempts={quizAttempts} color={color} />
    </div>
  );
}

/* ---------------------------------- Computer Science ---------------------------------- */

function CSPractice() {
  return (
    <EmptyState title="CS Practice Module coming soon." body="Curriculum tracking and the subject calendar are already available for Computer Science." />
  );
}

/* ================================================================== */
/*  Curriculum tracker (shared across subjects)                        */
/* ================================================================== */

function CurriculumTracker({ curriculum, color, onAdd, onToggle, onUnderstanding, onDateCompleted, onDelete }) {
  const [unit, setUnit] = useState('');
  const [lesson, setLesson] = useState('');

  const total = curriculum.length;
  const completedCount = curriculum.filter((c) => c.completed).length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;

  function handleAdd() {
    if (!unit.trim() || !lesson.trim()) return;
    onAdd(unit.trim(), lesson.trim());
    setLesson('');
  }

  return (
    <div>
      <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-sm font-semibold">Syllabus completion</h3>
          <span className="font-mono text-sm font-semibold" style={{ color }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} color={color} />
        <p className="text-[11px] text-[#8B92A3] mt-2">{completedCount} of {total} lessons completed</p>
      </div>

      <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 mb-5">
        <h3 className="font-display text-sm font-semibold mb-3">Add unit / lesson</h3>
        <Field label="Unit"><input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Unit 3" /></Field>
        <Field label="Sub-lesson"><input className={inputCls} value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="e.g. Chemical bonding" /></Field>
        <button onClick={handleAdd} className="w-full py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform" style={{ background: color, color: '#0A0C10' }}>
          <Plus size={15} className="inline mr-1 -mt-0.5" /> Add lesson
        </button>
      </div>

      {curriculum.length === 0 ? (
        <EmptyState icon={BookMarked} title="No lessons yet" body="Add units and sub-lessons from your official Bac syllabus above." />
      ) : (
        <div className="space-y-2.5">
          {curriculum.map((c) => (
            <div key={c.id} className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] text-[#8B92A3] uppercase tracking-wide">{c.unit}</p>
                  <p className="text-sm font-medium truncate">{c.lesson}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onToggle(c.id, !c.completed)}
                    className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors"
                    style={c.completed ? { background: `${color}33`, borderColor: color } : { borderColor: '#232733' }}
                    aria-label="Toggle completed"
                  >
                    {c.completed && <Check size={14} style={{ color }} />}
                  </button>
                  <IconBtn onClick={() => onDelete(c.id)} label="Delete" className="w-7 h-7 text-[#8B92A3] hover:text-[#F2536B]">
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={c.understanding}
                  onChange={(e) => onUnderstanding(c.id, parseInt(e.target.value, 10))}
                  className="flex-1 accent-current"
                  style={{ color }}
                />
                <span className="font-mono text-xs w-10 text-right text-[#8B92A3]">{c.understanding}%</span>
              </div>
              {c.completed && (
                <input
                  type="date"
                  value={c.dateCompleted || ''}
                  onChange={(e) => onDateCompleted(c.id, e.target.value)}
                  className="w-full bg-[#0F1218] border border-[#232733] rounded-lg px-2.5 py-1.5 text-xs text-[#F4F5F7] outline-none focus:border-[#F2B84B]"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Subject calendar (shared across subjects)                          */
/* ================================================================== */

function SubjectCalendarView({ log, color, subjectLabel }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(toKey(new Date()));

  const eventsByDay = useMemo(() => {
    const m = {};
    log.forEach((e) => {
      if (!m[e.date]) m[e.date] = [];
      m[e.date].push({ color });
    });
    return m;
  }, [log, color]);

  const dayEvents = log.filter((e) => e.date === selectedDay).sort((a, b) => (a.id > b.id ? 1 : -1));

  return (
    <div>
      <div className="rounded-2xl bg-[#12151C] border border-[#1E222C] p-4 mb-4">
        <MonthCalendarGrid
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          eventsByDay={eventsByDay}
          accentColor={color}
        />
      </div>

      <h3 className="font-display text-sm font-semibold mb-3">{subjectLabel} activity &middot; {selectedDay}</h3>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-[#8B92A3] px-1">Nothing logged for this subject on this day.</p>
      ) : (
        <div className="space-y-2">
          {dayEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl bg-[#12151C] border border-[#1E222C] px-3.5 py-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <p className="text-sm">{e.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
