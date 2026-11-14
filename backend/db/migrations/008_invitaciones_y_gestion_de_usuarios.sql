-- Migration: 008_invitaciones_y_gestion_de_usuarios.sql
--
-- Arregla una escalada de privilegios y agrega la gestión de usuarios.
--
-- La política de INSERT de miembros era `usuario_id = auth.uid()`: cualquier
-- usuario recién registrado podía insertarse en CUALQUIER organización con rol
-- admin si conocía su UUID, y pasaba a ver, modificar y borrar todo.
-- Ahora sólo se puede fundar una organización propia; para sumar gente hay que
-- invitarla.

-- 1. Invitaciones
CREATE TABLE IF NOT EXISTS public.invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  rol TEXT NOT NULL DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado', 'consulta')),
  email TEXT,
  creada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usada_en TIMESTAMPTZ,
  expira_en TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitaciones_organizacion_idx ON public.invitaciones (organizacion_id);

ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON TABLE public.invitaciones TO authenticated;

-- Sólo el admin de la organización ve y maneja sus invitaciones. El código no
-- se expone a nadie más: quien la recibe la canjea por la función de abajo.
DROP POLICY IF EXISTS "Admin ve las invitaciones de su organizacion" ON public.invitaciones;
CREATE POLICY "Admin ve las invitaciones de su organizacion" ON public.invitaciones
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

DROP POLICY IF EXISTS "Admin crea invitaciones de su organizacion" ON public.invitaciones;
CREATE POLICY "Admin crea invitaciones de su organizacion" ON public.invitaciones
  FOR INSERT TO authenticated
  WITH CHECK (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

DROP POLICY IF EXISTS "Admin revoca invitaciones de su organizacion" ON public.invitaciones;
CREATE POLICY "Admin revoca invitaciones de su organizacion" ON public.invitaciones
  FOR DELETE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin' AND usada_en IS NULL);

-- 2. Fundar la organización propia: sólo si todavía no tiene ningún miembro.
DROP POLICY IF EXISTS "Asociarme a una organizacion" ON public.miembros;
DROP POLICY IF EXISTS "Fundar mi organizacion" ON public.miembros;
CREATE POLICY "Fundar mi organizacion" ON public.miembros
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND rol = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.miembros otros WHERE otros.organizacion_id = miembros.organizacion_id
    )
  );

-- 3. Gestión de usuarios: el admin cambia roles y da de baja miembros de su
-- organización, pero nunca su propia fila (para no dejarla sin admin ni poder
-- auto-asignarse otro rol).
DROP POLICY IF EXISTS "Admin cambia roles de su organizacion" ON public.miembros;
CREATE POLICY "Admin cambia roles de su organizacion" ON public.miembros
  FOR UPDATE TO authenticated
  USING (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() = 'admin'
    AND usuario_id <> (SELECT auth.uid())
  )
  WITH CHECK (organizacion_id = public.mi_organizacion());

DROP POLICY IF EXISTS "Admin da de baja miembros de su organizacion" ON public.miembros;
CREATE POLICY "Admin da de baja miembros de su organizacion" ON public.miembros
  FOR DELETE TO authenticated
  USING (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() = 'admin'
    AND usuario_id <> (SELECT auth.uid())
  );

GRANT UPDATE, DELETE ON TABLE public.miembros TO authenticated;

