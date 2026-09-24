import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serviceClient } from '@/lib/admin';
import { MODULE_SLUGS } from '@/lib/modules';

/** First-party cookie that ties a visitor's runs together before they sign up. */
const ANON_COOKIE = 'cr_vid';
const ANON_MAX_AGE = 60 * 60 * 24 * 365;

type Payload = {
  moduleSlug: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
  config?: unknown;
};

/** The browser is untrusted — reject anything that isn't a plausible result. */
function parse(body: unknown): Payload | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  const { moduleSlug, score, totalQuestions, accuracy } = b;
  if (typeof moduleSlug !== 'string' || !MODULE_SLUGS.includes(moduleSlug)) return null;

  const nums = [score, totalQuestions, accuracy];
  if (!nums.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0)) return null;

  const s = score as number, t = totalQuestions as number, a = accuracy as number;
  if (t === 0 || t > 500 || s > t || a > 100) return null;

  return { moduleSlug, score: s, totalQuestions: t, accuracy: a, config: b.config };
}

export async function POST(req: NextRequest) {
  // No backend configured (local dev) — accept and drop.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true });
  }

  let payload: Payload | null;
  try {
    payload = parse(await req.json());
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const response = NextResponse.json({ ok: true });

  // Who ran this? A signed-in user, or an anonymous visitor we give a cookie to.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  let anonId: string | null = null;
  if (!user) {
    anonId = req.cookies.get(ANON_COOKIE)?.value ?? crypto.randomUUID();
    response.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ANON_MAX_AGE,
      path: '/',
    });
  }

  try {
    const { error } = await serviceClient().from('training_sessions').insert({
      user_id: user?.id ?? null,
      anon_id: user ? null : anonId,
      module_slug: payload.moduleSlug,
      score: payload.score,
      total_questions: payload.totalQuestions,
      accuracy: payload.accuracy,
      config: payload.config ?? null,
      user_agent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
    });
    // supabase-js reports failures on the result, it does not throw.
    if (error) console.error('Score save failed:', error.message);
  } catch (err) {
    console.error('Score save error:', err);
    // A failed save must not break the learner's results screen.
  }

  return response;
}
