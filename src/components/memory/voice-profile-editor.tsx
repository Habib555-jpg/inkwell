'use client';
import { useState, useTransition } from 'react';
import { Check, Lock, MessageSquareQuote, Pin, PinOff, RotateCcw, Sprout, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { updateVoiceAction, resetVoiceFieldAction, resolveVoiceNoteAction } from '@/app/(app)/novels/[novelId]/memory/actions';

type Sample = { quote: string; chapterNumber: number };
export type VoiceProfileData = {
  characterId: string; register: string; sentenceLength: string; emotionalBaseline: string; verbalTics: string[]; avoid: string[];
  sampleLines: Sample[]; pinnedSamples: Sample[]; relationshipRegisters: { toCharacterId: string; note: string }[];
  userVoiceNotes: string; lockedFields: string[]; lineCount: number; lexicalSignature: string[];
};
type Lockable = 'register' | 'sentenceLength' | 'emotionalBaseline' | 'verbalTics' | 'avoid' | 'sampleLines' | 'relationshipRegisters';

export function VoiceProfileEditor({ novelId, name, profile, notes, names }: {
  novelId: string; name: string; profile: VoiceProfileData; notes: { id: string; note: string }[]; names: Record<string, string>;
}) {
  const [v, setV] = useState({ ...profile, tics: profile.verbalTics.join(', '), avoidText: profile.avoid.join(', ') });
  const [pending, start] = useTransition();
  const locked = (f: Lockable) => profile.lockedFields.includes(f);
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const save = () => start(async () => {
    const patch: Record<string, unknown> = { userVoiceNotes: v.userVoiceNotes };
    if (v.register !== profile.register) patch.register = v.register;
    if (v.sentenceLength !== profile.sentenceLength) patch.sentenceLength = v.sentenceLength;
    if (v.emotionalBaseline !== profile.emotionalBaseline) patch.emotionalBaseline = v.emotionalBaseline;
    if (v.tics !== profile.verbalTics.join(', ')) patch.verbalTics = split(v.tics);
    if (v.avoidText !== profile.avoid.join(', ')) patch.avoid = split(v.avoidText);
    const r = await updateVoiceAction(novelId, profile.characterId, patch);
    if (r.ok) toast.success(`${name}'s voice saved`); else toast.error(r.error);
  });
  const pin = (s: Sample, on: boolean) => start(async () => {
    const pinnedSamples = on ? [...profile.pinnedSamples, s] : profile.pinnedSamples.filter((x) => x.quote !== s.quote);
    const r = await updateVoiceAction(novelId, profile.characterId, { pinnedSamples });
    if (!r.ok) toast.error(r.error);
  });
  const reset = (f: Lockable) => start(async () => { const r = await resetVoiceFieldAction(novelId, profile.characterId, f); if (r.ok) toast.success('Reset to what canon shows'); else toast.error(r.error); });
  const note = (id: string, accept: boolean) => start(async () => { const r = await resolveVoiceNoteAction(novelId, id, accept); if (!r.ok) toast.error(r.error); });
  const lockTag = (f: Lockable) => locked(f) ? (
    <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-normal normal-case text-accent"><Lock className="size-3" aria-hidden />yours
      <button type="button" onClick={() => reset(f)} className="cursor-pointer underline" title="Let canon dialogue derive this again"><RotateCcw className="inline size-3" aria-hidden /> reset</button></span>
  ) : null;
  const samples = [...profile.pinnedSamples, ...profile.sampleLines.filter((s) => !profile.pinnedSamples.some((p) => p.quote === s.quote))];
  const lbl = 'mb-1 flex items-center text-xs font-semibold uppercase tracking-wide text-ink-soft';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareQuote className="size-4 text-accent" aria-hidden />
        <h3 className="font-semibold">{name}&apos;s voice</h3>
        {profile.lineCount < 5
          ? <Badge tone="draft" icon={<Sprout className="size-3" aria-hidden />}>Voice still forming ({profile.lineCount} lines)</Badge>
          : <Badge tone="canon">{profile.lineCount} canon lines</Badge>}
        {profile.lexicalSignature.length > 0 && <span className="text-xs text-ink-faint">Signature words: {profile.lexicalSignature.slice(0, 6).join(', ')}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><p className={lbl}>Register{lockTag("register")}</p>
          <Select aria-label="Register" value={v.register} onChange={(e) => setV({ ...v, register: e.target.value })}>
            <option value="">Unknown</option><option value="casual">Casual</option><option value="neutral">Neutral</option><option value="formal">Formal</option><option value="crude">Crude</option>
          </Select></div>
        <div><p className={lbl}>Sentence length{lockTag("sentenceLength")}</p>
          <Select aria-label="Sentence length" value={v.sentenceLength} onChange={(e) => setV({ ...v, sentenceLength: e.target.value })}>
            <option value="">Unknown</option><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
          </Select></div>
        <div><p className={lbl}>Emotional baseline{lockTag("emotionalBaseline")}</p>
          <Input aria-label="Emotional baseline" value={v.emotionalBaseline} onChange={(e) => setV({ ...v, emotionalBaseline: e.target.value })} /></div>
        <div className="sm:col-span-3"><p className={lbl}>Verbal tics (comma separated){lockTag("verbalTics")}</p>
          <Input aria-label="Verbal tics" value={v.tics} onChange={(e) => setV({ ...v, tics: e.target.value })} placeholder="Figures, look" /></div>
        <div className="sm:col-span-3"><p className={lbl}>Never says (comma separated){lockTag("avoid")}</p>
          <Input aria-label="Never says" value={v.avoidText} onChange={(e) => setV({ ...v, avoidText: e.target.value })} placeholder="indeed, perhaps" /></div>
        <div className="sm:col-span-3"><p className={lbl}>Your voice notes (always wins)</p>
          <Textarea aria-label="Author voice notes" value={v.userVoiceNotes} onChange={(e) => setV({ ...v, userVoiceNotes: e.target.value })} placeholder="How this character talks, in your words." /></div>
      </div>
      {samples.length > 0 && (
        <div>
          <p className={lbl}>Canon lines used as voice samples</p>
          <ul className="space-y-1.5">
            {samples.map((s) => {
              const pinned = profile.pinnedSamples.some((p) => p.quote === s.quote);
              return (
                <li key={s.quote} className="flex items-start gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
                  <span className="manuscript flex-1">“{s.quote}” <span className="text-xs text-ink-faint">ch {s.chapterNumber}</span></span>
                  <button type="button" onClick={() => pin(s, !pinned)} disabled={pending} aria-label={pinned ? 'Unpin sample' : 'Pin sample'} className="cursor-pointer text-ink-faint hover:text-accent">
                    {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {profile.relationshipRegisters.length > 0 && (
        <div><p className={lbl}>With others{lockTag("relationshipRegisters")}</p>
          <ul className="flex flex-wrap gap-2 text-xs">{profile.relationshipRegisters.map((r) => <li key={r.toCharacterId} className="rounded-full bg-sunken px-2.5 py-1">{r.note || `with ${names[r.toCharacterId] ?? "someone"}`}</li>)}</ul></div>
      )}
      {notes.length > 0 && (
        <div className="rounded-xl border border-draft/30 bg-draft-soft/50 p-3">
          <p className="mb-2 text-sm font-medium text-draft">Suggested voice notes from your feedback — nothing is applied until you accept:</p>
          <ul className="space-y-1.5">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{n.note}</span>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => note(n.id, true)} icon={<Check className="size-3.5" aria-hidden />}>Accept</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => note(n.id, false)} icon={<X className="size-3.5" aria-hidden />}>Reject</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end"><Button onClick={save} loading={pending}>Save voice</Button></div>
    </div>
  );
}
