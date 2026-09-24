import { listSubjects, summarise } from '@/lib/admin-data';
import SubjectTable from './SubjectTable';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const subjects = await listSubjects();
  // stats.now is fixed on the server so the client table renders identical
  // relative times on both the server pass and hydration.
  const stats = summarise(subjects);

  const tiles = [
    { label: 'Subjects',     value: stats.subjects,         note: `${stats.registered} registered` },
    { label: 'Sessions',     value: stats.sessions,         note: 'all time' },
    { label: 'Active 7d',    value: stats.activeThisWeek,   note: 'subjects' },
    { label: 'Avg accuracy', value: `${stats.avgAccuracy}%`, note: 'across subjects' },
  ];

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-5 sm:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Results log</h1>
        <p className="text-sm text-slate-500">
          Every finished training run, by subject. Click a row for the per-module breakdown.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {tiles.map(t => (
          <div key={t.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5">{t.label}</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">{t.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t.note}</div>
          </div>
        ))}
      </div>

      {subjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm font-medium text-slate-500">No sessions recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1.5">
            Runs appear here as soon as someone finishes a module.
          </p>
        </div>
      ) : (
        <SubjectTable subjects={subjects} now={stats.now} />
      )}
    </div>
  );
}
