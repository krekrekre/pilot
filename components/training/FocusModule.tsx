'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

/* ── Task model ──────────────────────────────────────────────────────────
   Every task is the same two numbers and one of three rules. The rule says
   what to do with them twice over, and both results are typed into a single
   field, part a first, then part b, with nothing between them.

     rule 1   a) number 1 − number 2   b) positive difference of the two
     rule 2   a) number 2 − number 1   b) their sum, second digit if two digits
     rule 3   a) number 1 − number 2   b) positive sum of the two

   On −2 and 5, rule 1 gives −7 and 7, so the answer is "-77" — one string,
   graded by exact match. A minus sign stays wherever its part puts it, so a
   part b of −6 after a part a of −12 is typed "-12-6".

   The arithmetic is deliberately trivial. What the module trains is holding
   the right rule while the numbers keep coming: 1a and 3a are the identical
   sum, 1b and 3b differ only in the operation, and 2a is 1a with its sign
   flipped. Nothing here is hard to compute and everything is easy to confuse,
   which is the point.

   At most one of the two numbers is negative. That keeps every sum inside
   −8..18, so the only two-digit sums are positive and rule 2b never has to
   say what the second digit of a negative two-digit number would be.
------------------------------------------------------------------------ */

type RuleId = 1 | 2 | 3;

interface RuleDef {
  id: RuleId;
  aLabel: string;
  bLabel: string;
  aSolve: (n1: number, n2: number) => number;
  bSolve: (n1: number, n2: number) => number;
}

/* Two digits is the widest a sum gets, so "double digit" only ever means a
   leading 1 to drop. Written generally anyway — the sign survives. */
function secondDigit(v: number): number {
  return Math.abs(v) < 10 ? v : Math.sign(v) * (Math.abs(v) % 10);
}

const RULES: RuleDef[] = [
  {
    id: 1,
    aLabel: 'number 1 minus number 2 (with negatives)',
    bLabel: 'positive difference of number 1 and number 2',
    aSolve: (a, b) => a - b,
    bSolve: (a, b) => Math.abs(a - b),
  },
  {
    id: 2,
    aLabel: 'number 2 minus number 1 (with negatives)',
    bLabel: 'number 1 plus number 2 (second digit if it is a double-digit answer)',
    aSolve: (a, b) => b - a,
    bSolve: (a, b) => secondDigit(a + b),
  },
  {
    id: 3,
    aLabel: 'number 1 minus number 2 (with negatives)',
    bLabel: 'positive sum of number 1 and number 2',
    aSolve: (a, b) => a - b,
    bSolve: (a, b) => Math.abs(a + b),
  },
];

const ruleById = (id: RuleId) => RULES[id - 1];

/* The two parts, run together into the one string the field is graded on. */
const expectedFor = (rule: RuleDef, n1: number, n2: number) =>
  `${rule.aSolve(n1, n2)}${rule.bSolve(n1, n2)}`;

interface Task {
  rule: RuleId;
  n1: number;
  n2: number;
  expected: string;
  input: string | null;
  attempted: boolean;
  isCorrect: boolean;
}

interface Config {
  totalTasks: number;
  testDurationMin: number;
}

/* Fixed by the test rather than by the person sitting it: all three rules are
   in play, and the numbers run 1..9 on either side of zero. */
const ALL_RULES: RuleId[] = [1, 2, 3];
const MAX_MAGNITUDE = 9;

const DEFAULT_CONFIG: Config = {
  totalTasks: 150,
  testDurationMin: 10,
};

type Stage = 'start' | 'task' | 'results';

/* ── Generation ──────────────────────────────────────────────────────── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Both positive, or exactly one negative — never both. Zero is left out so
   that no task collapses into copying one of the numbers down. */
const SIGN_PATTERNS: [boolean, boolean][] = [[false, false], [true, false], [false, true]];

function makePair(maxMag: number): [number, number] {
  const [neg1, neg2] = pick(SIGN_PATTERNS);
  const m1 = 1 + Math.floor(Math.random() * maxMag);
  const m2 = 1 + Math.floor(Math.random() * maxMag);
  return [neg1 ? -m1 : m1, neg2 ? -m2 : m2];
}

/* The switching is the exercise, so a rule is not allowed to sit still for
   more than three tasks in a row. Left alone, a uniform draw hands out runs
   of five and six often enough to notice. */
