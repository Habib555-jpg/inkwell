'use client';
import Link from 'next/link';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { Issue } from '@/server/ai/types';
import type { ContinuityReport, CriticReport } from './types';

const CANON_CATS = new Set(['canon_contradiction', 'dead_character_acts', 'location_jump', 'knowledge_error', 'relationship_inconsistency', 'world_rule_violation']);
const SEV = {
  error: { icon: AlertOctagon, tone: 'border-changed/30 bg-changed-soft/50', label: 'Must fix' },
  warning: { icon: AlertTriangle, tone: 'border-draft/30 bg-draft-soft/50', label: 'Worth a look' },
  info: { icon: Info, tone: 'border-line bg-sunken', label: 'Notes' },
} as const;

function IssueCard({ issue, novelId, onFix }: { issue: Issue; novelId: string; onFix: () => void }) {
  const S = SEV[issue.severity];
  return (
    <li className={cn('rounded-xl border p-3 text-sm', S.tone)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{issue.category.replaceAll('_', ' ')}</p>
      <p className="mt-1">{issue.message}</p>
      {issue.evidence?.quote && <blockquote className="manuscript mt-2 border-l-2 border-canon pl-3 text-sm text-ink-soft">Canon, ch {issue.evidence.chapterNumber}: “{issue.evidence.quote}”</blockquote>}
      {issue.evidence?.draftQuote && <blockquote className="manuscript mt-2 border-l-2 border-draft pl-3 text-sm text-ink-soft">Draft: “{issue.evidence.draftQuote}”</blockquote>}
      {issue.severity !== 'info' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onFix} icon={<Wand2 className="size-3.5" aria-hidden />}>Draft is wrong → propose fix</Button>
          {CANON_CATS.has(issue.category) && <Link href={`/novels/${novelId}/memory?tab=characters`} className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-accent hover:bg-accent-soft">Canon is wrong → open memory</Link>}
        </div>
      )}
    </li>
  );
}

export function ContinuityPanel({ continuity, critic, novelId, onFix }: { continuity: ContinuityReport | null; critic: CriticReport | null; novelId: string; onFix: () => void }) {
  if (!continuity && !critic) return <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">No checks yet. Generate a draft or run a continuity check.</p>;
  const issues = [...(continuity?.issues ?? []), ...(critic?.issues ?? []).filter((c) => !(continuity?.issues ?? []).some((x) => x.message === c.message))];
  const m = critic?.metrics;
  return (
    <div className="space-y-5">
      {m && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-sunken p-3"><p className="text-xs text-ink-faint">Length</p><p className="font-semibold tabular-nums">{m.wordCount.toLocaleString()} / {m.targetWords.toLocaleString()}</p></div>
          <div className="rounded-xl bg-sunken p-3"><p className="text-xs text-ink-faint">Avg sentence</p><p className="font-semibold tabular-nums">{m.avgSentenceLength.toFixed(1)} words</p></div>
          <div className="col-span-2 rounded-xl bg-sunken p-3">
            <p className="text-xs text-ink-faint">Dialogue {Math.round(m.dialogueRatio * 100)}% (target {Math.round(m.targetDialogueRange[0] * 100)}–{Math.round(m.targetDialogueRange[1] * 100)}%)</p>
            <div className="relative mt-2 h-2 rounded-full bg-line" aria-hidden>
              <div className="absolute h-full rounded-full bg-canon/30" style={{ left: `${m.targetDialogueRange[0] * 100}%`, width: `${(m.targetDialogueRange[1] - m.targetDialogueRange[0]) * 100}%` }} />
              <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface" style={{ left: `${Math.min(100, m.dialogueRatio * 100)}%` }} />
            </div>
          </div>
          {m.perCharacter.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-2">
              {m.perCharacter.map((c) => <span key={c.characterId} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs">{c.name}: {c.lines} lines · formality {c.formality.toFixed(2)}</span>)}
            </div>
          )}
        </div>
      )}
      {critic?.summary && <p className="text-sm text-ink-soft">{critic.summary}</p>}
      {continuity && !continuity.aiReviewed && <p className="flex items-center gap-2 text-xs text-ink-faint"><ShieldCheck className="size-3.5" aria-hidden />Rule-based checks. Connect an AI provider for a deeper review.</p>}
      {(['error', 'warning', 'info'] as const).map((sev) => {
        const list = issues.filter((i) => i.severity === sev);
        if (!list.length) return null;
        const { icon: Icon, label } = SEV[sev];
        return (
          <section key={sev}>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint"><Icon className="size-3.5" aria-hidden />{label} · {list.length}</h4>
            <ul className="space-y-2">{list.map((i, n) => <IssueCard key={n} issue={i} novelId={novelId} onFix={onFix} />)}</ul>
          </section>
        );
      })}
      {issues.length === 0 && <p className="rounded-xl bg-canon-soft p-4 text-sm text-canon">No problems found by the checks.</p>}
    </div>
  );
}
