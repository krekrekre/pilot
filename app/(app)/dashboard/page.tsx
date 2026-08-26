export const metadata = { title: 'Dashboard – Pilot Prep' };

export default function DashboardPage() {
  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Dashboard</h1>
        <p className="text-sm text-slate-500">Your training history and performance trends.</p>
      </div>

      {/* Placeholder stats */}
      <div className="grid grid-cols-3 gap-5 mb-10">
        {[
          { label: 'Total sessions', value: '—' },
          { label: 'Best accuracy', value: '—' },
          { label: 'Current streak', value: '—' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5">{s.label}</div>
            <div className="text-2xl font-extrabold text-slate-900 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
        <div className="text-3xl mb-3">📈</div>
        <p className="text-sm font-medium">Complete your first session to see your stats here.</p>
      </div>
    </div>
  );
}
