'use client';

import { Fragment } from 'react';

/* ── Settings slider ─────────────────────────────────────────────────────
   One control for every module's settings panel.

   The reason this is a component rather than a bare <input type="range">:
   a tick label has to sit where its value actually is. Laying three labels
   out with `justify-between` puts the middle one at the halfway point of the
   track no matter what it says, so a "10" under a 1–25 slider pointed at 13.
   Here every tick is placed from its own value.

   A range thumb does not travel the full width — its centre runs from
   THUMB_W/2 to (width - THUMB_W/2), because the browser keeps the thumb
   inside the box. Ticks and the filled portion use that same span, so a tick
   marks the exact spot the thumb lands on.
------------------------------------------------------------------------ */

/* Must match the thumb width in globals.css */
const THUMB_W = 10;

export interface SliderTick {
  value: number;
  label: string;
}

interface SettingSliderProps {
  label: string;
  /** The readout, already formatted — "12", "1.5s", "0.8x". */
  display: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  ticks: SliderTick[];
  onChange: (value: number) => void;
}

/* Where a value sits along the track, in CSS the browser agrees with. */
function offsetOf(value: number, min: number, max: number): string {
  const span = max - min;
  const f = span === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / span));
  return `calc(${f * 100}% + ${(0.5 - f) * THUMB_W}px)`;
}

export default function SettingSlider({
  label, display, value, min, max, step, ticks, onChange,
}: SettingSliderProps) {
  const filled = offsetOf(value, min, max);

  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-2">
        <span className="text-slate-700">{label}</span>
        <span className="text-brand-500 font-mono font-bold tabular-nums">{display}</span>
      </div>

      <div className="relative h-[22px] group">
        {/* rail */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-slate-200" />
        {/* filled portion — stops dead under the centre of the thumb */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-brand-500 transition-[width] duration-75"
          style={{ width: filled }}
        />
        <input
          type="range"
          className="setting-slider absolute inset-0"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(+e.target.value)}
          aria-label={label}
          aria-valuetext={display}
        />
      </div>

      <div className="relative h-5 mt-1.5">
        {ticks.map((t, i) => {
          const left = offsetOf(t.value, min, max);
          // The end labels are pulled inside the track so they cannot spill
          // out of the settings column; the mark itself stays put.
          const shift = i === 0 ? '0%' : i === ticks.length - 1 ? '-100%' : '-50%';
          return (
            <Fragment key={t.value}>
              <span
                className="absolute top-0 w-px h-1.5 bg-slate-300"
                style={{ left, transform: 'translateX(-50%)' }}
              />
              <span
                className="absolute top-[9px] text-[10px] leading-none text-slate-400 whitespace-nowrap"
                style={{ left, transform: `translateX(${shift})` }}
              >
                {t.label}
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
