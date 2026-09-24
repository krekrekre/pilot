'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CONFIRM_WORD = 'DELETE';

export default function ClearDataButton({ rows, subjects }: { rows: number; subjects: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped('');
    setError(null);
  }

  async function clearAll() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/clear', { method: 'POST' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setOpen(false);
      setTyped('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (rows === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition px-3 py-1.5 rounded-lg hover:bg-rose-50"
      >
        Clear all data
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/40"
          onClick={close}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6"
          >
            <h2 id="clear-title" className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">
              Delete all training data?
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed mb-1">
              This permanently deletes{' '}
              <strong className="font-mono tabular-nums text-slate-900">{rows}</strong>{' '}
              recorded run{rows === 1 ? '' : 's'} across{' '}
              <strong className="font-mono tabular-nums text-slate-900">{subjects}</strong>{' '}
              subject{subjects === 1 ? '' : 's'}.
            </p>
            <p className="text-sm text-rose-600 font-semibold mb-4">
              This cannot be undone. There is no backup.
            </p>

            <label htmlFor="confirm-word" className="block text-xs text-slate-500 mb-1.5">
              Type <span className="font-mono font-bold text-slate-700">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              id="confirm-word"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && armed) clearAll(); }}
              disabled={busy}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 disabled:bg-slate-50"
            />

            {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!armed || busy}
                className="text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {busy ? 'Deleting…' : `Delete ${rows} run${rows === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
