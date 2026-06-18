-- Correção de dados (2026-06-17): entregas com status "preso".
-- Aprovada pelo usuário. NÃO destrutiva (apenas UPDATE de status). Nenhum canhoto,
-- entrega, nota ou registro é apagado.
--
-- Situação encontrada em produção:
--   - 36 entregas IN_TRANSIT, sendo 35 COM canhoto (delivery_receipts) — ou seja,
--     foram entregues fisicamente, mas o status não virou DELIVERED (bug no
--     fechamento da entrega: o canhoto sobe mas a transição IN_TRANSIT->DELIVERED
--     não dispara).
--   - 37 entregas ASSIGNED sem canhoto e sem evento DELIVERED — não entregues.
--     20 delas eram antigas/abandonadas (scheduled_date < 2026-06-16); 17 recentes
--     (16-18/06) foram mantidas como pendentes legítimas.
--
-- Ações:
--   1) IN_TRANSIT com canhoto -> DELIVERED, delivered_at = data do último canhoto.
--   2) ASSIGNED antigas (< 2026-06-16) -> PENDING e driver_id = null (reabertura
--      para reatribuição).
--
-- (Aplicado em produção via service_role; este arquivo é o registro versionado.)

-- 1) IN_TRANSIT entregues (com canhoto) -> DELIVERED
update public.deliveries d
set status = 'DELIVERED',
    delivered_at = r.last_receipt,
    updated_at = now()
from (
  select delivery_id, max(created_at) as last_receipt
  from public.delivery_receipts
  group by delivery_id
) r
where d.id = r.delivery_id
  and d.status = 'IN_TRANSIT';

-- 2) ASSIGNED antigas (não entregues) -> PENDING, sem motorista
update public.deliveries
set status = 'PENDING',
    driver_id = null,
    updated_at = now()
where status = 'ASSIGNED'
  and scheduled_date < date '2026-06-16';

-- Conferência (esperado: IN_TRANSIT só as sem canhoto; ASSIGNED só >= 2026-06-16)
-- select status, count(*) from public.deliveries group by status order by status;
