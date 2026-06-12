interface ErrorStateProps {
  melding: string;
  onOpnieuw?: () => void;
}

/** Herstelbare foutstaat: zegt wat er misging en biedt één duidelijke uitweg. */
export function ErrorState({ melding, onOpnieuw }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 px-6 py-8 text-center dark:border-coral-800 dark:bg-coral-950/20"
    >
      <p className="text-sm font-medium text-coral-700 dark:text-coral-300">{melding}</p>
      {onOpnieuw && (
        <button
          type="button"
          onClick={onOpnieuw}
          className="mt-1 rounded-md border border-coral-300 px-4 py-1.5 text-sm font-medium text-coral-700 hover:bg-coral-100 dark:border-coral-700 dark:text-coral-300 dark:hover:bg-coral-950/40"
        >
          Probeer opnieuw
        </button>
      )}
    </div>
  );
}
