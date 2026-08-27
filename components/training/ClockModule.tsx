'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

/* ── Clock model ─────────────────────────────────────────────────────────
   Positions are screen slots: 0 = top, then clockwise in 30° steps.
   `offset` rotates the dial, so the hour printed at slot 0 is not always 12.

   hourAt(pos) = ((pos + offset) mod 12) or 12

   Both hands land exactly on a dash — the minute hand never sits between
   marks, so every answer is a whole 5-minute increment.
------------------------------------------------------------------------ */

interface Question {
  offset: number;      // 0..11 — dial rotation
  labelPos: number;    // slot showing the single printed number
  hourPos: number;     // slot the hour hand points at
  minutePos: number;   // slot the minute hand points at
  hour: number;        // 1..12
  minute: number;      // 0,5,…,55
  userHour: number | null;
  userMinute: number | null;
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

function hourAt(pos: number, offset: number): number {
  return ((pos + offset) % 12) || 12;
}

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('clock_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('clock_config', JSON.stringify(config)); } catch {}
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateQuestion(): Question {
  const offset = Math.floor(Math.random() * 12);
  const slots = Array.from({ length: 12 }, (_, i) => i);

  const labelPos = pick(slots);
  // Neither hand may point at the slot that already shows a number …
  const free = slots.filter(p => p !== labelPos);
  const hourPos = pick(free);
  // … and the two hands must not overlap, or the dial would be unreadable.
  const minutePos = pick(free.filter(p => p !== hourPos));

  return {
    offset,
    labelPos,
    hourPos,
    minutePos,
    hour: hourAt(hourPos, offset),
    minute: (hourAt(minutePos, offset) % 12) * 5,
    userHour: null,
    userMinute: null,
    isCorrect: false,
  };
}

/* The answer is one field holding four digits — 0525. The colon belongs to the
   mask, not to the value, so it can never be typed over or backspaced away. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

function maskTime(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length < 2) return digits;
  // The colon appears as soon as the hour is complete, and stays put
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function fmtTime(h: number | null, m: number | null) {
  if (h === null || m === null) return '—';
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

/* ── Clock face ──────────────────────────────────────────────────────── */

const CENTER = 110;   // viewBox is 220 — the numbers sit outside the dial
const DIAL_R = 84;
const INK = '#0f172a';

const HOUR_LEN = 46;
const MINUTE_LEN = 70;

function polar(pos: number, r: number): [number, number] {
  const a = ((pos * 30) - 90) * Math.PI / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

/* Both hands are the same arrow — only the length separates hour from minute. */
function Hand({ pos, length }: { pos: number; length: number }) {
  const a = ((pos * 30) - 90) * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const HEAD = 16, HALF = 7;

  const tipX = CENTER + dx * length;
  const tipY = CENTER + dy * length;
  // The shaft stops where the head begins, so it never shows through the tip
  const baseX = CENTER + dx * (length - HEAD);
  const baseY = CENTER + dy * (length - HEAD);
  const px = -dy, py = dx;

  return (
    <g>
      <line x1={CENTER} y1={CENTER} x2={baseX} y2={baseY}
        stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <polygon
        points={`${tipX},${tipY} ${baseX + px * HALF},${baseY + py * HALF} ${baseX - px * HALF},${baseY - py * HALF}`}
        fill={INK}
      />
    </g>
  );
}

function ClockFace({ q, size = 300 }: { q: Question; size?: number }) {
  const [lx, ly] = polar(q.labelPos, 100);

  return (
    <svg width={size} height={size} viewBox="0 0 220 220" role="img" aria-label="Clock face">
      <circle cx={CENTER} cy={CENTER} r={DIAL_R} fill="#ffffff" stroke={INK} strokeWidth={3} />

      {Array.from({ length: 12 }, (_, p) => {
        // Top / right / bottom / left get the long dashes. They stop exactly at
        // the minute arrow's reach, so the tip meets the dash without crossing it.
        const cardinal = p % 3 === 0;
        const [x1, y1] = polar(p, cardinal ? MINUTE_LEN : DIAL_R - 9);
        const [x2, y2] = polar(p, DIAL_R);
        return (
          <line key={p} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={INK} strokeWidth={cardinal ? 4 : 3} />
        );
      })}

      <text
        x={lx} y={ly}
        textAnchor="middle" dominantBaseline="central"
        fontSize={20} fontWeight={800} fill={INK}
        fontFamily="var(--font-mono), monospace"
      >
        {hourAt(q.labelPos, q.offset)}
      </text>

      <Hand pos={q.minutePos} length={MINUTE_LEN} />
      <Hand pos={q.hourPos} length={HOUR_LEN} />

      <circle cx={CENTER} cy={CENTER} r={5.5} fill={INK} />
    </svg>
  );
}

/* Fixed illustration for the start screen: the printed 2 sits at the
   lower-right dash, the short arrow is on 10, the long arrow on 6 → 10:30. */
const EXAMPLE_Q: Question = {
  offset: 10, labelPos: 4, hourPos: 0, minutePos: 8,
  hour: 10, minute: 30, userHour: null, userMinute: null, isCorrect: false,
};

/* ── Module ──────────────────────────────────────────────────────────── */

export default function ClockModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeInput, setTimeInput] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.testDurationMin * 60);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  // Hour is readable at two digits; minutes only once all four are in
  const hourNum = timeInput.length >= 2 ? parseInt(timeInput.slice(0, 2), 10) : null;
  const minuteNum = timeInput.length === 4 ? parseInt(timeInput.slice(2), 10) : null;
  const hourValid = hourNum !== null && hourNum >= 1 && hourNum <= 12;
  const minuteValid = minuteNum !== null && minuteNum >= 0 && minuteNum <= 59;
  const answerReady = timeInput.length === 4 && hourValid && minuteValid;
  const showInvalid = (hourNum !== null && !hourValid) || (minuteNum !== null && !minuteValid);

