import SearchableSelect from "./SearchableSelect.jsx"
import modalStyles from "./Modal.module.css"
import styles from "./CustomFieldsSection.module.css"

// Renders editable inputs for a list of CustomField definitions (from GET /custom-fields,
// filtered by entityType), bound to a `{ [field.name]: value }` object — used the same way
// in every entity's create/edit form. `values`/`onChange` mirror the `form.customFields`
// pattern already used by Leads.jsx/Deals.jsx so all pages share one implementation.
export default function CustomFieldsSection({ fields, values, onChange }) {
  if (!fields || fields.length === 0) return null

  return (
    <div className={styles.wrap}>
      <h4 className={styles.title}>Custom Fields</h4>
      {fields.map((f) => {
        let parsedOptions = []
        try {
          if (f.options) parsedOptions = JSON.parse(f.options)
        } catch (e) {}

        return (
          <div key={f.id} className={modalStyles.field}>
            <label>{f.label} {f.required && <span className={styles.required}>*</span>}</label>
            {f.type === "SELECT" ? (
              <SearchableSelect
                options={parsedOptions.map((opt) => ({ id: opt, name: opt }))}
                value={values?.[f.id] || ""}
                onChange={(v) => onChange(f.id, v)}
                labelKey="name"
                valueKey="id"
                placeholder="Select option"
              />
            ) : (
              <input
                required={f.required}
                type={f.type === "NUMBER" ? "number" : "text"}
                value={values?.[f.id] || ""}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
