import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Romaneio, RomaneioStatus } from '../types'
import { Plus, Search, Share2, Camera, Calendar, Truck, User } from 'lucide-react'

const STATUSES: (RomaneioStatus | '')[] = ['', 'Pendente', 'Preenchido', 'Liberado', 'Cancelado']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<RomaneioStatus | ''>('')
  const [busca, setBusca] = useState('')
  const [counts, setCounts] = useState({ Pendente: 0, Preenchido: 0, Liberado: 0, Cancelado: 0 })

  // Load status counts
  const loadCounts = async () => {
    try {
      const getCount = (status: string) =>
        supabase
          .from('romaneios')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .is('excluido_em', null)

      const [p, pr, l, c] = await Promise.all([
        getCount('Pendente'),
        getCount('Preenchido'),
        getCount('Liberado'),
        getCount('Cancelado')
      ])

      setCounts({
        Pendente: p.count || 0,
        Preenchido: pr.count || 0,
        Liberado: l.count || 0,
        Cancelado: c.count || 0
      })
    } catch (e) {
      console.error('Erro ao buscar contagens de status:', e)
    }
  }

  // Load romaneios list
  const loadRomaneios = useCallback(async (status: RomaneioStatus | '', search: string) => {
    setLoading(true)
    try {
      let nfeIds: string[] = []
      if (search.trim()) {
        const { data: nfeMatches } = await supabase
          .from('romaneio_itens')
          .select('romaneio_id')
          .ilike('numero_nfe', `%${search.trim()}%`)
        nfeIds = [...new Set((nfeMatches || []).map(m => m.romaneio_id))]
      }

      let q = supabase
        .from('romaneios')
        .select('*')
        .is('excluido_em', null)
        .order('data_criacao', { ascending: false })

      if (status) {
        q = q.eq('status', status)
      }

      if (search.trim()) {
        const s = search.trim()
        let orFilter = `transportadora_nome.ilike.%${s}%,motorista_nome.ilike.%${s}%,veiculo_placa.ilike.%${s}%`
        if (nfeIds.length > 0) {
          orFilter += `,id.in.(${nfeIds.join(',')})`
        }
        q = q.or(orFilter)
      }

      const { data, error } = await q.limit(40) // Limit to top 40 on mobile for speed
      if (error) throw error
      setRomaneios(data || [])
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar romaneios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCounts()
    loadRomaneios(filtroStatus, busca)
  }, [filtroStatus, loadRomaneios])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      loadRomaneios(filtroStatus, busca)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, filtroStatus, loadRomaneios])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-mobile-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'romaneios' }, () => {
        loadCounts()
        loadRomaneios(filtroStatus, busca)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [filtroStatus, busca, loadRomaneios])

  // Generate public form link
  const getPublicLink = (token: string) => {
    const base = import.meta.env.VITE_APP_URL || window.location.origin
    return `${base}/coleta/${token}`
  }

  // Copy link to clipboard
  const handleCopyLink = async (e: React.MouseEvent, token: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(getPublicLink(token))
      toast.success('Link de coleta copiado!')
    } catch (err) {
      toast.error('Erro ao copiar link.')
    }
  }

  // Format creation date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 120px)' }}>
      {/* Metrics Horizontal Scroll Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {STATUSES.map((status) => {
          const isActive = filtroStatus === status
          const count = status === '' ? 0 : counts[status as keyof typeof counts] || 0
          return (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'var(--bg-card)',
                color: isActive ? '#fff' : 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span>{status || 'Todos'}</span>
              {status !== '' && (
                <span style={{
                  fontSize: '10px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-highlight)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  color: isActive ? '#fff' : 'var(--text-muted)'
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sticky Search Bar */}
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <input
          type="text"
          className="input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por placa, motorista, NF-e..."
          style={{ height: '44px', paddingLeft: '40px' }}
        />
        <Search size={18} className="search-icon" style={{ left: '14px' }} />
      </div>

      {/* Loading state */}
      {loading && romaneios.length === 0 ? (
        <div className="flex-center" style={{ padding: '40px 0' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : romaneios.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: '60px 16px' }}>
          Nenhum romaneio encontrado.
        </div>
      ) : (
        /* Romaneios vertical card list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {romaneios.map((romaneio) => (
            <div
              key={romaneio.id}
              className="card"
              onClick={() => navigate(`/romaneios/${romaneio.id}`)}
              style={{ padding: '16px', cursor: 'pointer' }}
            >
              {/* Header card info */}
              <div className="flex-between" style={{ marginBottom: '10px' }}>
                <span className="badge pendente" style={{ fontSize: '10px', background: 'var(--bg-highlight)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  #{romaneio.id.slice(0, 8).toUpperCase()}
                </span>
                <span className={`badge ${romaneio.status.toLowerCase()}`}>
                  {romaneio.status}
                </span>
              </div>

              {/* Transportadora e Placa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <Truck size={16} className="text-muted" />
                  <span className="font-bold">{romaneio.transportadora_nome || 'A definir'}</span>
                </div>
                {romaneio.motorista_nome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <User size={14} />
                    <span>{romaneio.motorista_nome} ({romaneio.veiculo_placa || 'Sem placa'})</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Calendar size={14} />
                  <span>Criado em {formatDate(romaneio.data_criacao)}</span>
                </div>
              </div>

              {/* Quick action buttons row inside card */}
              <div className="flex-between" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px' }}>
                {romaneio.status === 'Pendente' ? (
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => handleCopyLink(e, romaneio.token_publico)}
                    style={{ height: '36px', fontSize: '12px', padding: '0 12px', width: 'auto' }}
                  >
                    <Share2 size={14} />
                    <span>Link Público</span>
                  </button>
                ) : (
                  <div />
                )}
                
                <button
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/romaneios/${romaneio.id}/bipar`)
                  }}
                  style={{ height: '36px', fontSize: '12px', padding: '0 16px', width: 'auto', background: 'var(--success)' }}
                >
                  <Camera size={14} />
                  <span>Conferir (Câmera)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button (+) */}
      <button
        className="fab-scan"
        onClick={() => navigate('/romaneios/novo')}
        style={{ bottom: '24px', right: '24px' }}
        aria-label="Novo Romaneio"
      >
        <Plus size={24} />
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
