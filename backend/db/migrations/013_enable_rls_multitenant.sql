ALTER TABLE public.organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizacion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usuario_organizacion TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categoria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.producto TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedido TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedido_item TO authenticated;

GRANT SELECT ON TABLE public.organizacion TO anon;
GRANT SELECT ON TABLE public.categoria TO anon;
GRANT SELECT ON TABLE public.producto TO anon;

DROP POLICY IF EXISTS "Miembros leen su organizacion" ON public.organizacion;
CREATE POLICY "Miembros leen su organizacion"
  ON public.organizacion FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(id));

DROP POLICY IF EXISTS "Cualquier usuario registra su organizacion" ON public.organizacion;
CREATE POLICY "Cualquier usuario registra su organizacion"
  ON public.organizacion FOR INSERT TO authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Propietarios modifican su organizacion" ON public.organizacion;
CREATE POLICY "Propietarios modifican su organizacion"
  ON public.organizacion FOR UPDATE TO authenticated
  USING (public.rol_en_organizacion(id) = 'propietario')
  WITH CHECK (public.rol_en_organizacion(id) = 'propietario');

DROP POLICY IF EXISTS "Comensales leen organizaciones activas" ON public.organizacion;
CREATE POLICY "Comensales leen organizaciones activas"
  ON public.organizacion FOR SELECT TO anon
  USING (activo);

DROP POLICY IF EXISTS "Miembros leen las membresias de su organizacion" ON public.usuario_organizacion;
CREATE POLICY "Miembros leen las membresias de su organizacion"
  ON public.usuario_organizacion FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Administradores gestionan membresias" ON public.usuario_organizacion;
CREATE POLICY "Administradores gestionan membresias"
  ON public.usuario_organizacion FOR ALL TO authenticated
  USING (public.administra_organizacion(organizacion_id))
  WITH CHECK (public.administra_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros leen sus categorias" ON public.categoria;
CREATE POLICY "Miembros leen sus categorias"
  ON public.categoria FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Administradores gestionan categorias" ON public.categoria;
CREATE POLICY "Administradores gestionan categorias"
  ON public.categoria FOR ALL TO authenticated
  USING (public.administra_organizacion(organizacion_id))
  WITH CHECK (public.administra_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Comensales leen categorias activas" ON public.categoria;
CREATE POLICY "Comensales leen categorias activas"
  ON public.categoria FOR SELECT TO anon
  USING (activa);

DROP POLICY IF EXISTS "Miembros leen sus productos" ON public.producto;
CREATE POLICY "Miembros leen sus productos"
  ON public.producto FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Administradores gestionan productos" ON public.producto;
CREATE POLICY "Administradores gestionan productos"
  ON public.producto FOR ALL TO authenticated
  USING (public.administra_organizacion(organizacion_id))
  WITH CHECK (public.administra_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Comensales leen productos activos" ON public.producto;
CREATE POLICY "Comensales leen productos activos"
  ON public.producto FOR SELECT TO anon
  USING (activo);

DROP POLICY IF EXISTS "Miembros leen sus mesas" ON public.mesa;
CREATE POLICY "Miembros leen sus mesas"
  ON public.mesa FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros actualizan el estado de sus mesas" ON public.mesa;
CREATE POLICY "Miembros actualizan el estado de sus mesas"
  ON public.mesa FOR UPDATE TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id))
  WITH CHECK (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Administradores gestionan mesas" ON public.mesa;
CREATE POLICY "Administradores gestionan mesas"
  ON public.mesa FOR ALL TO authenticated
  USING (public.administra_organizacion(organizacion_id))
  WITH CHECK (public.administra_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros leen sus pedidos" ON public.pedido;
CREATE POLICY "Miembros leen sus pedidos"
  ON public.pedido FOR SELECT TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros registran pedidos" ON public.pedido;
CREATE POLICY "Miembros registran pedidos"
  ON public.pedido FOR INSERT TO authenticated
  WITH CHECK (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros actualizan pedidos" ON public.pedido;
CREATE POLICY "Miembros actualizan pedidos"
  ON public.pedido FOR UPDATE TO authenticated
  USING (public.pertenece_a_organizacion(organizacion_id))
  WITH CHECK (public.pertenece_a_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Administradores eliminan pedidos" ON public.pedido;
CREATE POLICY "Administradores eliminan pedidos"
  ON public.pedido FOR DELETE TO authenticated
  USING (public.administra_organizacion(organizacion_id));

DROP POLICY IF EXISTS "Miembros leen los items de sus pedidos" ON public.pedido_item;
CREATE POLICY "Miembros leen los items de sus pedidos"
  ON public.pedido_item FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedido p
    WHERE p.id = pedido_item.pedido_id
      AND public.pertenece_a_organizacion(p.organizacion_id)
  ));

DROP POLICY IF EXISTS "Miembros gestionan los items de sus pedidos" ON public.pedido_item;
CREATE POLICY "Miembros gestionan los items de sus pedidos"
  ON public.pedido_item FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedido p
    WHERE p.id = pedido_item.pedido_id
      AND public.pertenece_a_organizacion(p.organizacion_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedido p
    WHERE p.id = pedido_item.pedido_id
      AND public.pertenece_a_organizacion(p.organizacion_id)
  ));
