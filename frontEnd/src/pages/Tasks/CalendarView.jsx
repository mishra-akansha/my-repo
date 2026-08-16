import { useState, useMemo } from "react"
import { MdOutlineMail, MdOutlineCall, MdOutlineDescription, MdOutlineEvent } from "react-icons/md"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./CalendarView.module.css"

const TYPE_ICON = { EMAIL: MdOutlineMail, CALL: MdOutlineCall, TASK: MdOutlineDescription, MEETING: MdOutlineEvent }
const TYPE_COLOR = {
  EMAIL: "#3b82f6", // Blue
  CALL: "#10b981",  // Green
  TASK: "#f59e0b",  // Yellow
  MEETING: "#8b5cf6" // Purple
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarView({ tasks, onToggle, onEdit, onCreate }) {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("tasks.create")
  const canEdit = hasPermission("tasks.edit")
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    // First day of current month
    const firstDayIndex = new Date(year, month, 1).getDay()
    // Days in current month
    const totalDays = new Date(year, month + 1, 0).getDate()
    // Days in previous month
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days = []

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
      })
    }

    // Next month filler days to complete the 6-week grid (42 cells)
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      })
    }

    return days
  }, [year, month])

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  // Format date key as YYYY-MM-DD
  const formatDateKey = (y, m, d) => {
    const mm = String(m + 1).padStart(2, "0")
    const dd = String(d).padStart(2, "0")
    return `${y}-${mm}-${dd}`
  }

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const groups = {}
    tasks.forEach(task => {
      if (!task.dueDate) return
      const dateStr = task.dueDate.slice(0, 10)
      if (!groups[dateStr]) {
        groups[dateStr] = []
      }
      groups[dateStr].push(task)
    })
    return groups
  }, [tasks])

  const todayStr = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  return (
    <div className={styles.calendarWrap}>
      {/* Calendar Header */}
      <div className={styles.header}>
        <h3 className={styles.monthLabel}>
          {MONTHS[month]} {year}
        </h3>
        <div className={styles.navGroup}>
          <button className={styles.navBtn} onClick={handleToday}>Today</button>
          <button className={styles.navBtn} onClick={handlePrevMonth}>&lt;</button>
          <button className={styles.navBtn} onClick={handleNextMonth}>&gt;</button>
        </div>
      </div>

      {/* Weekday Titles */}
      <div className={styles.weekHeader}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className={styles.weekdayName}>{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className={styles.grid}>
        {calendarDays.map((cell, idx) => {
          const dateStr = formatDateKey(cell.year, cell.month, cell.day)
          const dayTasks = tasksByDate[dateStr] || []
          const isToday = dateStr === todayStr

          return (
            <div
              key={idx}
              className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.otherMonth : ""} ${isToday ? styles.today : ""}`}
              onClick={(e) => {
                // If clicking directly on cell background, trigger task creation on that day
                if (canCreate && (e.target === e.currentTarget || e.target.classList.contains(styles.dayNumberWrap))) {
                  onCreate(dateStr)
                }
              }}
            >
              <div className={styles.dayNumberWrap}>
                <span className={styles.dayNumber}>{cell.day}</span>
                {canCreate && (
                  <button
                    className={styles.addDayBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreate(dateStr)
                    }}
                    title="Add task on this day"
                  >
                    +
                  </button>
                )}
              </div>

              <div className={styles.taskContainer}>
                {dayTasks.map(task => {
                  const TypeIcon = TYPE_ICON[task.type]
                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskBubble} ${task.done ? styles.taskDone : ""}`}
                      style={{ borderLeftColor: TYPE_COLOR[task.type] || "var(--primary)" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(task)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        disabled={!canEdit}
                        onChange={(e) => {
                          e.stopPropagation()
                          if (canEdit) onToggle(task.id, task.done)
                        }}
                        className={styles.checkbox}
                      />
                      <span className={styles.taskTitle}>
                        {TypeIcon && <TypeIcon size={12} />} {task.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
