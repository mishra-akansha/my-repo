import { createContext, useContext, useEffect, useState } from "react"
import { api } from "../api/client.js"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(() => localStorage.getItem("ridgeline-impersonating") === "1")

  useEffect(() => {
    const token = localStorage.getItem("ridgeline-token")
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => {
        // Only clear the session if the token we checked is still the one in
        // storage. Otherwise a concurrent loginWithToken() (e.g. the Google
        // sign-in redirect landing page, mounted alongside this same provider)
        // may have already replaced a stale/expired token with a fresh, valid
        // one — clearing unconditionally here would wipe out that fresh login.
        if (localStorage.getItem("ridgeline-token") === token) {
          localStorage.removeItem("ridgeline-token")
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password })
    localStorage.setItem("ridgeline-token", res.token)
    setUser(res.user)
    return res.user
  }

  async function signup(name, email, password, organizationName, plan) {
    const res = await api.post("/auth/signup", { name, email, password, organizationName, plan })
    localStorage.setItem("ridgeline-token", res.token)
    setUser(res.user)
    return res.user
  }

  // Second half of "Sign in with Google" for a brand-new email — the
  // googleToken already proves the email via Google, so no password here.
  async function signupWithGoogle(googleToken, organizationName, plan) {
    const res = await api.post("/auth/signup-google", { googleToken, organizationName, plan })
    localStorage.setItem("ridgeline-token", res.token)
    setUser(res.user)
    return res.user
  }

  function logout() {
    localStorage.removeItem("ridgeline-token")
    localStorage.removeItem("ridgeline-super-token")
    localStorage.removeItem("ridgeline-impersonating")
    setImpersonating(false)
    setUser(null)
  }

  function hasPermission(perm) {
    if (!user) return false
    if (user.isSuperAdmin) return true
    return user.role?.permissions?.includes(perm) ?? false
  }

  function hasModule(key) {
    if (!user) return false
    if (user.isSuperAdmin) return true
    return user.organization?.modules?.[key] ?? true
  }

  async function startImpersonation(organizationId) {
    const res = await api.post(`/platform/organizations/${organizationId}/impersonate`, {})
    localStorage.setItem("ridgeline-super-token", localStorage.getItem("ridgeline-token"))
    localStorage.setItem("ridgeline-token", res.token)
    localStorage.setItem("ridgeline-impersonating", "1")
    setImpersonating(true)
    const me = await api.get("/auth/me")
    setUser(me.user)
    return res.organization
  }

  async function exitImpersonation() {
    const superToken = localStorage.getItem("ridgeline-super-token")
    if (!superToken) return
    localStorage.setItem("ridgeline-token", superToken)
    localStorage.removeItem("ridgeline-super-token")
    localStorage.removeItem("ridgeline-impersonating")
    setImpersonating(false)
    const me = await api.get("/auth/me")
    setUser(me.user)
  }

  async function refreshUser() {
    try {
      const me = await api.get("/auth/me")
      setUser(me.user)
      return me.user
    } catch (e) {
      // ignore
    }
  }

  // Accepts a JWT minted elsewhere (the "Sign in with Google" redirect hands
  // one over via URL) instead of trading credentials for one via login()/signup().
  // Unlike refreshUser(), this throws on failure so the caller (a one-shot
  // redirect landing page) can show an error instead of silently doing nothing.
  async function loginWithToken(token) {
    localStorage.setItem("ridgeline-token", token)
    const me = await api.get("/auth/me")
    setUser(me.user)
    return me.user
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, signupWithGoogle, loginWithToken, logout, hasPermission, hasModule, impersonating, startImpersonation, exitImpersonation, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}