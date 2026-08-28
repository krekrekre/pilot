'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SettingSlider from '@/components/training/SettingSlider';

/* ── Puzzle model ────────────────────────────────────────────────────────
   A password is a run of symbols; a word matches it when the two share the
   same shape of repeats. Which symbol stands for which letter never matters,
   only where the repeats fall:

     & $ $ & #   →  0 1 1 0 2
     t o o t h   →  0 1 1 0 2   ✓
     t a b l e   →  0 1 2 3 4   ✗

   Both sides reduce to that canonical form, so the check is string equality.
   Distinct symbols must map to distinct letters, which the reduction gives
   for free — two classes are never allowed to land on the same letter.
------------------------------------------------------------------------ */

type Pattern = number[];

interface Question {
  password: string[];   // one symbol per position
  words: string[];      // the five candidates, already shuffled
  correct: boolean[];   // parallel to words
  selected: boolean[];  // the user's marks
  isCorrect: boolean;   // the whole set had to be right
}

interface Config {
  totalQuestions: number;
  testDurationMin: number;
  wordLength: number;
}

const DEFAULT_CONFIG: Config = {
  totalQuestions: 10,
  testDurationMin: 10,
  wordLength: 5,
};

type Stage = 'start' | 'question' | 'results';

const WORDS_PER_QUESTION = 5;

/* Symbols are drawn from here — distinct at a glance, all one monospace cell. */
const SYMBOLS = ['&', '$', '#', '@', '%', '*', '?', '+'];

/* How the test is weighted: 65% of questions have one matching word, 25% have
   two, 10% have three. Every question has at least one. */
const MIX: { count: number; share: number }[] = [
  { count: 1, share: 0.65 },
  { count: 2, share: 0.25 },
  { count: 3, share: 0.10 },
];

/* ── Small helpers ───────────────────────────────────────────────────── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function canonical(units: string[]): Pattern {
  const seen = new Map<string, number>();
  return units.map(u => {
    let id = seen.get(u);
    if (id === undefined) { id = seen.size; seen.set(u, id); }
    return id;
  });
}

const keyOf = (p: Pattern) => p.join('');
const classesIn = (p: Pattern) => Math.max(...p) + 1;

/* ── Word building ───────────────────────────────────────────────────── */

const VOWELS = 'aeiou'.split('');
const CONSONANTS = 'bcdfghklmnprstvw'.split('');
/* Consonants that still read as a word when doubled — rules out "hh", "vv". */
const DOUBLEABLE = 'bdfglmnprst'.split('');

/* Every vowel/consonant layout a pattern can wear. A pattern with none of them
   cannot be spelled as anything pronounceable and is dropped from the pool. */
function typeLayouts(p: Pattern): boolean[][] {
  const k = classesIn(p);
  const out: boolean[][] = [];

  for (let mask = 0; mask < (1 << k); mask++) {
    const isVowel = Array.from({ length: k }, (_, c) => ((mask >> c) & 1) === 1);
    const seq = p.map(c => isVowel[c]);

    if (!seq.includes(true) || !seq.includes(false)) continue;

    // Three of a kind in a row is unsayable, vowels and consonants alike
    let run = 1, ok = true;
    for (let i = 1; i < seq.length; i++) {
      run = seq[i] === seq[i - 1] ? run + 1 : 1;
      if (run >= 3) { ok = false; break; }
    }
    if (!ok) continue;

    // Open on a vowel or on a single consonant. English does have "tr-" and
    // "kn-", but nothing here can tell those from "pn-" or "vh-", so clusters
    // are left to the real word list.
    if (!isVowel[p[0]] && !isVowel[p[1]]) continue;

    // Close the same way, except that a doubled consonant is fine — "pass"
    // and "hill" end that way, "-vb" and "-sn" do not.
    const last = p.length - 1;
    if (p[last] !== p[last - 1] && !isVowel[p[last]] && !isVowel[p[last - 1]]) continue;

    out.push(isVowel);
  }
  return out;
}

