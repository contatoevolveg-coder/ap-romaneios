import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 32, gap: 16, fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b' }}>Algo deu errado</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message ?? 'Erro desconhecido'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600
            }}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
