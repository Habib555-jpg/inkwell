'use client';
import { useTransition } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteChunkAction, deleteFactAction, reindexAction } from '@/app/(app)/novels/[novelId]/memory/actions';

export function ChunksList({ novelId, chunks, model }: { novelId: string; chunks: { id: string; chapterNumber: number; chunkIndex: number; content: string; keywords: string[]; embeddingModel: string }[]; model: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Passages of approved chapters, searchable by meaning. Embedding model in use: <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{model}</code></p>
        <Button variant="secondary" loading={pending} icon={<RefreshCw className="size-4" aria-hidden />}
          onClick={() => start(async () => { const r = await reindexAction(novelId); if (r.ok) toast.success(`Re-indexed ${r.data.chunks} passages`); else toast.error(r.error); })}>Re-index all canon</Button>
      </div>
      {chunks.length === 0 ? <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">No passages yet. They appear when chapters are approved.</p> : (
        <ul className="space-y-2">
          {chunks.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <span>Chapter {c.chapterNumber} · passage {c.chunkIndex + 1}</span>
                {c.embeddingModel !== model && <Badge tone="draft">old model — re-index</Badge>}
                <Button size="sm" variant="ghost" className="ml-auto text-changed" disabled={pending} title="Removes this passage from retrieval. The chapter stays canon." aria-label="Delete passage from memory"
                  onClick={() => start(async () => { const r = await deleteChunkAction(novelId, c.id); if (!r.ok) toast.error(r.error); })} icon={<Trash2 className="size-3.5" />} />
              </div>
              <p className="manuscript mt-1 line-clamp-4 text-sm">{c.content}</p>
              {c.keywords.length > 0 && <p className="mt-1 text-xs text-ink-faint">{c.keywords.slice(0, 8).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const KIND: Record<string, string> = { new_character: 'New character', new_location: 'New location', new_faction: 'New faction', new_object: 'New object', world_rule: 'World rule', event: 'Event', relationship: 'Relationship', character_state: 'Character change', character_development: 'Development', revelation: 'Revelation' };

export function FactsList({ novelId, facts }: { novelId: string; facts: { id: string; chapterNumber: number; kind: string; content: string }[] }) {
  const [pending, start] = useTransition();
  const chapters = [...new Set(facts.map((f) => f.chapterNumber))].sort((a, b) => a - b);
  if (!facts.length) return <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">Facts extracted from approved chapters appear here.</p>;
  return (
    <div className="space-y-5">
      {chapters.map((n) => (
        <section key={n}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">Chapter {n}</h3>
          <ul className="space-y-1.5">
            {facts.filter((f) => f.chapterNumber === n).map((f) => (
              <li key={f.id} className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm shadow-card">
                <Badge tone={f.kind === 'revelation' ? 'changed' : f.kind.startsWith('new_') ? 'info' : 'neutral'}>{KIND[f.kind] ?? f.kind}</Badge>
                <span className="flex-1">{f.content}</span>
                <button aria-label="Delete fact" disabled={pending} className="cursor-pointer text-ink-faint hover:text-changed"
                  onClick={() => start(async () => { const r = await deleteFactAction(novelId, f.id); if (!r.ok) toast.error(r.error); })}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
