import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './motion.css'
import App from './App.jsx'
import { ThemeProvider } from './components/ThemeProvider.jsx'

// ThemeProvider wraps the entire app (OUTSIDE BrowserRouter) so theme CSS
// variables are applied to <html> on every route — including public pages
// that don't go through the auth-protected Layout.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
