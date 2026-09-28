'use client';
import { useCallback, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bot, Brain, Cpu, GitBranch, MessageSquareHeart, RefreshCw, ScanSearch } from 'lucide-react';
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
import { checkAction, generateAction, improveAction, retryExtractionAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import type { ContinuityReport, CriticReport, MemoryLabel, WsChapter, WsFeedback, WsProposal, WsVersion, WsVersionSummary } from './types';

const EditorPane = dynamic(() => import('./editor-pane'), {
  ssr: false,
  loading: () => <div className="min-h-[65vh] animate-pulse rounded-[var(--radius-card)] border border-line bg-surface" aria-label="Loading editor" />,
});

type Tab = 'assistant' | 'feedback' | 'continuity' | 'memory' | 'versions';
const readTab = (): Tab => { try { return (localStorage.getItem('wn:ws-tab') as Tab) || 'feedback'; } catch { return 'feedback'; } };

export function ChapterWorkspace({ novelId, chapter, versions, current, characters, openConflicts, feedback, memoryUsed, provider }: {
  novelId: string; chapter: WsChapter; versions: WsVersionSummary[]; current: WsVersion | null; characters: { id: string; name: string }[];
  openConflicts: number; feedback: WsFeedback[]; memoryUsed: MemoryLabel[]; provider: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [proposal, setProposal] = useState<WsProposal | null>(null);
  const [reports, setReports] = useState<{ versionId: string; continuity: ContinuityReport; critic: CriticReport } | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [notApplied, setNotApplied] = useState<{ change: string }[]>([]);
  const [, startTransition] = useTransition();
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem('wn:ws-tab', t); } catch { /* optional */ } };
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
          <span className="font-serif text-lg text-ink-faint">Chapter {chapter.number}</span>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{chapter.title || 'Untitled'}</h1>
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

        <RequirementsDrawer chapter={chapter} characters={characters} defaultOpen={!current && !chapter.mainIdea} onSaved={refresh} />
        <ActionBar hasVersion={!!current} isCanon={isCanon} busy={busy} onGenerate={generate} onImprove={() => void improve()} onCheck={() => void check()} onApprove={() => setApproveOpen(true)} />

        {current ? (
          <EditorPane key={current.id} versionId={current.id} versionNumber={current.versionNumber} initialContent={current.content}
            readOnly={busy === 'generate' || busy === 'apply'} targetWords={chapter.targetWords ?? 2500} onForked={refresh} />
        ) : (
          <div className="grid min-h-[40vh] place-items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 p-8 text-center text-ink-soft">
            <div><p className="font-medium text-ink">No draft yet</p><p className="mt-1 text-sm">Check the requirements, then generate a draft — memory from approved chapters is added automatically.</p></div>
          </div>
        )}
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
          <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <TabsContent value="assistant" className="mt-0">
              <p className="text-sm text-ink-soft">Assistant modes arrive with the next build step.</p>
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
        <p className="mt-3 text-center text-xs text-ink-faint">Provider: {provider === 'local' ? 'offline local (no key)' : provider}</p>
      </aside>

      {current && (
        <ApproveDialog open={approveOpen} onOpenChange={setApproveOpen} versionId={current.id} versionNumber={current.versionNumber}
          chapterNumber={chapter.number} novelId={novelId} onApproved={refresh} />
      )}
    </div>
  );
}
