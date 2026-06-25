import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCNPJ, validateCNPJ, formatCPF, formatRG, formatPlaca } from '../lib/validators'
import type { TransportadoraCadastrada, MotoristaCadastrado, VeiculoCadastrado } from '../types'
import toast from 'react-hot-toast'
import { Plus, Trash2, ChevronDown, ChevronUp, Truck, User, CreditCard, ArrowLeft, Pencil, Camera, Eye } from 'lucide-react'

type TabType = 'motoristas' | 'veiculos'

interface TransportadoraExpandida extends TransportadoraCadastrada {
  motoristas: MotoristaCadastrado[]
  veiculos: VeiculoCadastrado[]
}

interface MotoristaForm { nome: string; cpf: string; rg: string }
interface VeiculoForm  { modelo: string; placa: string }

const emptyTransp = () => ({ nome: '', cnpj: '', contato_email: '', contato_telefone: '', recorrente: false })
const emptyMotorista = (): MotoristaForm => ({ nome: '', cpf: '', rg: '' })
const emptyVeiculo   = (): VeiculoForm  => ({ modelo: '', placa: '' })

export default function TransportadorasPage() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<TransportadoraExpandida[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, TabType>>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyTransp())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<{ mId: string; motoristaNome: string; base64: string } | null>(null)

  const [motorForm, setMotorForm] = useState<Record<string, MotoristaForm>>({})
  const [veicForm, setVeicForm]   = useState<Record<string, VeiculoForm>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: transp, error: errT }, { data: motors }, { data: veics }] = await Promise.all([
        supabase.from('transportadoras_cadastradas').select('*').eq('ativo', true).order('nome'),
        supabase.from('motoristas_cadastrados').select('*').eq('ativo', true).order('nome'),
        supabase.from('veiculos_cadastrados').select('*').eq('ativo', true).order('modelo'),
      ])
      if (errT) throw errT

      const expandidas: TransportadoraExpandida[] = (transp ?? []).map(t => ({
        ...t,
        motoristas: (motors ?? []).filter(m => m.transportadora_id === t.id),
        veiculos: (veics ?? []).filter(v => v.transportadora_id === t.id),
      }))
      setLista(expandidas)
    } catch (e: any) {
      toast.error('Erro ao carregar transportadoras.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setExpanded(prev => (prev === id ? null : id))
    setActiveTab(prev => ({ ...prev, [id]: prev[id] ?? 'motoristas' }))
  }

  function iniciarEdicao(t: TransportadoraExpandida) {
    setEditingId(t.id)
    setForm({
      nome: t.nome,
      cnpj: formatCNPJ(t.cnpj),
      contato_email: t.contato_email || '',
      contato_telefone: t.contato_telefone || '',
      recorrente: !!t.recorrente,
    })
    setShowForm(true)
  }

  async function salvarTransportadora() {
    if (!form.nome.trim() || !form.cnpj.trim()) {
      toast.error('Nome e CNPJ são obrigatórios')
      return
    }
    if (!validateCNPJ(form.cnpj)) {
      toast.error('CNPJ inválido')
      return
    }
    setSaving(true)
    try {
      const cleanCnpj = form.cnpj.replace(/\D/g, '')
      const payload = {
        nome: form.nome.trim(),
        cnpj: cleanCnpj,
        contato_email: form.contato_email.trim() || null,
        contato_telefone: form.contato_telefone.trim() || null,
        recorrente: form.recorrente,
      }

      let error
      if (editingId) {
        const { error: err } = await supabase
          .from('transportadoras_cadastradas')
          .update(payload)
          .eq('id', editingId)
        error = err
      } else {
        const { error: err } = await supabase
          .from('transportadoras_cadastradas')
          .insert(payload)
        error = err
      }
      if (error) throw error
      toast.success(editingId ? 'Transportadora atualizada!' : 'Transportadora cadastrada!')
      setForm(emptyTransp())
      setEditingId(null)
      setShowForm(false)
      load()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function excluirTransportadora(id: string) {
    if (!confirm('Desativar esta transportadora?')) return
    try {
      const { error } = await supabase
        .from('transportadoras_cadastradas')
        .update({ ativo: false })
        .eq('id', id)
      if (error) throw error
      toast.success('Transportadora desativada')
      if (expanded === id) setExpanded(null)
      load()
    } catch {
      toast.error('Erro ao desativar.')
    }
  }

  async function adicionarMotorista(transportadora_id: string) {
    const f = motorForm[transportadora_id]
    if (!f?.nome?.trim()) { toast.error('Nome do motorista é obrigatório'); return }
    try {
      const { error } = await supabase.from('motoristas_cadastrados').insert({
        transportadora_id,
        nome: f.nome.trim(),
        cpf: f.cpf?.trim() || null,
        rg: f.rg?.trim() || null,
      })
      if (error) throw error
      toast.success('Motorista adicionado')
      setMotorForm(prev => ({ ...prev, [transportadora_id]: emptyMotorista() }))
      load()
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    }
  }

  async function excluirMotorista(id: string) {
    if (!confirm('Desativar este motorista?')) return
    try {
      await supabase.from('motoristas_cadastrados').update({ ativo: false }).eq('id', id)
      toast.success('Motorista removido')
      load()
    } catch {
      toast.error('Erro ao remover motorista.')
    }
  }

  async function handleFotoUpload(mId: string, file: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 1000
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.70)
        
        try {
          const { error } = await supabase
            .from('motoristas_cadastrados')
            .update({ foto_documento: compressedBase64 })
            .eq('id', mId)
          if (error) throw error
          toast.success('Documento salvo!')
          load()
        } catch (err: any) {
          toast.error('Erro ao salvar documento: ' + err.message)
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  async function removerFoto(mId: string) {
    if (!confirm('Deseja remover o documento cadastrado para este motorista?')) return
    try {
      const { error } = await supabase
        .from('motoristas_cadastrados')
        .update({ foto_documento: null })
        .eq('id', mId)
      if (error) throw error
      toast.success('Documento removido!')
      setViewingPhoto(null)
      load()
    } catch (err: any) {
      toast.error('Erro ao remover documento: ' + err.message)
    }
  }

  async function adicionarVeiculo(transportadora_id: string) {
    const f = veicForm[transportadora_id]
    if (!f?.modelo?.trim() || !f?.placa?.trim()) {
      toast.error('Modelo e placa são obrigatórios')
      return
    }
    try {
      const { error } = await supabase.from('veiculos_cadastrados').insert({
        transportadora_id,
        modelo: f.modelo.trim(),
        placa: f.placa.trim().toUpperCase(),
      })
      if (error) throw error
      toast.success('Veículo adicionado')
      setVeicForm(prev => ({ ...prev, [transportadora_id]: emptyVeiculo() }))
      load()
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    }
  }

  async function excluirVeiculo(id: string) {
    if (!confirm('Desativar este veículo?')) return
    try {
      await supabase.from('veiculos_cadastrados').update({ ativo: false }).eq('id', id)
      toast.success('Veículo removido')
      load()
    } catch {
      toast.error('Erro ao remover veículo.')
    }
  }

  function renderTranspCard(t: TransportadoraExpandida) {
    const isExpanded = expanded === t.id
    const currentTab = activeTab[t.id] ?? 'motoristas'
    const mForm = motorForm[t.id] ?? emptyMotorista()
    const vForm = veicForm[t.id] ?? emptyVeiculo()

    return (
      <div key={t.id} className="card no-active" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header card click to expand */}
        <div
          onClick={() => toggle(t.id)}
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: isExpanded ? 'var(--bg-highlight)' : 'transparent',
            borderBottom: isExpanded ? '1px solid var(--border)' : 'none'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Truck size={20} className="text-primary" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="font-bold" style={{ fontSize: '15px' }}>{t.nome}</span>
                {t.recorrente && (
                  <span style={{ fontSize: '9px', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Recorrente
                  </span>
                )}
              </div>
              <span className="text-muted" style={{ fontSize: '12px' }}>CNPJ: {formatCNPJ(t.cnpj)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <button
              className="header-btn text-primary"
              onClick={() => iniciarEdicao(t)}
              style={{ width: '32px', height: '32px' }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="header-btn text-danger"
              onClick={() => excluirTransportadora(t.id)}
              style={{ width: '32px', height: '32px' }}
            >
              <Trash2 size={14} />
            </button>
            <div onClick={() => toggle(t.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div style={{ padding: '16px' }}>
            {/* Tab Switcher Pills */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-highlight)',
              padding: '4px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid var(--border)'
            }}>
              <button
                onClick={() => setActiveTab(prev => ({ ...prev, [t.id]: 'motoristas' }))}
                style={{
                  flex: 1,
                  height: '32px',
                  border: 'none',
                  borderRadius: '6px',
                  background: currentTab === 'motoristas' ? '#fff' : 'transparent',
                  color: currentTab === 'motoristas' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: currentTab === 'motoristas' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: currentTab === 'motoristas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Motoristas ({t.motoristas.length})
              </button>
              <button
                onClick={() => setActiveTab(prev => ({ ...prev, [t.id]: 'veiculos' }))}
                style={{
                  flex: 1,
                  height: '32px',
                  border: 'none',
                  borderRadius: '6px',
                  background: currentTab === 'veiculos' ? '#fff' : 'transparent',
                  color: currentTab === 'veiculos' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: currentTab === 'veiculos' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: currentTab === 'veiculos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Veículos ({t.veiculos.length})
              </button>
            </div>

            {/* Tab content 1: Motoristas */}
            {currentTab === 'motoristas' && (
              <div>
                {/* Add Driver mini-form */}
                <div style={{
                  background: 'var(--bg-highlight)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '16px'
                }}>
                  <span className="font-bold" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Adicionar Motorista</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Nome Completo *"
                      value={mForm.nome}
                      onChange={e => setMotorForm(prev => ({
                        ...prev,
                        [t.id]: { ...(prev[t.id] ?? emptyMotorista()), nome: e.target.value }
                      }))}
                      style={{ height: '36px', fontSize: '13px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="CPF (opcional)"
                        value={mForm.cpf}
                        onChange={e => setMotorForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? emptyMotorista()), cpf: formatCPF(e.target.value) }
                        }))}
                        style={{ height: '36px', fontSize: '13px', flex: 1 }}
                        inputMode="numeric"
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="RG (opcional)"
                        value={mForm.rg}
                        onChange={e => setMotorForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? emptyMotorista()), rg: formatRG(e.target.value) }
                        }))}
                        style={{ height: '36px', fontSize: '13px', flex: 1 }}
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      className="btn btn-secondary flex-center"
                      onClick={() => adicionarMotorista(t.id)}
                      style={{ height: '32px', fontSize: '12px', marginTop: '4px' }}
                    >
                      <Plus size={14} />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Drivers List */}
                {t.motoristas.length === 0 ? (
                  <p className="text-muted text-center" style={{ fontSize: '12px', padding: '10px' }}>Nenhum motorista cadastrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {t.motoristas.map(m => (
                      <div key={m.id} className="flex-between" style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={16} className="text-muted" />
                          <div>
                            <span className="font-bold" style={{ fontSize: '13px', display: 'block' }}>{m.nome}</span>
                            <span className="text-muted" style={{ fontSize: '11px' }}>
                              {m.cpf ? `CPF: ${formatCPF(m.cpf)}` : 'Sem CPF'} {m.rg && `· RG: ${formatRG(m.rg)}`}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {m.foto_documento ? (
                            <button
                              className="header-btn text-primary"
                              onClick={() => setViewingPhoto({ mId: m.id, motoristaNome: m.nome, base64: m.foto_documento! })}
                              style={{ width: '28px', height: '28px' }}
                            >
                              <Eye size={13} />
                            </button>
                          ) : (
                            <label
                              className="header-btn text-muted"
                              style={{ width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                            >
                              <Camera size={13} />
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (file) handleFotoUpload(m.id, file)
                                }}
                                style={{ display: 'none' }}
                              />
                            </label>
                          )}
                          <button className="header-btn text-danger" onClick={() => excluirMotorista(m.id)} style={{ width: '28px', height: '28px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab content 2: Veículos */}
            {currentTab === 'veiculos' && (
              <div>
                {/* Add Vehicle mini-form */}
                <div style={{
                  background: 'var(--bg-highlight)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '16px'
                }}>
                  <span className="font-bold" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Adicionar Veículo</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Modelo (Ex: Fiorino) *"
                        value={vForm.modelo}
                        onChange={e => setVeicForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? emptyVeiculo()), modelo: e.target.value }
                        }))}
                        style={{ height: '36px', fontSize: '13px', flex: 2 }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Placa *"
                        value={vForm.placa}
                        onChange={e => setVeicForm(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] ?? emptyVeiculo()), placa: formatPlaca(e.target.value) }
                        }))}
                        style={{ height: '36px', fontSize: '13px', flex: 1 }}
                      />
                    </div>
                    <button
                      className="btn btn-secondary flex-center"
                      onClick={() => adicionarVeiculo(t.id)}
                      style={{ height: '32px', fontSize: '12px', marginTop: '4px' }}
                    >
                      <Plus size={14} />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Vehicles List */}
                {t.veiculos.length === 0 ? (
                  <p className="text-muted text-center" style={{ fontSize: '12px', padding: '10px' }}>Nenhum veículo cadastrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {t.veiculos.map(v => (
                      <div key={v.id} className="flex-between" style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={16} className="text-muted" />
                          <div>
                            <span className="font-bold" style={{ fontSize: '13px', display: 'block' }}>{v.modelo}</span>
                            <span className="text-muted" style={{ fontSize: '11px' }}>Placa: {v.placa}</span>
                          </div>
                        </div>
                        <button className="header-btn text-danger" onClick={() => excluirVeiculo(v.id)} style={{ width: '28px', height: '28px' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const recorrentes = lista.filter(t => t.recorrente)
  const outras = lista.filter(t => !t.recorrente)

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="header-btn" onClick={() => navigate('/')} style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="title-large" style={{ margin: 0, fontSize: '18px' }}>Transportadoras</h2>
          <span className="text-muted" style={{ fontSize: '13px' }}>Cadastro de frota e parceiros</span>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowForm(!showForm)} style={{ width: 'auto', height: '36px', padding: '0 12px', fontSize: '12px' }}>
          <Plus size={16} />
          <span>Nova</span>
        </button>
      </div>

      {/* New Transportadora Form Card */}
      {showForm && (
        <div className="card no-active" style={{ border: '1px solid var(--primary)' }}>
          <h3 className="card-title" style={{ color: 'var(--primary)', marginBottom: '12px' }}>
            {editingId ? 'Editar Transportadora' : 'Cadastrar Transportadora'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label>Razão Social *</label>
              <input
                type="text"
                className="input"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Alfa Logística"
              />
            </div>
            <div className="form-group">
              <label>CNPJ *</label>
              <input
                type="text"
                className="input"
                value={form.cnpj}
                onChange={e => setForm(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0001-00"
                inputMode="numeric"
              />
            </div>
            <div className="form-group">
              <label>E-mail de Contato (Opcional)</label>
              <input
                type="email"
                className="input"
                value={form.contato_email}
                onChange={e => setForm(p => ({ ...p, contato_email: e.target.value }))}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="form-group">
              <label>Telefone (Opcional)</label>
              <input
                type="tel"
                className="input"
                value={form.contato_telefone}
                onChange={e => setForm(p => ({ ...p, contato_telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
              <input
                type="checkbox"
                id="form-recorrente"
                checked={form.recorrente}
                onChange={e => setForm(p => ({ ...p, recorrente: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="form-recorrente" style={{ fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', margin: 0 }}>
                Transportadora Recorrente
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(emptyTransp()); setEditingId(null); }} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={salvarTransportadora} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main list */}
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
      ) : lista.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px 16px' }}>
          <Truck size={40} className="text-muted" style={{ margin: '0 auto 12px auto' }} />
          <p className="text-muted" style={{ fontSize: '14px' }}>Nenhuma transportadora cadastrada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {recorrentes.length > 0 && (
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Recorrentes</span>
                <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '10px' }}>{recorrentes.length}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recorrentes.map(t => renderTranspCard(t))}
              </div>
            </div>
          )}

          {outras.length > 0 && (
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Outras Transportadoras</span>
                <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>{outras.length}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {outras.map(t => renderTranspCard(t))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewingPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }} onClick={() => setViewingPhoto(null)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '100%',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-bold" style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                Documento: {viewingPhoto.motoristaNome}
              </h3>
              <button
                style={{ background: 'transparent', border: 'none', fontSize: '18px', padding: '4px', cursor: 'pointer' }}
                onClick={() => setViewingPhoto(null)}
              >
                ✕
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
              maxHeight: '350px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: '#f8fafc'
            }}>
              <img
                src={viewingPhoto.base64}
                alt="Documento do Motorista"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => removerFoto(viewingPhoto.mId)}
                style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)', height: '38px', fontSize: '13px' }}
              >
                Remover Foto
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setViewingPhoto(null)}
                style={{ flex: 1, height: '38px', fontSize: '13px' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
