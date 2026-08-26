'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ── Cube model ──────────────────────────────────────────────────────────
   up:    front → top    → behind → bottom → front   (left/right unchanged)
   down:  front → bottom → behind → top    → front   (left/right unchanged)
   left:  front → right  → behind → left   → front   (top/bottom unchanged)
   right: front → left   → behind → right  → front   (top/bottom unchanged)
------------------------------------------------------------------------ */

type Face = 'top' | 'right' | 'bottom' | 'left' | 'front' | 'behind';
type Command = 'up' | 'down' | 'left' | 'right';

// Index + 1 is the number the user types: 1=top 2=right 3=bottom 4=left 5=front 6=behind
const FACES: Face[] = ['top', 'right', 'bottom', 'left', 'front', 'behind'];
const COMMANDS: Command[] = ['up', 'down', 'left', 'right'];

const LABEL: Record<Face | Command, string> = {
  top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left', front: 'Front', behind: 'Behind',
  up: 'Up', down: 'Down',
};

const ROTATIONS: Record<Command, Partial<Record<Face, Face>>> = {
  up:    { front: 'top',    top: 'behind',    behind: 'bottom', bottom: 'front' },
  down:  { front: 'bottom', bottom: 'behind', behind: 'top',    top: 'front' },
  left:  { front: 'right',  right: 'behind',  behind: 'left',   left: 'front' },
  right: { front: 'left',   left: 'behind',   behind: 'right',  right: 'front' },
};

function applyCommand(face: Face, cmd: Command): Face {
  return ROTATIONS[cmd][face] ?? face;
}

function resolveFace(start: Face, commands: Command[]): Face {
  return commands.reduce<Face>(applyCommand, start);
}

const AUDIO_KEYS: string[] = [...FACES, 'up', 'down', 'initial_position'];

interface Question {
  start: Face;
  commands: Command[];
  answer: Face;
  userAnswer: Face | null;
  isCorrect: boolean;
}

interface Config {
  commandsCount: number;
  delayBetweenSec: number;
  speechRate: number;
  totalQuestions: number;
}

const DEFAULT_CONFIG: Config = {
  commandsCount: 6,
  delayBetweenSec: 0.3,
  speechRate: 1.1,
  totalQuestions: 10,
};

type Stage = 'start' | 'prepare' | 'audio' | 'input' | 'results';

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('cube_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('cube_config', JSON.stringify(config)); } catch {}
}

function generateCommands(length: number): Command[] {
  const seq: Command[] = [];
  for (let i = 0; i < length; i++) {
    let cmd = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    // Avoid three identical commands in a row
    if (i >= 2 && seq[i - 1] === cmd && seq[i - 2] === cmd) {
      cmd = COMMANDS[(COMMANDS.indexOf(cmd) + 1) % COMMANDS.length];
    }
    seq.push(cmd);
  }
  return seq;
}

function generateQuestion(commandsCount: number): Question {
  const start = FACES[Math.floor(Math.random() * FACES.length)];
  const commands = generateCommands(commandsCount);
  return { start, commands, answer: resolveFace(start, commands), userAnswer: null, isCorrect: false };
}

// Fixed gap between the announced initial position and the first command
const INITIAL_POSITION_PAUSE_MS = 2000;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function fmtDelay(val: number) {
  return val.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + 's';
}

