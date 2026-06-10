-- Reparo seguro e deterministico de empresa do motorista para a operacao de 2026-06-11.
-- Nao apaga NF, canhoto, entrega, ocorrencia, storage, motorista ou usuario.

select * from public.repair_driver_company_from_profile('2026-06-11'::date);
