'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Lightbulb, MessageSquarePlus, PenLine, ScanSearch, Send, Sparkles, UserRound, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { assistantAction } from '@/app/(app)/novels/[novelId]/assistant-actions';
import type { AssistantMode } from '@/server/ai/types';

const MODES: { mode: AssistantMode; label: string; hint: string; icon: typeof Sparkles; quick: string }[] = [
  { mode: 'generate', label: 'Generate', hint: 'Draft this chapter from its requirements and memory', icon: Sparkles, quick: 'Draft this chapter' },
  { mode: 'revise', label: 'Revise', hint: 'Turn your instructions into reviewable changes', icon: PenLine, quick: 'Tighten the opening and make the dialogue less formal' },
  { mode: 'continuity', label: 'Continuity', hint: 'Check the draft against canon', icon: ScanSearch, quick: 'Check this draft for contradictions' },
  { mode: 'critic', label: 'Critic', hint: 'A demanding editor — never just “looks good”', icon: Wand2, quick: 'Critique this draft' },
  { mode: 'brainstorm', label: 'Brainstorm', hint: 'Ideas that stay out of canon', icon: Lightbulb, quick: 'What could go wrong in this chapter?' },
  { mode: 'character', label: 'Character', hint: 'Analyze one character’s voice and arc', icon: UserRound, quick: 'Tell me about ' },
  { mode: 'story_memory', label: 'Memory', hint: 'What I remember for this chapter', icon: Brain, quick: 'What do you remember?' },
];
type Msg = { role: 'user' | 'assistant'; content: string; mode: AssistantMode; meta?: Record<string, unknown> };

export function AssistantPanel({ novelId, chapterId, onVersionCreated, onReviewProposal }: {
  novelId: string; chapterId: string; onVersionCreated: () => void; onReviewProposal: (proposalId: string) => void;
}) {
  const [mode, setMode] = useState<AssistantMode>('critic');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length]);
  const current = MODES.find((m) => m.mode === mode)!;

  const send = (message: string) => {
    if (!message.trim() || pending) return;
    setMessages((m) => [...m, { role: 'user', content: message, mode }]);
    setText('');
    start(async () => {
      const r = await assistantAction({ novelId, chapterId, mode, message, conversationId });
      if (!r.ok) { toast.error(r.error); setMessages((m) => [...m, { role: 'assistant', content: `Could not complete: ${r.error}`, mode }]); return; }
      setConversationId(r.data.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: r.data.reply, mode, meta: r.data.meta }]);
      if (r.data.meta.versionId && mode === 'generate') onVersionCreated();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 xl:grid-cols-4" role="radiogroup" aria-label="Assistant mode">
        {MODES.map(({ mode: m, label, icon: Icon, hint }) => (
          <button key={m} role="radio" aria-checked={mode === m} title={hint} onClick={() => setMode(m)}
            className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors', mode === m ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-sunken')}>
            <Icon className="size-4" aria-hidden />{label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">{current.hint}. The assistant never changes canon or memory.</p>
      <div className="max-h-[48vh] min-h-40 space-y-3 overflow-y-auto rounded-xl bg-sunken p-3" aria-live="polite">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">Ask your writing partner anything about this chapter.</p>}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn('max-w-[92%] rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'ml-auto bg-accent text-accent-ink' : 'bg-surface shadow-card')}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">{MODES.find((x) => x.mode === m.mode)?.label}</p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.meta?.proposalId ? <Button size="sm" variant="secondary" className="mt-2" onClick={() => onReviewProposal(String(m.meta!.proposalId))}>Review changes</Button> : null}
            </motion.div>
          ))}
        </AnimatePresence>
        {pending && <div className="flex gap-1 px-2" aria-label="Thinking"><span className="size-2 animate-bounce rounded-full bg-ink-faint" /><span className="size-2 animate-bounce rounded-full bg-ink-faint [animation-delay:120ms]" /><span className="size-2 animate-bounce rounded-full bg-ink-faint [animation-delay:240ms]" /></div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2">
        <label htmlFor="assistant-input" className="sr-only">Message</label>
        <textarea id="assistant-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={current.quick}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text || current.quick); } }}
          className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
        <Button type="submit" aria-label="Send" loading={pending} onClick={(e) => { if (!text.trim()) { e.preventDefault(); send(current.quick); } }} icon={<Send className="size-4" aria-hidden />} />
      </form>
      <div className="flex justify-between">
        <button className="text-xs text-accent hover:underline" onClick={() => send(current.quick)} disabled={pending}>Quick: “{current.quick.trim()}”</button>
        <button className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink" onClick={() => { setMessages([]); setConversationId(undefined); }}><MessageSquarePlus className="size-3.5" aria-hidden />New thread</button>
      </div>
    </div>
  );
}
