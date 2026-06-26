-- =============================================================
-- MIGRAÇÃO 005 — RPCs de admin e login por username
-- Execute no SQL Editor do Supabase: odanqvpyuycqptqemfat
-- =============================================================

-- -----------------------------------------------------------
-- 1. get_email_by_username
--    Resolve username (nome) → email para login sem expor emails
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.perfis
  WHERE LOWER(nome) = LOWER(TRIM(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------
-- 2. admin_update_user
--    Atualiza nome, email e role de um usuário (master only)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID,
  p_nome    TEXT,
  p_email   TEXT,
  p_role    TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem editar usuários.';
  END IF;

  -- Atualiza tabela perfis
  UPDATE public.perfis
  SET nome  = TRIM(p_nome),
      email = LOWER(TRIM(p_email)),
      role  = p_role
  WHERE id = p_user_id;

  -- Atualiza auth.users (email + metadata)
  UPDATE auth.users
  SET email = LOWER(TRIM(p_email)),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('nome', TRIM(p_nome), 'role', p_role)
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------
-- 3. admin_delete_user
--    Remove usuário do sistema (master only, não pode auto-excluir)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas usuários master podem excluir usuários.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir a própria conta.';
  END IF;

  -- Remove de auth.users (perfis é deletado por CASCADE no trigger/FK)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
