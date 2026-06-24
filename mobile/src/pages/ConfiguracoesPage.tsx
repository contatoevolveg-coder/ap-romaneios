import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Moon, Sun, Volume2, VolumeX, Smartphone } from 'lucide-react'

export default function ConfiguracoesPage() {
  const { perfil } = useAuth()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('sound_enabled') !== 'false')
  const [vibrateEnabled, setVibrateEnabled] = useState(localStorage.getItem('vibrate_enabled') !== 'false')

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Sound toggle
  const toggleSound = () => {
    const nextVal = !soundEnabled
    setSoundEnabled(nextVal)
    localStorage.setItem('sound_enabled', String(nextVal))
  }

  // Vibration toggle
  const toggleVibrate = () => {
    const nextVal = !vibrateEnabled
    setVibrateEnabled(nextVal)
    localStorage.setItem('vibrate_enabled', String(nextVal))
  }

  return (
    <div>
      <h2 className="title-large">Configurações</h2>
      <p className="subtitle">Ajuste o comportamento do aplicativo no seu aparelho.</p>

      {/* User info card */}
      {perfil && (
        <div className="card no-active" style={{ marginBottom: '20px', background: 'var(--bg-highlight)' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
            Perfil Atual
          </span>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{perfil.nome}</h3>
          <p className="text-muted" style={{ fontSize: '13px' }}>{perfil.email}</p>
          <span className="badge preenchido" style={{ marginTop: '8px', fontSize: '10px' }}>
            {perfil.role.toUpperCase()}
          </span>
        </div>
      )}

      {/* Settings list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Theme Settings */}
        <div className="card no-active flex-between" style={{ padding: '16px' }}>
          <div>
            <h4 style={{ fontWeight: 700 }}>Tema Visual</h4>
            <p className="text-muted" style={{ fontSize: '12px' }}>Alterar entre modo claro e escuro</p>
          </div>
          <button className="btn btn-secondary" onClick={toggleTheme} style={{ width: 'auto', height: '40px', padding: '0 12px' }}>
            {theme === 'dark' ? (
              <>
                <Sun size={18} className="text-success" />
                <span>Claro</span>
              </>
            ) : (
              <>
                <Moon size={18} />
                <span>Escuro</span>
              </>
            )}
          </button>
        </div>

        {/* Audio feedback Settings */}
        <div className="card no-active flex-between" style={{ padding: '16px' }}>
          <div>
            <h4 style={{ fontWeight: 700 }}>Sons de Bipagem</h4>
            <p className="text-muted" style={{ fontSize: '12px' }}>Sinal sonoro de sucesso e erro ao bipar</p>
          </div>
          <button className="btn btn-secondary" onClick={toggleSound} style={{ width: 'auto', height: '40px', padding: '0 12px' }}>
            {soundEnabled ? (
              <>
                <Volume2 size={18} className="text-success" />
                <span>Ativo</span>
              </>
            ) : (
              <>
                <VolumeX size={18} />
                <span>Mudo</span>
              </>
            )}
          </button>
        </div>

        {/* Tactile feedback Settings */}
        <div className="card no-active flex-between" style={{ padding: '16px' }}>
          <div>
            <h4 style={{ fontWeight: 700 }}>Vibração (Tátil)</h4>
            <p className="text-muted" style={{ fontSize: '12px' }}>Vibrar o aparelho ao ler códigos de barras</p>
          </div>
          <button className="btn btn-secondary" onClick={toggleVibrate} style={{ width: 'auto', height: '40px', padding: '0 12px' }}>
            {vibrateEnabled ? (
              <>
                <Smartphone size={18} className="text-success" />
                <span>Ativo</span>
              </>
            ) : (
              <>
                <Smartphone size={18} />
                <span>Mudo</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
