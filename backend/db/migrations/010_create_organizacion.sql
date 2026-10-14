CREATE TABLE IF NOT EXISTS public.organizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  cuit TEXT,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizacion IS 'Cada negocio que usa la plataforma. Es la raiz del aislamiento multi-tenant.';

CREATE TABLE IF NOT EXISTS public.usuario_organizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizacion_id UUID NOT NULL REFERENCES public.organizacion(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('propietario', 'encargado', 'mozo', 'cocina')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, organizacion_id)
);

COMMENT ON TABLE public.usuario_organizacion IS 'Membresia y rol de cada usuario dentro de una organizacion. Las credenciales viven en auth.users.';

CREATE INDEX IF NOT EXISTS idx_usuario_organizacion_usuario ON public.usuario_organizacion(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_organizacion_organizacion ON public.usuario_organizacion(organizacion_id);

CREATE OR REPLACE FUNCTION public.pertenece_a_organizacion(p_organizacion UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_organizacion uo
    WHERE uo.organizacion_id = p_organizacion
      AND uo.usuario_id = auth.uid()
      AND uo.activo
  );
$$;

CREATE OR REPLACE FUNCTION public.rol_en_organizacion(p_organizacion UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uo.rol
  FROM public.usuario_organizacion uo
  WHERE uo.organizacion_id = p_organizacion
    AND uo.usuario_id = auth.uid()
    AND uo.activo
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.administra_organizacion(p_organizacion UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rol_en_organizacion(p_organizacion) IN ('propietario', 'encargado');
$$;

CREATE OR REPLACE FUNCTION public.asignar_propietario_inicial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.usuario_organizacion (usuario_id, organizacion_id, rol)
    VALUES (auth.uid(), NEW.id, 'propietario')
    ON CONFLICT (usuario_id, organizacion_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asignar_propietario_inicial ON public.organizacion;
CREATE TRIGGER trg_asignar_propietario_inicial
  AFTER INSERT ON public.organizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_propietario_inicial();

GRANT EXECUTE ON FUNCTION public.pertenece_a_organizacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_en_organizacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.administra_organizacion(UUID) TO authenticated;
