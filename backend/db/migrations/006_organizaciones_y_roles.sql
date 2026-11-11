-- Migration: 006_organizaciones_y_roles.sql
-- Multi-tenencia: cada producto pertenece a una organización, cada usuario es
-- miembro de una organización con un rol (admin | empleado).

CREATE TABLE IF NOT EXISTS public.organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miembros (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS miembros_organizacion_idx ON public.miembros (organizacion_id);

-- Helpers. SECURITY DEFINER para que las políticas puedan leer miembros sin
-- recursión de RLS.
CREATE OR REPLACE FUNCTION public.mi_organizacion()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organizacion_id FROM public.miembros WHERE usuario_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.miembros WHERE usuario_id = auth.uid();
$$;

-- productos: pasa de "mío" a "de mi organización"
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE;
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS productos_organizacion_idx ON public.productos (organizacion_id);

-- Backfill: cada usuario que ya tenía productos pasa a ser admin de una
-- organización propia.
DO $$
DECLARE u UUID; org UUID;
BEGIN
  FOR u IN SELECT DISTINCT usuario_id FROM public.productos WHERE organizacion_id IS NULL LOOP
    SELECT organizacion_id INTO org FROM public.miembros WHERE usuario_id = u;
    IF org IS NULL THEN
      INSERT INTO public.organizaciones (nombre) VALUES ('Mi negocio') RETURNING id INTO org;
      INSERT INTO public.miembros (usuario_id, organizacion_id, rol) VALUES (u, org, 'admin');
    END IF;
  END LOOP;
END $$;

-- Completa la organización de los productos a partir de la de su dueño.
UPDATE public.productos p
SET organizacion_id = m.organizacion_id
FROM public.miembros m
WHERE p.organizacion_id IS NULL AND m.usuario_id = p.usuario_id;

-- RLS
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.organizaciones TO authenticated;
GRANT SELECT, INSERT ON TABLE public.miembros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.productos TO authenticated;

DROP POLICY IF EXISTS "Ver mi organizacion" ON public.organizaciones;
CREATE POLICY "Ver mi organizacion" ON public.organizaciones
  FOR SELECT TO authenticated USING (id = public.mi_organizacion());

DROP POLICY IF EXISTS "Ver miembros de mi organizacion" ON public.miembros;
CREATE POLICY "Ver miembros de mi organizacion" ON public.miembros
  FOR SELECT TO authenticated USING (organizacion_id = public.mi_organizacion());

-- Alta en el registro: el usuario crea su organización y se asocia como admin.
-- La PK de miembros impide que después se cambie de organización o de rol.
DROP POLICY IF EXISTS "Crear mi organizacion" ON public.organizaciones;
CREATE POLICY "Crear mi organizacion" ON public.organizaciones
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Asociarme a una organizacion" ON public.miembros;
CREATE POLICY "Asociarme a una organizacion" ON public.miembros
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

-- Las políticas viejas eran por usuario_id: se reemplazan por organización + rol.
DROP POLICY IF EXISTS "Usuarios leen sus productos" ON public.productos;
DROP POLICY IF EXISTS "Usuarios crean sus productos" ON public.productos;
DROP POLICY IF EXISTS "Usuarios modifican sus productos" ON public.productos;
DROP POLICY IF EXISTS "Usuarios eliminan sus productos" ON public.productos;

-- Los tres roles leen.
CREATE POLICY "Leer productos de mi organizacion" ON public.productos
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion());

-- admin y empleado crean y modifican.
CREATE POLICY "Crear productos de mi organizacion" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

CREATE POLICY "Modificar productos de mi organizacion" ON public.productos
  FOR UPDATE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() IN ('admin', 'empleado'))
  WITH CHECK (organizacion_id = public.mi_organizacion() AND public.mi_rol() IN ('admin', 'empleado'));

-- Sólo admin elimina.
CREATE POLICY "Eliminar productos de mi organizacion" ON public.productos
  FOR DELETE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

-- Imágenes: la carpeta pasa a ser la organización, no el usuario.
DROP POLICY IF EXISTS "Usuarios suben imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios suben imagenes de productos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'productos'
    AND (storage.foldername(name))[1] = public.mi_organizacion()::text
    AND public.mi_rol() IN ('admin', 'empleado')
  );

DROP POLICY IF EXISTS "Usuarios ven sus imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios ven sus imagenes de productos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'productos'
    AND (storage.foldername(name))[1] = public.mi_organizacion()::text
  );

DROP POLICY IF EXISTS "Usuarios eliminan sus imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios eliminan sus imagenes de productos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'productos'
    AND (storage.foldername(name))[1] = public.mi_organizacion()::text
    AND public.mi_rol() = 'admin'
  );
