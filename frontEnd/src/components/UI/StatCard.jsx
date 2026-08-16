import { useEffect, useRef } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md'
import styles from './StatCard.module.css'

// Extracts a leading numeric run (with , . digits) from the display value so
// currency/percent strings like "₹3,14,25,000" or "41" can count up on mount,
// while the surrounding formatting (₹, commas) is preserved via the template.
function AnimatedValue({ value }) {
  const match = value.match(/[\d,]+\.?\d*/)
  const motionVal = useMotionValue(0)
  const ref = useRef(null)

  const target = match ? parseFloat(match[0].replace(/,/g, "")) : 0
  const prefix = match ? value.slice(0, match.index) : ""
  const suffix = match ? value.slice(match.index + match[0].length) : ""
  const hasCommas = match ? match[0].includes(",") : false

  useEffect(() => {
    if (!match) return
    const controls = animate(motionVal, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) {
          const rounded = Math.round(v)
          ref.current.textContent = `${prefix}${hasCommas ? rounded.toLocaleString("en-IN") : rounded}${suffix}`
        }
      },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!match) return <>{value}</>
  return <span ref={ref}>{prefix}0{suffix}</span>
}

export default function StatCard({ label, value, delta, deltaTone = 'up', icon }) {
  return (
    <motion.div
      className={styles.card}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.value}>
        <AnimatedValue value={String(value)} />
      </div>
      {delta && (
        <div className={`${styles.delta} ${deltaTone === 'up' ? styles.up : styles.down}`}>
          {deltaTone === 'up' ? <MdArrowUpward size={12} /> : <MdArrowDownward size={12} />} {delta}
        </div>
      )}
    </motion.div>
  )
}
