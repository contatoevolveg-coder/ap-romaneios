-- =============================================================
-- MIGRAÇÃO 006 — Colunas faltantes: recorrente + foto_documento
-- Execute no SQL Editor do Supabase: odanqvpyuycqptqemfat
-- =============================================================

-- Coluna recorrente em transportadoras_cadastradas
-- (criada na 003/004 sem esta coluna, mas usada no código)
ALTER TABLE public.transportadoras_cadastradas
  ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT false;

-- Coluna foto_documento em motoristas_cadastrados
-- (usada no código para upload de CNH/RG do motorista)
ALTER TABLE public.motoristas_cadastrados
  ADD COLUMN IF NOT EXISTS foto_documento TEXT;

-- Índice para buscas por recorrentes
CREATE INDEX IF NOT EXISTS idx_transp_recorrente
  ON public.transportadoras_cadastradas(recorrente)
  WHERE ativo = true;
