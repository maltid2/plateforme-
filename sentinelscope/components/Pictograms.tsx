/**
 * Original SentinelScope pictograms.
 *
 * Custom SVG line-art — not an icon library. Shared visual language:
 *  - 24x24 viewBox, main strokes use `currentColor` (inherits the card accent)
 *  - stroke width 2, rounded caps and joins
 *  - a single small flat accent detail (green / cyan / yellow / red) per symbol
 *  - flat, no gradients, no shadows
 */

type Props = { className?: string };

const ACC = {
  green: "#A7F36B",
  cyan: "#57E6D1",
  violet: "#8D7CFF",
  yellow: "#F5C451",
  red: "#F4576B",
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Attack surface — radar sweep with a detected blip */
export function PictoRadar({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" opacity="0.35" />
      <circle cx="12" cy="12" r="4.5" opacity="0.6" />
      <path d="M12 12 19 7" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="8.2" r="1.7" fill={ACC.green} stroke="none" />
    </svg>
  );
}

/* Continuous monitoring — screen with a live pulse waveform */
export function PictoMonitor({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="3" y="4.5" width="18" height="12" rx="2.2" />
      <path d="M9 20h6" opacity="0.6" />
      <path d="M12 16.5V20" opacity="0.6" />
      <path d="M5.5 11h2.4l1.5-3 2.1 5 1.4-2.4h5.6" stroke={ACC.cyan} />
    </svg>
  );
}

/* Dynamic application testing — browser frame with a scanning beam */
export function PictoScan({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="3" y="4.5" width="18" height="15" rx="2.4" />
      <path d="M3 8.5h18" />
      <circle cx="6" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="8.4" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      <path d="M6.5 15.5h11" stroke={ACC.green} />
      <path d="M6.5 12.5h6" opacity="0.5" />
    </svg>
  );
}

/* API security testing — connected service nodes */
export function PictoNodes({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M10.4 10.6 6.7 7.4" opacity="0.7" />
      <path d="M13.7 10.9 17.2 8.1" opacity="0.7" />
      <path d="M10.8 13.6 7.4 16.5" opacity="0.7" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="5.4" cy="6.4" r="1.8" />
      <circle cx="18.4" cy="7.2" r="1.8" fill={ACC.violet} stroke="none" />
      <circle cx="6.2" cy="17.4" r="1.8" />
    </svg>
  );
}

/* Authenticated scanning — user with an access key */
export function PictoKeyUser({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3.8 18.5a5.2 5.2 0 0 1 10.4 0" />
      <circle cx="17.6" cy="11" r="2" stroke={ACC.cyan} />
      <path d="M16.2 12.4 13.4 15.2" stroke={ACC.cyan} />
      <path d="M14.4 14.2 15.4 15.2" stroke={ACC.cyan} />
    </svg>
  );
}

/* Vulnerability detection — alert shield */
export function PictoAlertShield({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3 5 5.8v4.9c0 4.3 3 7.2 7 8.5 4-1.3 7-4.2 7-8.5V5.8z" />
      <path d="M12 8.4v3.6" stroke={ACC.red} />
      <circle cx="12" cy="14.9" r="0.95" fill={ACC.red} stroke="none" />
    </svg>
  );
}

/* Cloud security — cloud with a lock */
export function PictoCloudLock({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M7.2 15.5A3.4 3.4 0 0 1 7 8.7a4.6 4.6 0 0 1 8.8-1.2 3.2 3.2 0 0 1 1 6.3" />
      <rect x="9.4" y="14" width="5.2" height="4.4" rx="1.1" stroke={ACC.green} />
      <path d="M10.6 14v-1a1.4 1.4 0 0 1 2.8 0v1" stroke={ACC.green} />
    </svg>
  );
}

/* Code scanning — brackets with a validated check */
export function PictoCodeCheck({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M8.5 7.5 4.5 12l4 4.5" />
      <path d="M15.5 7.5 19.5 12l-4 4.5" />
      <path d="M10.4 13.2 12 14.8l3-3.4" stroke={ACC.green} />
    </svg>
  );
}

/* Security alerts — bell with a signal dot */
export function PictoAlertBell({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M6.5 16.5c1-1 1.5-2.2 1.5-4v-1a4 4 0 0 1 8 0v1c0 1.8.5 3 1.5 4z" />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
      <circle cx="17.5" cy="6.5" r="2" fill={ACC.red} stroke="none" />
    </svg>
  );
}

/* Runtime protection — shield with an active core */
export function PictoRuntime({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3 5 5.8v4.9c0 4.3 3 7.2 7 8.5 4-1.3 7-4.2 7-8.5V5.8z" />
      <circle cx="12" cy="11.2" r="2.2" stroke={ACC.cyan} />
      <path d="M12 6.8v2" opacity="0.5" />
    </svg>
  );
}

/* Integrations — connected building blocks */
export function PictoBlocks({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.6" />
      <rect x="14.5" y="14.5" width="6" height="6" rx="1.6" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.6" opacity="0.5" />
      <path d="M9.5 6.5h5" />
      <path d="M17.5 9.5v5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill={ACC.cyan} stroke="none" />
    </svg>
  );
}

/* Compliance — verified certificate */
export function PictoCompliance({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M6 3.5h9l3 3V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.5 3.5V7h3.5" opacity="0.5" />
      <path d="M8 12.5l1.7 1.7 3.3-3.5" stroke={ACC.green} />
    </svg>
  );
}

/* Automated testing — flask with a progress tick */
export function PictoAutoTest({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M10 3.5v5.2L5.7 16a1.5 1.5 0 0 0 1.3 2.3h10a1.5 1.5 0 0 0 1.3-2.3L14 8.7V3.5" />
      <path d="M8.8 3.5h6.4" />
      <path d="M8 14h8" opacity="0.5" />
      <circle cx="13.5" cy="15.6" r="1.3" fill={ACC.yellow} stroke="none" />
    </svg>
  );
}

/* Actionable prioritization — ranked list with a priority flag */
export function PictoPriority({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4.5 7h8" />
      <path d="M4.5 12h5.5" opacity="0.7" />
      <path d="M4.5 17h3.5" opacity="0.5" />
      <path d="M16.5 5.5v13" />
      <path d="M16.5 5.5 20 7.2l-3.5 1.7z" fill={ACC.green} stroke={ACC.green} />
    </svg>
  );
}
