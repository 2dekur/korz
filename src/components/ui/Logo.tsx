/** Korz mark — same geometry as `app-icon.svg` (app icons are generated from it). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden>
      <rect width="1024" height="1024" rx="232" fill="var(--color-raised)" />
      <g fill="none" stroke="var(--color-accent)" strokeWidth="112" strokeLinecap="round" strokeLinejoin="round">
        <path d="M352 272V752" />
        <path d="M688 272L496 512L688 752" />
      </g>
    </svg>
  );
}
