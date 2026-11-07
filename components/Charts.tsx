"use client";

import { useState } from "react";

/** Single-series horizontal bars: one hue (magnitude), label + value in text ink, hover highlights the row. */
export function BarList({ rows }: { rows: { key: string; label: string; value: number; title: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 text-sm" onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)} title={r.title}>
          <span className="truncate"><bdi>{r.label}</bdi></span>
          <span className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
            <span
              className={`block h-full rounded-full transition-opacity ${hover && hover !== r.key ? "opacity-40" : ""}`}
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 6 : 0, background: "var(--color-brand-500)" }}
            />
          </span>
          <span className="tabular-nums text-muted">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Single-series columns over time. Built with flex so the time axis follows the reading
 * direction (oldest at the start side: right in Arabic, left in French).
 */
export function Columns({ points, tableLabel, headers }: { points: { key: string; label: string; value: number; tooltip: string }[]; tableLabel: string; headers: [string, string] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="flex h-40 items-end gap-2 border-b border-line">
          {points.map((p, i) => (
            <button
              type="button"
              key={p.key}
              aria-label={p.tooltip}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative flex h-full flex-1 items-end justify-center outline-none"
            >
              <span
                className={`block w-full max-w-10 rounded-t-[4px] transition-opacity ${hover !== null && hover !== i ? "opacity-40" : ""}`}
                style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value ? 4 : 0, background: "var(--color-brand-500)" }}
              />
              {hover === i && (
                <span role="tooltip" className="surface absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-md px-2 py-1 text-xs shadow-md">
                  {p.tooltip}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          {points.map((p, i) => (
            <span key={p.key} className="flex-1 truncate text-center text-[0.7rem] text-muted">{i % 2 === points.length % 2 ? "" : p.label}</span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted">{tableLabel}</summary>
        <table className="mt-2 w-full text-start text-xs">
          <thead><tr className="text-muted"><th className="py-1 text-start font-medium">{headers[0]}</th><th className="py-1 text-end font-medium">{headers[1]}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.key} className="border-t border-line"><td className="py-1">{p.label}</td><td className="py-1 text-end tabular-nums">{p.value}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
