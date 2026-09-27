import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'canon' | 'draft' | 'changed' | 'info' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-soft border-line',
  canon: 'bg-canon-soft text-canon border-canon/25',
  draft: 'bg-draft-soft text-draft border-draft/25',
  changed: 'bg-changed-soft text-changed border-changed/25',
  info: 'bg-info-soft text-info border-info/25',
  accent: 'bg-accent-soft text-accent border-accent/25',
};
export function Badge({ tone = 'neutral', className, icon, children }: { tone?: Tone; className?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {icon}{children}
    </span>
  );
}
