-- Reparo de dados — 01/07/2026 (véspera do teste de campo de 02/07)
--
-- 1) Três entregas do Diego (29/06) ficaram presas em IN_TRANSIT mesmo com
--    canhoto anexado e delivered_at preenchido. Causa raiz: startRoute fazia
--    UPDATE status='IN_TRANSIT' pelos IDs da lista local do app sem filtrar
--    status no banco; o motorista fotografou os canhotos (entregas DELIVERED)
--    e 4 segundos depois apertou "Iniciar rota" com a lista desatualizada,
--    rebaixando as 3 de volta para IN_TRANSIT (updated_at = 12:25:44 =
--    started_at da sessão de tracking dele). O código foi corrigido em
--    src/services/api.ts (startRoute agora filtra status IN ('PENDING','ASSIGNED')).
--    Mesmo critério de segurança da migração 20260622000000: só toca entregas
--    com prova (delivered_at ou canhoto) e sem ocorrência registrada.

UPDATE deliveries
SET status = 'DELIVERED', updated_at = now()
WHERE id IN (
  'c57e1947-e7de-4ea6-85ab-64695404e83b',  -- NF 320773
  '6a14c4dd-cab9-4944-8ac0-2970b9481c87',  -- NF 320.783
  '79d87f00-6714-4122-9d9e-2eef5dd24365'   -- NF 320.778
)
AND status = 'IN_TRANSIT'
AND (
  delivered_at IS NOT NULL
  OR EXISTS (SELECT 1 FROM delivery_receipts r WHERE r.delivery_id = deliveries.id)
)
AND NOT EXISTS (SELECT 1 FROM occurrences o WHERE o.delivery_id = deliveries.id);

-- 2) Registro órfão duplicado em drivers para "Luis Elialdo Firmino da Silva"
--    (profile_id NULL, criado 22/06, zero entregas vinculadas — verificado).
--    O registro correto dele existe via profile. Se o admin atribuísse entregas
--    ao órfão, o motorista não as veria no app. Inativado, não removido,
--    para preservar histórico.

UPDATE drivers
SET status = 'INATIVO', updated_at = now()
WHERE id = '21d77b36-2653-4d90-8020-780f0205e62c'
  AND profile_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.driver_id = drivers.id);
