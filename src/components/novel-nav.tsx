'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'motion/react';
import { BookText, Brain, Globe2, History, Home, ListOrdered, Menu, Settings2, Users, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type NavChapter = { id: string; number: number; title: string; status: 'planning' | 'drafting' | 'approved' | 'canon_changed' };
const DOT: Record<NavChapter['status'], string> = { planning: 'bg-line-strong', drafting: 'bg-draft shadow-[0_0_8px_var(--color-draft)]', approved: 'bg-canon shadow-[0_0_8px_var(--color-canon)]', canon_changed: 'bg-changed shadow-[0_0_8px_var(--color-changed)]' };
const STATUS_LABEL: Record<NavChapter['status'], string> = { planning: 'Planning', drafting: 'Draft', approved: 'Canon', canon_changed: 'Canon changed' };

export function NovelNav({ novel, chapters, openConflicts }: { novel: { id: string; title: string }; chapters: NavChapter[]; openConflicts: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/novels/${novel.id}`;
  const links = [
    { href: base, label: 'Workspace', icon: Home, exact: true },
    { href: `${base}/chapters`, label: 'Chapters', icon: ListOrdered, exact: true },
    { href: `${base}/characters`, label: 'Characters', icon: Users },
    { href: `${base}/world`, label: 'World', icon: Globe2 },
    { href: `${base}/timeline`, label: 'Timeline', icon: History },
    { href: `${base}/memory`, label: 'Memory', icon: Brain, badge: openConflicts },
    { href: `${base}/settings`, label: 'Novel settings', icon: Settings2 },
  ];
  const body = (
    <nav aria-label="Novel" className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Novel</p>
        <Link href={base} className="mt-1 block font-serif text-xl font-semibold capitalize leading-tight transition-colors hover:text-accent">{novel.title}</Link>
        <div className="bg-brand mt-3 h-px w-12 rounded-full opacity-70" aria-hidden />
      </div>
      <ul className="isolate space-y-0.5">
        {links.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                className={cn('relative flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors', active ? 'font-medium text-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink')}>
                {active && <motion.span layoutId="novel-nav-pill" className="absolute inset-0 -z-10 rounded-xl border border-accent/20 bg-accent-soft" transition={{ type: 'spring', stiffness: 380, damping: 32 }}><span className="bg-brand absolute inset-y-2 left-0 w-0.5 rounded-full" /></motion.span>}
                <Icon className={cn('size-4', active && 'text-accent')} aria-hidden />{label}
                {!!badge && <span className="ml-auto rounded-full bg-changed px-1.5 text-xs font-semibold text-white" aria-label={`${badge} conflicts to review`}>{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="min-h-0">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint"><BookText className="size-3.5" aria-hidden />Chapters</p>
        {chapters.length === 0 ? <p className="text-sm text-ink-faint">No chapters yet.</p> : (
          <ul className="space-y-0.5">
            {chapters.map((c) => {
              const href = `${base}/chapters/${c.id}`;
              const active = path === href;
              return (
                <li key={c.id}>
                  <Link href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition-colors', active ? 'bg-accent-soft text-accent ring-1 ring-accent/20' : 'text-ink-soft hover:bg-sunken hover:text-ink')}>
                    <span className={cn('size-2 shrink-0 rounded-full', DOT[c.status])} title={STATUS_LABEL[c.status]} aria-label={STATUS_LABEL[c.status]} />
                    <span className="tabular-nums text-ink-faint">{c.number}.</span>
                    <span className="truncate">{c.title || 'Untitled'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open novel navigation" className="bg-brand fixed bottom-4 left-4 z-30 grid size-12 cursor-pointer place-items-center rounded-full text-white shadow-glow transition-transform active:scale-95 lg:hidden">
        <Menu className="size-5" />
      </button>
      <aside className="glass-strong sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r border-line lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Novel navigation">
          <div className="absolute inset-0 animate-overlay-in bg-[#05060d]/60 backdrop-blur-md" onClick={() => setOpen(false)} />
          <motion.div initial={{ x: -288 }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="absolute inset-y-0 left-0 w-72 border-r border-line bg-paper shadow-lift">
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-2 top-2 grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-sunken"><X className="size-4" /></button>
            {body}
          </motion.div>
        </div>
      )}
    </>
  );
}
