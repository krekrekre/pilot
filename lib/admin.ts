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
  // The gate 404s for every kind of denial so it doesn't advertise itself.
  // That makes a misconfigured deployment indistinguishable from "not an
  // admin", so say which one it was in the server log.
  const allowed = allowedAdmins();
  if (allowed.length === 0) {
    console.warn('[admin] denied: ADMIN_EMAILS is unset or empty in this environment');
    return null;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.warn('[admin] denied: Supabase env vars missing in this environment');
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const email = user?.email?.toLowerCase();
    if (!email) {
      console.warn('[admin] denied: no signed-in user on this request');
      return null;
    }
    if (!allowed.includes(email)) {
      console.warn('[admin] denied: signed-in email is not in ADMIN_EMAILS');
      return null;
    }
    return email;
  } catch {
    // A broken auth lookup must deny access, never grant it.
    return null;
  }
}
