-- Fix (higiene de dados): existem duas empresas "ID Transportes" em companies.
--   A = 382695a4-851d-483b-acf2-70c8be8a0010 (01/05) -> empresa real e operacional
--       (413 entregas, 8 motoristas, 293 clientes, 1 veículo, todos os profiles).
--   B = 11111111-0000-0000-0000-000000000001 (28/05) -> duplicata. Único dado
--       vinculado: 17 clientes (criados 01-02/06), invisíveis para a operação por
--       causa do RLS por company_id. (deliveries/drivers/profiles/vehicles em B = 0,
--       verificado em 2026-06-17.)
--
-- Ação aprovada pelo usuário: mover os 17 clientes para a empresa A e marcar a
-- empresa B como INACTIVE. NADA é apagado (regra de ouro: sem DELETE/DROP/TRUNCATE).
--
-- Observação: clients NÃO tem unique(company_id, document). Dois documentos
-- (09000493000991, 66890443000103) já existem na empresa A, então após o merge
-- haverá 2 pares de clientes com mesmo documento na empresa A — duplicata "leve",
-- não-bloqueante. Unificar manualmente depois, se desejado (nunca por DELETE cego).
--
-- Inclui também: marcar o driver órfão "teste cego" (profile_id NULL, criado
-- 2026-06-18, sem entregas) como INATIVO em vez de apagar.

-- Evidência ANTES
select company_id, count(*) as clientes
from public.clients
where company_id in (
  '11111111-0000-0000-0000-000000000001',
  '382695a4-851d-483b-acf2-70c8be8a0010'
)
group by company_id;

-- 1) mover os 17 clientes presos para a empresa real
update public.clients
set company_id = '382695a4-851d-483b-acf2-70c8be8a0010',
    updated_at = now()
where company_id = '11111111-0000-0000-0000-000000000001';

-- 2) desativar a empresa duplicada (sem apagar)
update public.companies
set status = 'INACTIVE',
    updated_at = now()
where id = '11111111-0000-0000-0000-000000000001';

-- 3) inativar o driver órfão de teste (profile_id NULL)
update public.drivers
set status = 'INATIVO',
    updated_at = now()
where id = '15ed0b1a-ece4-419f-84da-b3b56f0e4887'
  and profile_id is null;

-- Evidência DEPOIS: empresa B deve ter 0 clientes; empresa A, 310.
select company_id, count(*) as clientes
from public.clients
where company_id in (
  '11111111-0000-0000-0000-000000000001',
  '382695a4-851d-483b-acf2-70c8be8a0010'
)
group by company_id;
