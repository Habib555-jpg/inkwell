'use client';
import * as T from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = T.Root;
export function TabsList({ className, ...p }: T.TabsListProps) {
  return <T.List className={cn('flex gap-1 overflow-x-auto rounded-xl border border-line bg-sunken/70 p-1', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: T.TabsTriggerProps) {
  return (
    <T.Trigger
      className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-ink-soft transition-all duration-200 hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-accent data-[state=active]:shadow-card data-[state=active]:ring-1 data-[state=active]:ring-accent/25', className)}
      {...p}
    />
  );
}
export function TabsContent({ className, ...p }: T.TabsContentProps) {
  return <T.Content className={cn('mt-4 animate-overlay-in focus:outline-none', className)} {...p} />;
}