export default function CubeGame() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<Face | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);

  const abortRef = useRef(false);
  const audioClips = useRef<Record<string, HTMLAudioElement>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
    for (const key of AUDIO_KEYS) {
      const a = new Audio(`/audio/cube/${key}.mp3`);
      a.preload = 'auto';
      audioClips.current[key] = a;
    }
  }, []);

  const cancelAudio = useCallback(() => {
    abortRef.current = true;
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; } catch {}
      currentAudioRef.current = null;
    }
  }, []);

  const playClip = useCallback((key: string, rate: number): Promise<void> => {
    return new Promise((resolve) => {
      if (abortRef.current) { resolve(); return; }
      const audio = audioClips.current[key] ?? new Audio(`/audio/cube/${key}.mp3`);
      currentAudioRef.current = audio;
      audio.playbackRate = rate;
      audio.currentTime = 0;
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; currentAudioRef.current = null; resolve(); } };
      audio.onended = done;
      audio.onerror = done;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1.2;
      setTimeout(done, Math.max(450, (dur * 1000 / rate) + 400));
      audio.play().catch(done);
    });
  }, []);

  const playQuestionAudio = useCallback(async (q: Question, cfg: Config) => {
    const rate = cfg.speechRate;
    const delayMs = cfg.delayBetweenSec * 1000;

    await playClip('initial_position', rate);
    if (abortRef.current) return;
    await sleep(250);
    if (abortRef.current) return;

    await playClip(q.start, rate);
    if (abortRef.current) return;
    await sleep(INITIAL_POSITION_PAUSE_MS);

    for (const cmd of q.commands) {
      if (abortRef.current) break;
      await playClip(cmd, rate);
      if (abortRef.current) break;
      await sleep(delayMs);
    }
  }, [playClip]);

  const startQuestion = useCallback(async (qs: Question[], idx: number, cfg: Config) => {
    abortRef.current = false;
    setCurrentQIndex(idx);
    setCurrentAnswer(null);
    setStage('prepare');
    await sleep(1200);
    if (abortRef.current) return;

    setStage('audio');
    setIsPlayingAudio(true);
    await playQuestionAudio(qs[idx], cfg);
    setIsPlayingAudio(false);
    if (abortRef.current) return;

    setCurrentAnswer(qs[idx].userAnswer);
    setStage('input');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [playQuestionAudio]);

  const startNewTest = useCallback((cfg: Config) => {
    cancelAudio();
    const qs: Question[] = Array.from({ length: cfg.totalQuestions }, () => generateQuestion(cfg.commandsCount));
    setQuestions(qs);
    setCurrentAnswer(null);
    startQuestion(qs, 0, cfg);
  }, [cancelAudio, startQuestion]);

  const submitAnswer = useCallback((qs: Question[], idx: number, face: Face | null) => {
    return qs.map((q, i) => {
      if (i !== idx) return q;
      return { ...q, userAnswer: face, isCorrect: face === q.answer };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (isPlayingAudio) return;
    if (!currentAnswer) return;
    const updated = submitAnswer(questions, currentQIndex, currentAnswer);
    setQuestions(updated);
    if (currentQIndex + 1 < config.totalQuestions) {
      startQuestion(updated, currentQIndex + 1, config);
    } else {
      cancelAudio();
      setStage('results');
    }
  }, [isPlayingAudio, questions, currentQIndex, currentAnswer, config, submitAnswer, startQuestion, cancelAudio]);

  const confirmCancel = useCallback(() => {
    setCancelModalOpen(false);
    cancelAudio();
    setStage('start');
  }, [cancelAudio]);

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage !== 'input') return;
    // Digits and Backspace go to the answer field itself — only Enter is global
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, handleNext]);

  const totalQ = config.totalQuestions;
  const qNum = currentQIndex + 1;
  const pct = (qNum / totalQ) * 100;
  const answerKey = currentAnswer ? FACES.indexOf(currentAnswer) + 1 : null;
  const correctCount = questions.filter(q => q.isCorrect).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const inTest = stage === 'prepare' || stage === 'audio' || stage === 'input';

  // 10-minute countdown timer
  useEffect(() => {
    if (inTest) {
      setTimeLeft(600);
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
      cancelAudio();
      setQuestions(prev => submitAnswer(prev, currentQIndex, currentAnswer));
      setStage('results');
    }
  }, [timeLeft, inTest, cancelAudio, submitAnswer, currentQIndex, currentAnswer]);

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

            {/* Previous — always disabled */}
            <button
              disabled
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-[#8c1d68] text-white opacity-30 cursor-not-allowed"
            >
              <span>‹</span><span>Previous question</span>
            </button>

            {/* Center: counter + progress */}
            <div className="flex flex-col items-center flex-1 max-w-xs mx-4">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 font-mono">{qNum} / {totalQ}</div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#8c1d68] h-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Next */}
            <button
              onClick={handleNext}
              disabled={isPlayingAudio || (stage === 'input' && !currentAnswer)}
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-[#8c1d68] hover:bg-[#751857] text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Spatial Orientation module (CUBE)</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-[#8c1d68] hover:bg-[#751857] text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your spatial orientation and mental rotation ability.</p>
              <p className="text-sm text-slate-600">Imagine a cube in front of you. For each task, the audio first announces the <span className="font-semibold text-slate-800">initial position</span> on the cube, then reads out a series of rotation commands. Track the position in your head and report where it ends up.</p>
              <p className="text-sm text-slate-600">Nothing is shown on screen while the audio plays — listen carefully, each task is played only once.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* How the cube moves */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">How the cube moves</h3>
              <p className="text-xs text-slate-400 mb-4">Each command shifts the position one step along its cycle.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {COMMANDS.map(cmd => {
                  const cycle: Face[] = ['front'];
                  for (let i = 0; i < 3; i++) cycle.push(applyCommand(cycle[cycle.length - 1], cmd));
                  const fixed = cmd === 'up' || cmd === 'down' ? 'Left and right stay put' : 'Top and bottom stay put';
                  return (
                    <div key={cmd} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 hover:border-[#8c1d68]/30 hover:bg-white transition">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8c1d68] text-white uppercase tracking-wide">{LABEL[cmd]}</span>
                        <span className="text-[11px] text-slate-400">{fixed}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
                        {cycle.map((f, i) => (
                          <span key={f} className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                              {LABEL[f]}
                            </span>
                            <span className={i === cycle.length - 1
                              ? 'text-[#8c1d68] text-base font-bold leading-none'
                              : 'text-[#8c1d68]/60 text-sm font-bold leading-none'}>
                              {i === cycle.length - 1 ? '↺' : '→'}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inline Settings — 2×2 grid */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-left">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Settings</h3>
                <button
                  onClick={() => { setConfig({ ...DEFAULT_CONFIG }); saveConfig({ ...DEFAULT_CONFIG }); }}
                  className="text-xs font-semibold text-slate-500 hover:text-[#8c1d68] px-3 py-1 rounded-md border border-slate-300 hover:border-[#8c1d68]/50 bg-white transition cursor-pointer"
                >
                  Reset to default
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">Customise the number of tasks and command length before you begin.</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Commands per Question</span>
                    <span className="text-[#8c1d68] font-mono font-bold">{config.commandsCount}</span>
                  </div>
                  <input type="range" min={1} max={15} value={config.commandsCount}
                    onChange={e => updateConfig({ commandsCount: +e.target.value })}
                    className="w-full accent-[#8c1d68] cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1</span><span>8</span><span>15</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Questions per Test</span>
                    <span className="text-[#8c1d68] font-mono font-bold">{config.totalQuestions}</span>
                  </div>
                  <input type="range" min={1} max={25} value={config.totalQuestions}
                    onChange={e => updateConfig({ totalQuestions: +e.target.value })}
                    className="w-full accent-[#8c1d68] cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1</span><span>10</span><span>25</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Pause Between Commands</span>
                    <span className="text-[#8c1d68] font-mono font-bold">{fmtDelay(config.delayBetweenSec)}</span>
                  </div>
                  <input type="range" min={0.2} max={3} step={0.05} value={config.delayBetweenSec}
                    onChange={e => updateConfig({ delayBetweenSec: +e.target.value })}
                    className="w-full accent-[#8c1d68] cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0.2s</span><span>1.5s</span><span>3s</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Speech Rate</span>
                    <span className="text-[#8c1d68] font-mono font-bold">{config.speechRate.toFixed(1)}x</span>
                  </div>
                  <input type="range" min={0.6} max={1.8} step={0.1} value={config.speechRate}
                    onChange={e => updateConfig({ speechRate: +e.target.value })}
                    className="w-full accent-[#8c1d68] cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0.6x</span><span>1.0x</span><span>1.8x</span>
                  </div>
                </div>

              </div>
              <p className="text-xs text-slate-500 mt-4">Use default settings for the most accurate test simulation</p>
            </div>

          </div>
        )}

        {/* PREPARE */}
        {stage === 'prepare' && (
          <div className="w-full flex flex-col items-center text-center pt-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#600038] tracking-tight">Prepare for question...</h2>
          </div>
        )}

        {/* AUDIO */}
        {stage === 'audio' && (
          <div className="w-full flex flex-col items-center text-center pt-16 space-y-8">
            <div className="flex items-center justify-center space-x-2 text-[#8c1d68] text-xl sm:text-2xl font-bold">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span>Audio is playing</span>
            </div>
            <div className="equalizer-container flex items-end justify-center gap-1.5 h-16 w-36">
              {[1,2,3,4,5].map(i => <div key={i} className={`eq-bar eq-bar-${i}`} />)}
            </div>
          </div>
        )}

        {/* INPUT */}
        {stage === 'input' && (
          <div className="w-full text-left pt-6 space-y-4 max-w-xl">
            <p className="text-sm text-slate-700">What is the final position of the mark?</p>
            <p className="text-sm text-slate-700">The following numbers correspond to the following positions:</p>
            <div className="space-y-4">
              {FACES.map((f, i) => (
                <p key={f} className="text-sm text-slate-700">{LABEL[f].toLowerCase()}: {i + 1}</p>
              ))}
            </div>
            <p className="text-sm text-slate-700">Enter the correct number associated with the final position of the mark into the answer field!</p>
            <div className="space-y-1.5 pt-1">
              <label htmlFor="cube-answer" className="block text-xs font-bold text-slate-700">Your numeric answer</label>
              <input
                ref={inputRef}
                id="cube-answer"
                type="number"
                inputMode="numeric"
                min={1}
                max={6}
                step={1}
                placeholder="Your numeric answer"
                // A focused number input would otherwise change value on page scroll
                onWheel={e => e.currentTarget.blur()}
                value={answerKey ?? ''}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setCurrentAnswer(null); return; }
                  const n = parseInt(raw, 10);
                  if (n >= 1 && n <= 6) setCurrentAnswer(FACES[n - 1]);
                }}
                className="w-full max-w-xs text-sm text-slate-900 border-2 border-[#8c1d68] rounded-md py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-[#8c1d68]/30 bg-white placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#8c1d68]/10 flex items-center justify-center text-2xl">🧊</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#600038]">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this spatial orientation session:</p>
            </div>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Score</div>
                <div className="text-2xl sm:text-3xl font-bold text-[#8c1d68] mt-1 font-mono tabular-nums">{correctCount} / {questions.length}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Accuracy</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 font-mono tabular-nums">{accuracy}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase">Commands</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono">{config.commandsCount}</div>
              </div>
            </div>
            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700 w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Initial</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Commands</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Answer</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Yours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((q, i) => (
                    <tr key={i} className={`${q.isCorrect ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-rose-50 hover:bg-rose-100'} transition`}>
                      <td className="px-3 py-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-800">{LABEL[q.start]}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{q.commands.map(c => LABEL[c]).join(' · ')}</td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-800">{LABEL[q.answer]}</td>
                      <td className={`px-3 py-3 font-mono font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {q.userAnswer ? LABEL[q.userAnswer] : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-2">
              <button onClick={() => startNewTest(config)}
                className="px-8 py-3 rounded-lg bg-[#8c1d68] hover:bg-[#751857] text-white font-bold text-sm shadow-md transition cursor-pointer">
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
        const TOTAL = 600;
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
                  stroke={urgent ? '#e11d48' : '#8c1d68'}
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
                  fill={urgent ? '#e11d48' : '#8c1d68'}
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
