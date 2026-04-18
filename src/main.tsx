import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { AuthGate } from './auth/AuthGate'
import { ConfirmProvider } from './components/ConfirmDialog'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </AuthGate>
  </StrictMode>,
)