-- 4. Canjear una invitación. SECURITY DEFINER porque quien la usa todavía no
-- pertenece a la organización y no puede ver la tabla.
CREATE OR REPLACE FUNCTION public.aceptar_invitacion(codigo_invitacion TEXT)
RETURNS TABLE (organizacion_id UUID, rol TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.invitaciones;
  quien UUID := auth.uid();
BEGIN
  IF quien IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión para aceptar una invitación';
  END IF;

  IF EXISTS (SELECT 1 FROM public.miembros WHERE usuario_id = quien) THEN
    RAISE EXCEPTION 'Tu usuario ya pertenece a una organización';
  END IF;

  SELECT * INTO inv FROM public.invitaciones
  WHERE codigo = codigo_invitacion AND usada_en IS NULL AND expira_en > now();

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'La invitación no existe, ya se usó o venció';
  END IF;

  INSERT INTO public.miembros (usuario_id, organizacion_id, rol)
  VALUES (quien, inv.organizacion_id, inv.rol);

  UPDATE public.invitaciones
  SET usada_por = quien, usada_en = now()
  WHERE id = inv.id;

  RETURN QUERY SELECT inv.organizacion_id, inv.rol;
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_invitacion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion(TEXT) TO authenticated;

-- 5. Fundar la organización propia.
-- Hacerlo con dos INSERT desde el cliente no funcionaba: el RETURNING de
-- organizaciones choca con su política de SELECT (todavía no sos miembro).
-- Además, abrir INSERT en esas tablas es justamente lo que permitía colarse.
-- Esta función lo hace en un solo paso y deja ambas tablas sin INSERT público.
CREATE OR REPLACE FUNCTION public.fundar_organizacion(nombre_organizacion TEXT)
RETURNS TABLE (organizacion_id UUID, rol TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  quien UUID := auth.uid();
  nueva UUID;
BEGIN
  IF quien IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión';
  END IF;

  IF EXISTS (SELECT 1 FROM public.miembros WHERE usuario_id = quien) THEN
    RAISE EXCEPTION 'Tu usuario ya pertenece a una organización';
  END IF;

  INSERT INTO public.organizaciones (nombre)
  VALUES (COALESCE(NULLIF(btrim(nombre_organizacion), ''), 'Mi negocio'))
  RETURNING id INTO nueva;

  INSERT INTO public.miembros (usuario_id, organizacion_id, rol)
  VALUES (quien, nueva, 'admin');

  RETURN QUERY SELECT nueva, 'admin'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fundar_organizacion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fundar_organizacion(TEXT) TO authenticated;

-- Ya nadie necesita insertar a mano en estas tablas.
DROP POLICY IF EXISTS "Fundar mi organizacion" ON public.miembros;
DROP POLICY IF EXISTS "Crear mi organizacion" ON public.organizaciones;
REVOKE INSERT ON TABLE public.miembros FROM authenticated;
REVOKE INSERT ON TABLE public.organizaciones FROM authenticated;

-- 6. Alta directa de un miembro por parte del admin.
-- Lo usa POST /api/admin/usuarios, que crea la cuenta y la suma al equipo.
-- Como ya no hay INSERT público sobre miembros, pasa por acá: la función
-- comprueba que quien llama sea admin de esa organización.
CREATE OR REPLACE FUNCTION public.agregar_miembro(nuevo_usuario UUID, nuevo_rol TEXT)
RETURNS TABLE (organizacion_id UUID, rol TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org UUID := public.mi_organizacion();
BEGIN
  IF org IS NULL OR public.mi_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Sólo un administrador puede sumar usuarios a su organización';
  END IF;

  IF nuevo_rol NOT IN ('admin', 'empleado', 'consulta') THEN
    RAISE EXCEPTION 'Rol inválido: %', nuevo_rol;
  END IF;

  IF EXISTS (SELECT 1 FROM public.miembros WHERE usuario_id = nuevo_usuario) THEN
    RAISE EXCEPTION 'Ese usuario ya pertenece a una organización';
  END IF;

  INSERT INTO public.miembros (usuario_id, organizacion_id, rol)
  VALUES (nuevo_usuario, org, nuevo_rol);

  RETURN QUERY SELECT org, nuevo_rol;
END;
$$;

REVOKE ALL ON FUNCTION public.agregar_miembro(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agregar_miembro(UUID, TEXT) TO authenticated;

-- 7. Ver el equipo con nombre y correo.
-- auth.users no es legible con el token del usuario, así que la pantalla de
-- usuarios mostraba UUIDs en vez de correos y no se sabía a quién se le estaba
-- cambiando el rol. Esta función expone sólo los datos del propio equipo.
CREATE OR REPLACE FUNCTION public.mi_equipo()
RETURNS TABLE (usuario_id UUID, email TEXT, nombre TEXT, rol TEXT, creado_en TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.usuario_id,
         u.email::TEXT,
         COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::TEXT, '@', 1)),
         m.rol,
         m.creado_en
  FROM public.miembros m
  JOIN auth.users u ON u.id = m.usuario_id
  WHERE m.organizacion_id = public.mi_organizacion()
  ORDER BY m.creado_en;
$$;

REVOKE ALL ON FUNCTION public.mi_equipo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_equipo() TO authenticated;
