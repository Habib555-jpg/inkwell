'use client';
import { motion } from 'motion/react';

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center"
    >
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-ink-faint">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
