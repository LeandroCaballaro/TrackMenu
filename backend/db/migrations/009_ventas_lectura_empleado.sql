-- Migration: 009_ventas_lectura_empleado.sql
--
-- El cobro de una mesa era imposible para un empleado, que es justamente quien
-- cobra. Dos políticas de la migración 007 se contradecían:
--
--   - ventas: sólo el admin podía leer (SELECT).
--   - detalle_ventas: el INSERT exige comprobar con un EXISTS que la venta
--     pertenezca a la organización; ese EXISTS se evalúa con RLS aplicada, así
--     que para un empleado la venta recién creada era invisible y el detalle
--     se rechazaba con 42501.
--
-- Se habilita la lectura de ventas y de su detalle a admin y empleado. Anular
-- sigue siendo sólo del admin, y el panel de ventas también (lo corta
-- requireRole('admin') en el backend).

DROP POLICY IF EXISTS "Admin lee ventas de su organizacion" ON public.ventas;
CREATE POLICY "Admin y empleado leen ventas de su organizacion" ON public.ventas
  FOR SELECT TO authenticated
  USING (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

DROP POLICY IF EXISTS "Leer detalle ventas asociadas a mi organizacion" ON public.detalle_ventas;
CREATE POLICY "Leer detalle de ventas de mi organizacion" ON public.detalle_ventas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas v
    WHERE v.id = detalle_ventas.venta_id
      AND v.organizacion_id = public.mi_organizacion()
      AND public.mi_rol() IN ('admin', 'empleado')
  ));
