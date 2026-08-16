import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App.jsx"
import { ThemeProvider } from "./context/ThemeContext.jsx"
import { AuthProvider } from "./context/AuthContext.jsx"
import "./index.css"

// Dev server no longer registers a PWA service worker (see vite.config.js),
// but a worker registered before that change stays active until explicitly
// unregistered — it will keep serving a stale cached bundle otherwise.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  })
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)