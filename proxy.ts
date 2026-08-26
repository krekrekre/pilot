import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/training'];
const AUTH_PATHS = ['/login', '/signup'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some(p => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) return NextResponse.next();

  // If Supabase isn't configured (local dev without .env.local filled in), allow all
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next();

  const { createServerClient } = await import('@supabase/ssr');
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/training', request.url));
  }

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (!sub || sub.status !== 'active') {
      return NextResponse.redirect(new URL('/pricing', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/training/:path*', '/login', '/signup'],
};
