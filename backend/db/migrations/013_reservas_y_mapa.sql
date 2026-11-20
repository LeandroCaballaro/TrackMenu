-- Migration: 013_reservas_y_mapa.sql
--
-- Backend de lo último que se agregó al frontend: el plano editable del salón
-- y el sistema de reservas con seña. Los dos guardaban en el localStorage del
-- navegador, así que el plano que dibujaba el admin y las reservas que tomaba
-- el local existían en una sola máquina y se perdían al limpiar el navegador.

-- 1. Plano del salón: una configuración por organización.
-- Se guarda como JSON porque el editor cambia su forma seguido (formas,
-- dibujo libre, posición de caja y entrada) y el backend no necesita leerlo
-- por dentro.
CREATE TABLE IF NOT EXISTS public.configuracion_mapa (
  organizacion_id UUID PRIMARY KEY REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.configuracion_mapa ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.configuracion_mapa TO authenticated;

DROP POLICY IF EXISTS "Ver el plano de mi organizacion" ON public.configuracion_mapa;
CREATE POLICY "Ver el plano de mi organizacion" ON public.configuracion_mapa
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion());

-- Dibujar el salón es del dueño: define cuántas mesas hay y de qué capacidad.
DROP POLICY IF EXISTS "Admin guarda el plano de su organizacion" ON public.configuracion_mapa;
CREATE POLICY "Admin guarda el plano de su organizacion" ON public.configuracion_mapa
  FOR INSERT TO authenticated
  WITH CHECK (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

DROP POLICY IF EXISTS "Admin actualiza el plano de su organizacion" ON public.configuracion_mapa;
CREATE POLICY "Admin actualiza el plano de su organizacion" ON public.configuracion_mapa
  FOR UPDATE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin')
  WITH CHECK (organizacion_id = public.mi_organizacion());

-- 2. Reservas
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  codigo_confirmacion TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  personas INT NOT NULL CHECK (personas BETWEEN 1 AND 50),
  mesa_numero INT NOT NULL CHECK (mesa_numero BETWEEN 1 AND 999),
  mesa_capacidad INT NOT NULL DEFAULT 4 CHECK (mesa_capacidad > 0),
  nombre_cliente TEXT NOT NULL,
  telefono TEXT,
  notas TEXT,
  sena_monto NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (sena_monto >= 0),
  sena_pagada BOOLEAN NOT NULL DEFAULT FALSE,
  sena_metodo TEXT NOT NULL DEFAULT 'mercadopago',
  sena_comprobante TEXT,
  asistencia_confirmada BOOLEAN NOT NULL DEFAULT FALSE,
  asistencia_confirmada_en TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada', 'cumplida')),
  creada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una mesa no se reserva dos veces en el mismo día y horario. Es lo que
-- impide el doble turno cuando dos personas reservan a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_mesa_turno_idx
  ON public.reservas (organizacion_id, fecha, hora, mesa_numero)
  WHERE estado = 'confirmada';

CREATE INDEX IF NOT EXISTS reservas_organizacion_fecha_idx
  ON public.reservas (organizacion_id, fecha);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reservas TO authenticated;

DROP POLICY IF EXISTS "Ver reservas de mi organizacion" ON public.reservas;
CREATE POLICY "Ver reservas de mi organizacion" ON public.reservas
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion());

DROP POLICY IF EXISTS "Tomar reservas en mi organizacion" ON public.reservas;
CREATE POLICY "Tomar reservas en mi organizacion" ON public.reservas
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

DROP POLICY IF EXISTS "Gestionar reservas de mi organizacion" ON public.reservas;
CREATE POLICY "Gestionar reservas de mi organizacion" ON public.reservas
  FOR UPDATE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() IN ('admin', 'empleado'))
  WITH CHECK (organizacion_id = public.mi_organizacion());

-- 3. El cliente consulta su reserva con el código, sin sesión.
-- Devuelve sólo lo que necesita ver quien ya tiene el código en la mano: no
-- expone el teléfono, las notas internas ni el comprobante de la seña.
CREATE OR REPLACE FUNCTION public.reserva_por_codigo(codigo TEXT)
RETURNS TABLE (
  organizacion_nombre TEXT,
  codigo_confirmacion TEXT,
  fecha DATE,
  hora TEXT,
  personas INT,
  mesa_numero INT,
  nombre_cliente TEXT,
  sena_monto NUMERIC,
  sena_pagada BOOLEAN,
  asistencia_confirmada BOOLEAN,
  estado TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT o.nombre,
         r.codigo_confirmacion,
         r.fecha,
         r.hora,
         r.personas,
         r.mesa_numero,
         r.nombre_cliente,
         r.sena_monto,
         r.sena_pagada,
         r.asistencia_confirmada,
         r.estado
  FROM public.reservas r
  JOIN public.organizaciones o ON o.id = r.organizacion_id
  WHERE upper(r.codigo_confirmacion) = upper(btrim(codigo));
$func$;

REVOKE ALL ON FUNCTION public.reserva_por_codigo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserva_por_codigo(TEXT) TO anon, authenticated;
