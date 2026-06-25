import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Trash2, Save, Camera, Plus, Search, Loader2, FileText, Pencil } from 'lucide-react'
import { normalizarNfe, mesmaNfe, parseNfeXml } from '../lib/nfe'
import { audioService } from '../lib/audio'
import { Html5Qrcode } from 'html5-qrcode'

interface ItemForm {
  id?: string
  numero_nfe: string
  cliente_destinatario: string
  empresa: string
  depositante: string
  qtd_volumes: number
  isNew?: boolean
}

export default function EditarRomaneioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [itens, setItens] = useState<ItemForm[]>([])
  const [emailNotificacao, setEmailNotificacao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Scanner States
  const [scannerInput, setScannerInput] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [torchActive, setTorchActive] = useState(false)
  const [zoomActive, setZoomActive] = useState(false)
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const lastProcessedRef = useRef<string>('')

  // Manual Form States
  const [manualNfe, setManualNfe] = useState('')
  const [manualDest, setManualDest] = useState('')
  const [manualEmp, setManualEmp] = useState('')
  const [manualDep, setManualDep] = useState('')
  const [manualVol, setManualVol] = useState(1)
  const [consultandoWms, setConsultandoWms] = useState(false)

  // Edit Single Item States (Modal/Bottom Sheet)
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null)
  const [editingItemForm, setEditingItemForm] = useState<ItemForm | null>(null)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    try {
      const [romRes, itsRes] = await Promise.all([
        supabase.from('romaneios').select('*').eq('id', id!).single(),
        supabase.from('romaneio_itens').select('*').eq('romaneio_id', id!).order('inserido_em'),
      ])

      if (romRes.error) throw romRes.error
      if (itsRes.error) throw itsRes.error

      if (romRes.data) {
        setEmailNotificacao(romRes.data.email_notificacao || '')
      }

      setItens((itsRes.data || []).map((it: any) => ({
        id: it.id,
        numero_nfe: it.numero_nfe,
        cliente_destinatario: it.cliente_destinatario,
        empresa: it.empresa || '',
        depositante: it.depositante || '',
        qtd_volumes: it.qtd_volumes || 1,
      })))
    } catch (err: any) {
      toast.error('Erro ao carregar dados do romaneio.')
    } finally {
      setLoading(false)
    }
  }

  // Reset controls when camera is closed
  useEffect(() => {
    if (!cameraActive) {
      setTorchActive(false)
      setZoomActive(false)
    }
  }, [cameraActive])

  // Apply constraints (torch and zoom) dynamically
  useEffect(() => {
    const applyConstraints = async () => {
      if (cameraActive && html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        try {
          await html5QrcodeRef.current.applyVideoConstraints({
            advanced: [
              {
                torch: torchActive,
                zoom: zoomActive ? 2.0 : 1.0
              } as any
            ]
          })
        } catch (err) {
          console.warn('Erro ao aplicar constraints de vídeo (lanterna/zoom):', err)
        }
      }
    }
    const timeout = setTimeout(applyConstraints, 200)
    return () => clearTimeout(timeout)
  }, [torchActive, zoomActive, cameraActive])

  // Camera scanner lifecycle
  useEffect(() => {
    if (!cameraActive) {
      if (html5QrcodeRef.current?.isScanning) {
        html5QrcodeRef.current.stop().catch(err => console.error('Erro ao parar scanner:', err))
      }
      return
    }

    let isMounted = true
    const html5Qrcode = new Html5Qrcode('editar-romaneio-scanner')
    html5QrcodeRef.current = html5Qrcode

    html5Qrcode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (isMounted) handleBarcodeProcessed(decodedText, true)
      },
      () => {}
    ).then(() => {
      if (isMounted) {
        html5Qrcode.applyVideoConstraints({
          advanced: [
            {
              torch: torchActive,
              zoom: zoomActive ? 2.0 : 1.0
            } as any
          ]
        }).catch(err => console.warn('Erro ao aplicar constraints iniciais:', err))
      }
    }).catch(err => {
      console.error('Falha ao iniciar camera:', err)
      if (isMounted) {
        toast.error('Não foi possível acessar a câmera.')
        setCameraActive(false)
      }
    })

    return () => {
      isMounted = false
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.error('Erro ao desligar scanner:', err))
      }
      html5QrcodeRef.current = null
    }
  }, [cameraActive])

  // Process barcode input
  const handleBarcodeProcessed = async (barcode: string, fromCamera = false) => {
    const value = barcode.trim()
    if (!value) return

    // Debounce duplicate scans
    if (lastProcessedRef.current === value) return
    lastProcessedRef.current = value
    setTimeout(() => {
      if (lastProcessedRef.current === value) lastProcessedRef.current = ''
    }, 1500)

    const nfeNum = normalizarNfe(value)
    if (!nfeNum) return

    const jaExiste = itens.some(exist => mesmaNfe(exist.numero_nfe, nfeNum))
    if (jaExiste) {
      audioService.playError()
      toast.error(`NF-e ${nfeNum} já está na lista!`)
      return
    }

    toast.loading(`Consultando NF-e ${nfeNum}...`, { id: 'wms-fetch' })
    try {
      const { data, error } = await supabase.functions.invoke('buscar-nfe', {
        body: { nfe: nfeNum }
      })

      if (error || data?.error) {
        audioService.playError()
        toast.dismiss('wms-fetch')
        toast(`NF-e ${nfeNum} não encontrada no WMS. Digite os dados manualmente.`, { icon: '⚠️' })
        
        setManualNfe(nfeNum)
        setManualDest('')
        setManualEmp('')
        setManualDep('')
        setManualVol(1)
        
        if (fromCamera) setCameraActive(false)
        document.getElementById('manual-form-anchor')?.scrollIntoView({ behavior: 'smooth' })
      } else {
        audioService.playSuccess()
        toast.dismiss('wms-fetch')
        const newItem: ItemForm = {
          numero_nfe: data.nfe || nfeNum,
          cliente_destinatario: data.destinatario || '',
          empresa: data.empresa || '',
          depositante: data.depositante || '',
          qtd_volumes: data.volumes ?? 1,
          isNew: true
        }
        setItens(prev => [...prev, newItem])
        toast.success(`NF-e ${nfeNum} adicionada!`)
      }
    } catch {
      audioService.playError()
      toast.dismiss('wms-fetch')
      toast.error('Erro ao consultar WMS.')
    }
  }

  // WMS lookup for manual input
  const handleQueryManualNfe = async () => {
    const value = manualNfe.trim()
    if (!value) return

    const nfeNum = normalizarNfe(value)
    if (!nfeNum) {
      toast.error('Número de NF-e inválido.')
      return
    }

    setConsultandoWms(true)
    try {
      const { data, error } = await supabase.functions.invoke('buscar-nfe', {
        body: { nfe: nfeNum }
      })

      if (error || data?.error) {
        audioService.playError()
        toast(`NF-e ${nfeNum} não encontrada no WMS. Insira manualmente.`, { icon: '⚠️' })
        setManualNfe(nfeNum)
      } else {
        audioService.playSuccess()
        setManualNfe(data.nfe || nfeNum)
        setManualDest(data.destinatario || '')
        setManualEmp(data.empresa || '')
        setManualDep(data.depositante || '')
        setManualVol(data.volumes ?? 1)
        toast.success(`Dados carregados do WMS!`)
      }
    } catch {
      audioService.playError()
      toast.error('Erro ao consultar WMS.')
    } finally {
      setConsultandoWms(false)
    }
  }

  // XMLs Upload
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
            qtd_volumes: parsed.qtd_volumes,
            isNew: true
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

    const itensFiltrados = novosItens.filter(nov => {
      const jaExiste = itens.some(exist => mesmaNfe(exist.numero_nfe, nov.numero_nfe))
      return !jaExiste
    })

    const duplicadosCount = novosItens.length - itensFiltrados.length

    if (itensFiltrados.length > 0) {
      setItens(prev => {
        const limpa = prev.filter(it => it.numero_nfe.trim() !== '')
        return [...limpa, ...itensFiltrados]
      })
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

  // Add Manual Item to local list
  const addManualItem = (e: React.FormEvent) => {
    e.preventDefault()
    const nfe = manualNfe.trim()
    const dest = manualDest.trim()

    if (!nfe || !dest) {
      toast.error('NF-e e Destinatário são campos obrigatórios.')
      return
    }

    const nfeNorm = normalizarNfe(nfe)
    if (itens.some(it => mesmaNfe(it.numero_nfe, nfeNorm))) {
      audioService.playError()
      toast.error(`A NF-e ${nfeNorm} já está na lista!`)
      return
    }

    const newItem: ItemForm = {
      numero_nfe: nfeNorm,
      cliente_destinatario: dest,
      empresa: manualEmp.trim(),
      depositante: manualDep,
      qtd_volumes: Math.max(1, manualVol),
      isNew: true
    }

    setItens(prev => [...prev.filter(it => it.numero_nfe !== ''), newItem])
    toast.success('NF-e adicionada!')
    
    // Clear form
    setManualNfe('')
    setManualDest('')
    setManualEmp('')
    setManualDep('')
    setManualVol(1)
  }

  // Remove item from local list
  const removeItem = (idx: number) => {
    if (!confirm('Deseja remover este item do romaneio?')) return
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  // Open item edit
  const openEditItem = (idx: number) => {
    setEditingItemIdx(idx)
    setEditingItemForm({ ...itens[idx] })
  }

  // Save edited single item changes
  const saveEditedItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingItemIdx === null || !editingItemForm) return
    const nfe = editingItemForm.numero_nfe.trim()
    const dest = editingItemForm.cliente_destinatario.trim()

    if (!nfe || !dest) {
      toast.error('NF-e e Destinatário são obrigatórios.')
      return
    }

    const nfeNorm = normalizarNfe(nfe)
    const jaExiste = itens.some((it, i) => i !== editingItemIdx && mesmaNfe(it.numero_nfe, nfeNorm))
    if (jaExiste) {
      toast.error(`A NF-e ${nfeNorm} já está na lista!`)
      return
    }

    setItens(prev => prev.map((it, i) => i === editingItemIdx ? { ...editingItemForm, numero_nfe: nfeNorm } : it))
    setEditingItemIdx(null)
    setEditingItemForm(null)
    toast.success('Nota editada com sucesso!')
  }

  // Save all changes to Supabase
  async function salvar() {
    if (itens.some(it => !it.numero_nfe.trim() || !it.cliente_destinatario.trim())) {
      setError('Preencha os campos obrigatórios (NF-e e Destinatário) em todos os itens.')
      return
    }
    const nfes = itens.map(it => normalizarNfe(it.numero_nfe))
    const dups = nfes.filter((n, i) => nfes.indexOf(n) !== i)
    if (dups.length > 0) {
      setError(`NF-e duplicada: ${[...new Set(dups)].join(', ')}`)
      return
    }

    setSaving(true)
    setError('')

    try {
      // Diff database items
      const { data: itensAtuais } = await supabase
        .from('romaneio_itens').select('id').eq('romaneio_id', id!)

      const idsAtuais = new Set((itensAtuais || []).map(i => i.id))
      const idsNovos = new Set(itens.filter(i => i.id).map(i => i.id!))

      // Delete removed items
      const idsRemover = [...idsAtuais].filter(id => !idsNovos.has(id))
      if (idsRemover.length > 0) {
        const { error: errDel } = await supabase.from('romaneio_itens').delete().in('id', idsRemover)
        if (errDel) throw errDel
      }

      // Update / Insert
      const itensExistentes = itens.filter(it => it.id && !it.isNew)
      const itensNovos = itens.filter(it => !it.id || it.isNew)

      if (itensExistentes.length > 0) {
        for (const it of itensExistentes) {
          const { error: errUp } = await supabase.from('romaneio_itens').update({
            numero_nfe: normalizarNfe(it.numero_nfe),
            cliente_destinatario: it.cliente_destinatario.trim(),
            empresa: it.empresa.trim() || null,
            depositante: it.depositante.trim() || null,
            qtd_volumes: Number(it.qtd_volumes),
          }).eq('id', it.id!)
          if (errUp) throw errUp
        }
      }

      if (itensNovos.length > 0) {
        const { error: errIns } = await supabase.from('romaneio_itens').insert(
          itensNovos.map(it => ({
            romaneio_id: id!,
            numero_nfe: normalizarNfe(it.numero_nfe),
            cliente_destinatario: it.cliente_destinatario.trim(),
            empresa: it.empresa.trim() || null,
            depositante: it.depositante.trim() || null,
            qtd_volumes: Number(it.qtd_volumes),
          }))
        )
        if (errIns) throw errIns
      }

      // Save email notifications
      const updateData: Record<string, unknown> = {}
      if (emailNotificacao !== undefined) {
        updateData.email_notificacao = emailNotificacao.trim() || null
      }
      if (Object.keys(updateData).length > 0) {
        const { error: errRom } = await supabase.from('romaneios').update(updateData).eq('id', id!)
        if (errRom) throw errRom
      }

      toast.success('Romaneio atualizado com sucesso!')
      navigate(`/romaneios/${id}`)
    } catch (err: any) {
      setError('Erro ao salvar alterações: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '50vh' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="header-btn" onClick={() => navigate(`/romaneios/${id}`)} style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="title-large" style={{ margin: 0, fontSize: '18px' }}>Editar Romaneio</h2>
          <span className="text-muted" style={{ fontSize: '13px' }}>Modifique as notas fiscais e dados</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={salvar}
          disabled={saving}
          style={{ width: 'auto', height: '36px', padding: '0 12px', fontSize: '12px' }}
        >
          <Save size={16} />
          <span>{saving ? 'Gravando...' : 'Salvar'}</span>
        </button>
      </div>

      {/* Basic Notifications card */}
      <div className="card no-active">
        <h3 className="card-title">Configurações Gerais</h3>
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

      {/* Barcode scanner */}
      <div className="card no-active">
        <h3 className="card-title">Bipagem de Etiquetas</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input"
            placeholder="Cole a chave de 44 dígitos ou bipe aqui..."
            value={scannerInput}
            onChange={e => {
              const val = e.target.value
              setScannerInput(val)
              const clean = val.trim().replace(/\D/g, '')
              if (clean.length === 44) {
                handleBarcodeProcessed(val)
                setScannerInput('')
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (scannerInput.trim()) {
                  handleBarcodeProcessed(scannerInput)
                  setScannerInput('')
                }
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCameraActive(!cameraActive)}
            style={{ width: 'auto', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Camera size={18} />
          </button>
        </div>

        <div style={{ display: cameraActive ? 'block' : 'none', marginTop: '12px', position: 'relative' }}>
          <div id="editar-romaneio-scanner" style={{ width: '100%', minHeight: '200px', background: '#000', borderRadius: '8px', overflow: 'hidden' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className={`btn ${torchActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTorchActive(prev => !prev)}
              style={{ flex: 1, height: '36px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 'none', borderRadius: '6px' }}
            >
              <span>{torchActive ? '🔦 Lanterna Ativa' : '🔦 Lanterna'}</span>
            </button>
            <button
              type="button"
              className={`btn ${zoomActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setZoomActive(prev => !prev)}
              style={{ flex: 1, height: '36px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 'none', borderRadius: '6px' }}
            >
              <span>{zoomActive ? '🔍 Zoom 2x' : '🔍 Zoom 1x'}</span>
            </button>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setCameraActive(false)}
            style={{ marginTop: '8px', height: '36px', fontSize: '13px', width: '100%' }}
          >
            Fechar Câmera
          </button>
        </div>
      </div>

      {/* XML File Upload */}
      <div className="card no-active">
        <h3 className="card-title">Importar XMLs de Notas</h3>
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
      <div id="manual-form-anchor" className="card no-active">
        <h3 className="card-title">Adicionar NF-e Manual</h3>
        <form onSubmit={addManualItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label>Número NF-e ou Chave 44 dígitos *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input"
                value={manualNfe}
                onChange={e => {
                  const val = e.target.value
                  setManualNfe(val)
                  const clean = val.trim().replace(/\D/g, '')
                  if (clean.length === 44) {
                    handleBarcodeProcessed(val)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleQueryManualNfe()
                  }
                }}
                placeholder="Ex: 65915 ou Chave Completa"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleQueryManualNfe}
                disabled={consultandoWms}
                style={{ width: 'auto', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {consultandoWms ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Destinatário (Cliente) *</label>
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
            <select
              className="input"
              value={manualDep}
              onChange={e => setManualDep(e.target.value)}
            >
              <option value="">— Opcional —</option>
              <option>Amazon</option>
              <option>Correios</option>
              <option>Flex</option>
              <option>Jadlog</option>
              <option>Magalu</option>
              <option>Meli</option>
              <option>Pex</option>
              <option>Shein</option>
              <option>Shopee</option>
              <option>TikTok</option>
            </select>
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
            <span>Adicionar Nota</span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                  <span className="font-bold" style={{ fontSize: '13px' }}>NF-e #{it.numero_nfe}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{it.cliente_destinatario}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Volumes: {it.qtd_volumes} {it.depositante && `· Depositante: ${it.depositante}`} {it.empresa && `· Emitente: ${it.empresa}`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="header-btn text-primary"
                    onClick={() => openEditItem(idx)}
                    style={{ width: '28px', height: '28px' }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="header-btn text-danger"
                    onClick={() => removeItem(idx)}
                    style={{ width: '28px', height: '28px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="card no-active text-danger" style={{ fontSize: '13px', background: '#fee2e2' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate(`/romaneios/${id}`)}
          style={{ flex: 1 }}
        >
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={salvar}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Edit Single Item Bottom Sheet Modal */}
      {editingItemForm !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end'
        }} onClick={() => { setEditingItemIdx(null); setEditingItemForm(null); }}>
          <div style={{
            background: 'var(--bg-card)',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px 16px',
            boxShadow: '0 -4px 10px rgba(0,0,0,0.1)'
          }} onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Editar Nota Fiscal</h3>
              <button
                style={{ border: 'none', background: 'transparent', fontSize: '20px', color: 'var(--text-muted)' }}
                onClick={() => { setEditingItemIdx(null); setEditingItemForm(null); }}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEditedItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Número NF-e *</label>
                <input
                  type="text"
                  className="input"
                  value={editingItemForm.numero_nfe}
                  onChange={e => setEditingItemForm(p => p ? { ...p, numero_nfe: e.target.value } : null)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Destinatário *</label>
                <input
                  type="text"
                  className="input"
                  value={editingItemForm.cliente_destinatario}
                  onChange={e => setEditingItemForm(p => p ? { ...p, cliente_destinatario: e.target.value } : null)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Empresa Emitente</label>
                <input
                  type="text"
                  className="input"
                  value={editingItemForm.empresa}
                  onChange={e => setEditingItemForm(p => p ? { ...p, empresa: e.target.value } : null)}
                />
              </div>

              <div className="form-group">
                <label>Depositante</label>
                <select
                  className="input"
                  value={editingItemForm.depositante}
                  onChange={e => setEditingItemForm(p => p ? { ...p, depositante: e.target.value } : null)}
                >
                  <option value="">— Selecione —</option>
                  <option>Amazon</option>
                  <option>Correios</option>
                  <option>Flex</option>
                  <option>Jadlog</option>
                  <option>Magalu</option>
                  <option>Meli</option>
                  <option>Pex</option>
                  <option>Shein</option>
                  <option>Shopee</option>
                  <option>TikTok</option>
                </select>
              </div>

              <div className="form-group">
                <label>Volumes</label>
                <input
                  type="number"
                  className="input"
                  value={editingItemForm.qtd_volumes}
                  onChange={e => setEditingItemForm(p => p ? { ...p, qtd_volumes: Number(e.target.value) || 1 } : null)}
                  min="1"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setEditingItemIdx(null); setEditingItemForm(null); }}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Salvar Nota
                </button>
              </div>
            </form>
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
