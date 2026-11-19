/* Original vector illustrations for the CMS (drawn for Elanster, no outside assets). They follow light/dark mode. */

export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ha-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff9a5c" /><stop offset="1" stopColor="#f26f2c" /></linearGradient>
        <linearGradient id="ha-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9abff5" /><stop offset="1" stopColor="#6d9be6" /></linearGradient>
      </defs>
      <circle cx="250" cy="110" r="96" fill="#f26f2c" opacity=".08" />
      <circle cx="300" cy="40" r="28" fill="#9abff5" opacity=".25" />
      {/* browser window */}
      <g className="ha-float">
        <rect x="70" y="34" width="210" height="150" rx="14" fill="var(--card)" stroke="var(--line-2)" />
        <rect x="70" y="34" width="210" height="28" rx="14" fill="var(--panel)" />
        <rect x="70" y="50" width="210" height="12" fill="var(--panel)" />
        <circle cx="88" cy="48" r="4" fill="#ff8f6b" /><circle cx="101" cy="48" r="4" fill="#ffd166" /><circle cx="114" cy="48" r="4" fill="#7bd389" />
        <rect x="130" y="43" width="120" height="10" rx="5" fill="var(--card)" />
        {/* article cards */}
        <rect x="86" y="74" width="84" height="54" rx="8" fill="url(#ha-g1)" />
        <path d="M94 120l18-20 14 14 10-9 26 15z" fill="#fff" opacity=".55" />
        <circle cx="152" cy="88" r="6" fill="#fff" opacity=".7" />
        <rect x="86" y="136" width="70" height="7" rx="3.5" fill="var(--ink)" opacity=".75" />
        <rect x="86" y="149" width="54" height="6" rx="3" fill="var(--muted)" opacity=".45" />
        <rect x="182" y="74" width="84" height="54" rx="8" fill="url(#ha-g2)" />
        <path d="M190 120l16-16 12 10 12-12 26 18z" fill="#fff" opacity=".55" />
        <rect x="182" y="136" width="74" height="7" rx="3.5" fill="var(--ink)" opacity=".75" />
        <rect x="182" y="149" width="48" height="6" rx="3" fill="var(--muted)" opacity=".45" />
        <rect x="86" y="164" width="40" height="10" rx="5" fill="#e2f8ac" />
        <rect x="182" y="164" width="40" height="10" rx="5" fill="#fde4d6" />
      </g>
      {/* pencil */}
      <g className="ha-pen"><g transform="rotate(38 300 150)">
        <rect x="282" y="96" width="18" height="86" rx="4" fill="#ffd166" />
        <rect x="282" y="96" width="18" height="14" rx="4" fill="#ff8f6b" />
        <rect x="282" y="108" width="18" height="5" fill="#d9d9de" />
        <path d="M282 182h18l-9 18z" fill="#f6e2c8" /><path d="M287.5 191h7l-3.5 9z" fill="var(--ink)" />
      </g></g>
      {/* publish badge */}
      <g className="ha-pop">
        <circle cx="70" cy="170" r="22" fill="#1f9d55" />
        <path d="M60 170l7 7 14-15" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* sparkles */}
      <path d="M44 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#f26f2c" className="ha-tw" />
      <path d="M318 196l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#6d9be6" className="ha-tw ha-tw2" />
      <circle cx="330" cy="92" r="3" fill="#f26f2c" opacity=".6" />
      <circle cx="40" cy="130" r="3" fill="#6d9be6" opacity=".6" />
    </svg>
  );
}

export function CaughtUpArt() {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" fill="none" aria-hidden>
      <ellipse cx="60" cy="80" rx="38" ry="5" fill="var(--panel)" />
      <rect x="28" y="14" width="64" height="58" rx="10" fill="var(--card)" stroke="var(--line-2)" />
      <rect x="38" y="26" width="30" height="5" rx="2.5" fill="var(--muted)" opacity=".4" />
      <rect x="38" y="36" width="44" height="5" rx="2.5" fill="var(--muted)" opacity=".25" />
      <rect x="38" y="46" width="36" height="5" rx="2.5" fill="var(--muted)" opacity=".25" />
      <circle cx="86" cy="62" r="14" fill="#1f9d55" />
      <path d="M79 62l5 5 9-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f26f2c" />
    </svg>
  );
}

