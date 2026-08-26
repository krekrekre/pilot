import Link from 'next/link';
import Logo from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="py-5 px-6">
        <Link href="/" className="w-fit flex items-center gap-2.5 text-brand-500 hover:text-brand-600 transition-colors">
          <Logo className="w-7 h-7" />
          <span className="font-bold text-slate-900 tracking-tight text-base">CadetReady</span>
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
