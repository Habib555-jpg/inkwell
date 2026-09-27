'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode;
  children?: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" />
        <D.Content
          className={cn('fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-lift focus:outline-none',
            wide ? 'max-w-4xl' : 'max-w-lg')}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-ink-soft">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="grid size-9 cursor-pointer place-items-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** In-UI confirmation (never window.confirm). */
export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, danger, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: React.ReactNode; confirmLabel: string;
  onConfirm: () => void; danger?: boolean; loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={body}
      footer={<>
        <button className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm hover:bg-sunken" onClick={() => onOpenChange(false)}>Cancel</button>
        <button
          className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60', danger ? 'bg-changed' : 'bg-accent')}
          disabled={loading} onClick={onConfirm}
        >{confirmLabel}</button>
      </>}
    />
  );
}
