import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const ei = (window as any).electronAPI
if (ei) {
  document.body.style.background = 'transparent'
  document.documentElement.style.background = 'transparent'
}

// Restore theme from localStorage before render to avoid flash
try {
  const raw = localStorage.getItem('desk-notes-storage')
  if (raw) {
    const parsed = JSON.parse(raw)
    const theme = parsed?.state?.theme
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
