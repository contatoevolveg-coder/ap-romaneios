const POS_INICIO = 25 // posição 26 (0-based)
const POS_FIM = 34    // posição 35 (0-based, exclusiva)

/** Extrai os 9 dígitos brutos (posições 26-34) de uma chave de 44 dígitos. */
export function extrairDigitosNfe(valor: string): string {
  const digits = String(valor ?? '').replace(/\D/g, '')
  if (digits.length === 44) return digits.substring(POS_INICIO, POS_FIM)
  return digits
}

/**
 * Normaliza qualquer entrada (chave de 44 dígitos, número com zeros à
 * esquerda, ou número simples) para a forma canônica usada para
 * comparação e consulta no WMS: número inteiro sem zeros à esquerda.
 */
export function normalizarNfe(valor: string): string {
  const bruto = extrairDigitosNfe(valor)
  if (!bruto) return ''
  const nfeNum = bruto.replace(/^0+/, '')
  return nfeNum || '0'
}

/** Compara dois valores de NF-e tolerando chave completa, zeros à esquerda e formatação. */
export function mesmaNfe(a: string, b: string): boolean {
  const na = normalizarNfe(a)
  return na !== '' && na === normalizarNfe(b)
}

/** Quebra a chave em partes para exibição com destaque do número da NF-e. */
export function analisarChave(
  valor: string,
): { tipo: 'chave'; antes: string; nfe: string; depois: string; numero: string } | { tipo: 'numero'; nfe: string } | null {
  const digits = String(valor ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 44) {
    const nfe = digits.substring(POS_INICIO, POS_FIM)
    return {
      tipo: 'chave',
      antes: digits.substring(0, POS_INICIO),
      nfe,
      depois: digits.substring(POS_FIM),
      numero: normalizarNfe(digits),
    }
  }
  return { tipo: 'numero', nfe: digits }
}

/** True quando o valor já é uma chave de acesso completa (44 dígitos). */
export function ehChaveCompleta(valor: string): boolean {
  return String(valor ?? '').replace(/\D/g, '').length === 44
}

export interface ParsedXmlNfe {
  numero_nfe: string
  cliente_destinatario: string
  empresa: string
  depositante: string
  qtd_volumes: number
}

/** Lê e extrai as informações principais de um XML de NF-e (DANFE). */
export function parseNfeXml(xmlText: string): ParsedXmlNfe | null {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

    // Chave de acesso
    const chNFe = xmlDoc.getElementsByTagName('chNFe')[0]?.textContent || ''
    
    // Número da NF-e
    let nfeNum = xmlDoc.getElementsByTagName('nNF')[0]?.textContent || ''
    
    // Se achou chave mas não achou nNF diretamente, extrai da chave
    if (!nfeNum && chNFe.length === 44) {
      nfeNum = chNFe.substring(25, 34)
    }
    
    if (!nfeNum) return null

    // Destinatário
    const destTag = xmlDoc.getElementsByTagName('dest')[0]
    const cliente_destinatario = destTag?.getElementsByTagName('xNome')[0]?.textContent || ''

    // Emitente (Empresa)
    const emitTag = xmlDoc.getElementsByTagName('emit')[0]
    const empresa = emitTag?.getElementsByTagName('xNome')[0]?.textContent || ''

    // Volumes
    const qVol = xmlDoc.getElementsByTagName('qVol')[0]?.textContent
    const qtd_volumes = Math.max(1, Number(qVol) || 1)

    return {
      numero_nfe: nfeNum.replace(/^0+/, ''),
      cliente_destinatario: cliente_destinatario.trim(),
      empresa: empresa.trim(),
      depositante: '',
      qtd_volumes
    }
  } catch (e) {
    console.error('Error parsing XML', e)
    return null
  }
}
