-- Sessão 1 — Visibilidade no admin: rastrear quem cadastrou cada entrega.
-- ADITIVA e não-destrutiva: apenas ADD COLUMN + CREATE INDEX.
-- Entregas históricas ficam com created_by_* = NULL (compatível, sem migração de dados).
-- RLS de deliveries já filtra por company_id; as colunas novas herdam, sem nova policy.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text;

CREATE INDEX IF NOT EXISTS idx_deliveries_created_by_profile
  ON public.deliveries(created_by_profile_id);
