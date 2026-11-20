/** Elanster mark: a flat dark tile with a geometric "E" (stem + three bars, the middle one in the brand orange). No gradient or gloss. */
export function LogoMark({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="48" height="48" rx="12" fill="#17171c" />
      <rect x="14" y="13" width="5" height="22" rx="1.5" fill="#fff" />
      <rect x="14" y="13" width="20" height="5" rx="1.5" fill="#fff" />
      <rect x="14" y="21.5" width="14" height="5" rx="1.5" fill="#f26f2c" />
      <rect x="14" y="30" width="20" height="5" rx="1.5" fill="#fff" />
    </svg>
  );
}
