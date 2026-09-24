/**
 * Pure display helpers, shared by the server pages and the client table.
 * Dates render in UTC on purpose: a client component is rendered twice (once
 * on the server, once on hydration) and a locale- or timezone-dependent
 * string would differ between the two and trip a hydration mismatch.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDay(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDay(iso)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `now` is passed in rather than read, so both renders agree on the answer. */
export function relativeTime(iso: string, now: number) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDay(iso);
}

export function accuracyTone(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-rose-600';
}
