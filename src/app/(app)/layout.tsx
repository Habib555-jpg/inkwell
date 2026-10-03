import Link from 'next/link';
import { Gauge } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { getUsageSummary } from '@/server/services/usage';
import { AppNav } from '@/components/app-nav';

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const u = await getUsageSummary(await getAppDb(), user.id);
  const usage = (
    <Link href="/settings" title="AI usage in the last 30 days" className="hidden h-8 items-center gap-1.5 rounded-full border border-line bg-sunken/60 px-3 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-accent sm:inline-flex">
      <Gauge className="size-3.5" aria-hidden />{fmt(u.totalInput + u.totalOutput)} tokens{u.estimated ? ' est.' : ''}
    </Link>
  );
  return (
    <>
      <AppNav user={user} usage={usage} />
      {children}
    </>
  );
}
