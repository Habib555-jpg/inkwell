'use client';
import { useState } from 'react';

export type RatingPoint = { chapterNumber: number; title: string; versions: { versionNumber: number; rating: number }[]; approvedRating: number | null };

/** Single-series line (approved rating per chapter) with faint per-version dots. Inline SVG, one axis, hover tooltips. */
export function RatingTrend({ data }: { data: RatingPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rated = data.filter((d) => d.versions.length);
  if (!rated.length) return <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">Ratings appear here once you rate drafts.</p>;
  const W = 640, H = 220, L = 32, R = 12, T = 12, B = 28;
  const xs = rated.map((d) => d.chapterNumber);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const x = (n: number) => (maxX === minX ? L + (W - L - R) / 2 : L + ((n - minX) / (maxX - minX)) * (W - L - R));
  const y = (r: number) => T + (1 - r / 10) * (H - T - B);
  const line = rated.map((d) => ({ d, r: d.approvedRating ?? d.versions.at(-1)!.rating }));
  const path = line.map(({ d, r }, i) => `${i ? 'L' : 'M'}${x(d.chapterNumber).toFixed(1)},${y(r).toFixed(1)}`).join(' ');
  const h = hover === null ? null : line[hover];
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Rating per chapter, ${rated.length} chapters rated`}>
        {[0, 5, 10].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-faint)">{g}</text>
          </g>
        ))}
        {rated.flatMap((d) => d.versions.map((v, j) => (
          <circle key={`${d.chapterNumber}-${j}`} cx={x(d.chapterNumber)} cy={y(v.rating)} r={3} fill="var(--color-accent)" opacity={0.25} />
        )))}
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {line.map(({ d, r }, i) => (
          <g key={d.chapterNumber} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
            aria-label={`Chapter ${d.chapterNumber}: ${r} out of 10${d.approvedRating !== null ? ', approved' : ''}`}>
            <circle cx={x(d.chapterNumber)} cy={y(r)} r={14} fill="transparent" />
            <circle cx={x(d.chapterNumber)} cy={y(r)} r={hover === i ? 6 : 4.5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        ))}
        {line.map(({ d }) => <text key={`x${d.chapterNumber}`} x={x(d.chapterNumber)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-ink-faint)">{d.chapterNumber}</text>)}
      </svg>
      {h && (
        <div className="pointer-events-none absolute rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lift"
          style={{ left: `${(x(h.d.chapterNumber) / W) * 100}%`, top: `${(y(h.r) / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))' }}>
          <p className="font-semibold text-ink">Chapter {h.d.chapterNumber}{h.d.title ? ` · ${h.d.title}` : ''}</p>
          <p className="text-ink-soft">{h.d.approvedRating !== null ? `Approved at ${h.d.approvedRating}/10` : `Latest ${h.r}/10 (not approved)`}</p>
          <p className="text-ink-faint">Versions: {h.d.versions.map((v) => `v${v.versionNumber} ${v.rating}`).join(' · ')}</p>
        </div>
      )}
      <figcaption className="mt-1 text-xs text-ink-faint">Line: approved (or latest) rating per chapter · faint dots: every rated version.</figcaption>
      <details className="mt-2 text-xs"><summary className="cursor-pointer text-accent">Table view</summary>
        <table className="mt-2 w-full text-left"><thead><tr className="text-ink-faint"><th>Chapter</th><th>Ratings</th><th>Approved</th></tr></thead>
          <tbody>{rated.map((d) => <tr key={d.chapterNumber}><td>{d.chapterNumber}</td><td>{d.versions.map((v) => v.rating).join(', ')}</td><td>{d.approvedRating ?? '—'}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