interface PatternInfo {
  key: string;
  pattern: Pattern;
  classes: number;
  layouts: boolean[][];
  doubled: Set<number>;   // classes sitting on two adjacent positions
  hasReal: boolean;       // some real word happens to have this shape
}

const patternCache = new Map<number, PatternInfo[]>();

/* Every canonical pattern of a given length, minus the unspellable ones. */
function patternsFor(n: number): PatternInfo[] {
  const cached = patternCache.get(n);
  if (cached) return cached;

  const all: Pattern[] = [];
  const build = (cur: number[], max: number) => {
    if (cur.length === n) { all.push([...cur]); return; }
    for (let c = 0; c <= max + 1; c++) {
      cur.push(c);
      build(cur, Math.max(max, c));
      cur.pop();
    }
  };
  build([], -1);

  const infos = all
    .map(pattern => {
      const doubled = new Set<number>();
      for (let i = 1; i < pattern.length; i++) {
        if (pattern[i] === pattern[i - 1]) doubled.add(pattern[i]);
      }
      const key = keyOf(pattern);
      return {
        key,
        pattern,
        classes: classesIn(pattern),
        layouts: typeLayouts(pattern),
        doubled,
        hasReal: (realIndex.get(`${n}:${key}`)?.length ?? 0) > 0,
      };
    })
    .filter(i => i.layouts.length > 0);

  patternCache.set(n, infos);
  return infos;
}

/* Which shapes a question may draw on.

   Both bands stop well short of "any shape at all". A five-slot password built
   from only two symbols forces a word like "irrii" — legal by the rules, but
   a page of them stops resembling the real test. Capping the repeats at two
   keeps every candidate word-shaped.

   The password must repeat something, so it never reaches all-distinct.
   A distractor may, since a word with no repeated letter at all is the most
   natural wrong answer there is. */
interface PatternPools {
  targets: PatternInfo[];
  distractors: PatternInfo[];
}

const poolCache = new Map<number, PatternPools>();

function poolsFor(n: number): PatternPools {
  const cached = poolCache.get(n);
  if (cached) return cached;

  const floor = Math.max(3, n - 2);
  const infos = patternsFor(n);
  const pools: PatternPools = {
    targets: infos.filter(i => i.classes >= floor && i.classes <= n - 1),
    distractors: infos.filter(i => i.classes >= floor && i.classes <= n),
  };

  poolCache.set(n, pools);
  return pools;
}

/* Lean towards shapes that real words actually come in. Applied the same way
   to the password and to the distractors — otherwise "looks like a real word"
   would quietly become a tell for the answer. */
const REAL_BIAS = 0.55;

function pickPattern(pool: PatternInfo[]): PatternInfo {
  const real = pool.filter(i => i.hasReal);
  return pick(real.length > 0 && Math.random() < REAL_BIAS ? real : pool);
}

/* Real words, so a question does not read as a page of pure nonsense. They are
   indexed by the shape they happen to have — nothing is annotated by hand, so
   the list can be extended freely. */
const REAL_WORDS = `
bank fire cold glow hand jump lamp mind note play road ship tide warm yard cube
desk farm gate hike idea book deed tree moon seen peel door noon that tent sees
else area ally bell boss call doll fall hill less mass miss pass roll tell well
cell ever even onto papa dodo deep feel keep meet seed week been food good look
room soon tool
table wiper halve chair plant brick storm cloud frame ghost juice knife lemon
mount novel pilot quiet ranch spine trace urban vocal whale index joint march
north ocean prime robin siren tulip vapor bland crisp dwarf flint grasp haunt
latch apple tooth teeth issue level radar otter sassy llama error onion melee
happy puppy kayak civic rotor solos seems tests banal canal salad eerie knock
stats array abbey berry bunny carry daddy funny hurry jelly kitty merry penny
sorry sunny tummy worry queen green sheep sleep steel sweet tweet wheel bleed
cheek creek greed knees kneel
banana garden letter little mirror pepper planet rabbit silver summer tunnel
window yellow bottle coffee dinner effort forest hidden island jacket kitten
ladder matter number office pocket rubber supper travel wallet common cotton
dollar ribbon sudden tennis valley wisdom bridge circle danger escape future
golden hunter injury junior knight legend modern native orange parrot
`.trim().split(/\s+/);

