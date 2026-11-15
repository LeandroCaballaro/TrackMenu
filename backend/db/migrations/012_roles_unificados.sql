-- Migration: 012_roles_unificados.sql
--
-- Deja coherente lo que las dos ramas fusionadas en `main` dejaron a medias.
-- Va al final a propósito: corra en el orden que corra el resto, el estado
-- final es este.

-- 1. Un solo CHECK de roles, con los cuatro que el sistema usa de verdad.
--
-- Las dos ramas lo definen de forma incompatible y la última que corre rompe
-- a la otra:
--   006_organizaciones_y_roles.sql             ('admin', 'empleado', 'consulta')
--   008_superadmin_planes_y_suscripciones.sql  ('superadmin', 'admin', 'empleado')
--
-- Con el de la 008 el rol `consulta` deja de poder guardarse y se rompen las
-- invitaciones, /api/miembros y el panel de usuarios. Con el de la 006 el que
-- no entra es `superadmin`, y el módulo de super-administración se queda sin
-- nadie a quien dejar pasar.
ALTER TABLE public.miembros DROP CONSTRAINT IF EXISTS miembros_rol_check;
ALTER TABLE public.miembros ADD CONSTRAINT miembros_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'empleado', 'consulta'));

-- Las invitaciones tienen su propia lista y también le faltaba `superadmin`.
ALTER TABLE public.invitaciones DROP CONSTRAINT IF EXISTS invitaciones_rol_check;
ALTER TABLE public.invitaciones ADD CONSTRAINT invitaciones_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'empleado', 'consulta'));

-- La define la 008 del superadmin, pero esta migración no depende de que esa
-- haya corrido: así se puede aplicar sola sobre una base ya existente.
CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros WHERE usuario_id = auth.uid() AND rol = 'superadmin'
  );
$func$;

-- 2. Escribir en `organizaciones` vuelve a ser sólo del superadmin.
--
-- La 008 del superadmin dejó una política FOR ALL con
-- `es_superadmin() OR id = mi_organizacion()`. FOR ALL incluye UPDATE y DELETE,
-- y Supabase otorga esos permisos a `authenticated` por defecto, así que
-- cualquier integrante —hasta el rol de sólo lectura— podía modificar su propia
-- organización: ponerse `bloqueo_mora = false` y `estado_suscripcion = 'al_dia'`
-- para saltarse el corte por falta de pago, o borrar la organización entera y
-- arrastrar en cascada productos, miembros y ventas.
DROP POLICY IF EXISTS "Superadmin gestiona todas las organizaciones" ON public.organizaciones;
CREATE POLICY "Superadmin modifica cualquier organizacion" ON public.organizaciones
  FOR UPDATE TO authenticated
  USING (public.es_superadmin())
  WITH CHECK (public.es_superadmin());

DROP POLICY IF EXISTS "Superadmin da de baja organizaciones" ON public.organizaciones;
CREATE POLICY "Superadmin da de baja organizaciones" ON public.organizaciones
  FOR DELETE TO authenticated
  USING (public.es_superadmin());

-- 3. Nadie vuelve a crear organizaciones a mano.
--
-- Re-ejecutar la 006 reabre esta política, y con ella la escalada de
-- privilegios que cerró la 008: alta por fundar_organizacion() y nada más.
DROP POLICY IF EXISTS "Crear mi organizacion" ON public.organizaciones;
DROP POLICY IF EXISTS "Fundar mi organizacion" ON public.miembros;
DROP POLICY IF EXISTS "Asociarme a una organizacion" ON public.miembros;
REVOKE INSERT ON TABLE public.organizaciones FROM authenticated;
REVOKE INSERT ON TABLE public.miembros FROM authenticated;
