'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

/* ── Compass model ───────────────────────────────────────────────────────
   Slots are screen positions: 0 = top, then clockwise in 45° steps.
   `offset` rotates the rose, so the direction sitting at slot 0 is not
   always N — that rotation is the whole task.

   dirAt(slot) = DIRS[(slot + offset) mod 8]

   Exactly one slot is marked with a dash and its name; every other slot is
   left blank, so the name has to be carried round the dial by counting.
------------------------------------------------------------------------ */

/* Clockwise from the top. The answer list is shown in this same order. */
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

interface Question {
  offset: number;             // 0..7 — dial rotation
  labelSlot: number;          // slot carrying the single dash + name
  arrowSlot: number;          // slot the needle points at
  answer: number;             // index into DIRS
  userAnswer: number | null;
  isCorrect: boolean;
}

interface Config {
  totalQuestions: number;
  testDurationMin: number;
}

const DEFAULT_CONFIG: Config = {
  totalQuestions: 10,
  testDurationMin: 10,
};

type Stage = 'start' | 'question' | 'results';

function dirAt(slot: number, offset: number): number {
  return (slot + offset) % 8;
}

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('compass_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('compass_config', JSON.stringify(config)); } catch {}
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateQuestion(): Question {
  const offset = Math.floor(Math.random() * 8);
  const slots = Array.from({ length: 8 }, (_, i) => i);

  const labelSlot = pick(slots);
  // The needle may not sit on the marked slot, or the answer could be read
  // straight off the label instead of worked out.
  const arrowSlot = pick(slots.filter(s => s !== labelSlot));

  return {
    offset,
    labelSlot,
    arrowSlot,
    answer: dirAt(arrowSlot, offset),
    userAnswer: null,
    isCorrect: false,
  };
}

function fmtDir(i: number | null) {
  return i === null ? '—' : DIRS[i];
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

/* ── Compass face ────────────────────────────────────────────────────── */

const CENTER = 120;   // viewBox is 240 — the name sits outside the ring
const RING_R = 72;
const INK = '#0f172a';

const DASH_OUT = 15;  // how far the single dash reaches past the ring
const LABEL_R = 102;

function polar(slot: number, r: number): [number, number] {
  const a = ((slot * 45) - 90) * Math.PI / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

/* A needle, not a hand: it runs across the dial through the centre, so the
   tail is as much a cue as the head. */
function Needle({ slot }: { slot: number }) {
  const a = ((slot * 45) - 90) * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  // LEN stops just inside the ring's inner edge, so the head touches the
  // circle without breaking through it.
  const TAIL = 58, LEN = 69, HEAD = 22, HALF = 9;

  const tailX = CENTER - dx * TAIL;
  const tailY = CENTER - dy * TAIL;
  const tipX = CENTER + dx * LEN;
  const tipY = CENTER + dy * LEN;
  // The shaft stops where the head begins, so it never shows through the tip
  const baseX = CENTER + dx * (LEN - HEAD);
  const baseY = CENTER + dy * (LEN - HEAD);
  const px = -dy, py = dx;

  return (
    <g>
      <line x1={tailX} y1={tailY} x2={baseX} y2={baseY}
        stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <polygon
        points={`${tipX},${tipY} ${baseX + px * HALF},${baseY + py * HALF} ${baseX - px * HALF},${baseY - py * HALF}`}
        fill={INK}
      />
    </g>
  );
}

function CompassFace({ q, size = 300 }: { q: Question; size?: number }) {
  const [dx1, dy1] = polar(q.labelSlot, RING_R);
  const [dx2, dy2] = polar(q.labelSlot, RING_R + DASH_OUT);
  const [lx, ly] = polar(q.labelSlot, LABEL_R);

  return (
    <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label="Compass">
      <circle cx={CENTER} cy={CENTER} r={RING_R} fill="#ffffff" stroke={INK} strokeWidth={6} />

      {/* The one and only marked point on the dial */}
      <line x1={dx1} y1={dy1} x2={dx2} y2={dy2} stroke={INK} strokeWidth={5} strokeLinecap="round" />

      <text
        x={lx} y={ly}
        textAnchor="middle" dominantBaseline="central"
        fontSize={19} fontWeight={800} fill={INK}
        fontFamily="var(--font-mono), monospace"
      >
        {DIRS[dirAt(q.labelSlot, q.offset)]}
      </text>

      <Needle slot={q.arrowSlot} />
    </svg>
  );
}

/* Fixed illustration for the start screen: NW is marked at the right-hand
   slot, the needle points one slot anticlockwise from it → W. */
const EXAMPLE_Q: Question = {
  offset: 5, labelSlot: 2, arrowSlot: 1,
  answer: 6, userAnswer: null, isCorrect: false,
};

/* ── Module ──────────────────────────────────────────────────────────── */

export default function CompassModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.testDurationMin * 60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const currentQ = questions[currentQIndex];
  const answerReady = !!currentQ && currentQ.userAnswer !== null;

  const startNewTest = useCallback((cfg: Config) => {
    const qs = Array.from({ length: cfg.totalQuestions }, () => generateQuestion());
    setQuestions(qs);
    setCurrentQIndex(0);
    // Set here too, so the clock never flashes the previous duration for a frame
    setTimeLeft(cfg.testDurationMin * 60);
    setStage('question');
  }, []);

  /* One pick at a time — choosing again replaces the previous mark. */
  const selectDir = useCallback((dir: number) => {
    setQuestions(prev => prev.map((q, i) =>
      i === currentQIndex ? { ...q, userAnswer: dir } : q
    ));
  }, [currentQIndex]);

  const gradeAnswer = useCallback((qs: Question[], idx: number) => {
    return qs.map((q, i) =>
      i === idx ? { ...q, isCorrect: q.userAnswer === q.answer } : q
    );
  }, []);

  const handleNext = useCallback(() => {
    if (!answerReady) return;
    setQuestions(prev => gradeAnswer(prev, currentQIndex));
    if (currentQIndex + 1 < config.totalQuestions) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      setStage('results');
    }
  }, [answerReady, currentQIndex, config.totalQuestions, gradeAnswer]);

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

  const inTest = stage === 'question';

  // Number keys pick a direction, Enter moves on — no reaching for the mouse
  useEffect(() => {
    if (!inTest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= DIRS.length) { e.preventDefault(); selectDir(n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inTest, handleNext, selectDir]);

  const totalQ = config.totalQuestions;
  const qNum = currentQIndex + 1;
  const pct = (qNum / totalQ) * 100;
  const correctCount = questions.filter(q => q.isCorrect).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  // Record the finished session.
  const postedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'results') { postedRef.current = false; return; }
    if (postedRef.current) return;
    if (questions.length === 0) return;
    postedRef.current = true;

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleSlug: 'compass',
        score: questions.filter(q => q.isCorrect).length,
        totalQuestions: questions.length,
        accuracy: Math.round((questions.filter(q => q.isCorrect).length / questions.length) * 100),
        config,
      }),
    }).catch(() => { /* a failed save must not break the results screen */ });
  }, [stage, questions, config]);

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

  // Auto-end test when time expires
  useEffect(() => {
    if (timeLeft === 0 && inTest) {
      setQuestions(prev => gradeAnswer(prev, currentQIndex));
      setStage('results');
    }
  }, [timeLeft, inTest, gradeAnswer, currentQIndex]);

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
              <span>‹</span><span>Previous question</span>
            </button>

            <div className="flex flex-col items-center flex-1 max-w-xs mx-4">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 font-mono">{qNum} / {totalQ}</div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!answerReady}
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{qNum === totalQ ? 'Finish test' : 'Next question'}</span><span>›</span>
            </button>

          </div>
        </header>
      )}

      {/* ── MAIN ── */}
      {/* The test screen sits high and ends flush — the compass is the first
          thing read, and the cancel button is pinned to its own corner rather
          than following the list. The start and results screens are ordinary
          pages, so they keep padding under their last row of buttons. */}
      <main className={`flex-1 flex flex-col items-center justify-start max-w-4xl mx-auto w-full px-4 ${inTest ? 'pt-4' : 'pt-12 pb-16'}`}>

        {/* START */}
        {stage === 'start' && (
          <div className="w-full flex flex-col items-center text-center space-y-6 max-w-2xl">
            <div className="text-left w-full space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Spatial Orientation module (COMPASS)</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your ability to re-orient a rotated compass and read a bearing off it under time pressure.</p>
              <p className="text-sm text-slate-600">Each task shows a compass with <span className="font-semibold text-slate-800">one marked point</span>, placed at a random spot on the dial — north is rarely at the top. Use that single name as your reference to work out where the other seven directions sit, then read off where the needle points.</p>
              <p className="text-sm text-slate-600">The eight directions always run clockwise — N, NE, E, SE, S, SW, W, NW — and the needle always lands exactly on one of them. It never points at the marked direction itself.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Worked example */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Example</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col sm:flex-row items-center gap-6">
                <div className="shrink-0">
                  <CompassFace q={EXAMPLE_Q} size={190} />
                </div>
                <div className="space-y-2.5">
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The only marked point is <span className="font-bold text-slate-900">NW</span>, and it sits at the right-hand edge of the dial — so the whole compass has been turned.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    Directions run clockwise, so the point one step <span className="font-semibold text-slate-800">clockwise</span> from NW is N, the next is NE, and so on round the dial.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The needle points one step <span className="font-semibold text-slate-800">anticlockwise</span> from the NW mark, and the direction before NW is <span className="font-bold text-slate-900">W</span>.
                  </p>
                  <p className="text-[13px] text-slate-700 font-bold pt-1">
                    You would select W
                  </p>
                </div>
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
                  label="Questions per Test"
                  display={`${config.totalQuestions}`}
                  value={config.totalQuestions}
                  min={1}
                  max={25}
                  ticks={[{ value: 1, label: '1' }, { value: 10, label: '10' }, { value: 25, label: '25' }]}
                  onChange={v => updateConfig({ totalQuestions: v })}
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

        {/* QUESTION */}
        {stage === 'question' && currentQ && (
          <div className="w-full flex flex-col items-center space-y-3">
            <CompassFace q={currentQ} size={360} />

            <p className="text-sm text-slate-700">In which direction does the compass needle point?</p>

            <div className="w-full max-w-xl space-y-2">
              {DIRS.map((dir, i) => {
                const on = currentQ.userAnswer === i;
                return (
                  <button
                    key={dir}
                    onClick={() => selectDir(i)}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 transition cursor-pointer ${
                      on
                        ? 'border-brand-500 bg-brand-500/8'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* aria-pressed on the button carries the state — the dot
                        is decoration and is present even when unpicked */}
                    <span aria-hidden="true" className={`w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center ${
                      on ? 'border-brand-500' : 'border-slate-300'
                    }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-brand-500' : 'bg-transparent'}`} />
                    </span>
                    <span className="text-sm font-medium tracking-[0.1em] text-slate-900">{dir}</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-300">{i + 1}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-400">Keys 1–{DIRS.length} pick a direction, Enter moves on.</p>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">🧭</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this compass reading session:</p>
            </div>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Score</div>
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 mt-1 font-mono tabular-nums">{correctCount} / {questions.length}</div>
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
            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700 w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Compass</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Reference</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Answer</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Yours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((q, i) => (
                    <tr key={i} className={`${q.isCorrect ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-rose-50 hover:bg-rose-100'} transition`}>
                      <td className="px-3 py-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-2 py-2"><CompassFace q={q} size={92} /></td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{DIRS[dirAt(q.labelSlot, q.offset)]}</td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-800">{fmtDir(q.answer)}</td>
                      <td className={`px-3 py-3 font-mono font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {fmtDir(q.userAnswer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
           pointer events — it can float over the compass on a narrow window
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
