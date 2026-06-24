import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MobileLayout from './MobileLayout';

export default function ProtectedRoute({ children, masterOnly = false }: {
  children: ReactNode;
  masterOnly?: boolean;
}) {
  const { user, perfil, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite'
        }} />
        <span className="text-muted">Carregando perfil...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (masterOnly && perfil?.role !== 'master') {
    return <Navigate to="/" replace />;
  }

  return <MobileLayout>{children}</MobileLayout>;
}
