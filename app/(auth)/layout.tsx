import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="py-5 px-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#8c1d68] flex items-center justify-center text-white text-sm font-bold">✈</div>
          <span className="font-bold text-slate-900 text-sm">Pilot Prep</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </div>
      <footer className="py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Pilot Prep
      </footer>
    </div>
  );
}
