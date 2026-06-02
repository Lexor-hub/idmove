-- ============================================================
-- AGORA — Cole TUDO. Roda em 1 clique. Resolve os 2 problemas.
-- https://supabase.com/dashboard/project/jmxckbbunoyrsxkaubmi/sql/new
-- ============================================================

-- ===== PARTE 1 — Limpa cadastro órfão do Arlex =====
-- (resolve o erro 23505 que está bloqueando "criar motorista")

BEGIN;

DELETE FROM public.drivers
WHERE profile_id IN (
  SELECT id FROM public.profiles
  WHERE email = 'freitasluizl472@gmail.com'
     OR auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
);

DELETE FROM public.clients
WHERE profile_id IN (
  SELECT id FROM public.profiles
  WHERE email = 'freitasluizl472@gmail.com'
     OR auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
);

DELETE FROM public.profiles
WHERE email = 'freitasluizl472@gmail.com'
   OR auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6';

DELETE FROM auth.identities
WHERE user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR (identity_data->>'email') = 'freitasluizl472@gmail.com';

DELETE FROM auth.users
WHERE id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR email = 'freitasluizl472@gmail.com';

COMMIT;

-- ===== PARTE 2 — Diagnóstico das empresas (Ana / João) =====
-- (mostra qual company_id está errado, pra reatribuir na PARTE 3)

SELECT
  d.id          AS driver_id,
  d.name        AS motorista,
  d.company_id  AS empresa_atual_id,
  c.name        AS empresa_atual_nome,
  p.id          AS profile_id,
  p.company_id  AS profile_company_id
FROM public.drivers d
LEFT JOIN public.companies c ON c.id = d.company_id
LEFT JOIN public.profiles p ON p.id = d.profile_id
WHERE d.name ILIKE ANY(ARRAY['%ana%','%joão%','%joao%','%rafael%','%diego%'])
ORDER BY d.name;

-- ===== PARTE 3 — Lista todas as empresas (pra você identificar a correta) =====

SELECT id, name, domain FROM public.companies ORDER BY name;

-- ============================================================
-- Depois de rodar:
--
-- (A) Tenta cadastrar o Alex/Arlex no painel — deve funcionar.
-- (B) Olha o resultado da PARTE 2: se Ana/João estiverem com
--     empresa_atual_id DIFERENTE de Diego/Rafael, me manda print que
--     monto o UPDATE certo de reatribuição.
-- ============================================================