const realIndex = (() => {
  const map = new Map<string, string[]>();
  for (const word of REAL_WORDS) {
    const k = `${word.length}:${keyOf(canonical(word.split('')))}`;
    const bucket = map.get(k);
    if (bucket) bucket.push(word); else map.set(k, [word]);
  }
  return map;
})();

const REAL_WORD_CHANCE = 0.7;

/* One word carrying the given shape.

   `banned` holds the words already on this question and is absolute — two
   identical candidates would make the question unanswerable. `used` holds
   every word the test has shown so far and is only a preference: at four
   letters the supply of a single shape runs out long before a long test does,
   and repeating a word across questions beats repeating one inside a question. */
function makeWord(info: PatternInfo, banned: Set<string>, used: Set<string>): string {
  const pool = (realIndex.get(`${info.pattern.length}:${info.key}`) ?? []).filter(w => !banned.has(w));
  if (pool.length > 0 && Math.random() < REAL_WORD_CHANCE) {
    const fresh = pool.filter(w => !used.has(w));
    return pick(fresh.length > 0 ? fresh : pool);
  }

  let spare = '';   // shown before, but usable if nothing new turns up
  for (let attempt = 0; attempt < 60; attempt++) {
    const isVowel = pick(info.layouts);
    const vowels = shuffle(VOWELS);
    const consonants = shuffle(CONSONANTS);
    const doubleable = shuffle(DOUBLEABLE);

    const letter: string[] = [];
    const taken = new Set<string>();
    for (let c = 0; c < isVowel.length; c++) {
      const source = isVowel[c] ? vowels : (info.doubled.has(c) ? doubleable : consonants);
      // Classes must land on different letters, or the shape would collapse
      const choice = source.find(l => !taken.has(l))!;
      taken.add(choice);
      letter[c] = choice;
    }

    const word = info.pattern.map(c => letter[c]).join('');
    if (banned.has(word)) continue;
    if (!used.has(word)) return word;
    spare = word;
  }
  // Every shape in the pools spells hundreds of words against at most four
  // banned ones, so the loop does not come away empty.
  return spare || pick(pool);
}

/* ── Distractors ─────────────────────────────────────────────────────── */

/* How far a shape sits from the password, counted over every pair of
   positions: for each pair the password says "same letter" or "different
   letter", and this counts the pairs where the candidate disagrees.

     password  & $ $ & #     says: 1≡4, 2≡3, nothing else
     booty                   says:      2≡3
                             disagrees on 1≡4 only → distance 1

   "booty" is the answer that gets marked by mistake: the double letter sits
   in the right place and only the quieter constraint is broken. Distance is
   what makes that measurable, and a plain count of distinct letters is not —
   it scores "table" and "booty" as equally wrong. */
function shapeDistance(a: Pattern, b: Pattern): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if ((a[i] === a[j]) !== (b[i] === b[j])) d++;
    }
  }
  return d;
}

/* One step away is a single broken constraint, and always changes the number
   of distinct letters by exactly one — a candidate at distance 2 can split one
   class and merge another, keeping that count identical to the password's.
   Both kinds are wanted: the first is the near-miss that gets marked, the
   second is what stops "count the distinct letters" from being a shortcut. */
function distractorWeight(info: PatternInfo, target: PatternInfo): number {
  const d = shapeDistance(info.pattern, target.pattern);
  let w = d === 1 ? 6 : d === 2 ? 5 : d === 3 ? 2 : 1;
  if (info.classes === target.classes) w *= 2;
  if (info.hasReal) w *= 5;
  return w;
}

