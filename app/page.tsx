import Link from 'next/link';

const FEATURES = [
  {
    icon: '🎧',
    title: 'Number Memory',
    desc: 'Hear a sequence of digits and recall them in order. Trains auditory working memory — a core pilot aptitude metric.',
    badge: 'Available now',
    href: '/games/number-memory',
  },
  {
    icon: '🔢',
    title: 'Mental Arithmetic',
    desc: 'Rapid-fire calculations under time pressure. Mirrors the numerical reasoning sections of PILAPT and COMPASS.',
    badge: 'Coming soon',
    href: null,
  },
  {
    icon: '🧩',
    title: 'Pattern Recognition',
    desc: 'Identify the rule in a visual sequence and predict the next item. Directly maps to abstract reasoning subtests.',
    badge: 'Coming soon',
    href: null,
  },
  {
    icon: '🗺️',
    title: 'Spatial Awareness',
    desc: 'Mentally rotate and navigate 3D objects. Core to the instrument interpretation sections of most airline assessments.',
    badge: 'Coming soon',
    href: null,
  },
];

const STATS = [
  { value: '6', label: 'Aptitude categories' },
  { value: '10k+', label: 'Practice sessions' },
  { value: '95%', label: 'Score improvement rate' },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── NAV ── */}
      <nav className="w-full border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#8c1d68] flex items-center justify-center text-white text-sm font-bold">✈</div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">Pilot Prep</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-bold bg-[#8c1d68] hover:bg-[#751857] text-white px-4 py-2 rounded-lg transition">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-[#8c1d68]/8 border border-[#8c1d68]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#8c1d68] mb-7 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8c1d68] animate-pulse" />
          Built for pilot aptitude assessments
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] text-balance mb-6">
          Train your mind.<br />
          <span className="text-[#8c1d68]">Ace your assessment.</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-500 max-w-2xl leading-relaxed mb-10">
          Targeted cognitive training for PILAPT, COMPASS, ADAPT, and airline-specific aptitude tests.
          Sharpen your working memory, reaction speed, and numerical reasoning — the skills that get you through selection.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup" className="px-8 py-3.5 rounded-xl bg-[#8c1d68] hover:bg-[#751857] text-white font-bold text-sm shadow-lg shadow-[#8c1d68]/25 transition hover:scale-[1.02] active:scale-[0.98]">
            Start training — it&apos;s free
          </Link>
          <Link href="/pricing" className="px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition">
            View pricing
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 pt-8 border-t border-slate-100 w-full">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">{s.value}</div>
              <div className="text-xs text-slate-400 font-semibold mt-0.5 tracking-wide uppercase">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GAMES ── */}
      <section className="bg-slate-50 border-t border-slate-100 py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-[#8c1d68] uppercase tracking-widest mb-3">Training modules</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
              Every test you&apos;ll face, practiced here first
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className={`bg-white rounded-2xl border p-6 flex flex-col gap-4 transition ${f.href ? 'border-[#8c1d68]/30 hover:border-[#8c1d68]/60 hover:shadow-md cursor-pointer' : 'border-slate-200 opacity-70'}`}>
                <div className="text-3xl">{f.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-bold text-slate-900 text-sm">{f.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.href ? 'bg-[#8c1d68]/10 text-[#8c1d68]' : 'bg-slate-100 text-slate-400'}`}>
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
                {f.href && (
                  <Link href={f.href} className="mt-auto text-xs font-bold text-[#8c1d68] hover:underline">
                    Start training →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-[#8c1d68] uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-14 text-balance">Simple. Deliberate. Effective.</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-left">
            {[
              { n: '1', t: 'Choose a test', d: 'Pick the cognitive skill you want to develop — auditory memory, numerical speed, or spatial reasoning.' },
              { n: '2', t: 'Practice with precision', d: 'Adjust difficulty, speed, and sequence length. Every session is randomly generated so you never memorise patterns.' },
              { n: '3', t: 'Track your progress', d: 'Your score history shows how your accuracy and speed improve over time — so you know exactly where to focus.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#8c1d68]/10 text-[#8c1d68] font-extrabold text-sm flex items-center justify-center flex-shrink-0 mt-0.5 font-[family-name:var(--font-jetbrains-mono)]">{s.n}</div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1.5 text-sm">{s.t}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#600038] py-20 px-5 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 text-balance">
            Your assessment is closer than you think.
          </h2>
          <p className="text-[#fce7f3] text-sm sm:text-base mb-8 leading-relaxed">
            Start with the free number memory test today. Upgrade when you&apos;re ready for the full suite.
          </p>
          <Link href="/signup" className="inline-block px-8 py-3.5 rounded-xl bg-white text-[#8c1d68] font-bold text-sm shadow-lg transition hover:bg-[#fce7f3]">
            Create your free account
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-6 border-t border-slate-100 text-center text-xs text-slate-400">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span>© {new Date().getFullYear()} Pilot Prep</span>
          <Link href="/pricing" className="hover:text-slate-600 transition">Pricing</Link>
          <Link href="/login" className="hover:text-slate-600 transition">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
