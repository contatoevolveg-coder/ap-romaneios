import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FileText, PlusCircle, Settings, LogOut, Truck, Building2, Trash2, Sun, Moon } from 'lucide-react'

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, signOut, isMaster } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode(!darkMode)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navItem = (to: string, icon: ReactNode, label: string) => (
    <Link
      to={to}
      className={`nav-item ${location.pathname === to || location.pathname.startsWith(to + '/') ? 'active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Truck size={24} />
          <span>Romaneios</span>
        </div>

        <nav className="sidebar-nav">
          {navItem('/', <FileText size={18} />, 'Romaneios')}
          {navItem('/romaneios/novo', <PlusCircle size={18} />, 'Novo Romaneio')}
          {isMaster && navItem('/transportadoras', <Building2 size={18} />, 'Transportadoras')}
          {isMaster && navItem('/lixeira', <Trash2 size={18} />, 'Lixeira')}
          {isMaster && navItem('/configuracoes', <Settings size={18} />, 'Configurações')}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{perfil?.nome}</span>
            <span className={`role-badge ${perfil?.role}`}>
              {perfil?.role === 'master' ? 'Master' : perfil?.role === 'colaborador' ? 'Colaborador' : perfil?.role}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="btn-icon" onClick={toggleDarkMode} title={darkMode ? "Modo Claro" : "Modo Escuro"}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-icon" onClick={handleSignOut} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
