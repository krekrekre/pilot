import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS, so it must never be constructed
 * anywhere the result could reach the browser.
 */
export function serviceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function allowedAdmins(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The signed-in user's email if they are an admin, otherwise null.
 * Fails closed: an unset or empty ADMIN_EMAILS grants nobody access.
 */
export async function getAdminEmail(): Promise<string | null> {
  const allowed = allowedAdmins();
  if (allowed.length === 0) return null;
  // No backend configured — there is no session to check, so nobody is an admin.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const email = user?.email?.toLowerCase();
    return email && allowed.includes(email) ? email : null;
  } catch {
    // A broken auth lookup must deny access, never grant it.
    return null;
  }
}
