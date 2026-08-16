// Fills {{tag}} placeholders in an email template's subject/body with real
// values. Any tag not present in `data` is left as-is rather than replaced
// with an empty string or "undefined" — better to visibly show an unfilled
// placeholder (so the sender notices and edits it) than to silently send a
// broken sentence.
export function fillTemplatePlaceholders(text, data) {
  if (!text) return text
  return text.replace(/\{\{(\w+)\}\}/g, (match, tag) => {
    const value = data[tag]
    return value !== undefined && value !== null && value !== "" ? String(value) : match
  })
}

export function fillTemplate(template, data) {
  return {
    subject: fillTemplatePlaceholders(template.subject, data),
    body: fillTemplatePlaceholders(template.body, data),
  }
}

// Every {{tag}} the raw template references, in first-seen order, deduped.
// Used to know what a template *needs* before checking what's actually filled.
export function extractTemplateTags(template) {
  const text = `${template?.subject || ""} ${template?.body || ""}`
  const seen = new Set()
  const tags = []
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(match[1])) { seen.add(match[1]); tags.push(match[1]) }
  }
  return tags
}

// Which of a template's tags have no value in `data` (empty/missing) — these
// are the ones the sender needs to fill in by hand before sending, since the
// recipient/context didn't supply them automatically.
export function findMissingTags(template, data) {
  return extractTemplateTags(template).filter((tag) => {
    const value = data[tag]
    return value === undefined || value === null || value === ""
  })
}

// Human-readable label for a tag input, e.g. "first_name" -> "First name".
export function humanizeTag(tag) {
  const words = tag.split("_")
  return words.map((w, i) => i === 0 ? w[0].toUpperCase() + w.slice(1) : w).join(" ")
}

// True if any {{tag}} is still present — used to block Send until the sender
// has filled in (or the recipient/context provided) every placeholder.
export function hasUnfilledTags(text) {
  return /\{\{\w+\}\}/.test(text || "")
}
