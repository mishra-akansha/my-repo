import { useState, useEffect, useRef } from "react"
import { MdKeyboardArrowDown } from "react-icons/md"
import styles from "./SearchableSelect.module.css"

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select option...",
  labelKey = "label",
  valueKey = "value",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => String(opt[valueKey]) === String(value))

  const filteredOptions = options.filter((opt) =>
    String(opt[labelKey]).toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(opt) {
    onChange(opt[valueKey])
    setIsOpen(false)
    setSearch("")
  }

  function handleToggle() {
    if (disabled) return
    setIsOpen(!isOpen)
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ""} ${disabled ? styles.triggerDisabled : ""}`}
        onClick={handleToggle}
      >
        <span className={selectedOption ? styles.valueText : styles.placeholderText}>
          {selectedOption ? selectedOption[labelKey] : placeholder}
        </span>
        <span className={styles.arrow}><MdKeyboardArrowDown size={16} /></span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchBox}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className={styles.optionsList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noOptions}>No matches found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt[valueKey]) === String(value)
                return (
                  <div
                    key={opt[valueKey]}
                    className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                    onClick={() => handleSelect(opt)}
                  >
                    {opt[labelKey]}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
