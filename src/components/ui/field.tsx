import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

/*
 * Writing wells: translucent, inset fields that let the atmosphere show through. On focus the border turns into
 * the brand's warm-to-cool gradient (gold → violet → ember, the background's own palette) with a soft glow.
 * The gradient border is a two-layer background (padding-box fill over a border-box gradient) on a transparent
 * border, so it costs no extra elements.
 */
const control = cn(
  'well w-full rounded-xl px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-faint placeholder:italic',
  'transition-[box-shadow,background] duration-300 ease-out focus:outline-none disabled:opacity-60',
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...p} />;
});
/** Long-form fields (premise, main idea, setting…) are set in the manuscript serif: they are part of the story. */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-28 resize-y py-3 font-serif text-base leading-relaxed', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(control, 'h-11 cursor-pointer', className)} {...p} />;
});

export function Label({ className, children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft', className)} {...p}>
      <span aria-hidden className="size-1.5 rotate-45 rounded-[1px] bg-gradient-to-br from-gold to-accent" />
      {children}
    </label>
  );
}

/** Label + control + hint/error, wired with ids for accessibility. */
export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={cn('group/field', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {(error || hint) && (
        <p id={describedBy} className={cn('mt-1.5 pl-3.5 text-xs', error ? 'text-changed' : 'text-ink-faint')}>{error ?? hint}</p>
      )}
    </div>
  );
}
