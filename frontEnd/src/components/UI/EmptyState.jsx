import { motion } from "framer-motion"
import styles from "./EmptyState.module.css"

const ILLUSTRATIONS = {
  tasks: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-tasks-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="46" y="22" width="108" height="120" rx="14" fill="url(#es-tasks-a)" opacity="0.12" />
      <rect x="60" y="38" width="80" height="88" rx="10" fill="none" stroke="url(#es-tasks-a)" strokeWidth="2.5" />
      <path d="M74 60h52M74 78h52M74 96h32" stroke="url(#es-tasks-a)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <circle cx="140" cy="108" r="22" fill="var(--bg-app)" stroke="url(#es-tasks-a)" strokeWidth="2.5" />
      <path d="M131 108l6 6 12-13" stroke="url(#es-tasks-a)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-activity-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="80" r="58" fill="url(#es-activity-a)" opacity="0.1" />
      <rect x="52" y="46" width="70" height="50" rx="12" fill="none" stroke="url(#es-activity-a)" strokeWidth="2.5" />
      <path d="M64 108l10-12h20l6 8" stroke="url(#es-activity-a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <rect x="98" y="70" width="52" height="38" rx="10" fill="var(--bg-app)" stroke="url(#es-activity-a)" strokeWidth="2.5" />
      <path d="M108 88h32M108 96h20" stroke="url(#es-activity-a)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M112 108l-6 10v-10" fill="var(--bg-app)" stroke="url(#es-activity-a)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-trophy-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="30" y="118" width="140" height="10" rx="4" fill="url(#es-trophy-a)" opacity="0.18" />
      <rect x="82" y="98" width="36" height="24" fill="none" stroke="url(#es-trophy-a)" strokeWidth="2.5" />
      <path d="M70 46h60v30a30 30 0 0 1-60 0V46Z" fill="url(#es-trophy-a)" opacity="0.12" stroke="url(#es-trophy-a)" strokeWidth="2.5" />
      <path d="M70 52h-14a10 10 0 0 0 10 16M130 52h14a10 10 0 0 1-10 16" stroke="url(#es-trophy-a)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="66" r="10" fill="var(--bg-app)" stroke="url(#es-trophy-a)" strokeWidth="2.5" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-mail-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="126" rx="56" ry="8" fill="url(#es-mail-a)" opacity="0.14" />
      <rect x="42" y="46" width="116" height="76" rx="12" fill="url(#es-mail-a)" opacity="0.1" stroke="url(#es-mail-a)" strokeWidth="2.5" />
      <path d="M46 52l54 40 54-40" stroke="url(#es-mail-a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="146" cy="46" r="18" fill="var(--bg-app)" stroke="url(#es-mail-a)" strokeWidth="2.5" />
      <path d="M139 46h14M146 39v14" stroke="url(#es-mail-a)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  // A magnifying glass over faint scattered dots — "nothing found", not a
  // broken-image glyph (a rect+circle+zigzag reads as a missing photo icon).
  generic: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-generic-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="78" r="52" fill="url(#es-generic-a)" opacity="0.08" />
      <circle cx="62" cy="48" r="4" fill="url(#es-generic-a)" opacity="0.35" />
      <circle cx="142" cy="56" r="3" fill="url(#es-generic-a)" opacity="0.3" />
      <circle cx="128" cy="112" r="3.5" fill="url(#es-generic-a)" opacity="0.3" />
      <circle cx="88" cy="46" r="42" fill="none" stroke="url(#es-generic-a)" strokeWidth="4" />
      <line x1="118" y1="76" x2="150" y2="108" stroke="url(#es-generic-a)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  ),
  contacts: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-contacts-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="128" rx="56" ry="8" fill="url(#es-contacts-a)" opacity="0.12" />
      <rect x="48" y="34" width="104" height="76" rx="14" fill="none" stroke="url(#es-contacts-a)" strokeWidth="2.5" />
      <circle cx="86" cy="66" r="16" fill="url(#es-contacts-a)" opacity="0.14" stroke="url(#es-contacts-a)" strokeWidth="2.5" />
      <path d="M64 100c4-12 14-18 22-18s18 6 22 18" stroke="url(#es-contacts-a)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M118 58h20M118 70h14" stroke="url(#es-contacts-a)" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="140" cy="42" r="13" fill="var(--bg-app)" stroke="url(#es-contacts-a)" strokeWidth="2.5" />
      <path d="M134 42h12M140 36v12" stroke="url(#es-contacts-a)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-leads-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="130" rx="52" ry="7" fill="url(#es-leads-a)" opacity="0.12" />
      <path d="M56 40h88l-28 40v34l-32 12V80L56 40Z" fill="url(#es-leads-a)" opacity="0.12" stroke="url(#es-leads-a)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="146" cy="48" r="14" fill="var(--bg-app)" stroke="url(#es-leads-a)" strokeWidth="2.5" />
      <path d="M141 48l3.5 3.5L152 44" stroke="url(#es-leads-a)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-accounts-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="130" rx="58" ry="7" fill="url(#es-accounts-a)" opacity="0.12" />
      <rect x="58" y="52" width="52" height="70" rx="6" fill="url(#es-accounts-a)" opacity="0.1" stroke="url(#es-accounts-a)" strokeWidth="2.5" />
      <rect x="112" y="70" width="34" height="52" rx="5" fill="none" stroke="url(#es-accounts-a)" strokeWidth="2.5" />
      <path d="M70 66h10M86 66h10M70 80h10M86 80h10M70 94h10M86 94h10" stroke="url(#es-accounts-a)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M122 84h10M122 96h10M122 108h10" stroke="url(#es-accounts-a)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  invoices: (
    <svg viewBox="0 0 200 160" fill="none">
      <defs>
        <linearGradient id="es-invoices-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="130" rx="52" ry="7" fill="url(#es-invoices-a)" opacity="0.12" />
      <path d="M64 34h72v82l-9-7-9 7-9-7-9 7-9-7-9 7-9-7-9 7V34Z" fill="url(#es-invoices-a)" opacity="0.1" stroke="url(#es-invoices-a)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M78 54h44M78 68h44M78 82h28" stroke="url(#es-invoices-a)" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="140" cy="100" r="15" fill="var(--bg-app)" stroke="url(#es-invoices-a)" strokeWidth="2.5" />
      <path d="M140 93v14M135 96c0-2 2-3 5-3s5 1.5 5 3.5-2 3-5 3-5 1.5-5 3.5 2 3.5 5 3.5 5-1 5-3" stroke="url(#es-invoices-a)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

export default function EmptyState({ type = "generic", title, hint, compact = false, className = "" }) {
  return (
    <motion.div
      className={`${styles.wrap} ${compact ? styles.compact : ""} ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.illustration}>{ILLUSTRATIONS[type] || ILLUSTRATIONS.generic}</div>
      {title && <p className={styles.title}>{title}</p>}
      {hint && <p className={styles.hint}>{hint}</p>}
    </motion.div>
  )
}
