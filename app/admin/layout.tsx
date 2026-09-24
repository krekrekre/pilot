import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminEmail } from '@/lib/admin';
import Logo from '@/components/Logo';

export const metadata = { title: 'Admin – CadetReady' };
// Always evaluate the gate against the live session.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = await getAdminEmail();
  // 404 rather than 403 — a non-admin gets no hint that this route exists.
  if (!email) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="w-full border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5 text-brand-500 hover:text-brand-600 transition-colors">
            <Logo className="w-6 h-6" />
            <span className="font-bold text-slate-900 tracking-tight text-sm">CadetReady</span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded">
            Admin
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">{email}</span>
            <Link href="/training" className="hover:text-slate-700 font-medium transition">Exit</Link>
          </div>
        </div>
      </nav>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
