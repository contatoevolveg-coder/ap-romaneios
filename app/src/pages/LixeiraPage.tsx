import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Romaneio } from '../types'
import StatusBadge from '../components/StatusBadge'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'

export default function LixeiraPage() {
  const navigate = useNavigate()
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('romaneios')
      .select('*')
      .not('excluido_em', 'is', null)
      .order('excluido_em', { ascending: false })
    if (error) toast.error('Erro ao carregar lixeira')
    setRomaneios(data || [])
    setSelectedIds([])
    setLoading(false)
  }

  async function restaurar(id: string) {
    const { error } = await supabase
      .from('romaneios')
      .update({ excluido_em: null, excluido_por: null })
      .eq('id', id)
    if (error) { toast.error('Erro ao restaurar'); return }
    toast.success('Romaneio restaurado!')
    setRomaneios(prev => prev.filter(r => r.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  async function excluirDefinitivo(id: string) {
    if (!confirm('ATENÇÃO: Excluir permanentemente este romaneio e todos os seus itens? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('romaneios').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Romaneio excluído permanentemente.')
    setRomaneios(prev => prev.filter(r => r.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }

  function handleSelectAll(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(romaneios.map(r => r.id))
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
    const { error } = await supabase
      .from('romaneios')
      .update({ excluido_em: null, excluido_por: null })
      .in('id', selectedIds)
    if (error) { toast.error('Erro ao restaurar romaneios'); return }
    toast.success(`${selectedIds.length} romaneio(s) restaurado(s)!`)
    setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
    setSelectedIds([])
  }

  async function excluirSelecionados() {
    if (selectedIds.length === 0) return
    if (!confirm(`ATENÇÃO: Excluir permanentemente os ${selectedIds.length} romaneios selecionados e todos os seus itens? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase
      .from('romaneios')
      .delete()
      .in('id', selectedIds)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success(`${selectedIds.length} romaneio(s) excluído(s) permanentemente.`)
    setRomaneios(prev => prev.filter(r => !selectedIds.includes(r.id)))
    setSelectedIds([])
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost" onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
          <div>
            <h1>Lixeira</h1>
            <p className="subtitle">{romaneios.length} romaneio{romaneios.length !== 1 ? 's' : ''} excluído{romaneios.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : romaneios.length === 0 ? (
        <div className="empty-state">
          <Trash2 size={40} color="#94a3b8" />
          <p>A lixeira está vazia.</p>
          <button className="btn-ghost" onClick={() => navigate('/')}>Voltar ao dashboard</button>
        </div>
      ) : (
        <>
          <div className="lixeira-aviso" style={{ marginBottom: 12 }}>
            Romaneios na lixeira podem ser restaurados ou excluídos permanentemente.
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
                          onClick={() => restaurar(r.id)}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          className="btn-icon-sm danger"
                          title="Excluir permanentemente"
                          onClick={() => excluirDefinitivo(r.id)}
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
        </>
      )}
    </div>
  )
}

