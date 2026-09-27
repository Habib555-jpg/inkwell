'use client';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'canon';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; icon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-accent to-accent-strong text-accent-ink shadow-card hover:shadow-lift',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken',
  ghost: 'text-ink-soft hover:text-ink hover:bg-sunken',
  danger: 'bg-changed text-white hover:brightness-110',
  canon: 'bg-gradient-to-b from-canon to-[color-mix(in_oklab,var(--color-canon)_80%,black)] text-white shadow-card hover:shadow-lift',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
