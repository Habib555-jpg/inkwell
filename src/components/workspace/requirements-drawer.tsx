'use client';
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { RequirementsForm } from '@/components/chapters/requirements-form';
import { saveRequirementsAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import type { WsChapter } from './types';

export function RequirementsDrawer({ chapter, characters, defaultOpen, onSaved }: {
  chapter: WsChapter; characters: { id: string; name: string }[]; defaultOpen: boolean; onSaved: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const summary = [chapter.requiredEvents.length && `${chapter.requiredEvents.length} must happen`, chapter.forbiddenEvents.length && `${chapter.forbiddenEvents.length} must not`,
    chapter.characterIds.length && `${chapter.characterIds.length} characters`].filter(Boolean).join(' · ');
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left">
        <ClipboardList className="size-4 text-accent" aria-hidden />
        <span className="font-medium">Chapter requirements</span>
        <span className="truncate text-sm text-ink-faint">{chapter.mainIdea || 'Tell your writing partner what this chapter must do'}{summary && ` · ${summary}`}</span>
        <ChevronDown className={`ml-auto size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-line p-5">
              <RequirementsForm characters={characters} submitLabel="Save requirements" pending={pending}
                initial={{ title: chapter.title, mainIdea: chapter.mainIdea, requiredEvents: chapter.requiredEvents, forbiddenEvents: chapter.forbiddenEvents, characterIds: chapter.characterIds,
                  tone: chapter.tone, dialoguePoints: chapter.dialoguePoints, restrictions: chapter.restrictions, targetWords: chapter.targetWords, instructions: chapter.instructions }}
                onSubmit={({ number: _n, ...r }) => start(async () => {
                  const res = await saveRequirementsAction(chapter.id, r);
                  if (res.ok) { toast.success('Requirements saved'); setOpen(false); onSaved(); } else toast.error(res.error);
                })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
