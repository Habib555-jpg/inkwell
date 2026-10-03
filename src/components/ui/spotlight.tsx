'use client';
import { useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Cursor-following glow for cards (adapted from 21st.dev "Spotlight Card" by preetsuthar17).
 * Tracks the pointer through CSS variables instead of React state, so moving the mouse never re-renders;
 * the glow also shows while a child has keyboard focus.
 */
export function Spotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={move} className={cn('group/spot relative h-full', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100 group-focus-within/spot:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 0%), color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)' }}
      />
      {children}
    </div>
  );
}
