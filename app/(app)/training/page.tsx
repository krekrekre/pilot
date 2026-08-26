import Link from 'next/link';

const MODULES = [
  {
    slug: 'number-memory',
    icon: '🎧',
    title: 'Acoustic Memory',
    desc: 'Listen to a digit sequence and recall it in order. Trains auditory working memory.',
    category: 'Working Memory',
    available: true,
  },
  {
    slug: 'cube',
    icon: '🧊',
    title: 'Spatial Orientation (CUBE)',
    desc: 'Track a position on an imagined cube through spoken rotation commands. Trains 3D mental rotation.',
    category: 'Spatial',
    available: true,
  },
  {
    slug: 'mental-arithmetic',
    icon: '🔢',
    title: 'Mental Arithmetic',
    desc: 'Rapid calculations under time pressure — mirrors PILAPT numerical sections.',
    category: 'Numerical Reasoning',
    available: false,
  },
  {
    slug: 'pattern-recognition',
    icon: '🧩',
    title: 'Pattern Recognition',
    desc: 'Find the rule, predict the next item. Abstract reasoning for airline aptitude tests.',
    category: 'Abstract Reasoning',
    available: false,
  },
];

export default function TrainingPage() {
  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Training Hub</h1>
        <p className="text-sm text-slate-500">Select a module to begin your session.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {MODULES.map(g => {
          const cardClass = `group rounded-2xl border p-6 flex gap-5 transition ${g.available ? 'border-slate-200 hover:border-brand-500/40 hover:shadow-md cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40' : 'border-slate-100 bg-slate-50/60 opacity-60'}`;

          const content = (
            <>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${g.available ? 'bg-brand-500/8' : 'bg-slate-100'}`}>
                {g.icon}
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-sm">{g.title}</h2>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${g.available ? 'bg-brand-500/10 text-brand-500' : 'bg-slate-200 text-slate-400'}`}>
                    {g.available ? g.category : 'Coming soon'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{g.desc}</p>
                {g.available && (
                  <span className="mt-2 text-xs font-bold text-brand-500 group-hover:underline w-fit">
                    Start session →
                  </span>
                )}
              </div>
            </>
          );

          return g.available ? (
            <Link key={g.slug} href={`/training/${g.slug}`} className={cardClass}>
              {content}
            </Link>
          ) : (
            <div key={g.slug} className={cardClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
