import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import styles from "./illustrations.module.css"

/* ==========================================================================
   1. ORIGINAL FEATURE ICONS (kept for backward-compat)
   ========================================================================== */

export function PipelineIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="2.5" y="4" width="5.5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.5" y="4" width="5.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="16.5" y="4" width="5.5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.25 8h0M12.25 8h0M19.25 8h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SecurityIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 2.75 4.5 5.75v5.4c0 5 3.2 8.6 7.5 10.1 4.3-1.5 7.5-5.1 7.5-10.1v-5.4L12 2.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.75 12.25 11 14.5l4.25-4.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CommsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 16H9l-4.5 3.75V16A2.5 2.5 0 0 1 3.5 13.5v-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.25 8.25h9.5M7.25 11.25h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function AnalyticsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5" y="13" width="3.4" height="7" rx="0.9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.3" y="9" width="3.4" height="11" rx="0.9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15.6" y="4.5" width="3.4" height="15.5" rx="0.9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 8.5 9.5 5l4 2.75L19 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AutomationIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3.5v2.25M12 18.25V20.5M20.5 12h-2.25M5.75 12H3.5M17.66 6.34l-1.59 1.59M7.93 16.07l-1.59 1.59M17.66 17.66l-1.59-1.59M7.93 7.93 6.34 6.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9.75 13 12l-1 2.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AuditIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6 3.5h9.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15.5 3.5V7H19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12.25l1.6 1.6L13 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 16.75h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/* ==========================================================================
   2. ANIMATED SCENE SVG ILLUSTRATIONS (per CRM module)
   ========================================================================== */