const MAX_RUN = 3;

function buildTest(cfg: Config): Task[] {
  const tasks: Task[] = [];
  let run = 0;

  for (let i = 0; i < cfg.totalTasks; i++) {
    const previous = tasks[i - 1]?.rule;
    let rule = pick(ALL_RULES);
    while (run >= MAX_RUN && rule === previous) rule = pick(ALL_RULES);
    run = rule === previous ? run + 1 : 1;

    const [n1, n2] = makePair(MAX_MAGNITUDE);
    tasks.push({
      rule,
      n1,
      n2,
      expected: expectedFor(ruleById(rule), n1, n2),
      input: null,
      attempted: false,
      isCorrect: false,
    });
  }
  return tasks;
}

/* ── Entry ───────────────────────────────────────────────────────────── */

/* The longest answer any rule can produce is "-18-9" — five characters. One
   more than that is allowed so a mistyped sign can be backspaced away rather
   than swallowing the keystrokes that follow it. */
const MAX_LEN = 6;

/* A lone '-' is a real intermediate state, so the field holds raw text and
   only refuses to submit what could not be an answer. */
const isSubmittable = (raw: string) => /\d/.test(raw);

/* The field is a real text input, so anything can be pasted or typed into it.
   Digits and minus signs survive, a doubled minus collapses, and the length is
   capped at what the longest answer needs.

   Deliberately not <input type="number">: an answer runs the two parts
   together, which makes "06" and "-12-6" both legal and neither of them a
   number the browser would keep. */
function sanitize(raw: string): string {
  return raw.replace(/[^0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, MAX_LEN);
}

/* ── Display ─────────────────────────────────────────────────────────── */

const fmt = (v: number) => `${v}`;
const fmtPair = (n1: number, n2: number) => `${n1}, ${n2}`;

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('focus_config');
    if (!saved) return { ...DEFAULT_CONFIG };
    // Settings that used to live here are ignored; only the two below are read
    const { totalTasks, testDurationMin } = JSON.parse(saved);
    return {
      totalTasks: typeof totalTasks === 'number' ? totalTasks : DEFAULT_CONFIG.totalTasks,
      testDurationMin: typeof testDurationMin === 'number' ? testDurationMin : DEFAULT_CONFIG.testDurationMin,
    };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('focus_config', JSON.stringify(config)); } catch {}
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

/* One line of ordinary text — the numbers are the thing to read, not a
   graphic to decode. */
function NumberPair({ n1, n2, size = 'lg' }: { n1: number; n2: number; size?: 'lg' | 'sm' }) {
  return (
    <span className={size === 'lg' ? 'text-lg font-semibold text-slate-900' : 'text-slate-700'}>
      {fmtPair(n1, n2)}
    </span>
  );
}

/* The rule board, shown on the start screen and again under the results —
   laid out exactly as a task presents it, so what is learned here is what
   comes back on the clock. */
function RuleBoard() {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-left">
      {RULES.map(r => (
        <div key={r.id} className="px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Rule {r.id}:</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-slate-700 list-disc pl-5 marker:text-slate-400">
            <li>{r.aLabel}</li>
            <li>{r.bLabel}</li>
          </ul>
        </div>
      ))}
    </div>
  );
}

/* Fixed illustration for the start screen. */
const EXAMPLE: [number, number] = [-2, 5];

/* ── Module ──────────────────────────────────────────────────────────── */

