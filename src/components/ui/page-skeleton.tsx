import { Card } from './card';

const Bar = ({ className }: { className: string }) => <div className={`animate-pulse rounded-md bg-sunken ${className}`} />;

/** Route-level loading state: shown instantly on navigation while the server renders the page. */
export function PageSkeleton() {
  return (
    <main className="space-y-6 px-4 py-8 lg:px-8" aria-busy="true" aria-label="Loading">
      <header className="space-y-2">
        <Bar className="h-8 w-56" />
        <Bar className="h-4 w-80 max-w-full" />
      </header>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-3 p-5">
          <Bar className="h-5 w-40" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-2/3" />
        </Card>
      ))}
    </main>
  );
}
