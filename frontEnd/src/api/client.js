const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8005/api"

function getToken() {
  return localStorage.getItem("ridgeline-token")
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (data.error) {
        if (typeof data.error === "string") {
          message = data.error
        } else if (typeof data.error === "object") {
          const fieldErrors = data.error.formErrors?.fieldErrors || data.error.fieldErrors || data.error
          if (fieldErrors && typeof fieldErrors === "object") {
            const list = Object.values(fieldErrors).flat().filter(Boolean)
            if (list.length > 0) message = list.join(", ")
          }
        }
      }
    } catch {}
    const err = new Error(message || "Request failed")
    err.status = res.status
    throw err
  }

  if (res.status === 204) return null

  const data = await res.json()
  const totalCount = res.headers.get("X-Total-Count")
  if (totalCount !== null) {
    return {
      data,
      total: parseInt(totalCount, 10),
      page: parseInt(res.headers.get("X-Page") || "1", 10),
      limit: parseInt(res.headers.get("X-Limit") || "25", 10),
    }
  }

  return data
}

async function upload(path, file, extraFields = {}) {
  const token = getToken()
  const formData = new FormData()
  formData.append("file", file)
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null) formData.append(key, value)
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (data.error) message = typeof data.error === "string" ? data.error : message
    } catch {}
    const err = new Error(message || "Upload failed")
    err.status = res.status
    throw err
  }

  return res.json()
}

// Multi-file variant (e.g. compose email attachments) - each file appends
// under the same "files" field name so the backend's multer.array("files")
// middleware receives them all as req.files.
async function uploadMultiple(path, files, extraFields = {}) {
  const token = getToken()
  const formData = new FormData()
  for (const file of files) formData.append("files", file)
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null) formData.append(key, value)
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (data.error) message = typeof data.error === "string" ? data.error : message
    } catch {}
    const err = new Error(message || "Upload failed")
    err.status = res.status
    throw err
  }

  return res.json()
}

export function fileUrl(path) {
  const token = getToken()
  return `${API_URL}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`
}

// For genuinely public assets (e.g. org logo) that don't need a token —
// usable in <img> tags without triggering an auth round-trip.
export function publicUrl(path) {
  return `${API_URL}${path}`
}

// Full-page redirect to Google's consent screen — not a fetch, since the
// backend response here is a 302 to accounts.google.com, not JSON.
export function googleSignInUrl() {
  return `${API_URL}/auth/google/signin`
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload,
  uploadMultiple,
}