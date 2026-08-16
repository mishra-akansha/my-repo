import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext.jsx"
import styles from "./Login.module.css"

// Landing spot for the "Sign in with Google" redirect — the backend hands us
// a ready-made JWT via ?token=, same shape as a normal email/password login,
// just delivered through a URL instead of a fetch response.
export default function GoogleCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithToken } = useAuth()

  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token")
    if (!token) {
      navigate("/login?google=error", { replace: true })
      return
    }
    loginWithToken(token)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login?google=error", { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.wrap} style={{ alignItems: "center", justifyContent: "center" }}>
      <span
        className={styles.spinner}
        aria-hidden="true"
        style={{ width: "2rem", height: "2rem", borderColor: "var(--border-subtle)", borderTopColor: "var(--primary)" }}
      />
    </div>
  )
}
