-- Migration: 008_superadmin_planes_y_suscripciones.sql
-- Módulo de Super-Administración de Plataforma:
-- Planes SaaS, estados de suscripción, control de mora y bloqueo por falta de pago.

-- 1. Agregar campos de suscripción a la tabla organizaciones
ALTER TABLE public.organizaciones
  ADD COLUMN IF NOT EXISTS plan VARCHAR(30) NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS estado_suscripcion VARCHAR(30) NOT NULL DEFAULT 'al_dia',
  ADD COLUMN IF NOT EXISTS monto_mensual NUMERIC(10, 2) NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS bloqueo_mora BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_facturacion TEXT;

-- 2. Asegurar que miembros acepte el rol 'superadmin'
ALTER TABLE public.miembros DROP CONSTRAINT IF EXISTS miembros_rol_check;
-- 'consulta' existe desde la 006 y ya hay miembros con ese rol: sin él, este
-- ALTER falla con 23514 y la migración entera no se puede aplicar.
ALTER TABLE public.miembros ADD CONSTRAINT miembros_rol_check CHECK (rol IN ('superadmin', 'admin', 'empleado', 'consulta'));

-- 3. Función helper para identificar si el usuario es superadmin
CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros WHERE usuario_id = auth.uid() AND rol = 'superadmin'
  );
$$;

-- 4. Actualizar políticas RLS de organizaciones para que el superadmin gestione todas
DROP POLICY IF EXISTS "Ver mi organizacion" ON public.organizaciones;
CREATE POLICY "Ver mi organizacion" ON public.organizaciones
  FOR SELECT TO authenticated
  USING (public.es_superadmin() OR id = public.mi_organizacion());

DROP POLICY IF EXISTS "Superadmin gestiona todas las organizaciones" ON public.organizaciones;
CREATE POLICY "Superadmin gestiona todas las organizaciones" ON public.organizaciones
  FOR ALL TO authenticated
  USING (public.es_superadmin() OR id = public.mi_organizacion())
  WITH CHECK (public.es_superadmin() OR id = public.mi_organizacion());

