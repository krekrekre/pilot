import Link from 'next/link';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';

/** The signed-in user, or null — including when Supabase isn't configured. */
async function currentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // /training is open to anonymous visitors, so the nav has to cope with
  // having no session rather than assuming one.
  const user = await currentUser();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <nav className="w-full border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-5">
          <Link href="/" className="mr-2 flex items-center gap-2.5 text-brand-500 hover:text-brand-600 transition-colors">
            <Logo className="w-6 h-6" />
            <span className="font-bold text-slate-900 tracking-tight text-sm">CadetReady</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link href="/training" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition text-sm">
              Training
            </Link>
            {/* Dashboard is hidden while it's still a placeholder and sits behind
                the subscription gate in proxy.ts — the link would dead-end at
                /login. Restore this once the page shows real stats. */}
          </div>
          <div className="ml-auto">
            {user ? (
              <LogoutButton />
            ) : (
              <Link href="/login" className="text-xs text-slate-400 hover:text-slate-700 font-medium transition px-2 py-1">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

function LogoutButton() {
  // Client component inline — keeps layout as server component
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="text-xs text-slate-400 hover:text-slate-700 font-medium transition px-2 py-1">
        Sign out
      </button>
    </form>
  );
}
