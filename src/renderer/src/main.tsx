import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary, CrashScreen } from './ErrorBoundary'
import './styles.css'

function Root() {
  const [crash, setCrash] = useState<Error | string | null>(null)

  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      setCrash(event.error ?? event.message)
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      setCrash(event.reason instanceof Error ? event.reason : String(event.reason))
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (crash) return <CrashScreen error={crash} />

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
