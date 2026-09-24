import { serviceClient } from '@/lib/admin';

export type Session = {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  module_slug: string;
  score: number;
  total_questions: number;
  accuracy: number;
  config: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
};

export type Subject = {
  key: string;                    // 'u:<uuid>' for a user, 'a:<id>' for a visitor
  kind: 'user' | 'anon';
  label: string;
  sessions: number;
  avgAccuracy: number;
  questions: number;
  firstSeen: string;
  lastSeen: string;
  modules: ModuleStat[];
  plan: string | null;
  signedUpAt: string | null;
};

export type ModuleStat = {
  slug: string;
  runs: number;
  avgAccuracy: number;
  bestAccuracy: number;
  worstAccuracy: number;
  firstRun: string;
  lastRun: string;
  /** Accuracy of each run, oldest first — enough to read a trend. */
  history: number[];
  /** Every individual run of this module, newest first. */
  attempts: Attempt[];
};

export type Attempt = {
  id: string;
  at: string;
  score: number;
  total: number;
  accuracy: number;
  config: Record<string, unknown> | null;
};

export const subjectKey = (s: Pick<Session, 'user_id' | 'anon_id'>) =>
  s.user_id ? `u:${s.user_id}` : `a:${s.anon_id}`;

const avg = (ns: number[]) =>
  ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;

/** Per-module breakdown for one subject, strongest module first. */
export function moduleStats(rows: Session[]): ModuleStat[] {
  const byModule = new Map<string, Session[]>();
  for (const r of rows) {
    const bucket = byModule.get(r.module_slug);
    if (bucket) bucket.push(r);
    else byModule.set(r.module_slug, [r]);
  }

  return [...byModule.entries()]
    .map(([slug, group]) => {
      // Callers may hand us any order, so sort rather than assume one.
      const oldestFirst = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const acc = oldestFirst.map(r => r.accuracy);
      return {
        slug,
        runs: acc.length,
        attempts: [...oldestFirst].reverse().map(r => ({
          id: r.id,
          at: r.created_at,
          score: r.score,
          total: r.total_questions,
          accuracy: r.accuracy,
          config: r.config,
        })),
        avgAccuracy: avg(acc),
        bestAccuracy: Math.max(...acc),
        worstAccuracy: Math.min(...acc),
        firstRun: oldestFirst[0].created_at,
        lastRun: oldestFirst[oldestFirst.length - 1].created_at,
        history: acc,
      };
    })
    .sort((a, b) => b.lastRun.localeCompare(a.lastRun));
}

async function fetchDirectory() {
  const db = serviceClient();

  const [{ data: authData }, { data: subs }] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db.from('subscriptions').select('user_id, status, plan'),
  ]);

  const emails = new Map<string, { email: string; createdAt: string }>();
  for (const u of authData?.users ?? []) {
    emails.set(u.id, { email: u.email ?? '(no email)', createdAt: u.created_at });
  }

  const plans = new Map<string, string>();
  for (const s of subs ?? []) {
    if (s.user_id) plans.set(s.user_id, s.status === 'active' ? (s.plan ?? 'pro') : s.status);
  }

  return { emails, plans };
}

/** Every subject that has ever finished a run, most recently active first. */
export async function listSubjects(): Promise<Subject[]> {
  const db = serviceClient();
  const [{ data: sessions }, { emails, plans }] = await Promise.all([
    db.from('training_sessions').select('*').order('created_at', { ascending: false }),
    fetchDirectory(),
  ]);

  const grouped = new Map<string, Session[]>();
  for (const s of (sessions ?? []) as Session[]) {
    const key = subjectKey(s);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(s);
    else grouped.set(key, [s]);
  }

  const subjects: Subject[] = [];
  for (const [key, rows] of grouped) {
    const isUser = key.startsWith('u:');
    const id = key.slice(2);
    const profile = isUser ? emails.get(id) : undefined;

    subjects.push({
      key,
      kind: isUser ? 'user' : 'anon',
      label: isUser ? (profile?.email ?? id) : `Visitor ${id.slice(0, 8)}`,
      sessions: rows.length,
      avgAccuracy: avg(rows.map(r => r.accuracy)),
      questions: rows.reduce((a, r) => a + r.total_questions, 0),
      // rows are newest-first
      lastSeen: rows[0].created_at,
      firstSeen: rows[rows.length - 1].created_at,
      modules: moduleStats(rows),
      plan: isUser ? (plans.get(id) ?? 'free') : null,
      signedUpAt: profile?.createdAt ?? null,
    });
  }

  return subjects.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** One subject's full run history, newest first. */
export async function getSubject(key: string) {
  const isUser = key.startsWith('u:');
  const id = key.slice(2);

  const db = serviceClient();
  const query = db.from('training_sessions').select('*').order('created_at', { ascending: false });

  const { data } = await (isUser ? query.eq('user_id', id) : query.eq('anon_id', id));
  const sessions = (data ?? []) as Session[];
  if (sessions.length === 0) return null;

  const { emails, plans } = await fetchDirectory();
  const profile = isUser ? emails.get(id) : undefined;

  const subject: Subject = {
    key,
    kind: isUser ? 'user' : 'anon',
    label: isUser ? (profile?.email ?? id) : `Visitor ${id.slice(0, 8)}`,
    sessions: sessions.length,
    avgAccuracy: avg(sessions.map(s => s.accuracy)),
    questions: sessions.reduce((a, s) => a + s.total_questions, 0),
    lastSeen: sessions[0].created_at,
    firstSeen: sessions[sessions.length - 1].created_at,
    modules: moduleStats(sessions),
    plan: isUser ? (plans.get(id) ?? 'free') : null,
    signedUpAt: profile?.createdAt ?? null,
  };

  return { subject, sessions };
}

/** Headline counters for the overview. */
export function summarise(subjects: Subject[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return {
    // Handed to the client table so both renders agree on "5m ago".
    now,
    subjects: subjects.length,
    registered: subjects.filter(s => s.kind === 'user').length,
    sessions: subjects.reduce((a, s) => a + s.sessions, 0),
    activeThisWeek: subjects.filter(s => new Date(s.lastSeen).getTime() > weekAgo).length,
    avgAccuracy: avg(subjects.map(s => s.avgAccuracy)),
  };
}
