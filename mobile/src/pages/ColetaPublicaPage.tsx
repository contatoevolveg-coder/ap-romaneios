import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCNPJ, formatCPF, formatRG, validateCNPJ, validateCPF, validatePlaca } from '../lib/validators'
import type { RomaneioCompleto } from '../types'
import { Truck, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export default function ColetaPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const [romaneio, setRomaneio] = useState<RomaneioCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expired, setExpired] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    transportadora_nome: '',
    transportadora_cnpj: '',
    motorista_nome: '',
    motorista_rg: '',
    motorista_cpf: '',
    veiculo_modelo: '',
    veiculo_placa: '',
    observacao_transportadora: ''
  })

  useEffect(() => {
    async function load() {
      if (!token) return
      try {
        const { data, error: err } = await supabase.rpc('get_romaneio_by_token', { p_token: token })
        if (err || !data || data.error === 'not_found') {
          setNotFound(true)
          return
        }

        const r = data as RomaneioCompleto
        if (r.token_expira_em && new Date(r.token_expira_em) < new Date()) {
          setExpired(true)
          return
        }

        setRomaneio(r)
        setForm({
          transportadora_nome: r.transportadora_nome || '',
          transportadora_cnpj: r.transportadora_cnpj || '',
          motorista_nome: r.motorista_nome || '',
          motorista_rg: r.motorista_rg || '',
          motorista_cpf: r.motorista_cpf || '',
          veiculo_modelo: r.veiculo_modelo || '',
          veiculo_placa: r.veiculo_placa || '',
          observacao_transportadora: r.observacao_transportadora || ''
        })
      } catch (e) {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validations (only if field is filled)
    if (form.transportadora_cnpj.trim() && !validateCNPJ(form.transportadora_cnpj)) {
      setError('CNPJ da transportadora inválido.')
      return
    }
    if (form.motorista_cpf.trim() && !validateCPF(form.motorista_cpf)) {
      setError('CPF do motorista inválido.')
      return
    }
    if (form.veiculo_placa.trim() && !validatePlaca(form.veiculo_placa)) {
      setError('Placa do veículo inválida. Formato: ABC-1234 ou ABC1D23.')
      return
    }

    setSaving(true)
    try {
      const { data } = await supabase.rpc('preencher_dados_coleta', {
        p_token: token,
        p_transportadora_nome: form.transportadora_nome.trim() || null,
        p_transportadora_cnpj: form.transportadora_cnpj.trim() || null,
        p_motorista_nome: form.motorista_nome.trim() || null,
        p_motorista_rg: form.motorista_rg.trim() || null,
        p_motorista_cpf: form.motorista_cpf.trim() || null,
        p_veiculo_modelo: form.veiculo_modelo.trim() || null,
        p_veiculo_placa: form.veiculo_placa.trim().toUpperCase() || null,
        p_observacao: form.observacao_transportadora.trim() || null,
        p_assinatura: null // signature is collected physically on output romaneio sheet
      })

      if (data?.ok) {
        setSubmitted(true)
      } else {
        setError(data?.error || 'Erro ao salvar. Verifique as informações.')
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: 'var(--bg)' }}>
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

  if (notFound) {
    return (
      <div className="flex-center" style={{ height: '100vh', padding: '20px', background: 'var(--bg)' }}>
        <div className="card text-center" style={{ width: '100%', maxWidth: '400px', padding: '32px 16px' }}>
          <AlertTriangle size={48} className="text-danger" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Link Inválido</h2>
          <p className="text-muted" style={{ marginTop: '8px', fontSize: '14px' }}>
            Este romaneio não foi encontrado ou o link de acesso está corrompido.
          </p>
        </div>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="flex-center" style={{ height: '100vh', padding: '20px', background: 'var(--bg)' }}>
        <div className="card text-center" style={{ width: '100%', maxWidth: '400px', padding: '32px 16px' }}>
          <Clock size={48} className="text-danger" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Link Expirado</h2>
          <p className="text-muted" style={{ marginTop: '8px', fontSize: '14px' }}>
            O prazo de validade deste link expirou. Solicite um novo link de cadastro.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex-center" style={{ height: '100vh', padding: '20px', background: 'var(--bg)' }}>
        <div className="card text-center" style={{ width: '100%', maxWidth: '400px', padding: '32px 16px' }}>
          <CheckCircle size={48} className="text-success" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Enviado com Sucesso!</h2>
          <p className="text-muted" style={{ marginTop: '8px', fontSize: '14px' }}>
            Os dados de cadastro da coleta foram salvos. Você já pode fechar esta página.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* Logo and Header info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div className="flex-center" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
            <Truck size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Cadastro de Coleta</h2>
            <p className="text-muted" style={{ fontSize: '12px' }}>Preencha os dados do veículo e motorista</p>
          </div>
        </div>

        {/* Loading details summary card */}
        {romaneio && (
          <div className="card no-active" style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border)', marginBottom: '16px' }}>
            <div className="flex-between">
              <span className="font-bold" style={{ fontSize: '13px' }}>Resumo da Carga</span>
              <span className="badge preenchido">Status: {romaneio.status}</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span><strong>Remetente:</strong> {romaneio.remetente_nome}</span>
              <span><strong>Total NF-es:</strong> {romaneio.total_nfes}</span>
              <span><strong>Total Volumes:</strong> {romaneio.total_volumes}</span>
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="card no-active">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Nome da Transportadora</label>
              <input
                type="text"
                className="input"
                value={form.transportadora_nome}
                onChange={e => setForm(p => ({ ...p, transportadora_nome: e.target.value }))}
                placeholder="Ex: Alfa Transportes"
              />
            </div>

            <div className="form-group">
              <label>CNPJ da Transportadora</label>
              <input
                type="text"
                className="input"
                value={form.transportadora_cnpj}
                onChange={e => setForm(p => ({ ...p, transportadora_cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0001-00"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Nome Completo do Motorista</label>
              <input
                type="text"
                className="input"
                value={form.motorista_nome}
                onChange={e => setForm(p => ({ ...p, motorista_nome: e.target.value }))}
                placeholder="Ex: João da Silva"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>CPF</label>
                <input
                  type="text"
                  className="input"
                  value={form.motorista_cpf}
                  onChange={e => setForm(p => ({ ...p, motorista_cpf: formatCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>RG</label>
                <input
                  type="text"
                  className="input"
                  value={form.motorista_rg}
                  onChange={e => setForm(p => ({ ...p, motorista_rg: formatRG(e.target.value) }))}
                  placeholder="0.000.000"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Modelo do Veículo</label>
                <input
                  type="text"
                  className="input"
                  value={form.veiculo_modelo}
                  onChange={e => setForm(p => ({ ...p, veiculo_modelo: e.target.value }))}
                  placeholder="Ex: HR Bau"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Placa do Veículo</label>
                <input
                  type="text"
                  className="input"
                  value={form.veiculo_placa}
                  onChange={e => setForm(p => ({ ...p, veiculo_placa: e.target.value.toUpperCase() }))}
                  placeholder="Ex: ABC-1234"
                  autoCapitalize="characters"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Observações / Instruções Especiais</label>
              <textarea
                className="input"
                value={form.observacao_transportadora}
                onChange={e => setForm(p => ({ ...p, observacao_transportadora: e.target.value }))}
                placeholder="Ex: Ajudante necessário, carga frágil..."
                style={{ height: '80px', padding: '12px', resize: 'none' }}
              />
            </div>

            {error && (
              <div className="text-danger font-bold text-center" style={{ fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando...' : 'Salvar e Confirmar Coleta'}
            </button>
          </form>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
