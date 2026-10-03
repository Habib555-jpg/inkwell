'use client';
import { useCallback, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bot, Brain, Cpu, GitBranch, MessageSquareHeart, RefreshCw, ScanSearch, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from './status-badge';
import { ActionBar, type Busy } from './action-bar';
import { RequirementsDrawer } from './requirements-drawer';
import { FeedbackPanel } from './feedback-panel';
import { ContinuityPanel } from './continuity-panel';
import { MemoryUsedPanel } from './memory-used-panel';
import { VersionsPanel } from './versions-panel';
import { ApproveDialog } from './approve-dialog';
import { AssistantPanel } from './assistant-panel';
import { GenerationProgress } from './generation-progress';
import { AnimatePresence, motion } from 'motion/react';
import { checkAction, generateAction, getProposalAction, improveAction, retryExtractionAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import type { ContinuityReport, CriticReport, MemoryLabel, WsChapter, WsFeedback, WsProposal, WsVersion, WsVersionSummary } from './types';

const EditorPane = dynamic(() => import('./editor-pane'), {
  ssr: false,
  loading: () => <div className="min-h-[65vh] animate-pulse glass rounded-[var(--radius-card)] border border-line" aria-label="Loading editor" />,
});

type Tab = 'assistant' | 'feedback' | 'continuity' | 'memory' | 'versions';
// The saved tab lives in localStorage, which the server can't read: the server snapshot is null (→ default tab),
// so server and first client render agree, and the saved tab takes over after hydration.
const readTab = (): Tab | null => { try { return localStorage.getItem('wn:ws-tab') as Tab | null; } catch { return null; } };
const subscribeStorage = (cb: () => void) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); };

