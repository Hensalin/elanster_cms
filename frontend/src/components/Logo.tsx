/** Elanster CMS mark: an orange tile with a layered "E" (three content blocks stacked like a page). Original artwork. */
export function LogoMark({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs><linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8a4c" /><stop offset="1" stopColor="#e2581c" /></linearGradient></defs>
      <rect width="48" height="48" rx="13" fill="url(#lm-g)" />
      <rect x="13" y="12" width="22" height="6" rx="3" fill="#fff" />
      <rect x="13" y="21" width="15" height="6" rx="3" fill="#fff" opacity=".9" />
      <rect x="13" y="30" width="22" height="6" rx="3" fill="#fff" />
      <circle cx="34" cy="24" r="3" fill="#141414" />
    </svg>
  );
}
