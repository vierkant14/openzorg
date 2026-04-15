interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * OpenZorg logo mark.
 *
 * Concept: een open ring (niet gesloten — staat voor "open source" en
 * "open toegang") met een medisch kruis binnenin. Primaire kleur is
 * brand-teal, accent is coral. De opening in de ring zit rechtsboven.
 */
export function LogoMark({ size = 32, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OpenZorg logo"
    >
      {/* Outer ring — circle with gap top-right (the "open" part) */}
      <path
        d="M 32 6 A 26 26 0 1 0 52.15 16.5"
        stroke="#0d9488"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Coral accent dot at the "opening" — symbolic of warmth/care */}
      <circle cx="52" cy="16" r="5" fill="#f87171" />
      {/* Medical cross inside */}
      <path
        d="M 32 20 L 32 44 M 20 32 L 44 32"
        stroke="#0d9488"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Horizontal lockup with wordmark next to the mark.
 */
export function LogoLockup({ size = 32, className = "" }: LogoMarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-lg font-bold tracking-tight">
        Open<span className="text-brand-600">Zorg</span>
      </span>
    </div>
  );
}
