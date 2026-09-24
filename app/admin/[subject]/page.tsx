import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSubject } from '@/lib/admin-data';
import { moduleIcon, moduleTitle } from '@/lib/modules';

export const dynamic = 'force-dynamic';

function accuracyTone(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

/** Config is per-module and free-form — render whatever keys it happens to have. */
function ConfigChips({ config }: { config: Record<string, unknown> | null }) {
  if (!config) return <span className="text-slate-300">—</span>;
  const entries = Object.entries(config).filter(([, v]) => typeof v !== 'object');
  if (entries.length === 0) return <span className="text-slate-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
          {k}: {String(v)}
        </span>
      ))}
    </div>
  );
}

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;   // Next has already decoded this
  const result = await getSubject(subject);
  if (!result) notFound();

  const { subject: profile, sessions } = result;

  const device = sessions.find(s => s.user_agent)?.user_agent ?? null;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-5 sm:px-8 py-10">
      <Link href="/admin" className="text-xs text-slate-400 hover:text-slate-700 font-medium transition inline-block mb-5">
        ← All subjects
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{profile.label}</h1>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            profile.kind === 'user' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'
          }`}>
            {profile.kind === 'user' ? (profile.plan ?? 'free') : 'anonymous'}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {profile.sessions} runs · {profile.questions} questions ·
          first seen {new Date(profile.firstSeen).toLocaleDateString()}
          {profile.signedUpAt && ` · signed up ${new Date(profile.signedUpAt).toLocaleDateString()}`}
        </p>
        {device && (
          <p className="text-[11px] text-slate-300 mt-1 font-mono truncate" title={device}>{device}</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {profile.modules.map(m => (
          <div key={m.slug} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg leading-none">{moduleIcon(m.slug)}</span>
              <span className="text-sm font-bold text-slate-900">{moduleTitle(m.slug)}</span>
            </div>
            <div className="flex items-end gap-5">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Avg</div>
                <div className={`text-xl font-extrabold font-mono tabular-nums ${accuracyTone(m.avgAccuracy)}`}>
                  {m.avgAccuracy}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Best</div>
                <div className="text-xl font-extrabold font-mono tabular-nums text-slate-700">{m.bestAccuracy}%</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Runs</div>
                <div className="text-xl font-extrabold font-mono tabular-nums text-slate-400">{m.runs}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-bold text-slate-900 mb-3">Every run</h2>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">When</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Module</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Score</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Acc.</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(s.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="mr-1.5">{moduleIcon(s.module_slug)}</span>
                  <span className="text-slate-700">{moduleTitle(s.module_slug)}</span>
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                  {s.score}/{s.total_questions}
                </td>
                <td className={`px-5 py-3 text-right font-mono tabular-nums font-semibold ${accuracyTone(s.accuracy)}`}>
                  {s.accuracy}%
                </td>
                <td className="px-5 py-3"><ConfigChips config={s.config} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