  // An incomplete entry is recorded as no answer at all
  const parsedHour = answerReady ? hourNum : null;
  const parsedMinute = answerReady ? minuteNum : null;

  const startNewTest = useCallback((cfg: Config) => {
    const qs = Array.from({ length: cfg.totalQuestions }, () => generateQuestion());
    setQuestions(qs);
    setCurrentQIndex(0);
    setTimeInput('');
    // Set here too, so the clock never flashes the previous duration for a frame
    setTimeLeft(cfg.testDurationMin * 60);
    setStage('question');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const submitAnswer = useCallback((qs: Question[], idx: number, h: number | null, m: number | null) => {
    return qs.map((q, i) => {
      if (i !== idx) return q;
      return { ...q, userHour: h, userMinute: m, isCorrect: h === q.hour && m === q.minute };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (!answerReady) return;
    const updated = submitAnswer(questions, currentQIndex, parsedHour, parsedMinute);
    setQuestions(updated);
    if (currentQIndex + 1 < config.totalQuestions) {
      setCurrentQIndex(currentQIndex + 1);
      setTimeInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setStage('results');
    }
  }, [answerReady, questions, currentQIndex, parsedHour, parsedMinute, config.totalQuestions, submitAnswer]);

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
        moduleSlug: 'clock',
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
      setQuestions(prev => submitAnswer(prev, currentQIndex, parsedHour, parsedMinute));
      setStage('results');
    }
  }, [timeLeft, inTest, submitAnswer, currentQIndex, parsedHour, parsedMinute]);

  // Hide the app-level navbar during an active test
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav');
    if (!nav) return;
    nav.style.display = inTest ? 'none' : '';
    return () => { nav.style.display = ''; };
  }, [inTest]);

  const currentQ = questions[currentQIndex];

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
      <main className="flex-1 flex flex-col items-center justify-start max-w-4xl mx-auto w-full px-4 pt-12 pb-40">

        {/* START */}
        {stage === 'start' && (
          <div className="w-full flex flex-col items-center text-center space-y-6 max-w-2xl">
            <div className="text-left w-full space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Spatial Orientation module (CLOCK)</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your ability to re-orient a rotated dial and read it under time pressure.</p>
              <p className="text-sm text-slate-600">Each task shows a clock with twelve dashes but only <span className="font-semibold text-slate-800">one printed number</span>, placed at a random slot — 12 is rarely at the top. Use that single number as your reference to work out where every other hour sits, then read the time off the two hands.</p>
              <p className="text-sm text-slate-600">Both arrows always land exactly on a dash, so every answer is a whole 5-minute increment. The shorter arrow is the hour, the longer one the minutes. Neither ever points at the printed number.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Worked example */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Example</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col sm:flex-row items-center gap-6">
                <div className="shrink-0">
                  <ClockFace q={EXAMPLE_Q} size={190} />
                </div>
                <div className="space-y-2.5">
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The only printed number is <span className="font-bold text-slate-900">2</span>, and it sits at the lower-right dash. Counting clockwise from there, the dash at the top is <span className="font-bold text-slate-900">10</span>.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The <span className="font-semibold text-slate-800">shorter arrow</span> points at that top dash, so the hour is <span className="font-bold text-slate-900">10</span>.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The <span className="font-semibold text-slate-800">longer arrow</span> points four dashes clockwise from the 2, which is <span className="font-bold text-slate-900">6</span> — and 6 × 5 = <span className="font-bold text-slate-900">30</span> minutes.
                  </p>
                  <p className="text-[13px] text-slate-700 font-bold pt-1">
                    You would type 10 : 30
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
          <div className="w-full flex flex-col items-center space-y-6">
            <p className="text-sm text-slate-700">What time is shown on the clock?</p>

            <ClockFace q={currentQ} size={300} />

            <div className="flex flex-col items-center gap-1.5">
              <label htmlFor="clock-time" className="text-xs font-bold text-slate-700">Time</label>
              <input
                ref={inputRef}
                id="clock-time"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="--:--"
                value={maskTime(timeInput)}
                onChange={e => setTimeInput(digitsOnly(e.target.value))}
                onKeyDown={e => {
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    // Drop a digit, never the colon
                    e.preventDefault();
                    setTimeInput(d => d.slice(0, -1));
                    return;
                  }
                  if (e.key === 'Enter') { e.preventDefault(); handleNext(); }
                }}
                // Entry is strictly left to right, so the caret stays at the end
                onSelect={e => {
                  const el = e.currentTarget;
                  const end = el.value.length;
                  if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
                }}
                className={`w-48 text-center text-3xl tracking-[0.15em] font-mono font-bold text-slate-900 border-2 rounded-md py-3 px-3 focus:outline-none focus:ring-2 bg-white placeholder:text-slate-300 ${
                  showInvalid
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-brand-500 focus:ring-brand-500/30'
                }`}
              />
            </div>

            <p className="text-xs text-slate-400">Type four digits — 0525 becomes 05:25. Minutes are always a multiple of 5.</p>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">🕐</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this clock reading session:</p>
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
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Clock</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Reference</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Answer</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Yours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((q, i) => (
                    <tr key={i} className={`${q.isCorrect ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-rose-50 hover:bg-rose-100'} transition`}>
                      <td className="px-3 py-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-2 py-2"><ClockFace q={q} size={92} /></td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{hourAt(q.labelPos, q.offset)}</td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-800">{fmtTime(q.hour, q.minute)}</td>
                      <td className={`px-3 py-3 font-mono font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {fmtTime(q.userHour, q.userMinute)}
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

      {/* ── TIMER + CANCEL — bottom center during test ── */}
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
        return (
          <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-3 z-10">
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
            <button
              onClick={() => setCancelModalOpen(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-5 py-2 rounded-lg border border-rose-300 hover:border-rose-400 bg-white hover:bg-rose-50 transition cursor-pointer shadow-sm"
            >
              Cancel test
            </button>
          </div>
        );
      })()}

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
