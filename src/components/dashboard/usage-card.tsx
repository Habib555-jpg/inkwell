import { Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type Usage = { totalInput: number; totalOutput: number; estimated: boolean; byOperation: { operation: string; input: number; output: number; calls: number }[] };
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function UsageCard({ usage, provider }: { usage: Usage; provider: string }) {
  const max = Math.max(1, ...usage.byOperation.map((o) => o.input + o.output));
  return (
    <div className="glass rounded-[var(--radius-card)] border border-line p-5 shadow-card">
      <div className="flex items-center gap-2"><Gauge className="size-4 text-accent" aria-hidden /><h3 className="font-semibold">AI usage · 30 days</h3>
        {usage.estimated && <Badge tone="info">estimated</Badge>}</div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{fmt(usage.totalInput + usage.totalOutput)} <span className="text-sm font-normal text-ink-faint">tokens</span></p>
      <p className="text-xs text-ink-faint">{fmt(usage.totalInput)} in · {fmt(usage.totalOutput)} out · {provider === 'local' ? 'offline local provider — no cost' : provider}</p>
      {usage.byOperation.length > 0 && (
        <ul className="mt-4 space-y-2">
          {usage.byOperation.sort((a, b) => b.input + b.output - (a.input + a.output)).map((o) => (
            <li key={o.operation} className="text-xs">
              <div className="flex justify-between"><span className="text-ink-soft">{o.operation.replaceAll('_', ' ')}</span><span className="tabular-nums text-ink-faint">{o.calls} calls · {fmt(o.input + o.output)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full bg-accent" style={{ width: `${((o.input + o.output) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