function weightedPick(pool: PatternInfo[], weight: (i: PatternInfo) => number): PatternInfo {
  const weights = pool.map(weight);
  let roll = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/* ── Question building ───────────────────────────────────────────────── */

function generateQuestion(len: number, correctCount: number, used: Set<string>): Question {
  const { targets, distractors } = poolsFor(len);
  const target = pickPattern(targets);

  const symbols = shuffle(SYMBOLS).slice(0, target.classes);
  const password = target.pattern.map(c => symbols[c]);

  const words: string[] = [];
  const correct: boolean[] = [];
  const banned = new Set<string>();

  const add = (info: PatternInfo, isMatch: boolean) => {
    const word = makeWord(info, banned, used);
    banned.add(word);
    used.add(word);
    words.push(word);
    correct.push(isMatch);
  };

  for (let i = 0; i < correctCount; i++) add(target, true);

  const others = distractors.filter(i => i.key !== target.key);

  // Every question carries at least one shape that is a single broken
  // constraint away, so there is always something worth second-guessing.
  const closest = Math.min(...others.map(i => shapeDistance(i.pattern, target.pattern)));
  const nearest = others.filter(i => shapeDistance(i.pattern, target.pattern) === closest);
  add(weightedPick(nearest, i => (i.hasReal ? 2 : 1)), false);

  while (words.length < WORDS_PER_QUESTION) {
    add(weightedPick(others, i => distractorWeight(i, target)), false);
  }

  const order = shuffle(words.map((_, i) => i));
  return {
    password,
    words: order.map(i => words[i]),
    correct: order.map(i => correct[i]),
    selected: Array(WORDS_PER_QUESTION).fill(false),
    isCorrect: false,
  };
}

/* How many matches each question carries. Largest-remainder keeps the mix as
   near 65/25/10 as the chosen question count allows. */
function allocateCorrectCounts(total: number): number[] {
  const rows = MIX.map(m => {
    const exact = total * m.share;
    return { count: m.count, n: Math.floor(exact), rem: exact - Math.floor(exact) };
  });
  let left = total - rows.reduce((s, r) => s + r.n, 0);
  for (const row of [...rows].sort((a, b) => b.rem - a.rem)) {
    if (left <= 0) break;
    row.n++;
    left--;
  }
  return shuffle(rows.flatMap(r => Array<number>(r.n).fill(r.count)));
}

function buildTest(cfg: Config): Question[] {
  const used = new Set<string>();
  return allocateCorrectCounts(cfg.totalQuestions)
    .map(k => generateQuestion(cfg.wordLength, k, used));
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

function loadConfig(): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem('password_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

function saveConfig(config: Config) {
  try { localStorage.setItem('password_config', JSON.stringify(config)); } catch {}
}

/* ── Password display ────────────────────────────────────────────────── */

function PasswordBar({ symbols, size = 'lg' }: { symbols: string[]; size?: 'lg' | 'sm' }) {
  const cell = size === 'lg'
    ? 'w-12 h-14 text-3xl sm:w-14 sm:h-16 sm:text-4xl'
    : 'w-6 h-7 text-sm';
  return (
    <div className={`flex ${size === 'lg' ? 'gap-2.5' : 'gap-1'}`} aria-label={`Password ${symbols.join(' ')}`}>
      {symbols.map((s, i) => (
        <div
          key={i}
          className={`${cell} flex items-center justify-center rounded-md border-2 border-slate-800 bg-white text-slate-900 leading-none`}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

/* Fixed illustration for the start screen. */
const EXAMPLE_PASSWORD = ['&', '$', '$', '&', '#'];
const EXAMPLE_WORDS = ['table', 'booty', 'tooth', 'halve', 'issie'];
const EXAMPLE_CORRECT = [false, false, true, false, true];

/* ── Module ──────────────────────────────────────────────────────────── */

export default function PasswordModule() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [stage, setStage] = useState<Stage>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.testDurationMin * 60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const inTest = stage === 'question';
  const currentQ = questions[currentQIndex];
  const selectedCount = currentQ ? currentQ.selected.filter(Boolean).length : 0;
  // Every question has at least one match, so an empty sheet is never an answer
  const answerReady = selectedCount > 0;

  const startNewTest = useCallback((cfg: Config) => {
    setQuestions(buildTest(cfg));
    setCurrentQIndex(0);
    // Set here too, so the clock never flashes the previous duration for a frame
    setTimeLeft(cfg.testDurationMin * 60);
    setStage('question');
  }, []);

  const toggleWord = useCallback((wordIndex: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== currentQIndex) return q;
      const selected = [...q.selected];
      selected[wordIndex] = !selected[wordIndex];
      return { ...q, selected };
    }));
  }, [currentQIndex]);

  // A question only counts when the whole set is right — every match marked and
  // nothing else.
  const gradeAt = useCallback((qs: Question[], idx: number) => {
    return qs.map((q, i) => (
      i === idx ? { ...q, isCorrect: q.selected.every((s, w) => s === q.correct[w]) } : q
    ));
  }, []);

  const handleNext = useCallback(() => {
    if (!answerReady) return;
    setQuestions(prev => gradeAt(prev, currentQIndex));
    if (currentQIndex + 1 < config.totalQuestions) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      setStage('results');
    }
  }, [answerReady, currentQIndex, config.totalQuestions, gradeAt]);

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

  // Number keys mark words, Enter moves on — no reaching for the mouse
  useEffect(() => {
    if (!inTest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleNext(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= WORDS_PER_QUESTION) { e.preventDefault(); toggleWord(n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inTest, handleNext, toggleWord]);

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
        moduleSlug: 'password',
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
      setQuestions(prev => gradeAt(prev, currentQIndex));
      setStage('results');
    }
  }, [timeLeft, inTest, gradeAt, currentQIndex]);

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
      <main className="flex-1 flex flex-col items-center justify-start max-w-4xl mx-auto w-full px-4 pt-12 pb-40">

        {/* START */}
        {stage === 'start' && (
          <div className="w-full flex flex-col items-center text-center space-y-6 max-w-2xl">
            <div className="text-left w-full space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Symbol Pattern module (PASSWORD)</h2>
                <button
                  onClick={() => startNewTest(config)}
                  className="shrink-0 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md transition cursor-pointer"
                >
                  Start module
                </button>
              </div>
              <p className="text-sm text-slate-600">This module will assess your ability to hold an abstract pattern in mind and match it against several candidates at speed.</p>
              <p className="text-sm text-slate-600">Each task shows a <span className="font-semibold text-slate-800">password</span> made of symbols, followed by five words of the same length. Mark <span className="font-semibold text-slate-800">every</span> word the password applies to.</p>
              <p className="text-sm text-slate-600">A password applies to a word when the repeats line up: the same symbol always stands for the same letter, and two different symbols never stand for the same letter. The symbols themselves mean nothing, and neither do the words — only the positions of the repeats.</p>
              <p className="text-sm text-slate-600">Every task has at least one matching word and may have up to three. A task scores only if you mark all of them and nothing else.</p>
              <p className="text-sm font-bold text-slate-800">NO aid is allowed for this module.</p>
              <p className="text-sm text-slate-600">Good luck!</p>
            </div>

            {/* Worked example */}
            <div className="w-full text-left">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Example</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col sm:flex-row items-start gap-6">
                <div className="shrink-0 space-y-3">
                  <PasswordBar symbols={EXAMPLE_PASSWORD} />
                  <div className="space-y-1.5">
                    {EXAMPLE_WORDS.map((w, i) => (
                      <div
                        key={w}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm uppercase tracking-widest ${
                          EXAMPLE_CORRECT[i]
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <span className="w-3 text-center text-xs">{EXAMPLE_CORRECT[i] ? '✓' : ''}</span>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    The password reads <span className="font-semibold text-slate-900">&amp; $ $ &amp; #</span>. Positions 1 and 4 hold the same symbol, positions 2 and 3 hold another, and position 5 is a third — so the word has to run <span className="font-bold text-slate-900">same, other, other, same, new</span>.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">tooth</span> fits: <span className="font-bold text-slate-900">t</span>-oo-<span className="font-bold text-slate-900">t</span>-h. So does <span className="font-semibold text-slate-800">issie</span>: <span className="font-bold text-slate-900">i</span>-ss-<span className="font-bold text-slate-900">i</span>-e.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">booty</span> is the one that costs marks. The double letter is in exactly the right place — but the password also needs position 4 to come back to position 1, and <span className="font-bold text-slate-900">t</span> is not <span className="font-bold text-slate-900">b</span>. Every task carries a word this close.
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">table</span> and <span className="font-semibold text-slate-800">halve</span> repeat no letter at all, so no symbol could repeat either.
                  </p>
                  <p className="text-[13px] text-slate-700 font-bold pt-1">
                    You would mark tooth and issie
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
              <p className="text-xs text-slate-400 mb-4">Customise the number of tasks, the time limit and the password length before you begin.</p>

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

                <SettingSlider
                  label="Password Length"
                  display={`${config.wordLength} symbols`}
                  value={config.wordLength}
                  min={4}
                  max={6}
                  ticks={[{ value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' }]}
                  onChange={v => updateConfig({ wordLength: v })}
                />

              </div>
              <p className="text-xs text-slate-500 mt-4">Use default settings for the most accurate test simulation</p>
            </div>

          </div>
        )}

        {/* QUESTION */}
        {stage === 'question' && currentQ && (
          <div className="w-full flex flex-col items-center space-y-6">
            <p className="text-sm text-slate-700">Mark every word the password applies to.</p>

            <PasswordBar symbols={currentQ.password} />

            {/* Same row chrome as the compass answers — full-width rows, a
                small indicator, light type. The tick stays square here
                because more than one word can be marked. */}
            <div className="w-full max-w-xl space-y-2">
              {currentQ.words.map((word, i) => {
                const on = currentQ.selected[i];
                return (
                  <button
                    key={i}
                    onClick={() => toggleWord(i)}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 transition cursor-pointer ${
                      on
                        ? 'border-brand-500 bg-brand-500/8'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* aria-pressed on the button carries the state — the tick
                        is decoration and is present even when unticked */}
                    <span aria-hidden="true" className={`w-[18px] h-[18px] shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${
                      on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-transparent'
                    }`}>
                      ✓
                    </span>
                    <span className="text-base font-medium uppercase tracking-[0.2em] text-slate-900">{word}</span>
                    <span className="ml-auto text-[10px] font-mono text-slate-300">{i + 1}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-400">Keys 1–{WORDS_PER_QUESTION} mark a word, Enter moves on. At least one word always matches.</p>
          </div>
        )}

        {/* RESULTS */}
        {stage === 'results' && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-2xl pt-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center text-2xl">🔑</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-brand-700">Test Completed!</h3>
              <p className="text-sm text-slate-500">Here is how you performed on this symbol pattern session:</p>
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
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Password</th>
                    <th className="px-3 py-2.5 text-left font-bold text-slate-700">Words</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((q, i) => (
                    <tr key={i} className={`${q.isCorrect ? 'bg-emerald-50' : 'bg-rose-50'} align-top`}>
                      <td className="px-3 py-3 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3"><PasswordBar symbols={q.password} size="sm" /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {q.words.map((word, w) => {
                            const isMatch = q.correct[w];
                            const marked = q.selected[w];
                            // Colour, border and strike carry the four states,
                            // so the review needs no weight of its own
                            const style = isMatch
                              ? (marked
                                ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                                : 'border-emerald-500 border-dashed bg-white text-emerald-700')
                              : (marked
                                ? 'border-rose-400 bg-rose-100 text-rose-700 line-through'
                                : 'border-slate-200 bg-white text-slate-400');
                            return (
                              <span key={w} className={`px-2 py-1 rounded border text-[11px] uppercase tracking-wider ${style}`}>
                                {word}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-emerald-500 bg-emerald-100" /> match, marked</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-dashed border-emerald-500 bg-white" /> match, missed</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-rose-400 bg-rose-100" /> marked in error</span>
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
