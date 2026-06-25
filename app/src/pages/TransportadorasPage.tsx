import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCNPJ, validateCNPJ, formatCPF, formatRG } from '../lib/validators'
import type { TransportadoraCadastrada, MotoristaCadastrado, VeiculoCadastrado } from '../types'
import toast from 'react-hot-toast'
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Truck, User, Car, AlertTriangle, Pencil, Camera, Eye } from 'lucide-react'

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
  const [lista, setLista] = useState<TransportadoraExpandida[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, TabType>>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyTransp())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<{ mId: string; motoristaNome: string; base64: string } | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const [motorForm, setMotorForm] = useState<Record<string, MotoristaForm>>({})
  const [veicForm, setVeicForm]   = useState<Record<string, VeiculoForm>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: transp, error: errT }, { data: motors }, { data: veics }] = await Promise.all([
      supabase.from('transportadoras_cadastradas').select('*').eq('ativo', true).order('nome'),
      supabase.from('motoristas_cadastrados').select('*').eq('ativo', true).order('nome'),
      supabase.from('veiculos_cadastrados').select('*').eq('ativo', true).order('modelo'),
    ])
    if (errT?.code === '42P01') { // tabela não existe
      setMigrationNeeded(true)
      setLoading(false)
      return
    }

    const expandidas: TransportadoraExpandida[] = (transp ?? []).map(t => ({
      ...t,
      motoristas: (motors ?? []).filter(m => m.transportadora_id === t.id),
      veiculos: (veics ?? []).filter(v => v.transportadora_id === t.id),
    }))
    setLista(expandidas)
    setLoading(false)
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

    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(editingId ? 'Transportadora atualizada!' : 'Transportadora cadastrada!')
    setForm(emptyTransp())
    setEditingId(null)
    setShowForm(false)
    load()
  }

  async function excluirTransportadora(id: string) {
    if (!confirm('Desativar esta transportadora?')) return
    const { error } = await supabase
      .from('transportadoras_cadastradas')
      .update({ ativo: false })
      .eq('id', id)
    if (error) { toast.error('Erro ao desativar'); return }
    toast.success('Transportadora desativada')
    load()
  }

  async function adicionarMotorista(transportadora_id: string) {
    const f = motorForm[transportadora_id]
    if (!f?.nome?.trim()) { toast.error('Nome do motorista é obrigatório'); return }
    const { error } = await supabase.from('motoristas_cadastrados').insert({
      transportadora_id,
      nome: f.nome.trim(),
      cpf: f.cpf?.trim() || null,
      rg: f.rg?.trim() || null,
    })
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Motorista adicionado')
    setMotorForm(prev => ({ ...prev, [transportadora_id]: emptyMotorista() }))
    load()
  }

  async function excluirMotorista(id: string) {
    await supabase.from('motoristas_cadastrados').update({ ativo: false }).eq('id', id)
    toast.success('Motorista removido')
    load()
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
        
        // Save to Supabase
        const { error } = await supabase
          .from('motoristas_cadastrados')
          .update({ foto_documento: compressedBase64 })
          .eq('id', mId)
          
        if (error) {
          toast.error('Erro ao salvar documento: ' + error.message)
        } else {
          toast.success('Documento salvo!')
          load()
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  async function removerFoto(mId: string) {
    if (!confirm('Deseja remover o documento cadastrado para este motorista?')) return
    const { error } = await supabase
      .from('motoristas_cadastrados')
      .update({ foto_documento: null })
      .eq('id', mId)
      
    if (error) {
      toast.error('Erro ao remover documento: ' + error.message)
    } else {
      toast.success('Documento removido!')
      setViewingPhoto(null)
      load()
    }
  }

  async function adicionarVeiculo(transportadora_id: string) {
    const f = veicForm[transportadora_id]
    if (!f?.modelo?.trim() || !f?.placa?.trim()) {
      toast.error('Modelo e placa são obrigatórios')
      return
    }
    const { error } = await supabase.from('veiculos_cadastrados').insert({
      transportadora_id,
      modelo: f.modelo.trim(),
      placa: f.placa.trim().toUpperCase(),
    })
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Veículo adicionado')
    setVeicForm(prev => ({ ...prev, [transportadora_id]: emptyVeiculo() }))
    load()
  }

  async function excluirVeiculo(id: string) {
    await supabase.from('veiculos_cadastrados').update({ ativo: false }).eq('id', id)
    toast.success('Veículo removido')
    load()
  }

  function renderTranspCard(t: TransportadoraExpandida) {
    return (
      <div key={t.id} className="transp-card">
        <div className="transp-header" onClick={() => toggle(t.id)}>
          <div className="transp-info">
            <Truck size={18} color="#2563eb" />
            <div>
              <div className="transp-nome">
                {t.nome}
                {t.recorrente && (
                  <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 600 }}>
                    Recorrente
                  </span>
                )}
              </div>
              <div className="transp-cnpj">{formatCNPJ(t.cnpj)}</div>
              {t.contato_email && <div className="transp-cnpj">{t.contato_email}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="transp-badge">{t.motoristas.length} mot. · {t.veiculos.length} veíc.</span>
            <button
              className="btn-icon-sm"
              onClick={e => { e.stopPropagation(); iniciarEdicao(t) }}
              title="Editar"
              style={{ color: 'var(--primary)' }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="btn-icon-sm danger"
              onClick={e => { e.stopPropagation(); excluirTransportadora(t.id) }}
              title="Desativar"
            >
              <Trash2 size={14} />
            </button>
            {expanded === t.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expanded === t.id && (
          <div className="transp-body">
            <div className="transp-tabs">
              <button
                className={`transp-tab ${activeTab[t.id] !== 'veiculos' ? 'active' : ''}`}
                onClick={() => setActiveTab(prev => ({ ...prev, [t.id]: 'motoristas' }))}
              >
                <User size={14} /> Motoristas
              </button>
              <button
                className={`transp-tab ${activeTab[t.id] === 'veiculos' ? 'active' : ''}`}
                onClick={() => setActiveTab(prev => ({ ...prev, [t.id]: 'veiculos' }))}
              >
                <Car size={14} /> Veículos
              </button>
            </div>

            {activeTab[t.id] !== 'veiculos' ? (
              <div className="transp-sublist">
                {t.motoristas.map(m => (
                  <div key={m.id} className="transp-subitem">
                    <div>
                      <strong>{m.nome}</strong>
                      {m.cpf && <span className="muted"> · CPF: {formatCPF(m.cpf)}</span>}
                      {m.rg && <span className="muted"> · RG: {formatRG(m.rg)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {m.foto_documento ? (
                        <button
                          className="btn-icon-sm"
                          title="Ver Documento"
                          onClick={e => { e.stopPropagation(); setViewingPhoto({ mId: m.id, motoristaNome: m.nome, base64: m.foto_documento! }) }}
                          style={{ color: '#2563eb' }}
                        >
                          <Eye size={13} />
                        </button>
                      ) : (
                        <label
                          className="btn-icon-sm"
                          title="Upload Documento"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: 0, color: '#475569' }}
                          onClick={e => e.stopPropagation()}
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
                      <button className="btn-icon-sm danger" onClick={e => { e.stopPropagation(); excluirMotorista(m.id) }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="transp-add-row">
                  <input
                    placeholder="Nome do motorista *"
                    value={motorForm[t.id]?.nome ?? ''}
                    onChange={e => setMotorForm(prev => ({
                      ...prev,
                      [t.id]: { ...(prev[t.id] ?? emptyMotorista()), nome: e.target.value }
                    }))}
                  />
                  <input
                    placeholder="CPF"
                    inputMode="numeric"
                    value={motorForm[t.id]?.cpf ?? ''}
                    onChange={e => setMotorForm(prev => ({
                      ...prev,
                      [t.id]: { ...(prev[t.id] ?? emptyMotorista()), cpf: formatCPF(e.target.value) }
                    }))}
                  />
                  <input
                    placeholder="RG"
                    inputMode="numeric"
                    value={motorForm[t.id]?.rg ?? ''}
                    onChange={e => setMotorForm(prev => ({
                      ...prev,
                      [t.id]: { ...(prev[t.id] ?? emptyMotorista()), rg: formatRG(e.target.value) }
                    }))}
                  />
                  <button className="btn-secondary" onClick={() => adicionarMotorista(t.id)}>
                    <PlusCircle size={14} /> Adicionar
                  </button>
                </div>
              </div>
            ) : (
              <div className="transp-sublist">
                {t.veiculos.map(v => (
                  <div key={v.id} className="transp-subitem">
                    <div>
                      <strong>{v.modelo}</strong>
                      <span className="muted"> · {v.placa}</span>
                    </div>
                    <button className="btn-icon-sm danger" onClick={() => excluirVeiculo(v.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div className="transp-add-row">
                  <input
                    placeholder="Modelo *"
                    value={veicForm[t.id]?.modelo ?? ''}
                    onChange={e => setVeicForm(prev => ({
                      ...prev,
                      [t.id]: { ...(prev[t.id] ?? emptyVeiculo()), modelo: e.target.value }
                    }))}
                  />
                  <input
                    placeholder="Placa *"
                    value={veicForm[t.id]?.placa ?? ''}
                    onChange={e => setVeicForm(prev => ({
                      ...prev,
                      [t.id]: { ...(prev[t.id] ?? emptyVeiculo()), placa: e.target.value }
                    }))}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button className="btn-secondary" onClick={() => adicionarVeiculo(t.id)}>
                    <PlusCircle size={14} /> Adicionar
                  </button>
                </div>
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
    <div className="page">
        <div className="page-header">
          <div>
            <h1>Transportadoras</h1>
            <p className="subtitle">Cadastre transportadoras para pré-preencher romaneios</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <PlusCircle size={16} /> Nova Transportadora
          </button>
        </div>

        {showForm && (
          <div className="form-card" style={{ marginBottom: 20 }}>
            <div className="section-title">{editingId ? 'Editar Transportadora' : 'Nova Transportadora'}</div>
            <div className="field-row">
              <div className="field">
                <label>Razão Social *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="field">
                <label>CNPJ *</label>
                <input
                  value={form.cnpj}
                  onChange={e => setForm(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))}
                  placeholder="00.000.000/0001-00"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="field-row" style={{ marginTop: 10 }}>
              <div className="field">
                <label>E-mail de contato</label>
                <input
                  type="email"
                  value={form.contato_email}
                  onChange={e => setForm(p => ({ ...p, contato_email: e.target.value }))}
                  placeholder="contato@transportadora.com.br"
                />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input
                  value={form.contato_telefone}
                  onChange={e => setForm(p => ({ ...p, contato_telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                />
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="form-recorrente"
                type="checkbox"
                checked={form.recorrente}
                onChange={e => setForm(p => ({ ...p, recorrente: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="form-recorrente" style={{ fontSize: 13, fontWeight: 500, color: '#475569', cursor: 'pointer', margin: 0 }}>
                Transportadora Recorrente
              </label>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => { setShowForm(false); setForm(emptyTransp()); setEditingId(null); }}>Cancelar</button>
              <button className="btn-primary" onClick={salvarTransportadora} disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Atualizar Transportadora' : 'Salvar Transportadora'}
              </button>
            </div>
          </div>
        )}

        {migrationNeeded && (
          <div className="migration-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Migration pendente</strong>
              <p>As tabelas de transportadoras ainda não foram criadas. Execute o arquivo <code>004_lixeira_foto_documento.sql</code> no <a href="https://supabase.com/dashboard/project/odanqvpyuycqptqemfat/sql/new" target="_blank" rel="noreferrer">Supabase SQL Editor</a> para habilitar esta funcionalidade.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : migrationNeeded ? null : lista.length === 0 ? (
          <div className="empty-state">
            <Truck size={40} color="#94a3b8" />
            <p>Nenhuma transportadora cadastrada ainda.</p>
          </div>
        ) : !migrationNeeded ? (
          <div className="transp-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {recorrentes.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Recorrentes</span>
                  <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10 }}>{recorrentes.length}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recorrentes.map(t => renderTranspCard(t))}
                </div>
              </div>
            )}

            {outras.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Outras Transportadoras</span>
                  <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 10 }}>{outras.length}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {outras.map(t => renderTranspCard(t))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {viewingPhoto && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }} onClick={() => setViewingPhoto(null)}>
            <div style={{
              background: 'white',
              borderRadius: 8,
              padding: 20,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                  Documento: {viewingPhoto.motoristaNome}
                </h3>
                <button
                  className="btn-ghost"
                  style={{ padding: 4, height: 'auto', width: 'auto', fontSize: 18 }}
                  onClick={() => setViewingPhoto(null)}
                >
                  ✕
                </button>
              </div>
              <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 250,
                maxHeight: 400,
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                background: '#f8fafc',
                position: 'relative'
              }}>
                <img
                  src={viewingPhoto.base64}
                  alt="Documento do Motorista"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }}
                  onClick={() => setLightboxImage(viewingPhoto.base64)}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '8px',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  fontSize: '11px',
                  padding: '2px 10px',
                  borderRadius: '10px',
                  pointerEvents: 'none'
                }}>
                  Clique para ampliar
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn-secondary danger"
                  onClick={() => removerFoto(viewingPhoto.mId)}
                  style={{ flex: 1 }}
                >
                  Remover Foto
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setViewingPhoto(null)}
                  style={{ flex: 1 }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {lightboxImage && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: '16px'
            }}
            onClick={() => setLightboxImage(null)}
          >
            <button
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1110
              }}
              onClick={() => setLightboxImage(null)}
            >
              ✕
            </button>
            <img
              src={lightboxImage}
              alt="Visualização do Documento"
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </div>
  )
}