export function QuietArt() {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" fill="none" aria-hidden>
      <ellipse cx="60" cy="80" rx="38" ry="5" fill="var(--panel)" />
      <circle cx="60" cy="42" r="30" fill="var(--peach)" />
      <path d="M60 26v17l11 7" stroke="#f26f2c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="42" r="30" stroke="#f26f2c" strokeOpacity=".35" strokeWidth="2" />
    </svg>
  );
}

/* Line-art feature illustrations (outline style, brand accents). */
const S = { stroke: "var(--ink)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function WriteArt() {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="feat-art">
      <circle cx="62" cy="48" r="40" fill="var(--peach)" />
      <rect x="30" y="20" width="52" height="64" rx="6" fill="var(--card)" {...S} />
      <path d="M30 32h52" {...S} />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={40 + i * 10} cy="20" r="3" fill="var(--card)" {...S} />)}
      <path d="M40 44h30M40 54h24M40 64h28" {...S} strokeOpacity=".55" />
      <rect x="40" y="70" width="14" height="6" rx="3" fill="#f26f2c" />
      <g transform="rotate(35 92 46)"><rect x="86" y="22" width="12" height="48" rx="3" fill="#ffd166" {...S} /><path d="M86 70h12l-6 12z" fill="var(--card)" {...S} /><path d="M86 30h12" {...S} /></g>
      <path d="M18 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f26f2c" />
    </svg>
  );
}

export function PagesArt() {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="feat-art">
      <circle cx="60" cy="48" r="40" fill="#eef3ff" />
      <rect x="18" y="22" width="78" height="56" rx="7" fill="var(--card)" {...S} />
      <path d="M18 34h78" {...S} />
      <circle cx="26" cy="28" r="1.8" fill="var(--ink)" /><circle cx="32" cy="28" r="1.8" fill="var(--ink)" /><circle cx="38" cy="28" r="1.8" fill="var(--ink)" />
      <rect x="26" y="42" width="28" height="20" rx="4" fill="#9abff5" {...S} />
      <path d="M62 44h26M62 52h20M62 60h24" {...S} strokeOpacity=".55" />
      <rect x="26" y="66" width="22" height="5" rx="2.5" fill="#f26f2c" />
      <g transform="translate(84 54)"><path d="M0 0l16 6-7 3-3 7z" fill="var(--card)" {...S} /></g>
      <path d="M104 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#6d9be6" />
    </svg>
  );
}

export function LiveArt() {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="feat-art">
      <circle cx="60" cy="48" r="40" fill="#e9f7ee" />
      <circle cx="54" cy="50" r="26" fill="var(--card)" {...S} />
      <path d="M28 50h52M54 24c-9 8-9 44 0 52M54 24c9 8 9 44 0 52M32 37h44M32 63h44" {...S} strokeOpacity=".6" />
      <g transform="translate(76 18)"><path d="M10 0c8 4 12 12 10 22l-8 4-8-4C2 12 4 4 10 0z" fill="var(--card)" {...S} /><circle cx="11" cy="11" r="3" fill="#f26f2c" /><path d="M5 24l-4 8 7-3M17 24l4 8-7-3" {...S} /></g>
      <path d="M22 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#1f9d55" />
    </svg>
  );
}

export function PromoArt() {
  const W = { stroke: "#fff", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 140 96" width="140" height="96" fill="none" aria-hidden className="promo-art">
      <circle cx="70" cy="50" r="40" fill="#fff" opacity=".08" />
      <rect x="28" y="30" width="56" height="42" rx="6" {...W} fill="rgba(255,255,255,.06)" />
      <path d="M28 40h56" {...W} /><path d="M38 52h22M38 60h30" {...W} strokeOpacity=".6" />
      <path d="M84 52h10a8 8 0 0 1 8 8v4" {...W} />
      <rect x="94" y="62" width="16" height="12" rx="3" fill="#f26f2c" {...W} />
      <path d="M99 62v-5M105 62v-5" {...W} />
      <path d="M108 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#ffd166" />
      <circle cx="22" cy="24" r="3" fill="#9abff5" /><circle cx="120" cy="84" r="2.5" fill="#e2f8ac" />
    </svg>
  );
}
