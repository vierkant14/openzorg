interface LoadingSkeletonProps {
  regels?: number;
}

/** Laadstaat als skeleton-regels; aria-hidden zodat screenreaders de echte content afwachten. */
export function LoadingSkeleton({ regels = 3 }: LoadingSkeletonProps) {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: regels }, (_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-md bg-surface-100 dark:bg-surface-800"
        />
      ))}
    </div>
  );
}
