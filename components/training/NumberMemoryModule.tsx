'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

interface Question {
  target: number[];
  userEntered: number[] | null;
  isCorrect: boolean;
}

interface Config {
  digitsCount: number;
  delayBetweenSec: number;
  speechRate: number;
  totalQuestions: number;
}

const DEFAULT_CONFIG: Config = {
  digitsCount: 6,
  delayBetweenSec: 0.175,
  speechRate: 1.0,
  totalQuestions: 10,
};

type Stage = 'start' | 'prepare' | 'audio' | 'input' | 'results';

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('number_mem_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('number_mem_config', JSON.stringify(config)); } catch {}
}

function generateSequence(length: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    let digit = Math.floor(Math.random() * 10);
    if (i >= 2 && seq[i - 1] === digit && seq[i - 2] === digit) digit = (digit + 1) % 10;
    seq.push(digit);
  }
  return seq;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function fmtDelay(val: number) {
  return val.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + 's';
}

export default function NumberMemoryModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentDigits, setCurrentDigits] = useState<number[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);

  const abortRef = useRef(false);
  const audioClips = useRef<Record<number, HTMLAudioElement>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    for (let i = 0; i <= 9; i++) {
      const a = new Audio(`/audio/${i}.mp3`);
      a.preload = 'auto';
      audioClips.current[i] = a;
    }
  }, []);

  const cancelAudio = useCallback(() => {
    abortRef.current = true;
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; } catch {}
      currentAudioRef.current = null;
    }
  }, []);

  const playSingleDigit = useCallback((digit: number, rate: number): Promise<void> => {
    return new Promise((resolve) => {
      if (abortRef.current) { resolve(); return; }
      const audio = audioClips.current[digit] ?? new Audio(`/audio/${digit}.mp3`);
      currentAudioRef.current = audio;
      audio.playbackRate = rate;
      audio.currentTime = 0;
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; currentAudioRef.current = null; resolve(); } };
      audio.onended = done;
      audio.onerror = done;
      setTimeout(done, Math.max(450, (700 / rate) + 200));
      audio.play().catch(done);
    });
  }, []);

  const playSequence = useCallback(async (seq: number[], rate: number, delayMs: number) => {
    for (let i = 0; i < seq.length; i++) {
      if (abortRef.current) break;
      await playSingleDigit(seq[i], rate);
      if (abortRef.current) break;
      await sleep(delayMs);
    }
  }, [playSingleDigit]);

  const startQuestion = useCallback(async (qs: Question[], idx: number, cfg: Config) => {
    abortRef.current = false;
    setCurrentQIndex(idx);
    setCurrentDigits([]);
    setStage('prepare');
    await sleep(1200);
    if (abortRef.current) return;

    setStage('audio');
    setIsPlayingAudio(true);
    await playSequence(qs[idx].target, cfg.speechRate, cfg.delayBetweenSec * 1000);
    setIsPlayingAudio(false);
    if (abortRef.current) return;

    const prev = qs[idx].userEntered;
    if (prev && prev.length > 0) setCurrentDigits([...prev]);
    setStage('input');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [playSequence]);

  const startNewTest = useCallback((cfg: Config) => {
    cancelAudio();
    const qs: Question[] = Array.from({ length: cfg.totalQuestions }, () => ({
      target: generateSequence(cfg.digitsCount),
      userEntered: null,
      isCorrect: false,
    }));
    setQuestions(qs);
    setCurrentDigits([]);
    startQuestion(qs, 0, cfg);
  }, [cancelAudio, startQuestion]);

  const submitAnswer = useCallback((qs: Question[], idx: number, digits: number[]) => {
    return qs.map((q, i) => {
      if (i !== idx) return q;
      const correct = digits.length === q.target.length && q.target.every((d, j) => d === digits[j]);
      return { ...q, userEntered: [...digits], isCorrect: correct };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (isPlayingAudio) return;
    if (currentDigits.length !== config.digitsCount) return;
    const updated = submitAnswer(questions, currentQIndex, currentDigits);
    setQuestions(updated);
    if (currentQIndex + 1 < config.totalQuestions) {
      startQuestion(updated, currentQIndex + 1, config);
    } else {
      cancelAudio();
      setStage('results');
    }
  }, [isPlayingAudio, questions, currentQIndex, currentDigits, config, submitAnswer, startQuestion, cancelAudio]);

  const confirmCancel = useCallback(() => {
    setCancelModalOpen(false);
    cancelAudio();
    setStage('start');
  }, [cancelAudio]);

  const pushDigit = useCallback((d: number) => {
    setCurrentDigits(prev => prev.length >= config.digitsCount ? prev : [...prev, d]);
  }, [config.digitsCount]);

  const popDigit = useCallback(() => {
    setCurrentDigits(prev => prev.slice(0, -1));
  }, []);

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage !== 'input') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); }
      else if (e.key === 'Backspace') { e.preventDefault(); popDigit(); }
      else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pushDigit(parseInt(e.key, 10)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, handleNext, popDigit, pushDigit]);

  const totalQ = config.totalQuestions;
  const qNum = currentQIndex + 1;
  const pct = (qNum / totalQ) * 100;
  const mask = Array.from({ length: config.digitsCount }, (_, i) =>
    i < currentDigits.length ? currentDigits[i].toString() : '_'
  ).join('-');
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
      setQuestions(prev => submitAnswer(prev, currentQIndex, currentDigits));
      setStage('results');
    }
  }, [timeLeft, inTest, cancelAudio, submitAnswer, currentQIndex, currentDigits]);

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
              className="text-xs font-semibold flex items-center space-x-1 px-3 py-2 rounded-lg bg-brand-500 text-white opacity-30 cursor-not-allowed"
            >
              <span>‹</span><span>Previous question</span>
            </button>

            {/* Center: counter + progress */}
            <div className="flex flex-col items-center flex-1 max-w-xs mx-4">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 font-mono">{qNum} / {totalQ}</div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Next */}
            <button
              onClick={handleNext}
              disabled={isPlayingAudio || (stage === 'input' && currentDigits.length !== config.digitsCount)}
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
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Acoustic Memory module</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your short-term memory capacity and duration.</p>
              <p className="text-sm text-slate-600">For each task, you will first listen to an audio recording reading out a sequence of numbers. Your task will be to remember these numbers and write them down in the same order as they were heard.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Inline Settings — 2×2 grid */}
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
              <p className="text-xs text-slate-400 mb-4">Customise the number of tasks and digit length before you begin.</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                <SettingSlider
                  label="Digits per Question"
                  display={`${config.digitsCount}`}
                  value={config.digitsCount}
                  min={3}
                  max={15}
                  ticks={[{ value: 3, label: '3' }, { value: 9, label: '9' }, { value: 15, label: '15' }]}
                  onChange={v => updateConfig({ digitsCount: v })}
                />

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
                  label="Pause Between Numbers"
                  display={fmtDelay(config.delayBetweenSec)}
                  value={config.delayBetweenSec}
                  min={0.175}
                  max={2.5}
                  step={0.025}
                  ticks={[{ value: 0.175, label: '0.175s' }, { value: 1, label: '1s' }, { value: 2.5, label: '2.5s' }]}
                  onChange={v => updateConfig({ delayBetweenSec: v })}
                />

                <SettingSlider
                  label="Speech Rate"
                  display={`${config.speechRate.toFixed(1)}x`}
                  value={config.speechRate}
                  min={0.6}
                  max={1.8}
                  step={0.1}
                  ticks={[{ value: 0.6, label: '0.6x' }, { value: 1, label: '1.0x' }, { value: 1.8, label: '1.8x' }]}
                  onChange={v => updateConfig({ speechRate: v })}
                />

              </div>
              <p className="text-xs text-slate-500 mt-4">Use default settings for the most accurate test simulation</p>
            </div>

          </div>
        )}

        {/* PREPARE */}
        {stage === 'prepare' && (
          <div className="w-full flex flex-col items-center text-center pt-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-700 tracking-tight">Prepare for question...</h2>
          </div>
        )}

        {/* AUDIO */}
        {stage === 'audio' && (
          <div className="w-full flex flex-col items-center text-center pt-16 space-y-8">
            <div className="flex items-center justify-center space-x-2 text-brand-500 text-xl sm:text-2xl font-bold">
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
          <div className="w-full flex flex-col items-center text-center pt-10 space-y-5 max-w-lg mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Enter the digits in the appropriate sequence!</h3>
            <div className="w-full flex flex-col items-center space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Answer</label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                readOnly
                value={mask}
                className="w-full max-w-md text-center text-base sm:text-lg font-mono font-bold tracking-widest text-slate-900 border-2 border-brand-500 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-sm bg-white cursor-default"
              />
            </div>
            <p className="text-xs text-slate-400">
              Press <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-slate-600 font-bold">Enter</kbd> to submit
            </p>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">🎯</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this sequence memory session:</p>
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
                <div className="text-xs text-slate-500 font-semibold uppercase">Digit Length</div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 font-mono">{config.digitsCount}</div>
              </div>
            </div>
            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700 w-10">#</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Sequence</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Yours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {questions.map((q, i) => (
                    <tr key={i} className={`${q.isCorrect ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-rose-50 hover:bg-rose-100'} transition`}>
                      <td className="px-4 py-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{q.target.join('-')}</td>
                      <td className={`px-4 py-3 font-mono font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {q.userEntered && q.userEntered.length > 0 ? q.userEntered.join('-') : '—'}
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
        const TOTAL = 600;
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