/** Kanban Pipeline Scene — cards sliding across columns */
export function KanbanScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Column backgrounds */}
        <rect x="10" y="15" width="80" height="110" rx="8" fill="var(--landing-social-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
        <rect x="100" y="15" width="80" height="110" rx="8" fill="var(--landing-social-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
        <rect x="190" y="15" width="80" height="110" rx="8" fill="var(--landing-social-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />

        {/* Column headers */}
        <text x="50" y="32" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">QUALIFIED</text>
        <text x="140" y="32" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">PROPOSAL</text>
        <text x="230" y="32" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">WON</text>

        {/* Animated deal cards - column 1 */}
        <motion.g
          initial={{ x: -20, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="18" y="42" width="64" height="28" rx="5" fill="var(--landing-card-bg)" stroke="var(--landing-input-focus-border)" strokeWidth="1.2" />
          <rect x="24" y="49" width="32" height="4" rx="2" fill="#c084fc" opacity="0.6" />
          <rect x="24" y="57" width="20" height="3" rx="1.5" fill="var(--landing-card-border)" />
          <circle cx="72" cy="56" r="5" fill="rgba(168, 85, 247, 0.15)" />
          <text x="72" y="59" textAnchor="middle" fontSize="6" fontWeight="700" fill="#c084fc">$</text>
        </motion.g>

        <motion.g
          initial={{ x: -20, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="18" y="76" width="64" height="28" rx="5" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <rect x="24" y="83" width="28" height="4" rx="2" fill="#c084fc" opacity="0.4" />
          <rect x="24" y="91" width="24" height="3" rx="1.5" fill="var(--landing-card-border)" />
        </motion.g>

        {/* Column 2 card */}
        <motion.g
          initial={{ x: -20, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="108" y="42" width="64" height="28" rx="5" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <rect x="114" y="49" width="36" height="4" rx="2" fill="#f472b6" opacity="0.5" />
          <rect x="114" y="57" width="22" height="3" rx="1.5" fill="var(--landing-card-border)" />
        </motion.g>

        {/* Column 3 card with check */}
        <motion.g
          initial={{ x: -20, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.65, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="198" y="42" width="64" height="28" rx="5" fill="var(--landing-card-bg)" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.2" />
          <rect x="204" y="49" width="30" height="4" rx="2" fill="#10b981" opacity="0.5" />
          <rect x="204" y="57" width="18" height="3" rx="1.5" fill="var(--landing-card-border)" />
          <circle cx="252" cy="56" r="5" fill="rgba(16, 185, 129, 0.2)" />
          <path d="M249.5 56 251 57.5 254.5 54" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>

        {/* Animated moving deal dot */}
        <motion.circle
          r={4}
          fill="#c084fc"
          filter="drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))"
          cx={50}
          cy={108}
          animate={{
            cx: [50, 140, 230],
            cy: [108, 108, 108],
          }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
        />

        {/* Arrow path */}
        <motion.path
          d="M 82 108 L 108 108"
          stroke="#c084fc"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
        />
        <motion.path
          d="M 172 108 L 198 108"
          stroke="#c084fc"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ delay: 1, duration: 0.5 }}
        />
      </svg>
    </motion.div>
  )
}

/** Event & Project Scene — calendar + task list */
export function EventScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Calendar widget */}
        <motion.g
          initial={{ scale: 0.85, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="10" y="10" width="120" height="120" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <rect x="10" y="10" width="120" height="28" rx="10" fill="rgba(168, 85, 247, 0.1)" />
          <text x="70" y="28" textAnchor="middle" fontSize="9" fontWeight="700" fill="#c084fc" fontFamily="var(--font-body)">AUG 2026</text>

          {/* Calendar grid dots */}
          {[0,1,2,3,4,5,6].map((col) =>
            [0,1,2,3].map((row) => (
              <circle
                key={`${col}-${row}`}
                cx={24 + col * 16}
                cy={48 + row * 18}
                r={col === 3 && row === 1 ? 6 : 2.5}
                fill={col === 3 && row === 1 ? "rgba(168, 85, 247, 0.3)" : "var(--landing-card-border)"}
              />
            ))
          )}
          {/* Highlight date */}
          <text x={24 + 3 * 16} y={51 + 1 * 18} textAnchor="middle" fontSize="7" fontWeight="800" fill="#c084fc" fontFamily="var(--font-body)">14</text>
        </motion.g>

        {/* Task list panel */}
        <motion.g
          initial={{ x: 20, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x="145" y="10" width="125" height="120" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <text x="160" y="30" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">TASKS</text>

          {/* Task items */}
          {[
            { y: 42, done: true, w: 55 },
            { y: 62, done: true, w: 45 },
            { y: 82, done: false, w: 60 },
            { y: 102, done: false, w: 40 },
          ].map((t, i) => (
            <motion.g
              key={i}
              initial={{ x: 10, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
            >
              <rect x="155" y={t.y} width="10" height="10" rx="2.5" fill={t.done ? "rgba(16, 185, 129, 0.2)" : "var(--landing-social-bg)"} stroke={t.done ? "#10b981" : "var(--landing-card-border)"} strokeWidth="1" />
              {t.done && <path d={`M${157.5} ${t.y + 5.5}l1.5 1.5 3-3.5`} stroke="#10b981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
              <rect x="170" y={t.y + 3} width={t.w} height="4" rx="2" fill="var(--landing-card-border)" opacity={t.done ? 0.4 : 0.8} />
            </motion.g>
          ))}
        </motion.g>

        {/* Progress bar at bottom */}
        <motion.rect
          x="155"
          y="118"
          width="0"
          height="4"
          rx="2"
          fill="#c084fc"
          whileInView={{ width: 65 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
        />
        <rect x="155" y="118" width="105" height="4" rx="2" fill="var(--landing-card-border)" opacity="0.3" />
      </svg>
    </motion.div>
  )
}

/** Lead Scoring Scene — circular score gauge + rule items */
export function LeadScoreScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Score gauge */}
        <motion.g
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx="75" cy="70" r="50" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          {/* Background ring */}
          <circle cx="75" cy="70" r="38" fill="none" stroke="var(--landing-card-border)" strokeWidth="5" />
          {/* Animated score ring */}
          <motion.circle
            cx="75"
            cy="70"
            r="38"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="239"
            strokeDashoffset="239"
            transform="rotate(-90 75 70)"
            whileInView={{ strokeDashoffset: 60 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <text x="75" y="65" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--landing-title-color)" fontFamily="var(--font-display)">85</text>
          <text x="75" y="80" textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--text-tertiary)" fontFamily="var(--font-body)">SCORE</text>
        </motion.g>

        {/* Rule items on the right */}
        <motion.g
          initial={{ x: 15, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <rect x="145" y="18" width="125" height="104" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <text x="160" y="36" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">SCORING RULES</text>

          {[
            { y: 48, label: "Email opened", pts: "+10", color: "#10b981" },
            { y: 66, label: "Demo booked", pts: "+25", color: "#c084fc" },
            { y: 84, label: "Pricing page", pts: "+15", color: "#f472b6" },
            { y: 102, label: "No activity 7d", pts: "-5", color: "#ef4444" },
          ].map((r, i) => (
            <motion.g
              key={i}
              initial={{ x: 10, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
            >
              <circle cx="160" cy={r.y + 4} r="3" fill={r.color} opacity="0.3" />
              <text x="168" y={r.y + 7} fontSize="7.5" fontWeight="500" fill="var(--text-secondary)" fontFamily="var(--font-body)">{r.label}</text>
              <text x="260" y={r.y + 7} textAnchor="end" fontSize="7.5" fontWeight="700" fill={r.color} fontFamily="var(--font-body)">{r.pts}</text>
            </motion.g>
          ))}
        </motion.g>
      </svg>
    </motion.div>
  )
}

/** Communications Scene — email thread timeline */
export function CommsScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Main card */}
        <rect x="10" y="5" width="260" height="130" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />

        {/* Timeline line */}
        <motion.line
          x1="35" y1="25" x2="35" y2="125"
          stroke="var(--landing-card-border)"
          strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {/* Email items on timeline */}
        {[
          { y: 25, icon: "✉", color: "#c084fc", w: 130, type: "Email sent" },
          { y: 52, icon: "↩", color: "#10b981", w: 115, type: "Reply received" },
          { y: 79, icon: "📞", color: "#f472b6", w: 95, type: "Call logged" },
          { y: 106, icon: "📝", color: "#f59e0b", w: 110, type: "Note added" },
        ].map((item, i) => (
          <motion.g
            key={i}
            initial={{ x: 10, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Timeline dot */}
            <circle cx="35" cy={item.y + 7} r="5" fill={item.color} opacity="0.2" />
            <circle cx="35" cy={item.y + 7} r="2.5" fill={item.color} />

            {/* Content card */}
            <rect x="50" y={item.y} width={item.w} height="20" rx="5" fill="var(--landing-social-bg)" stroke="var(--landing-card-border)" strokeWidth="0.8" />
            <text x="60" y={item.y + 8} fontSize="6" fill={item.color} fontFamily="var(--font-body)">{item.icon}</text>
            <text x="72" y={item.y + 8} fontSize="7" fontWeight="600" fill="var(--text-secondary)" fontFamily="var(--font-body)">{item.type}</text>
            <rect x="60" y={item.y + 13} width={item.w - 28} height="3" rx="1.5" fill="var(--landing-card-border)" opacity="0.5" />

            {/* Timestamp */}
            <text x="250" y={item.y + 12} textAnchor="end" fontSize="6" fill="var(--text-tertiary)" fontFamily="var(--font-body)">{`${i + 1}h ago`}</text>
          </motion.g>
        ))}
      </svg>
    </motion.div>
  )
}

/** Customization Studio Scene — custom fields + template */
export function CustomizationScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Settings panel */}
        <motion.g
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <rect x="10" y="10" width="125" height="120" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <text x="25" y="30" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">CUSTOM FIELDS</text>

          {/* Field entries with toggles */}
          {[
            { y: 42, label: "Company Size", on: true },
            { y: 60, label: "Industry Type", on: true },
            { y: 78, label: "Budget Range", on: false },
            { y: 96, label: "Decision Date", on: true },
          ].map((f, i) => (
            <motion.g
              key={i}
              initial={{ x: -10, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.35 }}
            >
              <text x="25" y={f.y + 7} fontSize="7.5" fontWeight="500" fill="var(--text-secondary)" fontFamily="var(--font-body)">{f.label}</text>
              {/* Toggle switch */}
              <rect x="105" y={f.y} width="18" height="10" rx="5" fill={f.on ? "rgba(168, 85, 247, 0.3)" : "var(--landing-card-border)"} />
              <circle cx={f.on ? 118 : 110} cy={f.y + 5} r="3.5" fill={f.on ? "#c084fc" : "var(--text-tertiary)"} />
            </motion.g>
          ))}
        </motion.g>

        {/* Rotating gear icon */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{ originX: "155px", originY: "70px" }}
        >
          <circle cx="155" cy="70" r="8" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect
              key={angle}
              x="153"
              y="58"
              width="4"
              height="4"
              rx="1"
              fill="#c084fc"
              opacity="0.4"
              transform={`rotate(${angle} 155 70)`}
            />
          ))}
        </motion.g>

        {/* Template preview */}
        <motion.g
          initial={{ x: 15, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <rect x="175" y="10" width="95" height="120" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <text x="190" y="28" fontSize="7" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">INVOICE</text>

          {/* Invoice preview lines */}
          <rect x="185" y="36" width="55" height="4" rx="2" fill="#c084fc" opacity="0.3" />
          <rect x="185" y="46" width="75" height="3" rx="1.5" fill="var(--landing-card-border)" />
          <rect x="185" y="53" width="65" height="3" rx="1.5" fill="var(--landing-card-border)" />

          {/* Divider */}
          <line x1="185" y1="62" x2="260" y2="62" stroke="var(--landing-card-border)" strokeWidth="0.8" />

          {/* Line items */}
          <rect x="185" y="68" width="45" height="3" rx="1.5" fill="var(--landing-card-border)" />
          <text x="260" y="71" textAnchor="end" fontSize="7" fontWeight="600" fill="var(--text-secondary)" fontFamily="var(--font-body)">$500</text>
          <rect x="185" y="78" width="50" height="3" rx="1.5" fill="var(--landing-card-border)" />
          <text x="260" y="81" textAnchor="end" fontSize="7" fontWeight="600" fill="var(--text-secondary)" fontFamily="var(--font-body)">$250</text>

          {/* Total */}
          <line x1="185" y1="90" x2="260" y2="90" stroke="var(--landing-card-border)" strokeWidth="0.8" />
          <text x="185" y="102" fontSize="8" fontWeight="700" fill="var(--text-secondary)" fontFamily="var(--font-body)">Total</text>
          <text x="260" y="102" textAnchor="end" fontSize="9" fontWeight="800" fill="#c084fc" fontFamily="var(--font-body)">$750</text>
        </motion.g>
      </svg>
    </motion.div>
  )
}

/** Security & Audit Scene — shield + audit log feed */
export function SecurityScene() {
  return (
    <motion.div
      className={styles.sceneContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <svg viewBox="0 0 280 140" fill="none" className={styles.sceneSvg} aria-hidden="true">
        {/* Shield */}
        <motion.g
          initial={{ scale: 0.7, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
        >
          {/* Glow ring — cx/cy must be numeric (not string) once r is animated on
              the same circle: framer-motion's SVG renderer takes over cx/cy/r as
              one bundled geometry group, and string literals broke its parsing,
              logging "Expected length, undefined" for all three attrs. */}
          <motion.circle
            cx={70}
            cy={70}
            r={50}
            fill="none"
            stroke="rgba(168, 85, 247, 0.15)"
            strokeWidth="2"
            animate={{ r: [48, 52, 48], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx={70}
            cy={70}
            r={42}
            fill="none"
            stroke="rgba(236, 72, 153, 0.12)"
            strokeWidth="1.5"
            animate={{ r: [40, 44, 40], opacity: [0.12, 0.25, 0.12] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />

          <path d="M70 25 L40 38v18c0 22 13 37 30 43 17-6 30-21 30-43V38L70 25Z" fill="var(--landing-card-bg)" stroke="#c084fc" strokeWidth="1.5" strokeLinejoin="round" />
          <motion.path
            d="M58 68 l8 8 16-18"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.g>

        {/* Audit log */}
        <motion.g
          initial={{ x: 15, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <rect x="140" y="10" width="130" height="120" rx="10" fill="var(--landing-card-bg)" stroke="var(--landing-card-border)" strokeWidth="1" />
          <text x="155" y="28" fontSize="8" fontWeight="700" fill="var(--text-tertiary)" fontFamily="var(--font-body)">AUDIT LOG</text>

          {[
            { y: 38, action: "User login", status: "✓", color: "#10b981" },
            { y: 56, action: "Role updated", status: "✓", color: "#c084fc" },
            { y: 74, action: "Data export", status: "⚠", color: "#f59e0b" },
            { y: 92, action: "Permission set", status: "✓", color: "#10b981" },
            { y: 110, action: "API key rotated", status: "✓", color: "#c084fc" },
          ].map((log, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: 5 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.3 }}
            >
              <circle cx="155" cy={log.y + 5} r="3" fill={log.color} opacity="0.25" />
              <text x="163" y={log.y + 8} fontSize="7" fontWeight="500" fill="var(--text-secondary)" fontFamily="var(--font-body)">{log.action}</text>
              <text x="260" y={log.y + 8} textAnchor="end" fontSize="7" fontWeight="700" fill={log.color} fontFamily="var(--font-body)">{log.status}</text>
            </motion.g>
          ))}
        </motion.g>
      </svg>
    </motion.div>
  )
}


/* ==========================================================================
   3. PLATFORM FLOW ILLUSTRATION (upgraded with better animation)
   ========================================================================== */

const STAGE_NODES = [
  { x: 40, y: 100, label: "Lead" },
  { x: 190, y: 55, label: "Qualified" },
  { x: 340, y: 130, label: "Proposal" },
  { x: 490, y: 70, label: "Won" },
]

const FLOW_PATH = "M40 100 C 100 60, 130 60, 190 55 S 290 145, 340 130 S 440 55, 490 70"

export function PlatformFlowIllustration({ className }) {
  return (
    <svg
      viewBox="0 0 540 190"
      className={className}
      role="img"
      aria-label="Deal flowing through pipeline stages from Lead to Won"
    >
      <motion.path
        d={FLOW_PATH}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="2"
        strokeDasharray="1 8"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {STAGE_NODES.map((n, i) => (
        <motion.g
          key={n.label}
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx={n.x} cy={n.y} r={9} fill="var(--bg-surface-raised)" stroke="var(--primary)" strokeWidth="2" />
          <circle cx={n.x} cy={n.y} r={3.2} fill="var(--primary)" />
          <text
            x={n.x}
            y={n.y + 28}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--text-secondary)"
            fontFamily="var(--font-body)"
          >
            {n.label}
          </text>
        </motion.g>
      ))}

      <motion.circle
        r={6}
        fill="var(--accent)"
        cx={STAGE_NODES[0].x}
        cy={STAGE_NODES[0].y}
        animate={{
          cx: STAGE_NODES.map((n) => n.x),
          cy: STAGE_NODES.map((n) => n.y),
        }}
        transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
        className={styles.leadDotGlow}
      />
    </svg>
  )
}


/* ==========================================================================
   4. UTILITY COMPONENTS
   ========================================================================== */

/** Floating Particles — ambient background effect */
export function FloatingParticles({ count = 18, className }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${60 + Math.random() * 40}%`,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * 10,
      color: i % 3 === 0 ? "rgba(168, 85, 247, 0.4)" : i % 3 === 1 ? "rgba(236, 72, 153, 0.35)" : "rgba(192, 132, 252, 0.3)",
    }))
  }, [count])

  return (
    <div className={`${styles.particlesContainer} ${className || ""}`} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animation: `${p.id % 2 === 0 ? "particleFloat" : "particleFloat2"} ${p.duration}s ease-in-out ${p.delay}s infinite`,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}

/** CountUp Number — counts from 0 to target when in view */
export function CountUpNumber({ value, suffix = "", prefix = "", duration = 1.8 }) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef(null)

  // Parse the numeric part
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""))
  const isDecimal = value.includes(".")
  const displayValue = value.replace(/[0-9.]/g, "") // any non-numeric chars

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) return
    const startTime = performance.now()
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(eased * numericValue)
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [hasStarted, numericValue, duration])

  const displayCount = isDecimal ? count.toFixed(1) : Math.round(count)

  return (
    <span ref={ref} className={styles.countUpValue}>
      {prefix}{hasStarted ? displayCount : 0}{displayValue}{suffix}
    </span>
  )
}

/** Logo Ticker — infinite scroll brand trust carousel */
const TRUST_LOGOS = [
  { name: "NextGen Digital", icon: "🏢" },
  { name: "Solis Global", icon: "🌐" },
  { name: "Omnipresent SaaS", icon: "☁️" },
  { name: "Apex Ventures", icon: "🚀" },
  { name: "Quantum Corp", icon: "⚡" },
  { name: "Horizon AI", icon: "🤖" },
  { name: "Stellar Labs", icon: "⭐" },
  { name: "Pinnacle Group", icon: "🏔️" },
  { name: "Vortex Systems", icon: "🔄" },
  { name: "Nebula Tech", icon: "✨" },
]

export function LogoTicker() {
  // Double the items for seamless loop
  const allLogos = [...TRUST_LOGOS, ...TRUST_LOGOS]

  return (
    <div className={styles.tickerWrap}>
      <div className={styles.tickerTrack}>
        {allLogos.map((logo, i) => (
          <span key={i} className={styles.tickerItem}>
            <span style={{ fontSize: "1.15rem" }}>{logo.icon}</span>
            {logo.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Animated Section Divider */
export function SectionDivider() {
  return (
    <div className={styles.sectionDivider}>
      <svg width="100%" height="2" viewBox="0 0 1200 2" preserveAspectRatio="none">
        <motion.line
          x1="0" y1="1" x2="1200" y2="1"
          stroke="var(--landing-card-border)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  )
}

/** Sparkle SVG */
export function Sparkle({ size = 16, color = "#c084fc", style = {}, delay = 0 }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={styles.sparkle}
      style={style}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
      transition={{ duration: 2.5, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      <path
        d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
        fill={color}
      />
    </motion.svg>
  )
}

/** Testimonial Carousel — auto-rotating with crossfade */
export function TestimonialCarousel({ testimonials, cardClassName, quoteClassName, authorClassName, avatarClassName }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [testimonials.length])

  return (
    <div>
      <div className={styles.carouselContainer} style={{ minHeight: "220px" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className={cardClassName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "relative" }}
          >
            <p className={quoteClassName}>&ldquo;{testimonials[active].quote}&rdquo;</p>
            <div className={authorClassName}>
              <div className={avatarClassName}>
                {testimonials[active].name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <strong>{testimonials[active].name}</strong>
                <span>{testimonials[active].role}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.carouselDots}>
        {testimonials.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.carouselDot} ${i === active ? styles.carouselDotActive : ""}`}
            onClick={() => setActive(i)}
            aria-label={`View testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
