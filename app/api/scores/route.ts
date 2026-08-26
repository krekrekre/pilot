import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // If Supabase isn't configured, silently accept (dev mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await req.json();
    const { createServerClient } = await import('@supabase/ssr');

    const response = NextResponse.json({ ok: true });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase.from('game_sessions').insert({
      user_id: user.id,
      game_slug: body.gameSlug,
      score: body.score,
      total_questions: body.totalQuestions,
      accuracy: body.accuracy,
      config: body.config,
    });

    return response;
  } catch (err) {
    console.error('Score save error:', err);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
