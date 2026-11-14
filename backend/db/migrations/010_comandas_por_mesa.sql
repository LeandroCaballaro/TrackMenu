-- Migration: 010_comandas_por_mesa.sql
--
-- Las comandas vivían en la memoria del navegador: había una sola mesa (la 4),
-- se perdían al recargar y dos personas no podían atender mesas distintas.
-- Ahora cada mesa tiene su comanda abierta en la base, compartida por todo el
-- equipo de la organización.
--
-- La tabla `tables` del esquema viejo no sirve: no tiene organizacion_id, así
-- que no se puede separar por negocio.

CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  mesa_numero INT NOT NULL CHECK (mesa_numero BETWEEN 1 AND 999),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cobrada', 'cancelada')),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  abierta_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en TIMESTAMPTZ
);

-- Una sola comanda abierta por mesa y organización: es lo que impide que dos
-- personas abran comandas paralelas en la misma mesa.
CREATE UNIQUE INDEX IF NOT EXISTS comandas_mesa_abierta_idx
  ON public.comandas (organizacion_id, mesa_numero)
  WHERE estado = 'abierta';

CREATE INDEX IF NOT EXISTS comandas_organizacion_idx ON public.comandas (organizacion_id, estado);

CREATE TABLE IF NOT EXISTS public.comanda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad INT NOT NULL CHECK (cantidad > 0),
  UNIQUE (comanda_id, producto_id)
);

CREATE INDEX IF NOT EXISTS comanda_items_comanda_idx ON public.comanda_items (comanda_id);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comandas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comanda_items TO authenticated;

-- Las tres funciones ven lo mismo: el mapa de mesas lo mira todo el equipo,
-- incluido el rol de sólo lectura; tomar y cerrar pedidos es del mostrador.
DROP POLICY IF EXISTS "Ver comandas de mi organizacion" ON public.comandas;
CREATE POLICY "Ver comandas de mi organizacion" ON public.comandas
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion());

DROP POLICY IF EXISTS "Abrir comandas en mi organizacion" ON public.comandas;
CREATE POLICY "Abrir comandas en mi organizacion" ON public.comandas
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

DROP POLICY IF EXISTS "Cerrar comandas de mi organizacion" ON public.comandas;
CREATE POLICY "Cerrar comandas de mi organizacion" ON public.comandas
  FOR UPDATE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() IN ('admin', 'empleado'))
  WITH CHECK (organizacion_id = public.mi_organizacion());

DROP POLICY IF EXISTS "Ver items de comandas de mi organizacion" ON public.comanda_items;
CREATE POLICY "Ver items de comandas de mi organizacion" ON public.comanda_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comandas c
    WHERE c.id = comanda_items.comanda_id AND c.organizacion_id = public.mi_organizacion()
  ));

DROP POLICY IF EXISTS "Cargar items de comandas de mi organizacion" ON public.comanda_items;
CREATE POLICY "Cargar items de comandas de mi organizacion" ON public.comanda_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comandas c
    WHERE c.id = comanda_items.comanda_id
      AND c.organizacion_id = public.mi_organizacion()
      AND public.mi_rol() IN ('admin', 'empleado')
  ));

DROP POLICY IF EXISTS "Quitar items de comandas de mi organizacion" ON public.comanda_items;
CREATE POLICY "Quitar items de comandas de mi organizacion" ON public.comanda_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comandas c
    WHERE c.id = comanda_items.comanda_id
      AND c.organizacion_id = public.mi_organizacion()
      AND public.mi_rol() IN ('admin', 'empleado')
  ));

-- Sin esta política, pedir dos veces desde la misma mesa no sumaba: el UPDATE
-- no tocaba ninguna fila y no devolvía error.
DROP POLICY IF EXISTS "Actualizar items de comandas de mi organizacion" ON public.comanda_items;
CREATE POLICY "Actualizar items de comandas de mi organizacion" ON public.comanda_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comandas c
    WHERE c.id = comanda_items.comanda_id
      AND c.organizacion_id = public.mi_organizacion()
      AND public.mi_rol() IN ('admin', 'empleado')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comandas c
    WHERE c.id = comanda_items.comanda_id
      AND c.organizacion_id = public.mi_organizacion()
  ));
