-- High-precision driver tracking sessions.
-- Keeps one active session per driver, one active map position, and a full point history.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.driver_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  platform TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_tracking_sessions_one_active
  ON public.driver_tracking_sessions(driver_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_driver_tracking_sessions_company_status
  ON public.driver_tracking_sessions(company_id, status, started_at DESC);

DROP TRIGGER IF EXISTS driver_tracking_sessions_touch_updated_at ON public.driver_tracking_sessions;
CREATE TRIGGER driver_tracking_sessions_touch_updated_at
BEFORE UPDATE ON public.driver_tracking_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.motoristas_posicao
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.driver_tracking_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS speed_kmh DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS heading_deg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_motoristas_posicao_active_updated
  ON public.motoristas_posicao(is_active, updated_at DESC);

DROP VIEW IF EXISTS public.v_motoristas_posicao;
CREATE VIEW public.v_motoristas_posicao
WITH (security_invoker = true) AS
SELECT
  mp.motorista_id,
  d.name AS driver_name,
  d.company_id,
  mp.session_id,
  mp.is_active,
  ST_Y(mp.posicao::geometry) AS latitude,
  ST_X(mp.posicao::geometry) AS longitude,
  mp.accuracy_m,
  mp.speed_kmh,
  mp.heading_deg,
  mp.recorded_at,
  mp.updated_at
FROM public.motoristas_posicao mp
JOIN public.drivers d ON d.id = mp.motorista_id;

ALTER TABLE public.driver_tracking_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries role scoped" ON public.deliveries;
CREATE POLICY "deliveries role scoped" ON public.deliveries
FOR ALL USING (
  public.current_role() = 'MASTER'
  OR (
    company_id = public.current_company_id()
    AND (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'CLIENT')
      OR driver_id in (select id from public.drivers where profile_id = (public.current_profile()).id)
    )
  )
)
WITH CHECK (
  public.current_role() = 'MASTER'
  OR (
    company_id = public.current_company_id()
    AND public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);

DROP POLICY IF EXISTS "staff_read_positions" ON public.motoristas_posicao;
CREATE POLICY "staff_read_positions" ON public.motoristas_posicao
FOR SELECT TO authenticated
USING (
  public.current_role() = 'MASTER'
  OR motorista_id IN (
    SELECT id
    FROM public.drivers
    WHERE company_id = public.current_company_id()
  )
);

DROP POLICY IF EXISTS "driver_tracking_sessions_driver_own" ON public.driver_tracking_sessions;
CREATE POLICY "driver_tracking_sessions_driver_own" ON public.driver_tracking_sessions
FOR ALL TO authenticated
USING (
  driver_id IN (
    SELECT d.id
    FROM public.drivers d
    JOIN public.profiles p ON p.id = d.profile_id
    WHERE p.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  driver_id IN (
    SELECT d.id
    FROM public.drivers d
    JOIN public.profiles p ON p.id = d.profile_id
    WHERE p.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "driver_tracking_sessions_staff_read" ON public.driver_tracking_sessions;
CREATE POLICY "driver_tracking_sessions_staff_read" ON public.driver_tracking_sessions
FOR SELECT TO authenticated
USING (
  public.current_role() = 'MASTER'
  OR company_id = public.current_company_id()
);

CREATE OR REPLACE FUNCTION public.start_driver_tracking(
  p_motorista_id UUID,
  p_platform TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_session_id UUID;
BEGIN
  SELECT d.id, d.company_id INTO v_driver
  FROM public.drivers d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE d.id = p_motorista_id
    AND p.auth_user_id = auth.uid();

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller is not driver %', p_motorista_id;
  END IF;

  UPDATE public.driver_tracking_sessions
  SET status = 'finished',
      ended_at = COALESCE(ended_at, NOW())
  WHERE driver_id = p_motorista_id
    AND status = 'active';

  INSERT INTO public.driver_tracking_sessions (company_id, driver_id, platform)
  VALUES (v_driver.company_id, p_motorista_id, NULLIF(TRIM(p_platform), ''))
  RETURNING id INTO v_session_id;

  UPDATE public.drivers
  SET current_status = 'online'
  WHERE id = p_motorista_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_driver_location(
  p_session_id UUID,
  p_motorista_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_speed_kmh DOUBLE PRECISION DEFAULT NULL,
  p_heading_deg DOUBLE PRECISION DEFAULT NULL,
  p_recorded_at TIMESTAMPTZ DEFAULT NOW(),
  p_delivery_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_recorded_at TIMESTAMPTZ;
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  SELECT s.id, s.company_id, s.driver_id INTO v_session
  FROM public.driver_tracking_sessions s
  JOIN public.drivers d ON d.id = s.driver_id
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE s.id = p_session_id
    AND s.driver_id = p_motorista_id
    AND s.status = 'active'
    AND p.auth_user_id = auth.uid();

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized or inactive tracking session';
  END IF;

  v_recorded_at := COALESCE(p_recorded_at, NOW());

  INSERT INTO public.motoristas_posicao (
    motorista_id,
    session_id,
    posicao,
    is_active,
    accuracy_m,
    speed_kmh,
    heading_deg,
    recorded_at,
    updated_at
  )
  VALUES (
    p_motorista_id,
    p_session_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    TRUE,
    p_accuracy_m,
    p_speed_kmh,
    p_heading_deg,
    v_recorded_at,
    NOW()
  )
  ON CONFLICT (motorista_id) DO UPDATE
  SET session_id = EXCLUDED.session_id,
      posicao = EXCLUDED.posicao,
      is_active = TRUE,
      accuracy_m = EXCLUDED.accuracy_m,
      speed_kmh = EXCLUDED.speed_kmh,
      heading_deg = EXCLUDED.heading_deg,
      recorded_at = EXCLUDED.recorded_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.tracking_points (
    company_id,
    driver_id,
    delivery_id,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    created_at
  )
  VALUES (
    v_session.company_id,
    p_motorista_id,
    p_delivery_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_speed_kmh,
    p_heading_deg,
    v_recorded_at
  );

  UPDATE public.drivers
  SET current_status = 'active'
  WHERE id = p_motorista_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_driver_tracking(
  p_session_id UUID,
  p_motorista_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.id, s.driver_id INTO v_session
  FROM public.driver_tracking_sessions s
  JOIN public.drivers d ON d.id = s.driver_id
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE s.id = p_session_id
    AND s.driver_id = p_motorista_id
    AND p.auth_user_id = auth.uid();

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized tracking session';
  END IF;

  UPDATE public.driver_tracking_sessions
  SET status = 'finished',
      ended_at = COALESCE(ended_at, NOW())
  WHERE id = p_session_id
    AND driver_id = p_motorista_id;

  UPDATE public.motoristas_posicao
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE motorista_id = p_motorista_id
    AND session_id = p_session_id;

  UPDATE public.drivers
  SET current_status = 'offline'
  WHERE id = p_motorista_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_driver_tracking(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_driver_location(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_driver_tracking(UUID, UUID) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'motoristas_posicao'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas_posicao;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'driver_tracking_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_tracking_sessions;
  END IF;
END $$;