export function ChapterWorkspace({ novelId, chapter, versions, current, characters, openConflicts, feedback, memoryUsed, provider }: {
  novelId: string; chapter: WsChapter; versions: WsVersionSummary[]; current: WsVersion | null; characters: { id: string; name: string }[];
  openConflicts: number; feedback: WsFeedback[]; memoryUsed: MemoryLabel[]; provider: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const savedTab = useSyncExternalStore(subscribeStorage, readTab, () => null);
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab = picked ?? savedTab ?? 'assistant';
  const [proposal, setProposal] = useState<WsProposal | null>(null);
  const [reports, setReports] = useState<{ versionId: string; continuity: ContinuityReport; critic: CriticReport } | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [notApplied, setNotApplied] = useState<{ change: string }[]>([]);
  const [, startTransition] = useTransition();
  const editorApi = useRef<{ flush: () => Promise<{ versionId: string | null; savedAt: string | null }> } | null>(null);
  /** Approval targets exactly what is on screen: pending edits are saved first (possibly into a new version). */
  const prepareApproval = async () => {
    const f = editorApi.current ? await editorApi.current.flush() : { versionId: current!.id, savedAt: null };
    return { versionId: f.versionId ?? current!.id, expectedUpdatedAt: f.savedAt ?? undefined };
  };
  const setTab = (t: Tab) => { setPicked(t); try { localStorage.setItem('wn:ws-tab', t); } catch { /* optional */ } };
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const run = async <T,>(kind: Exclude<Busy, null>, fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, after: (d: T) => void) => {
    setBusy(kind);
    try { const r = await fn(); if (r.ok) after(r.data); else toast.error(r.error); } finally { setBusy(null); }
  };
  const generate = () => run('generate', () => generateAction(chapter.id), () => { toast.success('New draft ready'); setNotApplied([]); refresh(); });
  const improve = () => current && run('improve', () => improveAction(current.id), (p) => { setProposal({ id: p.id, source: 'critic', baseVersionId: p.baseVersionId, items: p.items }); setTab('feedback'); });
  const check = () => current && run('check', () => checkAction(current.id), (d) => { setReports({ versionId: current.id, continuity: d.continuity, critic: d.critic }); setTab('continuity'); });
  const retry = () => run('approve', () => retryExtractionAction(chapter.id), (r) => { if (r.extractionStatus === 'done') toast.success('Memory updated from canon'); else toast.error(r.error ?? 'Extraction failed again'); refresh(); });

  const continuity = reports && reports.versionId === current?.id ? reports.continuity : current?.continuityReport ?? null;
  const critic = reports && reports.versionId === current?.id ? reports.critic : current?.criticReport ?? null;
  const isCanon = !!current && current.id === chapter.approvedVersionId;
  const isLocalDraft = current?.generationMeta?.provider === 'local' && current.content.startsWith('[Local draft');
  const vNum = (id: string) => versions.find((v) => v.id === id)?.versionNumber ?? 0;
  const issues = (continuity?.issues.filter((i) => i.severity !== 'info').length ?? 0);

  return (
    <div className="grid gap-6 px-4 py-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-accent/25 bg-accent-soft/70 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Chapter {chapter.number}</span>
          <h1 className="text-gradient w-full pb-1 font-serif text-3xl font-semibold tracking-tight sm:w-auto sm:text-4xl">{chapter.title || 'Untitled'}</h1>
          <StatusBadge status={chapter.status} />
          {current && <Badge>v{current.versionNumber} · {current.source}</Badge>}
          {isLocalDraft && <Badge tone="info" icon={<Cpu className="size-3" aria-hidden />}>Local draft</Badge>}
        </header>

        {chapter.status === 'canon_changed' && (
          <div className="flex items-start gap-3 rounded-xl border border-changed/30 bg-changed-soft px-4 py-3 text-sm text-changed" role="status">
            <GitBranch className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>This chapter&apos;s text differs from the approved canon (v{vNum(chapter.approvedVersionId!)}). Memory still reflects the approved version — approve this version to update it.</span>
          </div>
        )}
        {chapter.extractionStatus === 'failed' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-draft/30 bg-draft-soft px-4 py-3 text-sm text-draft" role="alert">
            <AlertTriangle className="size-4" aria-hidden /><span className="flex-1">The chapter is canon, but updating memory failed. Nothing was lost.</span>
            <button onClick={retry} className="inline-flex cursor-pointer items-center gap-1 font-semibold underline"><RefreshCw className="size-3.5" aria-hidden />Retry</button>
          </div>
        )}
        {openConflicts > 0 && (
          <Link href={`/novels/${novelId}/memory?tab=conflicts`} className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent hover:shadow-card">
            <Brain className="size-4" aria-hidden />{openConflicts} memory conflict{openConflicts === 1 ? '' : 's'} from this chapter need your decision →
          </Link>
        )}
        {isLocalDraft && (
          <p className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
            This is a structured scaffold from the offline provider: scenes, beats and voice cues built from your requirements and memory. Write the prose over it (then remove the first line), or connect an AI provider for full drafts.
          </p>
        )}
        {notApplied.length > 0 && (
          <div className="rounded-xl border border-draft/30 bg-draft-soft px-4 py-3 text-sm text-draft">
            <p className="font-medium">The local provider couldn&apos;t apply these — edit them by hand or connect an AI provider:</p>
            <ul className="mt-1 list-disc pl-5">{notApplied.map((n, i) => <li key={i}>{n.change}</li>)}</ul>
          </div>
        )}

        <ActionBar hasVersion={!!current} isCanon={isCanon} busy={busy} onGenerate={generate} onImprove={() => void improve()} onCheck={() => void check()} onApprove={() => setApproveOpen(true)} />
        <RequirementsDrawer chapter={chapter} characters={characters} defaultOpen={!current && !chapter.mainIdea} onSaved={refresh} />

        <div className="relative">
        <AnimatePresence>{busy === 'generate' && <GenerationProgress key="gen" />}</AnimatePresence>
        {current ? (
          // each new version blurs in (Magic UI "Blur Fade")
          <motion.div key={current.id} initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease: 'easeOut' }}>
          <EditorPane key={current.id} chapterId={chapter.id} apiRef={editorApi} versionId={current.id} versionNumber={current.versionNumber} initialContent={current.content}
            readOnly={busy === 'generate' || busy === 'apply'} targetWords={chapter.targetWords ?? 2500} onForked={refresh} />
          </motion.div>
        ) : (
          <div className="glass relative grid min-h-[40vh] place-items-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center text-ink-soft">
            <div className="pointer-events-none absolute left-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />
            <div className="relative"><Sparkles className="mx-auto mb-3 size-6 text-accent" aria-hidden /><p className="font-serif text-lg font-semibold text-ink">No draft yet</p><p className="mt-1 text-sm">Check the requirements, then generate a draft — memory from approved chapters is added automatically.</p></div>
          </div>
        )}
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label="Writing partner panels" className="w-full">
            <TabsTrigger value="assistant"><Bot className="size-4" aria-hidden />Assistant</TabsTrigger>
            <TabsTrigger value="feedback"><MessageSquareHeart className="size-4" aria-hidden />Feedback</TabsTrigger>
            <TabsTrigger value="continuity"><ScanSearch className="size-4" aria-hidden />Checks{issues > 0 && <span className="rounded-full bg-draft px-1.5 text-xs text-white">{issues}</span>}</TabsTrigger>
            <TabsTrigger value="memory"><Brain className="size-4" aria-hidden />Memory</TabsTrigger>
            <TabsTrigger value="versions"><GitBranch className="size-4" aria-hidden />Versions</TabsTrigger>
          </TabsList>
          <div className="glass mt-3 rounded-[var(--radius-card)] border border-line p-4 shadow-card">
            <TabsContent value="assistant" className="mt-0">
              <AssistantPanel novelId={novelId} chapterId={chapter.id} hasDraft={!!current} onVersionCreated={refresh}
                onReviewProposal={(id) => void run('feedback', () => getProposalAction(id), (p) => { setProposal({ id: p.id, source: p.source, baseVersionId: p.baseVersionId, items: p.items }); setTab('feedback'); })} />
            </TabsContent>
            <TabsContent value="feedback" className="mt-0">
              {current ? (
                <FeedbackPanel versionId={current.id} versionNumber={current.versionNumber} proposal={proposal}
                  history={feedback.map((f) => ({ ...f, versionNumber: vNum(f.chapterVersionId) }))}
                  onProposal={setProposal} onWantsApproval={() => setApproveOpen(true)}
                  onApplied={(na) => { setNotApplied(na); setProposal(null); refresh(); }} />
              ) : <p className="text-sm text-ink-soft">Generate or write a draft first.</p>}
            </TabsContent>
            <TabsContent value="continuity" className="mt-0">
              <ContinuityPanel continuity={continuity} critic={critic} novelId={novelId} onFix={() => void improve()} />
            </TabsContent>
            <TabsContent value="memory" className="mt-0"><MemoryUsedPanel labels={memoryUsed} meta={current?.generationMeta ?? null} /></TabsContent>
            <TabsContent value="versions" className="mt-0">
              {versions.length ? <VersionsPanel versions={versions} currentId={chapter.currentVersionId} approvedId={chapter.approvedVersionId} onChanged={refresh} /> : <p className="text-sm text-ink-soft">No versions yet.</p>}
            </TabsContent>
          </div>
        </Tabs>
        <p className="mt-3 text-center text-xs text-ink-soft">Provider: {provider === 'local' ? 'offline local (no key)' : provider}</p>
      </aside>

      {current && (
        <ApproveDialog open={approveOpen} onOpenChange={setApproveOpen} prepare={prepareApproval} versionNumber={current.versionNumber}
          chapterNumber={chapter.number} novelId={novelId} onApproved={refresh} />
      )}
    </div>
  );
}
