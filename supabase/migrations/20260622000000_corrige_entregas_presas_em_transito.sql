-- Correção de dados (2026-06-22): entregas "presas" em Em Trânsito (IN_TRANSIT).
-- Aprovada pelo usuário. NÃO destrutiva (apenas UPDATE de status/delivered_at).
-- Nenhum canhoto, NF, entrega, ocorrência, storage ou usuário é apagado.
--
-- Situação encontrada no painel admin (Relatórios):
--   Entregas aparecendo como "Em Trânsito" (status = IN_TRANSIT) que JÁ possuem
--   "Entregue em" preenchido (delivered_at) e canhoto (delivery_receipts) — ou seja,
--   foram entregues fisicamente, mas a transição IN_TRANSIT -> DELIVERED não disparou
--   (mesmo bug tratado em 20260617130000, reincidente em entregas de 18-19/06).
--
-- Regra de segurança ("mantendo documentado o que teve ocorrência"):
--   Só viram DELIVERED entregas COMPROVADAS (com delivered_at OU canhoto) e SEM
--   registro em public.occurrences. Entregas com ocorrência (recusa/avaria/reentrega)
--   ou sem comprovação são PRESERVADAS e documentadas no registro de execução abaixo.
--
-- =====================================================================
-- REGISTRO DA EXECUÇÃO (aplicado em produção via Management API):
--
--   Distribuição ANTES:
--     PENDING 20 | ASSIGNED 26 | IN_TRANSIT 11 | DELIVERED 398 | FAILED 16
--   Distribuição DEPOIS:
--     PENDING 20 | ASSIGNED 26 | IN_TRANSIT  1 | DELIVERED 408 | FAILED 16
--
--   CORRIGIDAS (10 entregas IN_TRANSIT comprovadas, 0 ocorrências -> DELIVERED):
--     320065 OPERA MIX TATUI LTDA ME              (18/06 18:14)
--     320066 ITALGIO FORNERIA LTDA                (18/06 13:48)
--     320278 FELICITA COMERCIO DE ALIMENTOS       (19/06 15:37)
--     320082 FLAVIO ROBERTO QUEIROZ               (18/06 14:23)
--     320061 VARANDA FRUTAS E MERCEARIA LTDA      (18/06 18:15)
--     320084 TORICELLI PANETTERIA LTDA            (18/06 15:15)
--     320228 Sacolão                              (19/06 16:37)
--     320093 FRIGORIFICO DA CARNE ITAMARATY LTDA  (18/06 18:15)
--     319898 EMPORIO E CONFEITARIA PARIS LTDA EPP (18/06 16:54)
--     320089 O ADE DE FRANCA BEBIDAS ME           (18/06 14:42)
--
--   PRESERVADAS / NÃO TOCADAS (sem comprovação de entrega — exigem decisão manual):
--     - NF 1141538877 SUPERMERCADOS MAMBO LTDA (IN_TRANSIT, agendada 08/06):
--       sem canhoto e sem delivered_at. Entrega presa há ~2 semanas, sem prova.
--     - 20 PENDING + 26 ASSIGNED: nenhuma com canhoto/delivered_at; 1 ASSIGNED é
--       reentrega. Não foram entregues -> NÃO marcadas como DELIVERED.
--
--   OCORRÊNCIAS: nenhuma das entregas IN_TRANSIT/PENDING/ASSIGNED tinha registro em
--   public.occurrences no momento da correção. As 16 FAILED (com ocorrência) seguem
--   intactas.
-- =====================================================================

update public.deliveries d
set status = 'DELIVERED',
    delivered_at = coalesce(
      d.delivered_at,
      (select max(r.created_at) from public.delivery_receipts r where r.delivery_id = d.id)
    ),
    updated_at = now()
where d.status = 'IN_TRANSIT'
  and (
        d.delivered_at is not null
        or exists (select 1 from public.delivery_receipts r where r.delivery_id = d.id)
      )
  and not exists (select 1 from public.occurrences o where o.delivery_id = d.id);

-- Conferência:
-- select status, count(*) from public.deliveries group by status order by status;
