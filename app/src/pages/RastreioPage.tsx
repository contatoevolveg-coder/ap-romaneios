import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Package, Truck, CheckCircle2, ClipboardCheck, FileText, Clock } from 'lucide-react'

interface Rastreio {
  numero: string
  status: 'Pendente' | 'Preenchido' | 'Liberado' | 'Cancelado'
  data_criacao: string | null
  conferido_em: string | null
  liberado_em: string | null
  transportadora_nome: string | null
  veiculo_placa: string | null
  total_nfes: number
  total_volumes: number
}

const STATUS_INFO: Record<string, { label: string; cor: string; bg: string }> = {
  Pendente:   { label: 'Aguardando transportadora', cor: '#92400e', bg: '#fef3c7' },
  Preenchido: { label: 'Em preparação',             cor: '#1e40af', bg: '#dbeafe' },
  Liberado:   { label: 'Liberado para transporte',  cor: '#065f46', bg: '#d1fae5' },
  Cancelado:  { label: 'Cancelado',                 cor: '#991b1b', bg: '#fee2e2' },
}

function fmt(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function RastreioPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Rastreio | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase.rpc('get_rastreio_by_token', { p_token: token }).then(({ data: r, error }) => {
      if (error || !r || (r as { error?: string }).error) { setErro(true) }
      else setData(r as Rastreio)
      setLoading(false)
    })
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div className="spinner" />
    </div>
  )

  if (erro || !data) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 24, gap: 12, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <Package size={48} color="#94a3b8" />
      <h2 style={{ margin: 0, color: '#334155' }}>Romaneio não encontrado</h2>
      <p style={{ color: '#64748b', maxWidth: 360 }}>O link de rastreamento é inválido ou o romaneio não está mais disponível.</p>
    </div>
  )

  const si = STATUS_INFO[data.status] ?? STATUS_INFO.Pendente
  const cancelado = data.status === 'Cancelado'

  const etapas = [
    { label: 'Romaneio criado', icon: <FileText size={18} />, data: data.data_criacao, done: true },
    { label: 'Dados preenchidos', icon: <Truck size={18} />, data: null, done: ['Preenchido', 'Liberado'].includes(data.status) },
    { label: 'Carga conferida', icon: <ClipboardCheck size={18} />, data: data.conferido_em, done: !!data.conferido_em },
    { label: 'Liberado para transporte', icon: <CheckCircle2 size={18} />, data: data.liberado_em, done: data.status === 'Liberado' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: '#f1f5f9', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2563eb', fontWeight: 700, fontSize: 18 }}>
            <Truck size={22} /> Rastreamento de Carga
          </div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Romaneio nº {data.numero}</div>
        </div>

        {/* Card de status */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: si.bg, color: si.cor, padding: '6px 14px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
            {si.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '.04em' }}>NF-e's</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{data.total_nfes}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '.04em' }}>Volumes</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{data.total_volumes}</div>
            </div>
            {data.transportadora_nome && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '.04em' }}>Transportadora</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                  {data.transportadora_nome}{data.veiculo_placa ? ` · ${data.veiculo_placa}` : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        {!cancelado && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '.05em', marginBottom: 16 }}>Acompanhamento</div>
            {etapas.map((et, i) => (
              <div key={et.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: et.done ? '#10b981' : '#e2e8f0', color: et.done ? '#fff' : '#94a3b8', flexShrink: 0
                  }}>
                    {et.icon}
                  </div>
                  {i < etapas.length - 1 && (
                    <div style={{ width: 2, height: 28, background: et.done ? '#10b981' : '#e2e8f0' }} />
                  )}
                </div>
                <div style={{ paddingTop: 6, paddingBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: et.done ? '#1e293b' : '#94a3b8' }}>{et.label}</div>
                  {et.done && et.data && (
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Clock size={11} /> {fmt(et.data)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, color: '#94a3b8', fontSize: 12 }}>
          Atualizado automaticamente · {fmt(new Date().toISOString())}
        </div>
      </div>
    </div>
  )
}
