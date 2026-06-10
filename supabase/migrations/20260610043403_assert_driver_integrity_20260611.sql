-- Gate de seguranca para a operacao de 2026-06-11.
-- Falha se ainda houver motorista ativo/roteirizado sem auth/profile/empresa coerentes.

select public.assert_driver_integrity_for_date('2026-06-11'::date);
