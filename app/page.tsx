import Link from 'next/link';
import Logo from '@/components/Logo';

const FEATURES = [
  {
    icon: '🎧',
    title: 'Number Memory',
    desc: 'Hear a sequence of digits and recall them in order. Trains auditory working memory — a core pilot aptitude metric.',
    badge: 'Available now',
    href: '/training/number-memory',
  },
  {
    icon: '🧊',
    title: 'Spatial Orientation (CUBE)',
    desc: 'Track a position on an imagined cube through spoken rotation commands. Trains 3D mental rotation.',
    badge: 'Available now',
    href: '/training/cube',
  },
  {
    icon: '🕐',
    title: 'Spatial Orientation (CLOCK)',
    desc: 'Read the time from a rotated dial that shows only one hour number. Trains mental rotation and reference-frame shifting.',
    badge: 'Available now',
    href: '/training/clock',
  },
  {
    icon: '🧭',
    title: 'Spatial Orientation (COMPASS)',
    desc: 'Read a bearing off a rotated compass that names only one of its eight points. Trains mental rotation and reference-frame shifting.',
    badge: 'Available now',
    href: '/training/compass',
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
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── NAV ── */}
      <nav className="w-full border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5 text-brand-500 hover:text-brand-600 transition-colors">
              <Logo className="w-7 h-7" />
              <span className="font-bold text-slate-900 tracking-tight text-base">CadetReady</span>
            </Link>
            <Link href="/training" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition px-2 py-1.5">
              Training
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="px-5 sm:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-20 items-center">

          <div>
            <h1 className="text-[2.5rem] sm:text-5xl font-bold text-slate-900 tracking-[-0.03em] leading-[1.05] text-balance">
              Practice the tests airlines actually screen you on.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg">
              Pilot Prep rebuilds the cognitive subtests used in airline selection. Start with
              auditory number memory, timed and scored the way the real assessment runs it.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/training/number-memory"
                className="px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors"
              >
                Start the number memory test
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-semibold text-slate-700 hover:text-brand-500 underline underline-offset-4 decoration-slate-300 hover:decoration-brand-500 transition-colors"
              >
                See pricing
              </Link>
            </div>

            <p className="mt-5 text-xs text-slate-400">Free to start. No card required.</p>

            <div className="mt-12 pt-7 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-3">Modelled on the subtest formats used in</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-500">
                <span>PILAPT</span>
                <span>COMPASS</span>
                <span>ADAPT</span>
                <span>cut-e</span>
              </div>
            </div>
          </div>

          {/* Live module preview — mirrors the real number memory screen */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(15,23,42,0.16)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
              <span className="text-xs font-semibold text-slate-500">Number memory</span>
              <span className="text-xs text-slate-400 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">03 / 10</span>
            </div>

            <div className="px-6 py-9">
              <div className="flex items-end justify-center gap-1.5 h-14 mb-9" aria-hidden="true">
                <div className="eq-bar eq-bar-1" />
                <div className="eq-bar eq-bar-2" />
                <div className="eq-bar eq-bar-3" />
                <div className="eq-bar eq-bar-4" />
                <div className="eq-bar eq-bar-5" />
              </div>

              <div className="flex justify-center gap-2" aria-hidden="true">
                {['8', '3', '6', '0', '', ''].map((d, i) => (
                  <div
                    key={i}
                    className={`w-11 h-14 rounded-lg flex items-center justify-center text-xl font-[family-name:var(--font-jetbrains-mono)] tabular-nums ${
                      d
                        ? 'border border-slate-200 bg-white text-slate-900'
                        : 'border border-dashed border-slate-200 bg-slate-50 text-slate-300'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <p className="mt-7 text-center text-xs text-slate-400 leading-relaxed">
                Six digits, read aloud once.<br />Type them back in order.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRAINING MODULES ── */}
      <section className="bg-slate-50 border-t border-slate-100 py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">Training modules</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
              Every test you&apos;ll face, practiced here first
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => {
              const cardClass = `group bg-white rounded-2xl border p-6 flex flex-col gap-4 transition ${f.href ? 'border-brand-500/30 hover:border-brand-500/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40' : 'border-slate-200 opacity-70'}`;

              const content = (
                <>
                  <div className="text-3xl">{f.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-slate-900 text-sm">{f.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.href ? 'bg-brand-500/10 text-brand-500' : 'bg-slate-100 text-slate-400'}`}>
                        {f.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                  {f.href && (
                    <span className="mt-auto text-xs font-bold text-brand-500 group-hover:underline w-fit">
                      Start training →
                    </span>
                  )}
                </>
              );

              return f.href ? (
                <Link key={f.title} href={f.href} className={cardClass}>
                  {content}
                </Link>
              ) : (
                <div key={f.title} className={cardClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-14 text-balance">Simple. Deliberate. Effective.</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-left">
            {[
              { n: '1', t: 'Choose a test', d: 'Pick the cognitive skill you want to develop — auditory memory, numerical speed, or spatial reasoning.' },
              { n: '2', t: 'Practice with precision', d: 'Adjust difficulty, speed, and sequence length. Every session is randomly generated so you never memorise patterns.' },
              { n: '3', t: 'Track your progress', d: 'Your score history shows how your accuracy and speed improve over time — so you know exactly where to focus.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 font-extrabold text-sm flex items-center justify-center flex-shrink-0 mt-0.5 font-[family-name:var(--font-jetbrains-mono)]">{s.n}</div>
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
      <section className="bg-brand-700 py-20 px-5 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 text-balance">
            Your assessment is closer than you think.
          </h2>
          <p className="text-brand-100 text-sm sm:text-base mb-8 leading-relaxed">
            Start with the free number memory test today. Upgrade when you&apos;re ready for the full suite.
          </p>
          <Link href="/signup" className="inline-block px-8 py-3.5 rounded-xl bg-white text-brand-500 font-bold text-sm shadow-lg transition hover:bg-brand-100">
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
