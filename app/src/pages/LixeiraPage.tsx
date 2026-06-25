import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Romaneio, TransportadoraCadastrada } from '../types'
import { formatCNPJ } from '../lib/validators'
import StatusBadge from '../components/StatusBadge'
import { ArrowLeft, RotateCcw, Trash2, Truck } from 'lucide-react'

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
    const [{ data: roms, error: errR }, { data: transps, error: errT }, { data: motors }, { data: veics }] = await Promise.all([
      supabase.from('romaneios').select('*').not('excluido_em', 'is', null).order('excluido_em', { ascending: false }),
      supabase.from('transportadoras_cadastradas').select('*').eq('ativo', false).order('nome'),
      supabase.from('motoristas_cadastrados').select('*'),
      supabase.from('veiculos_cadastrados').select('*')
    ])

    if (errR) toast.error('Erro ao carregar romaneios da lixeira')
    if (errT) toast.error('Erro ao carregar transportadoras da lixeira')

    setRomaneios(roms || [])

    const mappedTransps: TransportadoraInativa[] = (transps || []).map(t => ({
      ...t,
      motoristas_count: (motors || []).filter(m => m.transportadora_id === t.id && m.ativo).length,
      veiculos_count: (veics || []).filter(v => v.transportadora_id === t.id && v.ativo).length
    }))
    setTransportadoras(mappedTransps)

    setSelectedIds([])
    setLoading(false)
  }

  async function restaurarRomaneio(id: string) {
    const { error } = await supabase
      .from('romaneios')
      .update({ excluido_em: null, excluido_por: null })
      .eq('id', id)
    if (error) { toast.error('Erro ao restaurar'); return }
    toast.success('Romaneio restaurado!')
    setRomaneios(prev => prev.filter(r => r.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  async function excluirDefinitivoRomaneio(id: string) {
    if (!confirm('ATENÇÃO: Excluir permanentemente este romaneio e todos os seus itens? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('romaneios').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Romaneio excluído permanentemente.')
    setRomaneios(prev => prev.filter(r => r.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  async function restaurarTransportadora(id: string) {
    const { error } = await supabase
      .from('transportadoras_cadastradas')
      .update({ ativo: true })
      .eq('id', id)
    if (error) { toast.error('Erro ao restaurar transportadora'); return }
    toast.success('Transportadora restaurada!')
    setTransportadoras(prev => prev.filter(t => t.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  async function excluirDefinitivoTransportadora(id: string) {
    if (!confirm('ATENÇÃO: Excluir permanentemente esta transportadora? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('transportadoras_cadastradas').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Transportadora excluída permanentemente.')
    setTransportadoras(prev => prev.filter(t => t.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  function handleSelectAll(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
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
    if (activeTab === 'romaneios') {
      const { error } = await supabase
        .from('romaneios')
        .update({ excluido_em: null, excluido_por: null })
        .in('id', selectedIds)
      if (error) { toast.error('Erro ao restaurar romaneios'); return }
      toast.success(`${selectedIds.length} romaneio(s) restaurado(s)!`)
      setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
    } else {
      const { error } = await supabase
        .from('transportadoras_cadastradas')
        .update({ ativo: true })
        .in('id', selectedIds)
      if (error) { toast.error('Erro ao restaurar transportadoras'); return }
      toast.success(`${selectedIds.length} transportadora(s) restaurada(s)!`)
      setTransportadoras(prev => prev.filter(t => !selectedIds.includes(t.id)))
    }
    setSelectedIds([])
  }

  async function excluirSelecionados() {
    if (selectedIds.length === 0) return
    if (activeTab === 'romaneios') {
      if (!confirm(`ATENÇÃO: Excluir permanentemente os ${selectedIds.length} romaneios selecionados e todos os seus itens? Esta ação não pode ser desfeita.`)) return
      const { error } = await supabase
        .from('romaneios')
        .delete()
        .in('id', selectedIds)
      if (error) { toast.error('Erro ao excluir: ' + error.message); return }
      toast.success(`${selectedIds.length} romaneio(s) excluído(s) permanentemente.`)
      setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
    } else {
      if (!confirm(`ATENÇÃO: Excluir permanentemente as ${selectedIds.length} transportadoras selecionadas? Esta ação não pode ser desfeita.`)) return
      const { error } = await supabase
        .from('transportadoras_cadastradas')
        .delete()
        .in('id', selectedIds)
      if (error) { toast.error('Erro ao excluir: ' + error.message); return }
      toast.success(`${selectedIds.length} transportadora(s) excluída(s) permanentemente.`)
      setTransportadoras(prev => prev.filter(t => !selectedIds.includes(t.id)))
    }
    setSelectedIds([])
  }

  const hasItems = activeTab === 'romaneios' ? romaneios.length > 0 : transportadoras.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost" onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
          <div>
            <h1>Lixeira</h1>
            <p className="subtitle">
              {activeTab === 'romaneios'
                ? `${romaneios.length} romaneio(s) excluído(s)`
                : `${transportadoras.length} transportadora(s) desativada(s)`}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          onClick={() => { setActiveTab('romaneios'); setSelectedIds([]); }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'romaneios' ? 600 : 400,
            borderBottom: activeTab === 'romaneios' ? '2px solid #2563eb' : 'none',
            color: activeTab === 'romaneios' ? '#2563eb' : '#475569',
            cursor: 'pointer'
          }}
        >
          Romaneios
        </button>
        <button
          onClick={() => { setActiveTab('transportadoras'); setSelectedIds([]); }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'transportadoras' ? 600 : 400,
            borderBottom: activeTab === 'transportadoras' ? '2px solid #2563eb' : 'none',
            color: activeTab === 'transportadoras' ? '#2563eb' : '#475569',
            cursor: 'pointer'
          }}
        >
          Transportadoras
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : !hasItems ? (
        <div className="empty-state">
          {activeTab === 'romaneios' ? <Trash2 size={40} color="#94a3b8" /> : <Truck size={40} color="#94a3b8" />}
          <p>{activeTab === 'romaneios' ? 'Nenhum romaneio na lixeira.' : 'Nenhuma transportadora desativada.'}</p>
          <button className="btn-ghost" onClick={() => navigate('/')}>Voltar ao dashboard</button>
        </div>
      ) : (
        <>
          <div className="lixeira-aviso" style={{ marginBottom: 12 }}>
            Itens na lixeira podem ser restaurados ou excluídos permanentemente.
          </div>

          {selectedIds.length > 0 && (
            <div className="lixeira-actions-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#475569' }}>
                {selectedIds.length} item{selectedIds.length !== 1 ? 'ns' : ''} selecionado{selectedIds.length !== 1 ? 's' : ''}
              </span>
              <button className="btn-secondary" onClick={restaurarSelecionados} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
                <RotateCcw size={14} /> Restaurar selecionados
              </button>
              <button className="btn-secondary danger" onClick={excluirSelecionados} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
                <Trash2 size={14} /> Excluir permanentemente
              </button>
            </div>
          )}

          {activeTab === 'romaneios' ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={romaneios.length > 0 && selectedIds.length === romaneios.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Data criação</th>
                    <th>Transportadora</th>
                    <th>Motorista</th>
                    <th>Placa</th>
                    <th>Status</th>
                    <th>Excluído em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {romaneios.map(r => (
                    <tr key={r.id}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => handleSelectRow(r.id)}
                        />
                      </td>
                      <td>{new Date(r.data_criacao).toLocaleDateString('pt-BR')}</td>
                      <td>{r.transportadora_nome || <span className="muted">—</span>}</td>
                      <td>{r.motorista_nome || <span className="muted">—</span>}</td>
                      <td>{r.veiculo_placa || <span className="muted">—</span>}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.excluido_em ? new Date(r.excluido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-icon-sm"
                            title="Restaurar romaneio"
                            onClick={() => restaurarRomaneio(r.id)}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            className="btn-icon-sm danger"
                            title="Excluir permanentemente"
                            onClick={() => excluirDefinitivoRomaneio(r.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={transportadoras.length > 0 && selectedIds.length === transportadoras.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Razão Social</th>
                    <th>CNPJ</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Qtd. Motoristas</th>
                    <th>Qtd. Veículos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transportadoras.map(t => (
                    <tr key={t.id}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => handleSelectRow(t.id)}
                        />
                      </td>
                      <td><strong>{t.nome}</strong></td>
                      <td>{formatCNPJ(t.cnpj)}</td>
                      <td>{t.contato_email || <span className="muted">—</span>}</td>
                      <td>{t.contato_telefone || <span className="muted">—</span>}</td>
                      <td>{t.motoristas_count}</td>
                      <td>{t.veiculos_count}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-icon-sm"
                            title="Restaurar transportadora"
                            onClick={() => restaurarTransportadora(t.id)}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            className="btn-icon-sm danger"
                            title="Excluir permanentemente"
                            onClick={() => excluirDefinitivoTransportadora(t.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
