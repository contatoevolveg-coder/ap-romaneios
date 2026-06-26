import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart3, Package, CheckCircle2, Clock, Truck } from 'lucide-react'

interface RomaneioRow {
  id: string
  status: string
  data_criacao: string
  liberado_em: string | null
  transportadora_nome: string | null
}

const STATUS_CORES: Record<string, string> = {
  Pendente: '#f59e0b',
  Preenchido: '#3b82f6',
  Liberado: '#10b981',
  Cancelado: '#ef4444',
}

function diaLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function AnalyticsPage() {
  const [romaneios, setRomaneios] = useState<RomaneioRow[]>([])
  const [volumesPorRom, setVolumesPorRom] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: roms }, { data: itens }] = await Promise.all([
        supabase.from('romaneios').select('id, status, data_criacao, liberado_em, transportadora_nome').is('excluido_em', null),
        supabase.from('romaneio_itens').select('romaneio_id, qtd_volumes'),
      ])
      const volMap: Record<string, number> = {}
      for (const it of itens ?? []) {
        volMap[it.romaneio_id] = (volMap[it.romaneio_id] || 0) + (it.qtd_volumes || 0)
      }
      setVolumesPorRom(volMap)
      setRomaneios((roms ?? []) as RomaneioRow[])
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  // Métricas
  const total = romaneios.length
  const porStatus: Record<string, number> = {}
  for (const r of romaneios) porStatus[r.status] = (porStatus[r.status] || 0) + 1
  const liberados = porStatus['Liberado'] || 0
  const emAberto = (porStatus['Pendente'] || 0) + (porStatus['Preenchido'] || 0)

  // Tempo médio Pendente -> Liberado
  const tempos = romaneios
    .filter(r => r.status === 'Liberado' && r.liberado_em)
    .map(r => new Date(r.liberado_em!).getTime() - new Date(r.data_criacao).getTime())
    .filter(ms => ms > 0)
  const tempoMedioH = tempos.length ? tempos.reduce((s, m) => s + m, 0) / tempos.length / 3600000 : 0
  const tempoMedioLabel = tempoMedioH >= 24
    ? `${(tempoMedioH / 24).toFixed(1)} dias`
    : `${tempoMedioH.toFixed(1)} h`

  // Volume últimos 7 dias
  const hoje = new Date(); hoje.setHours(23, 59, 59, 999)
  const dias: { label: string; volume: number; romaneios: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i); d.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    let vol = 0, qt = 0
    for (const r of romaneios) {
      const dc = new Date(r.data_criacao)
      if (dc >= d && dc <= fim) { vol += volumesPorRom[r.id] || 0; qt += 1 }
    }
    dias.push({ label: diaLabel(d), volume: vol, romaneios: qt })
  }
  const maxVol = Math.max(1, ...dias.map(d => d.volume))

  // Ranking de transportadoras (por nº de romaneios)
  const transpMap: Record<string, { count: number; volumes: number }> = {}
  for (const r of romaneios) {
    const nome = r.transportadora_nome?.trim() || 'Sem transportadora'
    if (!transpMap[nome]) transpMap[nome] = { count: 0, volumes: 0 }
    transpMap[nome].count += 1
    transpMap[nome].volumes += volumesPorRom[r.id] || 0
  }
  const ranking = Object.entries(transpMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
  const maxRank = Math.max(1, ...ranking.map(([, v]) => v.count))

  const statusOrdenado = ['Pendente', 'Preenchido', 'Liberado', 'Cancelado'].filter(s => porStatus[s])
  const maxStatus = Math.max(1, ...statusOrdenado.map(s => porStatus[s]))

  const metricCard = (icon: ReactNode, label: string, value: string | number, cor: string) => (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: cor + '22', color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="subtitle">Visão geral da operação de romaneios</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <BarChart3 size={40} color="#94a3b8" />
          <p>Ainda não há romaneios para analisar.</p>
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {metricCard(<Package size={22} />, 'Total de romaneios', total, '#2563eb')}
            {metricCard(<CheckCircle2 size={22} />, 'Liberados', liberados, '#10b981')}
            {metricCard(<Clock size={22} />, 'Em aberto', emAberto, '#f59e0b')}
            {metricCard(<Clock size={22} />, 'Tempo médio liberação', tempoMedioLabel, '#8b5cf6')}
          </div>

          {/* Volume últimos 7 dias */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Volumes — últimos 7 dias</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, paddingTop: 12 }}>
              {dias.map(d => (
                <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{d.volume || ''}</div>
                  <div
                    title={`${d.romaneios} romaneio(s) · ${d.volume} volume(s)`}
                    style={{
                      width: '100%', maxWidth: 46, borderRadius: '6px 6px 0 0',
                      height: `${(d.volume / maxVol) * 100}%`, minHeight: d.volume ? 4 : 0,
                      background: '#2563eb', transition: 'height .3s'
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Por status */}
            <div className="card">
              <div className="card-title">Romaneios por status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {statusOrdenado.map(s => (
                  <div key={s}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text)' }}>{s}</span>
                      <strong style={{ color: 'var(--text)' }}>{porStatus[s]}</strong>
                    </div>
                    <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(porStatus[s] / maxStatus) * 100}%`, background: STATUS_CORES[s] || '#64748b', borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking transportadoras */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={15} /> Top transportadoras</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {ranking.map(([nome, v]) => (
                  <div key={nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, gap: 8 }}>
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                      <strong style={{ color: 'var(--text)', flexShrink: 0 }}>{v.count} · {v.volumes}vol</strong>
                    </div>
                    <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(v.count / maxRank) * 100}%`, background: '#2563eb', borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
