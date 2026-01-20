import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { I18nProvider } from './i18n/I18nContext'
import { ThemeProvider } from './theme/ThemeContext'

const anyWindow = window as unknown as { ipcRenderer?: { on?: (channel: string, listener: (...args: unknown[]) => void) => (() => void) | void; off?: (...args: unknown[]) => void; send?: (...args: unknown[]) => void; invoke?: (...args: unknown[]) => Promise<unknown> } }
if (!anyWindow.ipcRenderer) {
  anyWindow.ipcRenderer = {
    on: () => () => { },
    off: () => { },
    send: () => { },
    invoke: async () => {
      throw new Error('ipcRenderer not available')
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
