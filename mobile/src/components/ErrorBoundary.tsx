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
          minHeight: '100dvh', padding: 24, gap: 16, fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc'
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1e293b', textAlign: 'center' }}>Algo deu errado</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 320 }}>
            {this.state.error?.message ?? 'Erro desconhecido'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600,
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
