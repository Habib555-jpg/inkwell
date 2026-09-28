'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { AlertTriangle, BookCheck, Brain, History, Layers, ListTree, RefreshCw, Save, ScrollText, Settings2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { retryExtractionAction, updateSummaryAction } from '@/app/(app)/novels/[novelId]/memory/actions';

export type Overview = {
  counts: { characters: number; relationships: number; locations: number; factions: number; worldRules: number; objects: number; timeline: number; chunks: number; canonChapters: number; preferencesActive: number; conflictsOpen: number };
  canonChapters: { chapterId: string; number: number; title: string; summaryId: string | null; summary: string; keyEvents: string[]; wordCount: number; extractionStatus: string }[];
};

function Counter({ value }: { value: number }) {
  return <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</motion.span>;
}

function ChapterSummary({ c, novelId }: { c: Overview['canonChapters'][number]; novelId: string }) {
  const [text, setText] = useState(c.summary);
  const [pending, start] = useTransition();
  const dirty = text !== c.summary;
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/novels/${novelId}/chapters/${c.chapterId}`} className="font-serif text-lg font-semibold hover:text-accent">Chapter {c.number}{c.title ? `: ${c.title}` : ''}</Link>
        <Badge tone="canon">Canon</Badge>
        <span className="text-xs text-ink-faint">{c.wordCount.toLocaleString()} words</span>
        {c.extractionStatus === 'failed' && (
          <Button size="sm" variant="secondary" className="ml-auto" loading={pending} icon={<RefreshCw className="size-3.5" aria-hidden />}
            onClick={() => start(async () => { const r = await retryExtractionAction(novelId, c.chapterId); if (r.ok) toast.success('Memory updated'); else toast.error(r.error); })}>
            <AlertTriangle className="size-3.5 text-draft" aria-hidden />Retry memory update
          </Button>
        )}
      </div>
      <label className="sr-only" htmlFor={`sum-${c.chapterId}`}>Summary of chapter {c.number}</label>
      <Textarea id={`sum-${c.chapterId}`} value={text} onChange={(e) => setText(e.target.value)} className="mt-3 min-h-20" disabled={!c.summaryId} />
      {c.keyEvents.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-soft">{c.keyEvents.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {dirty && c.summaryId && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={pending} icon={<Save className="size-3.5" aria-hidden />} onClick={() => start(async () => {
            const r = await updateSummaryAction(novelId, c.summaryId!, text); if (r.ok) toast.success('Summary corrected'); else toast.error(r.error);
          })}>Save summary</Button>
        </div>
      )}
    </li>
  );
}

export function MemoryOverview({ overview, novelId }: { overview: Overview; novelId: string }) {
  const k = overview.counts;
  const layers = [
    { n: 1, title: 'Novel profile', value: 1, sub: 'premise, style, rules', icon: Settings2, href: `/novels/${novelId}` },
    { n: 2, title: 'Story bible', value: k.characters + k.locations + k.factions + k.worldRules + k.objects, sub: `${k.characters} characters · ${k.locations} places · ${k.worldRules} rules`, icon: Users, href: `/novels/${novelId}/characters` },
    { n: 3, title: 'Canon timeline', value: k.timeline, sub: 'events from approved chapters', icon: History, href: `/novels/${novelId}/timeline` },
    { n: 4, title: 'Approved chapters', value: k.canonChapters, sub: 'full canonical text', icon: BookCheck, href: `/novels/${novelId}/chapters` },
    { n: 5, title: 'Semantic memory', value: k.chunks, sub: 'searchable canon passages', icon: Layers, href: `?tab=semantic` },
    { n: 6, title: 'Preferences', value: k.preferencesActive, sub: 'active writing preferences', icon: ScrollText, href: `?tab=preferences` },
    { n: 7, title: 'Current chapter', value: k.relationships, sub: 'assembled per draft from layers 1–6', icon: ListTree, href: `/novels/${novelId}/chapters` },
  ];
  return (
    <div className="space-y-8">
      <motion.ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: 0.06 } } }}>
        {layers.map(({ n, title, value, sub, icon: Icon, href }) => (
          <motion.li key={n} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }}>
            <Link href={href} className="block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between"><Icon className="size-4 text-accent" aria-hidden /><span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Layer {n}</span></div>
              <p className="mt-2 text-sm font-medium">{title}</p>
              {n === 7 ? <p className="text-xs text-ink-faint">{sub}</p> : <><Counter value={value} /><p className="text-xs text-ink-faint">{sub}</p></>}
            </Link>
          </motion.li>
        ))}
        <li className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
          <Brain className="size-4 text-accent" aria-hidden /><p className="mt-2 text-sm font-medium">Conflicts to review</p>
          <Counter value={k.conflictsOpen} /><p className="text-xs text-ink-faint"><Link className="text-accent hover:underline" href="?tab=conflicts">Open conflicts</Link></p>
        </li>
      </motion.ul>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Canon chapters</h2>
        {overview.canonChapters.length ? <ul className="space-y-3">{overview.canonChapters.map((c) => <ChapterSummary key={c.chapterId} c={c} novelId={novelId} />)}</ul>
          : <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">Nothing is canon yet. Approve a chapter to start building memory.</p>}
      </section>
    </div>
  );
}
