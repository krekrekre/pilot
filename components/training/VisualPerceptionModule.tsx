'use client';

import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

/* ── Instrument model ────────────────────────────────────────────────────
   A simplified instrument is a dial with 8 dashes, numbered 1–8 clockwise.
   `offset` rotates the numbering, so the dash at the top is rarely 8, and
   only TWO of the eight numbers are actually printed — the rest have to be
   interpolated from those two.

     numberAt(pos) = ((pos + offset) mod 8) or 8

   Two traits pick instruments out of the set: the body is white or red, and
   the hub in the middle is a circle or a square. A task's instruction names
   one or both of them.

   The single arrow always lands exactly on a dash, and never on a dash that
   already carries a printed number.
------------------------------------------------------------------------ */

const SLOTS = 8;

type Colour = 'white' | 'red';
type Centre = 'circle' | 'square';

interface Instrument {
  colour: Colour;
  centre: Centre;
  offset: number;           // 0..7 — dial rotation
  labels: [number, number]; // the two slots showing a printed number
  handPos: number;          // slot the arrow points at
  value: number;            // 1..8 — the number the arrow points at
}

/* A null field means the instruction does not mention that trait at all. */
interface Criterion {
  colour: Colour | null;
  centre: Centre | null;
}

const COLOURS: Colour[] = ['red', 'white'];
const CENTRES: Centre[] = ['circle', 'square'];

interface Task {
  criterion: Criterion;
  instruments: Instrument[];  // always 6
  answer: string;             // 6 chars — the digit per instrument, '0' = does not comply
  userAnswer: string;         // 0..6 chars
}

interface Config {
  totalQuestions: number;
  instructionSec: number;
  instrumentSec: number;
}

const DEFAULT_CONFIG: Config = {
  totalQuestions: 10,
  instructionSec: 4,
  instrumentSec: 4,
};

/* The exposure bar fills in whole steps, not continuously — five blocks over
   the phase, so the countdown is read at a glance instead of measured. */
const SEGMENTS = 5;

type Stage = 'start' | 'task' | 'results';
type Phase = 'instruction' | 'instruments' | 'answer';

function numberAt(pos: number, offset: number): number {
  return ((pos + offset) % SLOTS) || SLOTS;
}

function matches(inst: Instrument, c: Criterion): boolean {
  return (c.colour === null || inst.colour === c.colour)
    && (c.centre === null || inst.centre === c.centre);
}

