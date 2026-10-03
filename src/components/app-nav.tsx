'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
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
      className="grid size-10 cursor-pointer place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sunken hover:text-accent">
      <Moon className="size-4 dark:hidden" aria-hidden /><Sun className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}

export function AppNav({ user, usage }: { user: { name: string; email: string }; usage?: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="glass-strong sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4">
        <Link href="/" className="group mr-3 flex items-center gap-2.5 font-serif text-lg font-semibold">
          <span className="bg-brand grid size-9 place-items-center rounded-xl text-white shadow-glow transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105"><Feather className="size-4" aria-hidden /></span>
          <span className="text-gradient hidden sm:inline">Inkwell</span>
        </Link>
        <nav className="isolate flex items-center gap-1" aria-label="Main">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn('relative inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink')}>
                {active && <motion.span layoutId="app-nav-pill" className="absolute inset-0 -z-10 rounded-xl border border-accent/25 bg-accent-soft shadow-card" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <Icon className={cn('size-4', active && 'text-accent')} aria-hidden /><span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {usage}
          <ThemeToggle />
          <span className="hidden max-w-40 truncate px-2 text-sm text-ink-soft lg:inline" title={user.email}>{user.name || user.email}</span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sign out" className="grid size-10 cursor-pointer place-items-center rounded-xl text-ink-soft transition-colors hover:bg-changed-soft hover:text-changed">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
