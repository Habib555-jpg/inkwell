'use client';
import { motion } from 'motion/react';

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass relative flex flex-col items-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-14 text-center"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <motion.div
        className="bg-brand relative mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-glow" aria-hidden
        initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
      >{icon}</motion.div>
      <h3 className="relative font-serif text-xl font-semibold text-ink">{title}</h3>
      {children && <p className="relative mt-1 max-w-md text-sm text-ink-soft">{children}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </motion.div>
  );
}
