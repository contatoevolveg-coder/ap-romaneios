import type { ReactNode } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Home, Settings, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, perfil } = useAuth();

  const isRoot = pathname === '/';
  const showBack = !isRoot && pathname !== '/login';

  // Determine Title based on current route
  let title = 'Romaneios';
  if (pathname === '/configuracoes') {
    title = 'Configurações';
  } else if (pathname.startsWith('/romaneios/')) {
    if (pathname.endsWith('/bipar')) {
      title = 'Bipagem Câmera';
    } else if (pathname.endsWith('/editar')) {
      title = 'Editar Romaneio';
    } else if (pathname.endsWith('/novo')) {
      title = 'Novo Romaneio';
    } else {
      title = 'Detalhes do Romaneio';
    }
  }

  return (
    <div className="mobile-app">
      {/* Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showBack && (
            <button className="header-btn" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft size={24} />
            </button>
          )}
          <h1>{title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {perfil && (
            <span className="text-muted" style={{ fontSize: '12px', marginRight: '4px' }}>
              Hi, {perfil.nome.split(' ')[0]}
            </span>
          )}
          <button className="header-btn" onClick={signOut} aria-label="Sair">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content">
        {children}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="bottom-nav">
        <Link to="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
          <Home />
          <span>Dashboard</span>
        </Link>
        <Link to="/configuracoes" className={`nav-link ${pathname === '/configuracoes' ? 'active' : ''}`}>
          <Settings />
          <span>Ajustes</span>
        </Link>
      </nav>
    </div>
  );
}
