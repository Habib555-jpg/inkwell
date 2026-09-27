import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/session';
import { Card, CardHeader } from '@/components/ui/card';
import { logoutAction } from '@/app/(auth)/actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
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
    </main>
  );
}
