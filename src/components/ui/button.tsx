'use client';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Shimmer } from './shimmer';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'canon';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; icon?: React.ReactNode;
  /** Primary only: a light travels around the edge — reserve for the one main action on a screen. */
  shimmer?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-glow hover:brightness-110',
  secondary: 'glass text-ink border border-line hover:border-accent/40 hover:text-accent',
  ghost: 'text-ink-soft hover:text-ink hover:bg-sunken',
  danger: 'bg-changed text-white hover:brightness-110',
  canon: 'bg-gradient-to-br from-canon to-[color-mix(in_oklab,var(--color-canon)_70%,black)] text-white shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-canon)_70%,transparent)] hover:brightness-110 dark:text-[#07140f]',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, shimmer, className, children, disabled, ...rest }, ref,
) {
  const edge = shimmer && variant === 'primary' && !loading && !disabled;
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center rounded-xl font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variants[variant], sizes[size],
        // in-progress primary actions (Generate, Apply…) get a light sweep instead of just fading out
        loading && variant === 'primary' && 'shimmer disabled:opacity-95',
        edge && 'relative z-0 overflow-hidden',
        className,
      )}
      {...rest}
    >
      {edge && <Shimmer />}
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