function criterionText(c: Criterion): string {
  if (c.colour && c.centre) return `${c.colour} instrument(s) with a ${c.centre}`;
  if (c.colour) return `${c.colour} instrument(s)`;
  return `instrument(s) with a ${c.centre}`;
}

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('visual_perception_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('visual_perception_config', JSON.stringify(config)); } catch {}
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Slots are a ring, so 0 and 7 are neighbours. */
function ringGap(a: number, b: number): number {
  const d = Math.abs(a - b) % SLOTS;
  return Math.min(d, SLOTS - d);
}

function otherColour(c: Colour): Colour { return c === 'red' ? 'white' : 'red'; }
function otherCentre(c: Centre): Centre { return c === 'circle' ? 'square' : 'circle'; }

/* Traits are handed in — the task decides which instruments comply before any
   of them is drawn, so the number of hits is exact rather than left to chance. */
function generateInstrument(colour: Colour, centre: Centre): Instrument {
  const offset = Math.floor(Math.random() * SLOTS);
  const slots = Array.from({ length: SLOTS }, (_, i) => i);

  const labelA = pick(slots);
  // Keep the two printed numbers apart, so neither is read straight off the other
  const labelB = pick(slots.filter(p => ringGap(p, labelA) >= 2));
  const handPos = pick(slots.filter(p => p !== labelA && p !== labelB));

  return {
    colour,
    centre,
    offset,
    labels: [labelA, labelB],
    handPos,
    value: numberAt(handPos, offset),
  };
}

/* Colour and shape carry the task roughly equally; naming both at once is the
   rare, harder case. Percentages: 42.5 / 42.5 / 15. */
function pickCriterion(): Criterion {
  const r = Math.random();
  if (r < 0.425) return { colour: pick(COLOURS), centre: null };
  if (r < 0.85) return { colour: null, centre: pick(CENTRES) };
  return { colour: pick(COLOURS), centre: pick(CENTRES) };
}

/* Three of the six always comply; four and five are the stretch cases.
   Percentages: 75 / 15 / 10. */
function pickHitCount(): number {
  const r = Math.random();
  if (r < 0.75) return 3;
  if (r < 0.90) return 4;
  return 5;
}

function traitsFor(c: Criterion, comply: boolean): { colour: Colour; centre: Centre } {
  if (comply) {
    // Whichever trait the instruction does not name is free to be anything
    return { colour: c.colour ?? pick(COLOURS), centre: c.centre ?? pick(CENTRES) };
  }
  if (c.colour && c.centre) {
    /* A distractor only has to fail one of the two. Failing just the colour or
       just the shape is what makes a combined criterion worth reading twice, so
       those near misses appear as often as the outright miss. */
    const mode = Math.floor(Math.random() * 3);
    return {
      colour: mode === 1 ? c.colour : otherColour(c.colour),
      centre: mode === 0 ? c.centre : otherCentre(c.centre),
    };
  }
  if (c.colour) return { colour: otherColour(c.colour), centre: pick(CENTRES) };
  return { colour: pick(COLOURS), centre: otherCentre(c.centre!) };
}

function generateTask(): Task {
  const criterion = pickCriterion();
  const hits = pickHitCount();

  // Which slots comply is independent of how many — a hit is as likely at the
  // bottom of the pyramid as at the top.
  const positions = [0, 1, 2, 3, 4, 5];
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const complying = new Set(positions.slice(0, hits));

  const instruments = Array.from({ length: 6 }, (_, i) => {
    const { colour, centre } = traitsFor(criterion, complying.has(i));
    return generateInstrument(colour, centre);
  });

  const answer = instruments.map(i => (matches(i, criterion) ? String(i.value) : '0')).join('');

  return { criterion, instruments, answer, userAnswer: '' };
}

/* The answer field is the Acoustic Memory one: six slots joined by fixed
   dashes, each slot an underscore until its digit is typed —  _-_-_-_-_-_  */
function maskAnswer(digits: string): string {
  return Array.from({ length: 6 }, (_, i) => digits[i] ?? '_').join('-');
}

function correctDigits(task: Task): number {
  let n = 0;
  for (let i = 0; i < 6; i++) if (task.userAnswer[i] === task.answer[i]) n++;
  return n;
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

/* ── Instrument face ─────────────────────────────────────────────────────
   viewBox 220, dial radius 90 — the two printed numbers sit inside the rim,
   the way a simplified instrument prints them.
------------------------------------------------------------------------ */

const CENTER = 110;
const DIAL_R = 90;
const INK = '#0f172a';
const RED = '#fa3c3c';

const TICK_LONG_IN = 64;    // the four cardinal dashes reach further in
const TICK_SHORT_IN = 73;
const LABEL_R = 48;
const HAND_LEN = 54;   // stops short of the dashes, so the tip never touches one

function polar(pos: number, r: number): [number, number] {
  const a = ((pos * (360 / SLOTS)) - 90) * Math.PI / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

/* A plain line, no arrowhead — which dash it reaches is the whole reading. */
function Hand({ pos }: { pos: number }) {
  const [x, y] = polar(pos, HAND_LEN);
  return <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={INK} strokeWidth={7} />;
}

function InstrumentFace({ inst, size }: { inst: Instrument; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" role="img"
      aria-label={`${inst.colour} instrument with a ${inst.centre} in the middle`}>
      <circle cx={CENTER} cy={CENTER} r={DIAL_R}
        fill={inst.colour === 'red' ? RED : '#ffffff'} stroke={INK} strokeWidth={8} />

      {Array.from({ length: SLOTS }, (_, p) => {
        const cardinal = p % 2 === 0;
        const [x1, y1] = polar(p, cardinal ? TICK_LONG_IN : TICK_SHORT_IN);
        const [x2, y2] = polar(p, DIAL_R);
        return (
          <line key={p} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={INK} strokeWidth={cardinal ? 9 : 8} />
        );
      })}

      {inst.labels.map(p => {
        const [lx, ly] = polar(p, LABEL_R);
        return (
          <text key={p} x={lx} y={ly}
            textAnchor="middle" dominantBaseline="central"
            fontSize={30} fontWeight={800} fill={INK}
            fontFamily="var(--font-mono), monospace">
            {numberAt(p, inst.offset)}
          </text>
        );
      })}

      <Hand pos={inst.handPos} />

      {inst.centre === 'circle'
        ? <circle cx={CENTER} cy={CENTER} r={11} fill={INK} />
        : <rect x={CENTER - 10} y={CENTER - 10} width={20} height={20} fill={INK} />}
    </svg>
  );
}

/* The six instruments sit in a 3–2–1 pyramid, and that shape IS the reading
   order: left to right, starting from the top row. */
const ROWS = [[0, 1, 2], [3, 4], [5]];

function InstrumentPyramid({ instruments, size }: { instruments: Instrument[]; size: number }) {
  return (
    <div className="flex flex-col items-center">
      {ROWS.map((row, r) => (
        <div key={r} className="flex" style={{ marginTop: r === 0 ? 0 : -size * 0.11 }}>
          {row.map((idx, i) => (
            <div key={idx} style={{ marginLeft: i === 0 ? 0 : -size * 0.09 }}>
              <InstrumentFace inst={instruments[idx]} size={size} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* Fixed illustration for the start screen. Criterion: red with a circle.
   Complying: #2 → 8, #5 → 3, #6 → 5. Answer: 080035. */
const EXAMPLE_TASK: Task = {
  criterion: { colour: 'red', centre: 'circle' },
  instruments: [
    { colour: 'white', centre: 'circle', offset: 3, labels: [1, 5], handPos: 6, value: 1 },
    { colour: 'red',   centre: 'circle', offset: 0, labels: [2, 6], handPos: 0, value: 8 },
    { colour: 'red',   centre: 'square', offset: 5, labels: [0, 4], handPos: 2, value: 7 },
    { colour: 'white', centre: 'square', offset: 2, labels: [3, 7], handPos: 1, value: 3 },
    { colour: 'red',   centre: 'circle', offset: 6, labels: [1, 3], handPos: 5, value: 3 },
    { colour: 'red',   centre: 'circle', offset: 1, labels: [0, 2], handPos: 4, value: 5 },
  ],
  answer: '080035',
  userAnswer: '',
};

/* ── Module ──────────────────────────────────────────────────────────── */

export default function VisualPerceptionModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [phase, setPhase] = useState<Phase>('instruction');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [step, setStep] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const inTest = stage === 'task';
  const totalQ = config.totalQuestions;
  const qNum = currentIndex + 1;
  const currentTask = tasks[currentIndex];
  const answerReady = answerInput.length === 6;

  const startNewTest = useCallback((cfg: Config) => {
    setTasks(Array.from({ length: cfg.totalQuestions }, generateTask));
    setCurrentIndex(0);
    setAnswerInput('');
    setStep(0);
    setPhase('instruction');
    setStage('task');
    startedAtRef.current = Date.now();
  }, []);

  /* Exposure timer. Both timed steps run the same way: five equal ticks, and
     the step ends when the fifth lands. The answer step has no timer. */
  const phaseSec = phase === 'instruction' ? config.instructionSec
    : phase === 'instruments' ? config.instrumentSec
      : 0;

  useEffect(() => {
    if (!inTest || phaseSec === 0) return;
    let ticks = 0;
    const iv = setInterval(() => {
      ticks += 1;
      if (ticks < SEGMENTS) { setStep(ticks); return; }
      // The step ends the moment the last block would land, so the bar goes
      // straight back to empty for whatever comes next.
      clearInterval(iv);
      setStep(0);
      setPhase(p => (p === 'instruction' ? 'instruments' : 'answer'));
    }, (phaseSec * 1000) / SEGMENTS);
    return () => clearInterval(iv);
  }, [inTest, phase, currentIndex, phaseSec]);

  useEffect(() => {
    if (inTest && phase === 'answer') setTimeout(() => inputRef.current?.focus(), 50);
  }, [inTest, phase, currentIndex]);

  const handleNext = useCallback(() => {
    if (!answerReady) return;
    const updated = tasks.map((t, i) => (i === currentIndex ? { ...t, userAnswer: answerInput } : t));
    setTasks(updated);
    setAnswerInput('');

    if (currentIndex + 1 < config.totalQuestions) {
      setCurrentIndex(currentIndex + 1);
      setStep(0);
      setPhase('instruction');
    } else {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
      setStage('results');
    }
  }, [answerReady, tasks, currentIndex, answerInput, config.totalQuestions]);

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  /* The field is read-only — digits arrive from the keyboard, so a caret can
     never land between two slots and the dashes can never be typed over. */
  const mask = maskAnswer(answerInput);

  useEffect(() => {
    if (!inTest || phase !== 'answer' || cancelModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); }
      else if (e.key === 'Backspace') { e.preventDefault(); setAnswerInput(d => d.slice(0, -1)); }
      else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); setAnswerInput(d => (d.length >= 6 ? d : d + e.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inTest, phase, cancelModalOpen, handleNext]);

  /* Scoring is per digit — six points are on the table in every task. */
  const scoredDigits = tasks.reduce((n, t) => n + correctDigits(t), 0);
  const totalDigits = tasks.length * 6;
  const accuracy = totalDigits > 0 ? Math.round((scoredDigits / totalDigits) * 100) : 0;
  const perfectTasks = tasks.filter(t => correctDigits(t) === 6).length;

  // Record the finished session.
  const postedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'results') { postedRef.current = false; return; }
    if (postedRef.current || tasks.length === 0) return;
    postedRef.current = true;

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleSlug: 'visual-perception',
        score: scoredDigits,
        totalQuestions: totalDigits,
        accuracy,
        config,
      }),
    }).catch(() => { /* a failed save must not break the results screen */ });
  }, [stage, tasks, scoredDigits, totalDigits, accuracy, config]);

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
          <div className="max-w-4xl mx-auto px-4 py-2.5">
            <div className="flex items-center justify-between gap-4">

              <button
                disabled
                className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 text-white opacity-30 cursor-not-allowed"
              >
                <span>‹</span><span>Previous task</span>
              </button>

              <div className="text-xs font-semibold text-slate-600 font-mono tabular-nums">{qNum} / {totalQ}</div>

              <button
                onClick={handleNext}
                disabled={!answerReady}
                className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{qNum === totalQ ? 'Finish test' : 'Next task'}</span><span>›</span>
              </button>

            </div>

            {/* Exposure bar — runs the full width from the previous-task button
                to the next-task button, and fills in five steps as the seconds
                run out. Empty on the answer step, which is not timed. */}
            <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    // The block for the fifth of a second currently running counts
                    // as filled, so the bar is already full through the last one.
                    phaseSec > 0 && i <= step ? 'bg-brand-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </header>
      )}

      {/* ── MAIN ── */}
      {/* Every step of a task sits high on the page — the instruction line, the
          instruments and the answer field all start just under the header. */}
      <main className={`flex-1 flex flex-col items-center justify-start max-w-4xl mx-auto w-full px-4 pb-40 ${inTest ? 'pt-5' : 'pt-12'}`}>

        {/* START */}
        {stage === 'start' && (
          <div className="w-full flex flex-col items-center text-center space-y-6 max-w-2xl">
            <div className="text-left w-full space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Visual perception module</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your level of perception, short-term visual memory, and interpolation skills.</p>
              <p className="text-sm text-slate-600">
                You will receive <span className="font-semibold text-slate-800">{config.totalQuestions} tasks</span>. At each task you will first see a <span className="font-semibold text-slate-800">short instruction</span> (1st step) and then <span className="font-semibold text-slate-800">6 simplified instruments</span> (2nd step). The short instruction will ask you to read the upcoming instruments based on specific criteria. Watch out, instruments will only be visible for <span className="font-semibold text-slate-800">{config.instrumentSec} seconds</span>.
              </p>
              <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1.5">
                <li>First, find those instrument(s) that comply with the given metrics (e.g., white instrument with a circle in the middle). If an instrument does not comply with the criteria, type &ldquo;0&rdquo; into the corresponding answer field.</li>
                <li>Second, read where the arrow points on these instrument(s).</li>
                <li>Third, enter these digits into the answer field. Each digit will represent one instrument. Your final answer will be a sequence of six numbers.</li>
              </ol>
              <p className="text-sm text-slate-600">Your answer is only correct if you pick the correct number for the given digit. If you leave a digit empty or type in a wrong number you will not get a point for that. Remember to read them from left to right, starting from the top — as illustrated below.</p>
              <p className="text-sm text-slate-600">Every dial carries <span className="font-semibold text-slate-800">8 dashes numbered 1 to 8</span>, but only two of those numbers are printed — work the rest out from them. The arrow always lands exactly on a dash, never on a printed number.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Worked example */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Example</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col sm:flex-row items-center gap-6">
                <div className="shrink-0">
                  <p className="text-sm text-slate-900 mb-3 text-center">
                    <span className="font-bold">Look for:</span> red instrument(s) with a circle.
                  </p>
                  <InstrumentPyramid instruments={EXAMPLE_TASK.instruments} size={104} />
                </div>
                <div className="space-y-2.5">
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    Read the six in the order <span className="font-semibold text-slate-800">top row left to right, then the middle row, then the bottom one</span>.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    Instruments <span className="font-bold text-slate-900">1</span> and <span className="font-bold text-slate-900">4</span> are white, and <span className="font-bold text-slate-900">3</span> is red but has a square in the middle — all three score <span className="font-bold text-slate-900">0</span>.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    On the three that do comply, the arrow points at <span className="font-bold text-slate-900">8</span>, <span className="font-bold text-slate-900">3</span> and <span className="font-bold text-slate-900">5</span>.
                  </p>
                  <p className="text-[13px] text-slate-700 font-bold pt-1">
                    You would type 0 8 0 0 3 5
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
              <p className="text-xs text-slate-400 mb-4">Customise the number of tasks and how long each step stays on screen.</p>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                <SettingSlider
                  label="Tasks per Test"
                  display={`${config.totalQuestions}`}
                  value={config.totalQuestions}
                  min={1}
                  max={25}
                  ticks={[{ value: 1, label: '1' }, { value: 10, label: '10' }, { value: 25, label: '25' }]}
                  onChange={v => updateConfig({ totalQuestions: v })}
                />

                <SettingSlider
                  label="Instruction Time"
                  display={`${config.instructionSec}s`}
                  value={config.instructionSec}
                  min={2}
                  max={10}
                  ticks={[{ value: 2, label: '2s' }, { value: 4, label: '4s' }, { value: 10, label: '10s' }]}
                  onChange={v => updateConfig({ instructionSec: v })}
                />

                <SettingSlider
                  label="Instrument Time"
                  display={`${config.instrumentSec}s`}
                  value={config.instrumentSec}
                  min={2}
                  max={10}
                  ticks={[{ value: 2, label: '2s' }, { value: 4, label: '4s' }, { value: 10, label: '10s' }]}
                  onChange={v => updateConfig({ instrumentSec: v })}
                />

              </div>
              <p className="text-xs text-slate-500 mt-4">Use default settings for the most accurate test simulation</p>
            </div>

          </div>
        )}

        {/* TASK — one step at a time, and nothing else on screen */}
        {stage === 'task' && currentTask && (
          <div className="w-full flex flex-col items-center">

            {phase === 'instruction' && (
              <p className="w-full text-left text-sm text-slate-900">
                <span className="font-bold">Look for:</span> {criterionText(currentTask.criterion)}.
              </p>
            )}

            {phase === 'instruments' && (
              <InstrumentPyramid instruments={currentTask.instruments} size={140} />
            )}

            {phase === 'answer' && (
              <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-1.5">
                <label htmlFor="vp-answer" className="text-xs font-semibold text-slate-500">Answer</label>
                <input
                  ref={inputRef}
                  id="vp-answer"
                  type="text"
                  inputMode="numeric"
                  readOnly
                  value={mask}
                  className="w-full max-w-md text-center text-base sm:text-lg font-mono font-bold tracking-widest text-slate-900 border-2 border-brand-500 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-sm bg-white cursor-default"
                />
              </div>
            )}

          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">👁️</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this visual perception session:</p>
            </div>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Digits</div>
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 mt-1 font-mono tabular-nums">{scoredDigits} / {totalDigits}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Accuracy</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 font-mono tabular-nums">{accuracy}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Perfect</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono tabular-nums">{perfectTasks} / {tasks.length}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Time Used</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono tabular-nums">{fmtDuration(elapsed)}</div>
              </div>
            </div>

            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700 w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Instruments</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Look for</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Answer</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Yours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((t, i) => {
                    const hits = correctDigits(t);
                    return (
                      <tr key={i} className={hits === 6 ? 'bg-emerald-50' : hits === 0 ? 'bg-rose-50' : 'bg-amber-50'}>
                        <td className="px-3 py-3 font-semibold text-slate-500 align-top">{i + 1}</td>
                        <td className="px-2 py-2"><InstrumentPyramid instruments={t.instruments} size={62} /></td>
                        <td className="px-3 py-3 text-[11px] text-slate-600 align-top">{criterionText(t.criterion)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-slate-800 tracking-widest align-top">{maskAnswer(t.answer)}</td>
                        {/* Same dashed layout as the answer field, so a digit
                            lines up with the one it is being compared to. */}
                        <td className="px-3 py-3 font-mono font-bold tracking-widest align-top">
                          {Array.from({ length: 6 }, (_, d) => (
                            <Fragment key={d}>
                              {d > 0 && <span className="text-slate-400">-</span>}
                              <span className={t.userAnswer[d] === t.answer[d] ? 'text-emerald-700' : 'text-rose-600'}>
                                {t.userAnswer[d] ?? '_'}
                              </span>
                            </Fragment>
                          ))}
                          <span className="block text-[10px] font-sans font-semibold text-slate-500 mt-1">{hits} / 6</span>
                        </td>
                      </tr>
                    );
                  })}
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
                onClick={() => { setCancelModalOpen(false); setStage('start'); }}
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
