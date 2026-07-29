import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} />
    }
    return this.props.children
  }
}

export function CrashScreen({ error }: { error: Error | string }) {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'string' ? null : error.stack

  const handleRelaunch = (): void => {
    void window.api.relaunchApp()
  }

  return (
    <div className="crash-screen">
      <h1>Something went wrong</h1>
      <p className="muted">{message}</p>
      {stack && <pre>{stack}</pre>}
      <button className="primary" onClick={handleRelaunch}>
        Relaunch app
      </button>
    </div>
  )
}