export default function FocusModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.testDurationMin * 60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const inTest = stage === 'task';
  const currentTask = tasks[currentIndex];
  const currentRule = currentTask ? ruleById(currentTask.rule) : null;

  const startNewTest = useCallback((cfg: Config) => {
    setTasks(buildTest(cfg));
    setCurrentIndex(0);
    setEntry('');
    // Set here too, so the clock never flashes the previous duration for a frame
    setTimeLeft(cfg.testDurationMin * 60);
    setStage('task');
  }, []);

  const answerReady = isSubmittable(entry);

  const submit = useCallback(() => {
    if (!isSubmittable(entry)) return;
    setTasks(prev => prev.map((t, i) => (
      i === currentIndex
        ? { ...t, input: entry, attempted: true, isCorrect: entry === t.expected }
        : t
    )));
    setEntry('');
    if (currentIndex + 1 < tasks.length) setCurrentIndex(currentIndex + 1);
    else setStage('results');
  }, [entry, currentIndex, tasks.length]);

  const confirmCancel = useCallback(() => {
    setCancelModalOpen(false);
    setStage('start');
  }, []);

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  /* The field has to be live the moment a task appears, and again once the
     cancel dialog is dismissed — a test at four seconds a task cannot afford
     a click to start typing. */
  useEffect(() => {
    if (!inTest || cancelModalOpen) return;
    inputRef.current?.focus();
  }, [inTest, cancelModalOpen, currentIndex]);

  const totalTasks = tasks.length || config.totalTasks;
  const taskNum = currentIndex + 1;
  const pct = (currentIndex / totalTasks) * 100;
  const attemptedCount = tasks.filter(t => t.attempted).length;
  const correctCount = tasks.filter(t => t.isCorrect).length;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  // Record the finished session.
  const postedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'results') { postedRef.current = false; return; }
    if (postedRef.current) return;
    if (tasks.length === 0) return;
    postedRef.current = true;

    const attempted = tasks.filter(t => t.attempted).length;
    const correct = tasks.filter(t => t.isCorrect).length;

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleSlug: 'focus',
        score: correct,
        totalQuestions: tasks.length,
        // Out of what was reached — a test nobody is meant to finish would
        // otherwise report every unseen task as a miss.
        accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
        config: { ...config, attempted },
      }),
    }).catch(() => { /* a failed save must not break the results screen */ });
  }, [stage, tasks, config]);

  // Countdown timer — startNewTest seeds timeLeft, this only runs the clock down
  const totalSeconds = config.testDurationMin * 60;
  useEffect(() => {
    if (inTest) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [inTest]);

  /* Auto-end test when time expires. Every submitted task was graded on the
     way through, so there is nothing to settle here — the task on screen was
     simply never answered. */
  useEffect(() => {
    if (timeLeft === 0 && inTest) setStage('results');
  }, [timeLeft, inTest]);

  // Hide the app-level navbar during an active test
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav');
    if (!nav) return;
    nav.style.display = inTest ? 'none' : '';
    return () => { nav.style.display = ''; };
  }, [inTest]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800 antialiased select-none font-sans">

      {/* ── STICKY HEADER (test only) ── */}
      {inTest && (
        <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">

            <button
              disabled
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 text-white opacity-30 cursor-not-allowed"
            >
              <span>‹</span><span>Previous task</span>
            </button>

            <div className="flex flex-col items-center flex-1 max-w-xs mx-4">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 font-mono">{taskNum} / {totalTasks}</div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <button
              onClick={submit}
              disabled={!answerReady}
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{taskNum === totalTasks ? 'Finish test' : 'Next task'}</span><span>›</span>
            </button>

          </div>
        </header>
      )}

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col items-center justify-start max-w-4xl mx-auto w-full px-4 pt-12 pb-40">

        {/* START */}
        {stage === 'start' && (
          <div className="w-full flex flex-col items-center text-center space-y-6 max-w-2xl">
            <div className="text-left w-full space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Focus Maintaining module (RULES)</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your ability to hold a rule in mind and keep applying it correctly while the pace stays high and the rule keeps changing under you.</p>
              <p className="text-sm text-slate-600">Each task shows <span className="font-semibold text-slate-800">two numbers</span> and <span className="font-semibold text-slate-800">one rule</span>. Every rule has two parts, and both parts go into a single answer — part a first, then part b, with nothing between them.</p>
            </div>

            <RuleBoard />

            <div className="text-left w-full space-y-3">
              <p className="text-sm text-slate-600">One of the two numbers may be negative, never both. A part that comes out negative keeps its minus sign where it falls, so a part a of <span className="font-semibold text-slate-800">-12</span> followed by a part b of <span className="font-semibold text-slate-800">-6</span> is typed <span className="font-semibold text-slate-800">-12-6</span>.</p>
              <p className="text-sm text-slate-600">There are <span className="font-semibold text-slate-800">{config.totalTasks} tasks</span> and <span className="font-semibold text-slate-800">{config.testDurationMin} minutes</span>. Nobody is expected to finish — get through as many as you can without losing accuracy. A task scores only if both parts are right.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Worked example */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Example</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-2.5">
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  The task reads <span className="font-semibold text-slate-900">{fmtPair(EXAMPLE[0], EXAMPLE[1])}</span> — number 1 is <span className="font-semibold text-slate-900">{fmt(EXAMPLE[0])}</span>, number 2 is <span className="font-semibold text-slate-900">{fmt(EXAMPLE[1])}</span>. What you type depends entirely on which rule the task carries:
                </p>
                <ul className="text-[13px] text-slate-600 leading-relaxed space-y-1.5">
                  {RULES.map(r => {
                    const a = r.aSolve(EXAMPLE[0], EXAMPLE[1]);
                    const b = r.bSolve(EXAMPLE[0], EXAMPLE[1]);
                    return (
                      <li key={r.id}>
                        <span className="font-bold text-brand-500">Rule {r.id}</span>
                        {' — part a is '}<span className="font-semibold text-slate-900">{fmt(a)}</span>
                        {', part b is '}<span className="font-semibold text-slate-900">{fmt(b)}</span>
                        {', so you type '}
                        <span className="font-bold text-slate-900 font-mono">{expectedFor(r, EXAMPLE[0], EXAMPLE[1])}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Rules 1 and 3 share their part a here, and rules 2 and 3 land on the same part b. That is the trap the module is built around — the arithmetic is easy, the bookkeeping is not.
                </p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  The second-digit rule only bites once the sum reaches ten: on rule 2, <span className="font-semibold text-slate-900">8, 7</span> gives a part a of <span className="font-semibold text-slate-900">-1</span> and a sum of 15, so part b is <span className="font-semibold text-slate-900">5</span> and the answer is <span className="font-bold text-slate-900 font-mono">-15</span>.
                </p>
                <p className="text-[13px] text-slate-700 font-bold pt-1">
                  Type the answer and press Enter for the next task
                </p>
              </div>
            </div>

            {/* Inline Settings */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-left">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Settings</h3>
                <button
                  onClick={() => { setConfig({ ...DEFAULT_CONFIG }); saveConfig({ ...DEFAULT_CONFIG }); }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-500 px-3 py-1 rounded-md border border-slate-300 hover:border-brand-500/50 bg-white transition cursor-pointer"
                >
                  Reset to default
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">Customise the number of tasks and the time limit before you begin.</p>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                <SettingSlider
                  label="Tasks per Test"
                  display={`${config.totalTasks}`}
                  value={config.totalTasks}
                  min={10}
                  max={150}
                  step={5}
                  ticks={[{ value: 10, label: '10' }, { value: 80, label: '80' }, { value: 150, label: '150' }]}
                  onChange={v => updateConfig({ totalTasks: v })}
                />

                <SettingSlider
                  label="Test Duration"
                  display={`${config.testDurationMin} min`}
                  value={config.testDurationMin}
                  min={1}
                  max={20}
                  ticks={[{ value: 1, label: '1' }, { value: 10, label: '10' }, { value: 20, label: '20' }]}
                  onChange={v => updateConfig({ testDurationMin: v })}
                />

              </div>

              <p className="text-xs text-slate-500 mt-4">Use default settings for the most accurate test simulation</p>
            </div>

          </div>
        )}

        {/* TASK */}
        {stage === 'task' && currentTask && currentRule && (
          <div className="w-full flex flex-col items-start text-left space-y-6">

            {/* The rule reads as a heading over its two parts, in the order
                they are typed — no shorthand to decode on the clock. */}
            <div className="max-w-xl">
              <p className="text-base font-bold text-slate-900">Rule {currentTask.rule}:</p>
              <ul className="mt-1.5 space-y-1 text-base text-slate-700 list-disc pl-5 marker:text-slate-400">
                <li>{currentRule.aLabel}</li>
                <li>{currentRule.bLabel}</li>
              </ul>
            </div>

            <NumberPair n1={currentTask.n1} n2={currentTask.n2} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="focus-answer" className="text-xs font-semibold text-slate-500">
                Your numeric answer
              </label>
              {/* select-text overrides the module-wide select-none, so the
                  answer can still be selected and retyped over. */}
              <input
                ref={inputRef}
                id="focus-answer"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={entry}
                placeholder="Your numeric answer"
                onChange={e => setEntry(sanitize(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                className="w-64 select-text rounded-md border-2 border-brand-500 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <p className="text-xs text-slate-400">
              Type both parts as one answer ·{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-slate-600 font-bold">-</kbd> for a minus sign ·{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-slate-600 font-bold">Enter</kbd> submits
            </p>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">🎯</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this focus maintaining session:</p>
            </div>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Completed</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono tabular-nums">{attemptedCount} / {tasks.length}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Correct</div>
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 mt-1 font-mono tabular-nums">{correctCount}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Accuracy</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 font-mono tabular-nums">{accuracy}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Time Used</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono tabular-nums">{fmtDuration(totalSeconds - timeLeft)}</div>
              </div>
            </div>

            {/* Per-rule breakdown — a score that only sags on rule 2 is a
                different problem from one that sags everywhere. */}
            <div className="w-full grid grid-cols-3 gap-3">
              {RULES.map(r => {
                const seen = tasks.filter(t => t.attempted && t.rule === r.id);
                const got = seen.filter(t => t.isCorrect).length;
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rule {r.id}</div>
                    <div className="text-lg font-bold text-slate-800 mt-0.5 font-mono tabular-nums">
                      {seen.length > 0 ? `${got} / ${seen.length}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {attemptedCount === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-slate-400">No tasks were answered.</p>
              ) : (
                <div className="max-h-[26rem] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700 w-8">#</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700 w-12">Rule</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Numbers</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Your answer</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-700">Correct</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tasks.filter(t => t.attempted).map((t, i) => (
                        <tr key={i} className={`${t.isCorrect ? 'bg-emerald-50' : 'bg-rose-50'} align-middle`}>
                          <td className="px-3 py-2 font-semibold text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-700">{t.rule}</td>
                          <td className="px-3 py-2"><NumberPair n1={t.n1} n2={t.n2} size="sm" /></td>
                          <td className={`px-3 py-2 font-mono tabular-nums ${t.isCorrect ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                            {t.input ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-slate-500">{t.expected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="w-full">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">The rules again</h4>
              <RuleBoard />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-2">
              <button onClick={() => startNewTest(config)}
                className="px-8 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer">
                Retake Test
              </button>
              <button onClick={() => setStage('start')}
                className="px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer">
                Back to Settings
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── TIMER — top left during test ── */}
      {inTest && (() => {
        const TOTAL = totalSeconds;
        const R = 48;
        const C = 2 * Math.PI * R;
        const elapsed = TOTAL - timeLeft;
        const offset = C - (C * elapsed / TOTAL);
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        const urgent = timeLeft <= 60;
        /* Sits under the sticky header rather than in the true corner, so it
           never lands on the header's own controls. Read-only, so it takes no
           pointer events — it can float over the content on a narrow window
           without stealing a click. */
        return (
          <div className="fixed top-16 left-6 z-10 pointer-events-none">
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-slate-500 mb-1.5">Total time for this module</span>
              <svg width="116" height="116" viewBox="0 0 116 116">
                <circle cx="58" cy="58" r={R} fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle
                  cx="58" cy="58" r={R}
                  fill="none"
                  stroke={urgent ? '#e11d48' : 'var(--color-brand-500)'}
                  strokeWidth="5"
                  strokeDasharray={C}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 58 58)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                />
                <text
                  x="58" y="65"
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="700"
                  fontFamily="monospace"
                  fill={urgent ? '#e11d48' : 'var(--color-brand-500)'}
                >
                  {timeStr}
                </text>
              </svg>
            </div>
          </div>
        );
      })()}

      {/* ── CANCEL — bottom right during test ── */}
      {inTest && (
        <button
          onClick={() => setCancelModalOpen(true)}
          className="fixed bottom-6 right-6 z-10 text-xs font-semibold px-5 py-2 rounded-lg border border-rose-600 bg-rose-600 text-white hover:bg-white hover:text-rose-600 transition cursor-pointer shadow-sm"
        >
          Cancel test
        </button>
      )}

      {/* ── CANCEL CONFIRMATION MODAL ── */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <h3 className="text-lg font-bold text-slate-800">Cancel test?</h3>
            <p className="text-sm text-slate-500">Your progress will be lost.</p>
            <div className="flex gap-3 justify-center pt-1">
              <button
                onClick={confirmCancel}
                className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition cursor-pointer"
              >
                Yes, cancel
              </button>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-6 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                No, continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
