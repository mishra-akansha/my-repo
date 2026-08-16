import { humanizeTag } from "../../lib/emailTemplate.js"
import styles from "./TemplateMissingFields.module.css"

// Renders one input per template placeholder that couldn't be auto-filled
// (no recipient selected, raw email address instead of a CRM contact, no
// linked invoice, etc). Shown right under the subject/body so the sender
// fills real values in before sending — instead of the email going out with
// literal "{{first_name}}" text in it.
export default function TemplateMissingFields({ tags, values, onChange }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>This template needs a few details it couldn't fill in automatically:</p>
      <div className={styles.grid}>
        {tags.map((tag) => (
          <div key={tag} className={styles.field}>
            <label>{humanizeTag(tag)}</label>
            <input
              value={values[tag] || ""}
              onChange={(e) => onChange(tag, e.target.value)}
              placeholder={`Enter ${humanizeTag(tag).toLowerCase()}…`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
