import Link from 'next/link';
import Logo from '@/components/Logo';

const PLANS = [
  {
    name: 'Free',
    price: '€0',
    period: 'forever',
    cta: 'Get started free',
    href: '/signup',
    highlight: false,
    features: [
      '3 practice sessions per day',
      'Acoustic Memory module',
      'Adjustable difficulty',
      'Basic score tracking',
    ],
    missing: ['Full score history', 'All test modules', 'Priority support'],
  },
  {
    name: 'Pro',
    price: '€9.99',
    period: 'per month',
    annualNote: 'or €79.99/year — save 33%',
    cta: 'Start Pro',
    href: '/signup?plan=pro',
    highlight: true,
    features: [
      'Unlimited practice sessions',
      'All test modules (now + future)',
      'Full score history & trends',
      'All difficulty settings',
      'Priority support',
    ],
    missing: [],
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="w-full border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-brand-500 hover:text-brand-600 transition-colors">
            <Logo className="w-7 h-7" />
            <span className="font-bold text-slate-900 tracking-tight text-base">CadetReady</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition px-3 py-1.5">Sign in</Link>
            <Link href="/signup" className="text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition">Start free</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 text-balance">
              Simple, transparent pricing
            </h1>
            <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
              Start free. Upgrade when you need the full suite. Cancel anytime.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 flex flex-col gap-5 ${
                  plan.highlight
                    ? 'bg-brand-700 text-white border border-brand-500'
                    : 'bg-white border border-slate-200'
                }`}
              >
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-brand-100' : 'text-slate-500'}`}>
                    {plan.name}
                  </div>
                  <div className={`text-3xl font-extrabold font-[family-name:var(--font-jetbrains-mono)] ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                    {plan.price}
                  </div>
                  <div className={`text-xs mt-0.5 ${plan.highlight ? 'text-brand-100' : 'text-slate-400'}`}>
                    {plan.period}
                    {plan.annualNote && <div className="mt-0.5 text-brand-100/80">{plan.annualNote}</div>}
                  </div>
                </div>

                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className={`text-xs mt-0.5 font-bold ${plan.highlight ? 'text-brand-100' : 'text-emerald-600'}`}>✓</span>
                      <span className={plan.highlight ? 'text-brand-100' : 'text-slate-700'}>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map(f => (
                    <li key={f} className="flex items-start gap-2.5 opacity-40">
                      <span className="text-xs mt-0.5 font-bold">—</span>
                      <span className={plan.highlight ? 'text-brand-100' : 'text-slate-500'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition ${
                    plan.highlight
                      ? 'bg-white text-brand-500 hover:bg-brand-100'
                      : 'bg-brand-500 text-white hover:bg-brand-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Prices in EUR · Billed securely via Stripe · Cancel anytime
          </p>
        </div>
      </main>

      <footer className="py-6 border-t border-slate-100 text-center text-xs text-slate-400">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span>© {new Date().getFullYear()} Pilot Prep</span>
          <Link href="/" className="hover:text-slate-600 transition">Home</Link>
          <Link href="/login" className="hover:text-slate-600 transition">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
