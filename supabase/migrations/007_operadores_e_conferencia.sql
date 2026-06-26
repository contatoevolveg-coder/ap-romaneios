-- =============================================================
-- MIGRAÇÃO 007 — Histórico de operadores + dados de conferência
-- Execute no SQL Editor do Supabase: odanqvpyuycqptqemfat
-- =============================================================

-- -----------------------------------------------------------
-- 1. Colunas de operador em romaneios
--    criado_por já existe; adiciona quem conferiu e quem liberou
-- -----------------------------------------------------------
ALTER TABLE public.romaneios
  ADD COLUMN IF NOT EXISTS conferido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conferido_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS liberado_por  UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS liberado_em   TIMESTAMPTZ;

-- -----------------------------------------------------------
-- 2. View vw_romaneio_completo — preserva a ordem real das colunas
--    e adiciona os nomes/datas dos operadores ao final
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_romaneio_completo AS
SELECT
    r.id AS romaneio_id,
    r.token_publico,
    to_char(r.data_criacao, 'DD/MM/YYYY HH24:MI'::text) AS data_emissao,
    to_char(r.data_atualizacao, 'DD/MM/YYYY HH24:MI'::text) AS data_ultima_atualizacao,
    r.status,
    r.observacoes,
    cr.nome_empresa AS remetente_nome,
    cr.cnpj AS remetente_cnpj,
    cr.endereco AS remetente_endereco,
    cr.cidade_uf AS remetente_cidade_uf,
    cr.cep AS remetente_cep,
    r.transportadora_nome,
    r.transportadora_cnpj,
    r.motorista_nome,
    r.motorista_rg,
    r.motorista_cpf,
    r.veiculo_modelo,
    r.veiculo_placa,
    r.observacao_transportadora,
    r.assinatura_motorista,
    count(ri.id) AS total_nfes,
    COALESCE(sum(ri.qtd_volumes), 0::bigint) AS total_volumes,
    COALESCE(round(sum(ri.peso_kg), 2), 0::numeric) AS total_peso_kg,
    array_agg(DISTINCT ri.depositante) FILTER (WHERE ri.depositante IS NOT NULL) AS depositantes,
    COALESCE(json_agg(json_build_object('numero_nfe', ri.numero_nfe, 'cliente_destinatario', ri.cliente_destinatario, 'empresa', ri.empresa, 'depositante', ri.depositante, 'qtd_volumes', ri.qtd_volumes, 'peso_kg', ri.peso_kg, 'observacao', ri.observacao) ORDER BY ri.inserido_em) FILTER (WHERE ri.id IS NOT NULL), '[]'::json) AS itens,
    p.nome AS criado_por_nome,
    p.email AS criado_por_email,
    pc.nome AS conferido_por_nome,
    r.conferido_em,
    pl.nome AS liberado_por_nome,
    r.liberado_em
   FROM romaneios r
     CROSS JOIN ( SELECT config_remetente.id,
            config_remetente.nome_empresa,
            config_remetente.cnpj,
            config_remetente.endereco,
            config_remetente.cidade_uf,
            config_remetente.cep,
            config_remetente.atualizado_em
           FROM config_remetente
         LIMIT 1) cr
     LEFT JOIN romaneio_itens ri ON ri.romaneio_id = r.id
     LEFT JOIN perfis p  ON p.id  = r.criado_por
     LEFT JOIN perfis pc ON pc.id = r.conferido_por
     LEFT JOIN perfis pl ON pl.id = r.liberado_por
  GROUP BY r.id, r.token_publico, r.data_criacao, r.data_atualizacao, r.status, r.observacoes,
           cr.nome_empresa, cr.cnpj, cr.endereco, cr.cidade_uf, cr.cep,
           r.transportadora_nome, r.transportadora_cnpj, r.motorista_nome, r.motorista_rg, r.motorista_cpf,
           r.veiculo_modelo, r.veiculo_placa, r.observacao_transportadora, r.assinatura_motorista,
           r.conferido_em, r.liberado_em,
           p.nome, p.email, pc.nome, pl.nome;

GRANT SELECT ON public.vw_romaneio_completo TO authenticated;

-- -----------------------------------------------------------
-- 3. RPC pública de rastreio (portal do cliente)
--    Retorna apenas dados de acompanhamento — sem CPF/RG/assinatura
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_rastreio_by_token(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rom RECORD;
  v_total_nfes INT;
  v_total_vol  INT;
BEGIN
  SELECT r.id, r.status, r.data_criacao, r.conferido_em, r.liberado_em,
         r.transportadora_nome, r.veiculo_placa, r.excluido_em
  INTO v_rom
  FROM public.romaneios r
  WHERE r.token_publico = CASE WHEN p_token ~ '^[0-9a-fA-F-]{36}$' THEN p_token::uuid ELSE NULL END
  LIMIT 1;

  IF NOT FOUND OR v_rom.excluido_em IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(qtd_volumes), 0)
  INTO v_total_nfes, v_total_vol
  FROM public.romaneio_itens WHERE romaneio_id = v_rom.id;

  RETURN jsonb_build_object(
    'numero',              UPPER(SUBSTRING(v_rom.id::text, 1, 8)),
    'status',              v_rom.status,
    'data_criacao',        v_rom.data_criacao,
    'conferido_em',        v_rom.conferido_em,
    'liberado_em',         v_rom.liberado_em,
    'transportadora_nome', v_rom.transportadora_nome,
    'veiculo_placa',       v_rom.veiculo_placa,
    'total_nfes',          v_total_nfes,
    'total_volumes',       v_total_vol
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_rastreio_by_token(TEXT) TO anon, authenticated;
