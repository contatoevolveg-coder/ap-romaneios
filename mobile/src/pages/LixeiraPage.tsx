import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Romaneio, TransportadoraCadastrada } from '../types'
import { formatCNPJ } from '../lib/validators'
import { ArrowLeft, RotateCcw, Trash2, Calendar, Truck, User, CreditCard } from 'lucide-react'

interface TransportadoraInativa extends TransportadoraCadastrada {
  motoristas_count: number
  veiculos_count: number
}

export default function LixeiraPage() {
  const navigate = useNavigate()
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [transportadoras, setTransportadoras] = useState<TransportadoraInativa[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'romaneios' | 'transportadoras'>('romaneios')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: roms, error: errR }, { data: transps, error: errT }, { data: motors }, { data: veics }] = await Promise.all([
        supabase.from('romaneios').select('*').not('excluido_em', 'is', null).order('excluido_em', { ascending: false }),
        supabase.from('transportadoras_cadastradas').select('*').eq('ativo', false).order('nome'),
        supabase.from('motoristas_cadastrados').select('*'),
        supabase.from('veiculos_cadastrados').select('*')
      ])

      if (errR) throw errR
      if (errT) throw errT

      setRomaneios(roms || [])

      const mappedTransps: TransportadoraInativa[] = (transps || []).map(t => ({
        ...t,
        motoristas_count: (motors || []).filter(m => m.transportadora_id === t.id && m.ativo).length,
        veiculos_count: (veics || []).filter(v => v.transportadora_id === t.id && v.ativo).length
      }))
      setTransportadoras(mappedTransps)
      setSelectedIds([])
    } catch (e) {
      toast.error('Erro ao carregar lixeira.')
    } finally {
      setLoading(false)
    }
  }

  async function restaurarRomaneio(id: string) {
    try {
      const { error } = await supabase
        .from('romaneios')
        .update({ excluido_em: null, excluido_por: null })
        .eq('id', id)
      if (error) throw error
      toast.success('Romaneio restaurado!')
      setRomaneios(prev => prev.filter(r => r.id !== id))
      setSelectedIds(prev => prev.filter(x => x !== id))
    } catch {
      toast.error('Erro ao restaurar.')
    }
  }

  async function excluirDefinitivoRomaneio(id: string) {
    if (!confirm('ATENÇÃO: Excluir permanentemente este romaneio e todos os seus itens? Esta ação não pode ser desfeita.')) return
    try {
      const { error } = await supabase.from('romaneios').delete().eq('id', id)
      if (error) throw error
      toast.success('Romaneio excluído permanentemente.')
      setRomaneios(prev => prev.filter(r => r.id !== id))
      setSelectedIds(prev => prev.filter(x => x !== id))
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message)
    }
  }

  async function restaurarTransportadora(id: string) {
    try {
      const { error } = await supabase
        .from('transportadoras_cadastradas')
        .update({ ativo: true })
        .eq('id', id)
      if (error) throw error
      toast.success('Transportadora restaurada!')
      setTransportadoras(prev => prev.filter(t => t.id !== id))
      setSelectedIds(prev => prev.filter(x => x !== id))
    } catch {
      toast.error('Erro ao restaurar transportadora.')
    }
  }

  async function excluirDefinitivoTransportadora(id: string) {
    if (!confirm('ATENÇÃO: Excluir permanentemente esta transportadora? Esta ação não pode ser desfeita.')) return
    try {
      const { error } = await supabase.from('transportadoras_cadastradas').delete().eq('id', id)
      if (error) throw error
      toast.success('Transportadora excluída permanentemente.')
      setTransportadoras(prev => prev.filter(t => t.id !== id))
      setSelectedIds(prev => prev.filter(x => x !== id))
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message)
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      if (activeTab === 'romaneios') {
        setSelectedIds(romaneios.map(r => r.id))
      } else {
        setSelectedIds(transportadoras.map(t => t.id))
      }
    } else {
      setSelectedIds([])
    }
  }

  function handleSelectRow(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function restaurarSelecionados() {
    if (selectedIds.length === 0) return
    try {
      if (activeTab === 'romaneios') {
        const { error } = await supabase
          .from('romaneios')
          .update({ excluido_em: null, excluido_por: null })
          .in('id', selectedIds)
        if (error) throw error
        toast.success(`${selectedIds.length} romaneio(s) restaurado(s)!`)
        setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
      } else {
        const { error } = await supabase
          .from('transportadoras_cadastradas')
          .update({ ativo: true })
          .in('id', selectedIds)
        if (error) throw error
        toast.success(`${selectedIds.length} transportadora(s) restaurada(s)!`)
        setTransportadoras(prev => prev.filter(t => !selectedIds.includes(t.id)))
      }
      setSelectedIds([])
    } catch {
      toast.error('Erro ao restaurar itens.')
    }
  }

  async function excluirSelecionados() {
    if (selectedIds.length === 0) return
    const isRomaneios = activeTab === 'romaneios'
    const confirmMsg = isRomaneios
      ? `ATENÇÃO: Excluir permanentemente os ${selectedIds.length} romaneios selecionados? Esta ação não pode ser desfeita.`
      : `ATENÇÃO: Excluir permanentemente as ${selectedIds.length} transportadoras selecionadas? Esta ação não pode ser desfeita.`

    if (!confirm(confirmMsg)) return
    try {
      if (isRomaneios) {
        const { error } = await supabase
          .from('romaneios')
          .delete()
          .in('id', selectedIds)
        if (error) throw error
        toast.success(`${selectedIds.length} romaneio(s) excluído(s) permanentemente.`)
        setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
      } else {
        const { error } = await supabase
          .from('transportadoras_cadastradas')
          .delete()
          .in('id', selectedIds)
        if (error) throw error
        toast.success(`${selectedIds.length} transportadora(s) excluída(s) permanentemente.`)
        setTransportadoras(prev => prev.filter(t => !selectedIds.includes(t.id)))
      }
      setSelectedIds([])
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message)
    }
  }

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const hasItems = activeTab === 'romaneios' ? romaneios.length > 0 : transportadoras.length > 0
  const itemsCount = activeTab === 'romaneios' ? romaneios.length : transportadoras.length

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="header-btn" onClick={() => navigate('/')} style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="title-large" style={{ margin: 0, fontSize: '18px' }}>Lixeira</h2>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {activeTab === 'romaneios'
              ? `${romaneios.length} romaneio(s) excluído(s)`
              : `${transportadoras.length} transportadora(s) desativada(s)`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-highlight)',
        padding: '4px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid var(--border)'
      }}>
        <button
          onClick={() => { setActiveTab('romaneios'); setSelectedIds([]); }}
          style={{
            flex: 1,
            height: '36px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'romaneios' ? '#fff' : 'transparent',
            color: activeTab === 'romaneios' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'romaneios' ? 700 : 500,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: activeTab === 'romaneios' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          Romaneios
        </button>
        <button
          onClick={() => { setActiveTab('transportadoras'); setSelectedIds([]); }}
          style={{
            flex: 1,
            height: '36px',
            border: 'none',
            borderRadius: '6px',
            background: activeTab === 'transportadoras' ? '#fff' : 'transparent',
            color: activeTab === 'transportadoras' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'transportadoras' ? 700 : 500,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: activeTab === 'transportadoras' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          Transportadoras
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '40vh' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : !hasItems ? (
        <div className="card text-center" style={{ padding: '40px 16px', marginTop: '16px' }}>
          {activeTab === 'romaneios' ? <Trash2 size={40} className="text-muted" style={{ margin: '0 auto 12px auto' }} /> : <Truck size={40} className="text-muted" style={{ margin: '0 auto 12px auto' }} />}
          <p className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
            {activeTab === 'romaneios' ? 'A lixeira de romaneios está vazia.' : 'Nenhuma transportadora desativada.'}
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Voltar ao Dashboard</button>
        </div>
      ) : (
        <>
          <div className="warning-card" style={{ background: '#f8fafc', borderLeftColor: '#64748b', border: '1px solid #e2e8f0', color: '#475569', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              Itens na lixeira podem ser restaurados ou excluídos de forma permanente do banco de dados.
            </div>
          </div>

          {/* Bulk Selection Bar */}
          <div className="card no-active" style={{ padding: '12px 16px', marginBottom: '16px' }}>
            <div className="flex-between">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={itemsCount > 0 && selectedIds.length === itemsCount}
                  onChange={e => handleSelectAll(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Selecionar Todos
              </label>
              <span className="text-muted" style={{ fontSize: '13px' }}>
                {selectedIds.length} selecionado(s)
              </span>
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  className="btn btn-secondary flex-center"
                  onClick={restaurarSelecionados}
                  style={{ flex: 1, fontSize: '13px', height: '36px' }}
                >
                  <RotateCcw size={14} />
                  <span>Restaurar</span>
                </button>
                <button
                  className="btn btn-danger flex-center"
                  onClick={excluirSelecionados}
                  style={{ flex: 1, fontSize: '13px', height: '36px' }}
                >
                  <Trash2 size={14} />
                  <span>Excluir</span>
                </button>
              </div>
            )}
          </div>

          {/* List as Cards */}
          {activeTab === 'romaneios' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {romaneios.map(r => (
                <div key={r.id} className="card" style={{ padding: '16px', margin: 0 }}>
                  <div className="flex-between" style={{ marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => handleSelectRow(r.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span className="font-bold" style={{ fontSize: '14px' }}>
                        #{r.id.slice(0, 8).toUpperCase()}
                      </span>
                    </label>
                    <span className={`badge ${r.status.toLowerCase()}`} style={{ fontSize: '10px' }}>
                      {r.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Truck size={14} className="text-muted" />
                      <span>{r.transportadora_nome || 'Transportadora a definir'}</span>
                    </div>
                    {r.motorista_nome && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <User size={14} className="text-muted" />
                        <span>{r.motorista_nome}</span>
                      </div>
                    )}
                    {r.veiculo_placa && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CreditCard size={14} className="text-muted" />
                        <span>{r.veiculo_modelo || 'Veículo'} ({r.veiculo_placa})</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--danger)', fontSize: '11px', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                      <Calendar size={12} />
                      <span>Excluído em {formatDate(r.excluido_em)}</span>
                    </div>
                  </div>

                  {/* Individual Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-secondary flex-center"
                      onClick={() => restaurarRomaneio(r.id)}
                      style={{ flex: 1, height: '32px', fontSize: '12px', padding: 0 }}
                    >
                      <RotateCcw size={12} />
                      <span>Restaurar</span>
                    </button>
                    <button
                      className="btn btn-danger flex-center"
                      onClick={() => excluirDefinitivoRomaneio(r.id)}
                      style={{ flex: 1, height: '32px', fontSize: '12px', padding: 0 }}
                    >
                      <Trash2 size={12} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transportadoras.map(t => (
                <div key={t.id} className="card" style={{ padding: '16px', margin: 0 }}>
                  <div className="flex-between" style={{ marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => handleSelectRow(t.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span className="font-bold" style={{ fontSize: '14px' }}>
                        {t.nome}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Truck size={14} className="text-muted" />
                      <span>CNPJ: {formatCNPJ(t.cnpj)}</span>
                    </div>
                    {t.contato_email && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span>E-mail: {t.contato_email}</span>
                      </div>
                    )}
                    {t.contato_telefone && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span>Tel: {t.contato_telefone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                      <span>{t.motoristas_count} motoristas · {t.veiculos_count} veículos</span>
                    </div>
                  </div>

                  {/* Individual Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-secondary flex-center"
                      onClick={() => restaurarTransportadora(t.id)}
                      style={{ flex: 1, height: '32px', fontSize: '12px', padding: 0 }}
                    >
                      <RotateCcw size={12} />
                      <span>Restaurar</span>
                    </button>
                    <button
                      className="btn btn-danger flex-center"
                      onClick={() => excluirDefinitivoTransportadora(t.id)}
                      style={{ flex: 1, height: '32px', fontSize: '12px', padding: 0 }}
                    >
                      <Trash2 size={12} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
