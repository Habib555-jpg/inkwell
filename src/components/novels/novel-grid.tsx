'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import { AlertTriangle, BookMarked, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type NovelSummary = { id: string; title: string; genre: string; premise: string; updatedAt: Date; chapterCount: number; canonCount: number; openConflicts: number };

export function NovelGrid({ novels }: { novels: NovelSummary[] }) {
  return (
    <motion.ul
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {novels.map((n) => (
        <motion.li key={n.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
          <Link href={`/novels/${n.id}`} className="group block h-full rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-lift hover:ring-1 hover:ring-accent/20">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-soft to-sunken text-accent"><BookMarked className="size-5" aria-hidden /></div>
              {n.genre && <Badge tone="accent">{n.genre}</Badge>}
            </div>
            <h3 className="font-serif text-xl font-semibold leading-snug group-hover:text-accent">{n.title}</h3>
            {n.premise && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{n.premise}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>{n.chapterCount} chapter{n.chapterCount === 1 ? '' : 's'}</span>
              <Badge tone="canon" icon={<CheckCircle2 className="size-3" aria-hidden />}>{n.canonCount} canon</Badge>
              {n.openConflicts > 0 && <Badge tone="changed" icon={<AlertTriangle className="size-3" aria-hidden />}>{n.openConflicts} to review</Badge>}
            </div>
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}
