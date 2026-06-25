import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Romaneio, RomaneioItem } from '../types'
import { normalizarNfe, mesmaNfe } from '../lib/nfe'
import { audioService } from '../lib/audio'
import { ArrowLeft, Camera, Keyboard, Check, AlertCircle } from 'lucide-react'

export default function BipadorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [romaneio, setRomaneio] = useState<Romaneio | null>(null)
  const [itens, setItens] = useState<RomaneioItem[]>([])
  const [loading, setLoading] = useState(true)
  
  // Camera scanner states
  const [cameraActive, setCameraActive] = useState(true)
  const [scannerReady, setScannerReady] = useState(false)
  const [lastScanned, setLastScanned] = useState<{ nfe: string; success: boolean; message: string } | null>(null)

  // Manual entry states
  const [manualCode, setManualCode] = useState('')
  const [submittingManual, setSubmittingManual] = useState(false)

  const lastProcessedRef = useRef('')
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)

  // Load details
  const load = useCallback(async () => {
    if (!id) return
    try {
      const [{ data: rom }, { data: items }] = await Promise.all([
        supabase.from('romaneios').select('*').eq('id', id).single(),
        supabase.from('romaneio_itens').select('*').eq('romaneio_id', id).order('inserido_em')
      ])
      if (rom) setRomaneio(rom)
      if (items) setItens(items)
    } catch (e) {
      toast.error('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Process barcode scan
  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    const value = barcode.trim()
    if (!value) return

    // Debounce: prevent duplicate scan of the same barcode in short window
    if (lastProcessedRef.current === value) return
    lastProcessedRef.current = value
    setTimeout(() => {
      if (lastProcessedRef.current === value) lastProcessedRef.current = ''
    }, 1500)

    const normalized = normalizarNfe(value)
    
    // Find item
    const item = itens.find(i => mesmaNfe(i.numero_nfe, value))

    if (!item) {
      audioService.playError()
      setLastScanned({ nfe: normalized, success: false, message: 'Nota não encontrada neste romaneio' })
      toast.error(`NF-e não encontrada: ${normalized}`)
      return
    }

    if (item.bipado_em) {
      audioService.playError()
      setLastScanned({ nfe: normalized, success: false, message: 'Nota já foi bipada anteriormente' })
      toast.error(`Nota já bipada: ${normalized}`)
      return
    }

    try {
      // Call Supabase RPC to record scan
      const { data, error } = await supabase.rpc('bipar_item_romaneio', {
        p_romaneio_id: id,
        p_item_id: item.id,
        p_codigo: value
      })

      if (error) throw error

      if (data && !data.error) {
        audioService.playSuccess()
        setLastScanned({ nfe: normalized, success: true, message: 'Conferida com sucesso!' })
        toast.success(`NF-e ${normalized} conferida!`)
        
        // Update local item list
        setItens(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, bipado_em: new Date().toISOString(), bipado_codigo: value }
            : i
        ))
      } else {
        throw new Error(data?.error || 'Erro na bipagem')
      }
    } catch (err: any) {
      audioService.playError()
      setLastScanned({ nfe: normalized, success: false, message: err.message || 'Erro ao registrar conferência' })
      toast.error('Erro ao bipar item.')
    }
  }, [id, itens])

  // Manual code submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim() || submittingManual) return
    setSubmittingManual(true)
    await handleBarcodeScanned(manualCode)
    setManualCode('')
    setSubmittingManual(false)
  }

  // Camera life cycle handler
  useEffect(() => {
    if (!id || !cameraActive || loading) return

    let isMounted = true
    const html5Qrcode = new Html5Qrcode('scanner-container')
    html5QrcodeRef.current = html5Qrcode

    const startScanner = async () => {
      try {
        setScannerReady(false)
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (width) => ({ width: Math.min(width * 0.85, 300), height: 110 }),
            aspectRatio: 1.777778
          },
          (decodedText) => {
            if (isMounted) {
              handleBarcodeScanned(decodedText)
            }
          },
          () => {
            // ignore verbose log warnings
          }
        )
        if (isMounted) setScannerReady(true)
      } catch (err) {
        console.warn('Falha ao acessar a câmera traseira, tentando qualquer câmera:', err)
        try {
          if (!isMounted) return
          await html5Qrcode.start(
            { facingMode: 'user' },
            {
              fps: 12,
              qrbox: (width) => ({ width: Math.min(width * 0.85, 300), height: 110 }),
              aspectRatio: 1.777778
            },
            (decodedText) => {
              if (isMounted) handleBarcodeScanned(decodedText)
            },
            () => {}
          )
          if (isMounted) setScannerReady(true)
        } catch (innerErr) {
          toast.error('Não foi possível ativar o leitor de câmera.')
        }
      }
    }

    startScanner()

    return () => {
      isMounted = false
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.error('Erro ao desligar scanner:', err))
      }
      html5QrcodeRef.current = null
    }
  }, [id, cameraActive, loading, handleBarcodeScanned])

  const bipadosCount = itens.filter(i => i.bipado_em).length
  const totalCount = itens.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className="header-btn" onClick={() => navigate(`/romaneios/${id}`)} style={{ marginLeft: '-8px' }}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="title-large" style={{ margin: 0, fontSize: '18px' }}>Conferir Romaneio</h2>
          {romaneio && (
            <p className="text-muted" style={{ fontSize: '12px' }}>
              Progresso: <strong style={{ color: 'var(--primary)' }}>{bipadosCount} de {totalCount} bipados</strong>
            </p>
          )}
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="card no-active" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        
        {/* Toggle Mode Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setCameraActive(true)}
            style={{
              flex: 1,
              height: '44px',
              border: 'none',
              background: cameraActive ? 'var(--bg-highlight)' : 'transparent',
              color: cameraActive ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Camera size={16} />
            <span>Usar Câmera</span>
          </button>
          <button
            onClick={() => setCameraActive(false)}
            style={{
              flex: 1,
              height: '44px',
              border: 'none',
              background: !cameraActive ? 'var(--bg-highlight)' : 'transparent',
              color: !cameraActive ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Keyboard size={16} />
            <span>Digitar Nota</span>
          </button>
        </div>

        {/* Viewport for scanning camera */}
        <div style={{ display: cameraActive ? 'block' : 'none', position: 'relative', background: '#000', width: '100%', minHeight: '260px' }}>
          <div id="scanner-container" style={{ width: '100%', minHeight: '260px' }} />
          
          {!scannerReady && (
            <div className="flex-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#000', color: '#fff', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '2px solid #334155',
                borderTopColor: '#fff',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '12px' }}>Iniciando câmera traseira...</span>
            </div>
          )}

          {/* Custom Overlay Scanning Target */}
          {scannerReady && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              height: '80px',
              border: '2px dashed var(--primary)',
              borderRadius: '8px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
            }} />
          )}
        </div>

        {/* Manual Text entry form */}
        <div style={{ display: !cameraActive ? 'block' : 'none', padding: '24px 16px' }}>
          <form onSubmit={handleManualSubmit}>
            <div className="form-group">
              <label>Número da Nota Fiscal (NF-e) ou Chave 44 dígitos</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="text"
                  className="input"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Ex: 65915"
                  autoFocus={!cameraActive}
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }} disabled={submittingManual}>
                  Bipar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Last scanned result indicator feedback */}
      {lastScanned && (
        <div style={{
          background: lastScanned.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${lastScanned.success ? 'var(--success)' : 'var(--danger)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          {lastScanned.success ? (
            <Check size={24} className="text-success" />
          ) : (
            <AlertCircle size={24} className="text-danger" />
          )}
          <div style={{ flex: 1 }}>
            <div className="font-bold" style={{ fontSize: '14px' }}>
              NF-e #{lastScanned.nfe}
            </div>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              {lastScanned.message}
            </div>
          </div>
        </div>
      )}

      {/* List of remaining notes to scan */}
      <div className="card no-active">
        <h3 className="card-title">Falta Conferir ({totalCount - bipadosCount})</h3>
        {totalCount === bipadosCount ? (
          <div className="text-center text-success font-bold" style={{ padding: '20px 0' }}>
            Conferência concluída com sucesso! 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '30vh', overflowY: 'auto' }}>
            {itens.filter(i => !i.bipado_em).map((it) => (
              <div key={it.id} className="flex-between" style={{
                background: 'var(--bg-highlight)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '13px'
              }}>
                <span className="font-bold">NF-e #{it.numero_nfe}</span>
                <span className="text-muted" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.cliente_destinatario}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
