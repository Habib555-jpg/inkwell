'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Feather, LayoutDashboard, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { logoutAction } from '@/app/(auth)/actions';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/novels', label: 'Novels', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function ThemeToggle() {
  // No React state: the icon swaps via the `dark` class, which the pre-paint script sets.
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('wn:theme', next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  };
  return (
    <button onClick={toggle} aria-label="Toggle light or dark theme"
      className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink">
      <Moon className="size-4 dark:hidden" aria-hidden /><Sun className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}

export function AppNav({ user, usage }: { user: { name: string; email: string }; usage?: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4">
        <Link href="/" className="mr-3 flex items-center gap-2 font-serif text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-accent-ink"><Feather className="size-4" aria-hidden /></span>
          <span className="hidden sm:inline">Inkwell</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                  active ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:bg-sunken hover:text-ink')}>
                <Icon className="size-4" aria-hidden /><span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {usage}
          <ThemeToggle />
          <span className="hidden max-w-40 truncate px-2 text-sm text-ink-soft lg:inline" title={user.email}>{user.name || user.email}</span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sign out" className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
