'use client';
import { useRef } from 'react';
import { BookCheck, History, Layers, ListTree, ScrollText, Settings2, Users, type LucideIcon } from 'lucide-react';
import { AnimatedBeam } from '@/components/ui/animated-beam';

type Node = { label: string; icon: LucideIcon };
const LEFT: Node[] = [{ label: 'Novel profile', icon: Settings2 }, { label: 'Story bible', icon: Users }, { label: 'Canon timeline', icon: History }];
const RIGHT: Node[] = [{ label: 'Approved chapters', icon: BookCheck }, { label: 'Semantic memory', icon: Layers }, { label: 'Preferences', icon: ScrollText }];

/** One memory layer plus the beam that carries it into the hub. */
function Branch({ node, side, index, box, hub }: {
  node: Node; side: 'left' | 'right'; index: number;
  box: React.RefObject<HTMLDivElement | null>; hub: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = node.icon;
  return (
    <>
      <div className={`flex items-center gap-2.5 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
        <div ref={ref} className="glass relative z-10 grid size-11 shrink-0 place-items-center rounded-xl border border-line text-accent shadow-card">
          <Icon className="size-4.5" aria-hidden />
        </div>
        <span className="relative z-10 hidden rounded-md bg-surface/80 px-1.5 text-xs font-medium text-ink-soft sm:inline">{node.label}</span>
      </div>
      <AnimatedBeam containerRef={box} fromRef={ref} toRef={hub} curvature={(index - 1) * -40}
        delay={(side === 'right' ? 1.2 : 0) + index * 0.4} reverse={side === 'right'} />
    </>
  );
}

/** How memory reaches a draft: layers 1–6 stream into the current chapter's context (Magic UI animated beams). */
export function MemoryFlow() {
  const box = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  return (
    <section className="glass overflow-hidden rounded-[var(--radius-card)] border border-line p-5 shadow-card sm:p-6" aria-label="How memory feeds each draft">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold">How memory reaches a draft</h2>
        <p className="text-sm text-ink-faint">Every generation assembles layer 7 from canon layers 1–6 — nothing from unapproved drafts.</p>
      </div>
      <div ref={box} className="relative flex items-center justify-between gap-4 py-2">
        <div className="flex flex-col gap-6">{LEFT.map((n, i) => <Branch key={n.label} node={n} side="left" index={i} box={box} hub={hub} />)}</div>
        <div ref={hub} className="bg-brand relative z-10 flex flex-col items-center rounded-2xl px-4 py-3 text-center text-white shadow-glow">
          <ListTree className="size-5" aria-hidden />
          <span className="mt-1 text-xs font-semibold">Current chapter</span>
          <span className="text-[10px] opacity-80">layer 7</span>
        </div>
        <div className="flex flex-col gap-6">{RIGHT.map((n, i) => <Branch key={n.label} node={n} side="right" index={i} box={box} hub={hub} />)}</div>
      </div>
    </section>
  );
}
