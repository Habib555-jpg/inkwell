import { requireUser } from '@/server/auth/session';
import { AppNav } from '@/components/app-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <AppNav user={user} />
      {children}
    </>
  );
}
