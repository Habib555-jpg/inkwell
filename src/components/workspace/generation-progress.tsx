'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Brain, Check, Feather, Loader2, MessagesSquare, ScanSearch } from 'lucide-react';
import { cn } from '@/lib/cn';

// The pipeline's real stages, in order (pipeline/generate.ts: context pack → generateText → runDraftChecks).
// The server doesn't stream progress, so the list advances on a timer and parks on the last stage until the
// draft actually arrives.
const STAGES = [
  { label: 'Gathering canon memory', icon: Brain },
  { label: 'Loading character voices', icon: MessagesSquare },
  { label: 'Writing the draft', icon: Feather },
  { label: 'Checking continuity & voice', icon: ScanSearch },
];

/** Overlay shown over the editor while a draft is generated (list motion after Magic UI "Animated List"). */
export function GenerationProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STAGES.length - 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 grid place-items-center rounded-[var(--radius-card)] bg-paper/70 backdrop-blur-sm"
      role="status" aria-live="polite" aria-label={`Generating: ${STAGES[step].label}`}
    >
      <div className="glass w-[min(92%,22rem)] rounded-2xl border border-line p-5 shadow-lift">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Drafting chapter</p>
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {STAGES.slice(0, step + 1).map(({ label, icon: Icon }, i) => {
              const done = i < step;
              return (
                <motion.li key={label} layout
                  initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="flex items-center gap-3 text-sm">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', done ? 'bg-canon-soft text-canon' : 'bg-brand text-white shadow-glow')}>
                    {done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                  </span>
                  <span className={done ? 'text-ink-soft' : 'font-medium text-ink'}>{label}</span>
                  {!done && <Loader2 className="ml-auto size-4 animate-spin text-accent" aria-hidden />}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}
