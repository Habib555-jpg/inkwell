'use client';
import type { GenerationMeta, MemoryLabel } from './types';

const SECTIONS: { key: string; title: string }[] = [
  { key: 'voice', title: 'Voice' }, { key: 'character', title: 'Characters' }, { key: 'recent', title: 'Previous chapters' },
  { key: 'chunk', title: 'Relevant canon' }, { key: 'timeline', title: 'Timeline' }, { key: 'relationship', title: 'Relationships' },
  { key: 'world', title: 'World' }, { key: 'preference', title: 'Writing preferences' },
];

export function MemoryUsedPanel({ labels, meta }: { labels: MemoryLabel[]; meta: GenerationMeta | null }) {
  if (!labels.length) return <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">Memory used for a draft appears here after generating. Your own edits don&apos;t use AI memory.</p>;
  const b = meta?.budget;
  return (
    <div className="space-y-4">
      {b && (
        <div>
          <div className="flex justify-between text-xs text-ink-faint"><span>Context budget</span><span className="tabular-nums">{b.used.toLocaleString()} / {b.limit.toLocaleString()} tokens</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-gradient-to-r from-accent to-canon" style={{ width: `${Math.min(100, (b.used / b.limit) * 100)}%` }} /></div>
          {b.trimmed.length > 0 && <p className="mt-1 text-xs text-ink-faint">{b.trimmed.length} lower-priority items were left out to stay within budget.</p>}
        </div>
      )}
      {SECTIONS.map(({ key, title }) => {
        const items = labels.filter((l) => l.section === key);
        if (!items.length) return null;
        return (
          <section key={key}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h4>
            <ul className="space-y-1.5">
              {items.map((l, i) => l.detail ? (
                <li key={i}><details className="rounded-lg bg-sunken px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">{l.label}</summary><p className="manuscript mt-2 text-sm text-ink-soft">{l.detail}</p></details></li>
              ) : <li key={i} className="rounded-lg bg-sunken px-3 py-2 text-sm">{l.label}</li>)}
            </ul>
          </section>
        );
      })}
      {meta?.provider && <p className="text-xs text-ink-faint">Written by {meta.provider === 'local' ? 'the offline local provider' : `${meta.provider} · ${meta.model}`}.</p>}
    </div>
  );
}
