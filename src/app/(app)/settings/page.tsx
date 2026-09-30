import type { Metadata } from 'next';
import { CheckCircle2, Cpu, KeyRound, XCircle } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { getEnv } from '@/server/env';
import { getProviderStatus } from '@/server/ai/status';
import { getUsageSummary } from '@/server/services/usage';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UsageCard } from '@/components/dashboard/usage-card';
import { logoutAction } from '@/app/(auth)/actions';

export const metadata: Metadata = { title: 'Settings' };

const Yes = ({ ok }: { ok: boolean }) => ok ? <Badge tone="canon" icon={<CheckCircle2 className="size-3" aria-hidden />}>configured</Badge> : <Badge icon={<XCircle className="size-3" aria-hidden />}>not set</Badge>;

export default async function SettingsPage() {
  const user = await requireUser();
  const st = getProviderStatus(getEnv());
  const usage = await getUsageSummary(await getAppDb(), user.id);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader title="Account" action={<form action={logoutAction}><button className="h-9 cursor-pointer rounded-lg border border-line px-3 text-sm hover:bg-sunken">Sign out</button></form>} />
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-faint">Name</dt><dd className="font-medium">{user.name || '—'}</dd></div>
          <div><dt className="text-ink-faint">Email</dt><dd className="font-medium">{user.email}</dd></div>
        </dl>
      </Card>
      <Card>
        <CardHeader title="AI provider" description="Configured on the server through environment variables. Keys are never sent to the browser." />
        <div className="space-y-4 p-5 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-ink-faint">Writing provider</dt><dd className="flex items-center gap-2 font-medium"><Cpu className="size-4 text-accent" aria-hidden />{st.aiProvider}</dd></div>
            <div><dt className="text-ink-faint">Models</dt><dd className="font-medium">{st.mainModel} <span className="text-ink-faint">· fast: {st.fastModel}</span></dd></div>
            <div><dt className="text-ink-faint">Embeddings</dt><dd className="font-medium">{st.embeddingProvider} · {st.embeddingModel}</dd></div>
            <div><dt className="text-ink-faint">Anthropic server-side fallback</dt><dd className="font-medium">{st.aiProvider === 'anthropic' ? st.anthropicServerFallback : 'n/a'}</dd></div>
            <div><dt className="flex items-center gap-1 text-ink-faint"><KeyRound className="size-3.5" aria-hidden />ANTHROPIC_API_KEY</dt><dd><Yes ok={st.keyConfigured.anthropic} /></dd></div>
            <div><dt className="flex items-center gap-1 text-ink-faint"><KeyRound className="size-3.5" aria-hidden />OPENAI_API_KEY</dt><dd><Yes ok={st.keyConfigured.openai} /></dd></div>
            <div><dt className="flex items-center gap-1 text-ink-faint"><KeyRound className="size-3.5" aria-hidden />GEMINI_API_KEY (free)</dt><dd><Yes ok={st.keyConfigured.gemini} /></dd></div>
          </dl>
          {st.local && (
            <p className="rounded-xl border border-info/20 bg-info-soft p-4 text-info">
              Running fully offline. Drafts are structured scaffolds; memory, retrieval, continuity and voice analysis are fully functional.
              For real AI prose at no cost, get a free Gemini key at aistudio.google.com/apikey, set <code>AI_PROVIDER=gemini</code> and <code>GEMINI_API_KEY</code> in <code>.env.local</code>, and restart (see README → AI provider setup).
            </p>
          )}
        </div>
      </Card>
      <UsageCard usage={usage} provider={st.aiProvider} />
    </main>
  );
}
