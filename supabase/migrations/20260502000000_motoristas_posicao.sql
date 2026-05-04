-- 1. Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabela de posição atual (1 linha por motorista)
CREATE TABLE IF NOT EXISTS public.motoristas_posicao (
  motorista_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  posicao      GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. View para leitura JS-friendly (extrai lat/lon do geography)
CREATE OR REPLACE VIEW public.v_motoristas_posicao AS
SELECT
  mp.motorista_id,
  d.name          AS driver_name,
  d.company_id,
  ST_Y(mp.posicao::geometry) AS latitude,
  ST_X(mp.posicao::geometry) AS longitude,
  mp.updated_at
FROM public.motoristas_posicao mp
JOIN public.drivers d ON d.id = mp.motorista_id;

-- 4. RPC para upsert com validação de ownership
CREATE OR REPLACE FUNCTION public.upsert_driver_position(
  p_motorista_id UUID,
  p_latitude     DOUBLE PRECISION,
  p_longitude    DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  -- Verifica que o caller é o próprio motorista
  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_user_id = auth.uid() AND d.id = p_motorista_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller is not driver %', p_motorista_id;
  END IF;

  INSERT INTO public.motoristas_posicao (motorista_id, posicao, updated_at)
  VALUES (
    p_motorista_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    NOW()
  )
  ON CONFLICT (motorista_id) DO UPDATE
  SET posicao    = EXCLUDED.posicao,
      updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_driver_position TO authenticated;

-- 5. Habilitar Realtime nesta tabela
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'motoristas_posicao'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas_posicao;
  END IF;
END $$;

-- 6. RLS
ALTER TABLE public.motoristas_posicao ENABLE ROW LEVEL SECURITY;

-- Motorista lê/escreve a própria linha
CREATE POLICY "driver_own_position" ON public.motoristas_posicao
  FOR ALL TO authenticated
  USING (
    motorista_id IN (
      SELECT d.id FROM public.drivers d
      JOIN public.profiles p ON p.id = d.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    motorista_id IN (
      SELECT d.id FROM public.drivers d
      JOIN public.profiles p ON p.id = d.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- Admin/Supervisor/Operator lê todas as posições da própria empresa
CREATE POLICY "staff_read_positions" ON public.motoristas_posicao
  FOR SELECT TO authenticated
  USING (
    motorista_id IN (
      SELECT id FROM public.drivers WHERE company_id = current_company_id()
    )
  );
