'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Subject, ModuleStat } from '@/lib/admin-data';
import { moduleIcon, moduleTitle } from '@/lib/modules';
import { accuracyTone, formatDateTime, formatDay, relativeTime } from '@/lib/format';

/** Settings are per-module and free-form, so render whatever keys exist. */
function ConfigChips({ config }: { config: Record<string, unknown> | null }) {
  const entries = Object.entries(config ?? {}).filter(
    ([k, v]) => k !== 'demo' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
  );
  if (entries.length === 0) return <span className="text-slate-300 text-xs">—</span>;

  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
          {k}: {String(v)}
        </span>
      ))}
    </div>
  );
}

/** Tiny inline trend line — enough to see direction without a chart library. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const w = 52, h = 16;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`)
    .join(' ');
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? 'stroke-emerald-500' : 'stroke-rose-400'}
      />
    </svg>
  );
}

function ModuleRow({ m, open, onToggle }: { m: ModuleStat; open: boolean; onToggle: () => void }) {
  const trend = m.history.length > 1 ? m.history[m.history.length - 1] - m.history[0] : null;

  return (
    <div className="border-b border-slate-100 last:border-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full text-left grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] items-center gap-x-4 gap-y-1 py-2.5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-slate-300 text-[10px] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <span className="text-base leading-none shrink-0">{moduleIcon(m.slug)}</span>
        <span className="text-sm font-semibold text-slate-800 truncate">{moduleTitle(m.slug)}</span>
      </div>

      <div className="hidden sm:block">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Avg</div>
        <div className={`text-sm font-bold font-mono tabular-nums ${accuracyTone(m.avgAccuracy)}`}>
          {m.avgAccuracy}%
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Best / worst</div>
        <div className="text-sm font-mono tabular-nums text-slate-600">
          {m.bestAccuracy}% <span className="text-slate-300">/</span> {m.worstAccuracy}%
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Runs</div>
        <div className="text-sm font-mono tabular-nums text-slate-600">{m.runs}</div>
      </div>

      <div className="hidden sm:block">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Last run</div>
        <div className="text-xs text-slate-500 whitespace-nowrap">{formatDay(m.lastRun)}</div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Sparkline values={m.history} />
        {trend !== null && trend !== 0 && (
          <span className={`text-[11px] font-bold font-mono ${trend > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>

      {/* Compact summary for narrow screens, where the columns above are hidden. */}
      <div className="sm:hidden col-span-2 flex gap-3 text-xs text-slate-500 font-mono pl-6">
        <span className={accuracyTone(m.avgAccuracy)}>{m.avgAccuracy}% avg</span>
        <span>{m.runs} runs</span>
        <span>{formatDay(m.lastRun)}</span>
      </div>
    </button>

    {open && (
      <div className="pb-3 pl-6 pr-1">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">
          {m.runs} run{m.runs === 1 ? '' : 's'}, newest first
        </div>
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          {m.attempts.map((a, i) => (
            <div
              key={a.id}
              className={`grid grid-cols-[auto_auto_1fr] sm:grid-cols-[130px_70px_60px_1fr] items-center gap-x-3 gap-y-1 px-3 py-2 text-xs ${
                i % 2 ? 'bg-slate-50/60' : 'bg-white'
              }`}
            >
              <span className="text-slate-500 whitespace-nowrap">{formatDateTime(a.at)}</span>
              <span className="font-mono tabular-nums text-slate-700 whitespace-nowrap">{a.score}/{a.total}</span>
              <span className={`font-mono tabular-nums font-bold ${accuracyTone(a.accuracy)}`}>{a.accuracy}%</span>
              <div className="col-span-3 sm:col-span-1"><ConfigChips config={a.config} /></div>
            </div>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}

export default function SubjectTable({ subjects, now }: { subjects: Subject[]; now: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_90px_90px_110px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <div>Subject</div>
        <div>Modules</div>
        <div className="text-right">Runs</div>
        <div className="text-right">Avg acc.</div>
        <div className="text-right">Last seen</div>
      </div>

      {subjects.map(s => {
        const expanded = open === s.key;
        return (
          <div key={s.key} className="border-b border-slate-50 last:border-0">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : s.key)}
              aria-expanded={expanded}
              className={`w-full text-left px-5 py-3.5 grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_90px_90px_110px] gap-2 sm:gap-4 items-center transition ${
                expanded ? 'bg-slate-50' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-slate-300 text-xs transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{s.label}</div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    s.kind === 'user' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {s.kind === 'user' ? (s.plan ?? 'free') : 'anonymous'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pl-6 sm:pl-0">
                {s.modules.map(m => (
                  <span
                    key={m.slug}
                    title={`${moduleTitle(m.slug)} — avg ${m.avgAccuracy}%, ${m.runs} run${m.runs === 1 ? '' : 's'}`}
                    className="text-base leading-none"
                  >
                    {moduleIcon(m.slug)}
                  </span>
                ))}
              </div>

              <div className="hidden sm:block text-right font-mono tabular-nums text-slate-700">{s.sessions}</div>
              <div className={`hidden sm:block text-right font-mono tabular-nums font-semibold ${accuracyTone(s.avgAccuracy)}`}>
                {s.avgAccuracy}%
              </div>
              <div className="hidden sm:block text-right text-xs text-slate-400 whitespace-nowrap">
                {relativeTime(s.lastSeen, now)}
              </div>
            </button>

            {expanded && (
              <div className="px-5 pb-4 pt-1 bg-slate-50">
                <div className="bg-white border border-slate-200 rounded-xl px-4">
                  {s.modules.map(m => {
                    const id = `${s.key}:${m.slug}`;
                    return (
                      <ModuleRow
                        key={m.slug}
                        m={m}
                        open={openModule === id}
                        onToggle={() => setOpenModule(openModule === id ? null : id)}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-slate-400">
                    {s.questions} questions answered · first seen {formatDay(s.firstSeen)}
                  </span>
                  <Link
                    href={`/admin/${encodeURIComponent(s.key)}`}
                    className="font-semibold text-brand-500 hover:text-brand-600 transition"
                  >
                    Every run →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
