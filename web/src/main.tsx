import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// HashRouter (not BrowserRouter): the same bundle is served by the Effect server AND loaded in the
// Tauri desktop webview over a non-HTTP protocol — neither has an SPA path fallback, so hash routing
// is the only scheme where a deep link / refresh resolves everywhere without server changes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
)
