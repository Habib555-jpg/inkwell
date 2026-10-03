'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import { AlertTriangle, BookMarked, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Spotlight } from '@/components/ui/spotlight';

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
          <Spotlight className="rounded-[var(--radius-card)]">
          <Link href={`/novels/${n.id}`} className="glass group relative block h-full overflow-hidden rounded-[var(--radius-card)] border border-line p-5 shadow-card transition-all duration-300 hover:border-accent/30 hover:shadow-lift">
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent/0 blur-2xl transition-colors duration-500 group-hover:bg-accent/20" aria-hidden />
            <div className="relative mb-3 flex items-start justify-between gap-3">
              <div className="bg-brand grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-glow transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"><BookMarked className="size-5" aria-hidden /></div>
              {n.genre && <Badge tone="accent">{n.genre}</Badge>}
            </div>
            <h3 className="relative font-serif text-xl font-semibold capitalize leading-snug transition-colors group-hover:text-accent">{n.title}</h3>
            {n.premise && <p className="relative mt-1 line-clamp-2 text-sm text-ink-soft">{n.premise}</p>}
            <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>{n.chapterCount} chapter{n.chapterCount === 1 ? '' : 's'}</span>
              <Badge tone="canon" icon={<CheckCircle2 className="size-3" aria-hidden />}>{n.canonCount} canon</Badge>
              {n.openConflicts > 0 && <Badge tone="changed" icon={<AlertTriangle className="size-3" aria-hidden />}>{n.openConflicts} to review</Badge>}
            </div>
          </Link>
          </Spotlight>
        </motion.li>
      ))}
    </motion.ul>
  );
}
