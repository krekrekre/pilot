import { NextResponse } from 'next/server';
import { getAdminEmail, serviceClient } from '@/lib/admin';

/**
 * Deletes every recorded training run. POST only, and the admin check runs
 * here rather than trusting the caller — the button is just a UI on top.
 */
export async function POST() {
  const admin = await getAdminEmail();
  if (!admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const db = serviceClient();

    const { count: before } = await db
      .from('training_sessions')
      .select('*', { count: 'exact', head: true });

    // Supabase requires a filter on delete; this one matches every row.
    const { error } = await db.from('training_sessions').delete().not('id', 'is', null);
    if (error) {
      console.error('[admin] clear failed:', error.message);
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }

    // Deliberate audit line: this is destructive and irreversible.
    console.warn(`[admin] ${admin} cleared all training data (${before ?? 0} rows)`);
    return NextResponse.json({ ok: true, deleted: before ?? 0 });
  } catch (err) {
    console.error('[admin] clear error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
