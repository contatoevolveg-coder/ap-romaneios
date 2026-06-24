import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { parseNfeXml, normalizarNfe, mesmaNfe } from '../lib/nfe'
import { audioService } from '../lib/audio'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Plus, Trash2, FileText } from 'lucide-react'

interface ItemForm {
  numero_nfe: string
  cliente_destinatario: string
  empresa: string
  depositante: string
  qtd_volumes: number
}

interface Transportadora {
  id: string
  nome: string
  cnpj: string
}

export default function NovoRomaneioPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [selectedTranspId, setSelectedTranspId] = useState('')
  const [emailNotificacao, setEmailNotificacao] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([])
  const [saving, setSaving] = useState(false)

  // Manual item input states
  const [manualNfe, setManualNfe] = useState('')
  const [manualDest, setManualDest] = useState('')
  const [manualEmp, setManualEmp] = useState('')
  const [manualDep, setManualDep] = useState('')
  const [manualVol, setManualVol] = useState(1)

  // Load transportadoras list
  useEffect(() => {
    supabase
      .from('transportadoras_cadastradas')
      .select('id, nome, cnpj')
      .eq('ativo', true)
      .then(({ data }) => {
        if (data) setTransportadoras(data)
      })
  }, [])

  // Handle XML files upload
  async function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const novosItens: ItemForm[] = []
    let erros = 0

    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text()
        const parsed = parseNfeXml(text)
        if (parsed) {
          novosItens.push({
            numero_nfe: parsed.numero_nfe,
            cliente_destinatario: parsed.cliente_destinatario,
            empresa: parsed.empresa,
            depositante: parsed.depositante,
            qtd_volumes: parsed.qtd_volumes
          })
        } else {
          erros++
        }
      } catch (err) {
        console.error(err)
        erros++
      }
    }

    e.target.value = ''

    if (novosItens.length === 0) {
      audioService.playError()
      toast.error('Nenhum XML válido pôde ser importado.')
      return
    }

    // Filter duplicates
    const itensFiltrados = novosItens.filter(nov => {
      const jaExiste = itens.some(exist => mesmaNfe(exist.numero_nfe, nov.numero_nfe))
      return !jaExiste
    })

    const duplicadosCount = novosItens.length - itensFiltrados.length

    if (itensFiltrados.length > 0) {
      setItens(prev => [...prev, ...itensFiltrados])
      audioService.playSuccess()
      toast.success(`${itensFiltrados.length} NF-e(s) importada(s) com sucesso!`)
    }

    if (duplicadosCount > 0) {
      toast(`${duplicadosCount} NF-e(s) ignorada(s) por já estarem na lista.`, { icon: '⚠️' })
    }

    if (erros > 0) {
      toast.error(`Falha ao ler ${erros} arquivo(s) XML.`)
    }
  }

  // Add manual item
  function addManualItem(e: React.FormEvent) {
    e.preventDefault()
    if (!manualNfe.trim()) {
      toast.error('Preencha o número da NF-e.')
      return
    }
    if (!manualDest.trim()) {
      toast.error('Preencha o destinatário.')
      return
    }

    const normalizedNum = normalizarNfe(manualNfe)
    const jaExiste = itens.some(exist => mesmaNfe(exist.numero_nfe, normalizedNum))

    if (jaExiste) {
      audioService.playError()
      toast.error('Esta NF-e já está na lista!')
      return
    }

    const newItem: ItemForm = {
      numero_nfe: normalizedNum,
      cliente_destinatario: manualDest.trim(),
      empresa: manualEmp.trim(),
      depositante: manualDep.trim(),
      qtd_volumes: Number(manualVol) || 1
    }

    setItens(prev => [...prev, newItem])
    audioService.playSuccess()
    toast.success('Nota adicionada!')

    // Clear manual inputs
    setManualNfe('')
    setManualDest('')
    setManualEmp('')
    setManualDep('')
    setManualVol(1)
  }

  // Remove item from list
  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  // Submit and create romaneio
  async function handleSubmit() {
    if (saving) return
    if (itens.length === 0) {
      toast.error('Adicione ao menos uma NF-e para criar o romaneio.')
      return
    }

    setSaving(true)

    try {
      const selectedTransp = transportadoras.find(t => t.id === selectedTranspId)
      const insertData: Record<string, unknown> = { criado_por: user!.id }
      if (emailNotificacao.trim()) insertData.email_notificacao = emailNotificacao.trim()
      if (selectedTransp) {
        insertData.transportadora_nome = selectedTransp.nome
        insertData.transportadora_cnpj = selectedTransp.cnpj
      }

      // 1. Insert romaneio
      const { data: romaneio, error: errR } = await supabase
        .from('romaneios')
        .insert(insertData)
        .select('id')
        .single()

      if (errR || !romaneio) throw errR || new Error('Falha ao criar romaneio.')

      // 2. Insert items
      const { error: errI } = await supabase.from('romaneio_itens').insert(
        itens.map(it => ({
          romaneio_id: romaneio.id,
          numero_nfe: normalizarNfe(it.numero_nfe),
          cliente_destinatario: it.cliente_destinatario.trim(),
          empresa: it.empresa.trim() || null,
          depositante: it.depositante.trim() || null,
          qtd_volumes: Number(it.qtd_volumes)
        }))
      )

      if (errI) throw errI

      toast.success('Romaneio criado com sucesso!')
      navigate(`/romaneios/${romaneio.id}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao criar o romaneio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="header-btn" onClick={() => navigate('/')} style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 className="title-large" style={{ margin: 0 }}>Novo Romaneio</h2>
      </div>

      {/* Main configuration fields */}
      <div className="card no-active">
        <h3 className="card-title">Configurações Básicas</h3>
        
        <div className="form-group">
          <label htmlFor="transp">Transportadora (Opcional)</label>
          <select
            id="transp"
            className="input"
            value={selectedTranspId}
            onChange={e => setSelectedTranspId(e.target.value)}
          >
            <option value="">— Selecione a Transportadora —</option>
            {transportadoras.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="email">E-mail para Notificação (Opcional)</label>
          <input
            id="email"
            type="email"
            className="input"
            value={emailNotificacao}
            onChange={e => setEmailNotificacao(e.target.value)}
            placeholder="notificacoes@empresa.com"
          />
        </div>
      </div>

      {/* Import XML Block */}
      <div className="card no-active">
        <h3 className="card-title">Importar Arquivos XML</h3>
        <p className="text-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>
          Você pode selecionar múltiplos arquivos XML de NF-e salvos no seu aparelho.
        </p>
        <label className="btn btn-secondary flex-center" style={{ cursor: 'pointer' }}>
          <FileText size={18} />
          <span>Selecionar XMLs</span>
          <input
            type="file"
            accept=".xml"
            multiple
            onChange={handleXmlUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Manual Item Form */}
      <div className="card no-active">
        <h3 className="card-title">Adicionar NF-e Manual</h3>
        <form onSubmit={addManualItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label>Número NF-e ou Chave 44 dígitos</label>
            <input
              type="text"
              className="input"
              value={manualNfe}
              onChange={e => setManualNfe(e.target.value)}
              placeholder="Ex: 65915 ou Chave Completa"
            />
          </div>
          <div className="form-group">
            <label>Destinatário (Cliente)</label>
            <input
              type="text"
              className="input"
              value={manualDest}
              onChange={e => setManualDest(e.target.value)}
              placeholder="Razão Social ou Nome"
            />
          </div>
          <div className="form-group">
            <label>Empresa Emitente (Opcional)</label>
            <input
              type="text"
              className="input"
              value={manualEmp}
              onChange={e => setManualEmp(e.target.value)}
              placeholder="Ex: SmartGo"
            />
          </div>
          <div className="form-group">
            <label>Depositante (Opcional)</label>
            <input
              type="text"
              className="input"
              value={manualDep}
              onChange={e => setManualDep(e.target.value)}
              placeholder="Ex: Shopee"
            />
          </div>
          <div className="form-group">
            <label>Volumes</label>
            <input
              type="number"
              className="input"
              value={manualVol}
              onChange={e => setManualVol(Number(e.target.value) || 1)}
              min="1"
            />
          </div>
          <button type="submit" className="btn btn-secondary flex-center">
            <Plus size={16} />
            <span>Adicionar à Lista</span>
          </button>
        </form>
      </div>

      {/* Added Items List */}
      <div className="card no-active">
        <h3 className="card-title">Notas no Romaneio ({itens.length})</h3>
        {itens.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: '20px 0' }}>
            Nenhuma NF-e adicionada.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {itens.map((it, idx) => (
              <div key={idx} className="flex-between" style={{
                background: 'var(--bg-highlight)',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
                  <span className="font-bold">NF-e #{it.numero_nfe}</span>
                  <span className="text-muted" style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.cliente_destinatario}
                  </span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    {it.qtd_volumes} volume(s) {it.depositante && `• ${it.depositante}`}
                  </span>
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="header-btn text-danger"
                  style={{ width: '36px', height: '36px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save action button */}
      <button
        className="btn btn-primary mt-12"
        onClick={handleSubmit}
        disabled={saving || itens.length === 0}
        style={{ marginBottom: '24px' }}
      >
        {saving ? 'Salvando...' : 'Criar Romaneio'}
      </button>
    </div>
  )
}
