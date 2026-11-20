-- Migration: 014_superadmin_opera_como_admin.sql
--
-- Probando el sistema rol por rol, el `superadmin` recibía 403 en casi todo:
-- no podía cargar un producto, tomar un pedido, cobrar una mesa, invitar
-- gente, cambiar un rol, tomar una reserva ni guardar el plano. Veía media
-- aplicación y no podía tocar nada, que es lo contrario de lo que su nombre
-- promete.
--
-- Pasaba en los dos lados: los `requireRole(...)` del backend sólo nombran
-- 'admin' y 'empleado', y las ~18 políticas RLS comparan `mi_rol()` contra esa
-- misma lista.
--
-- En vez de repetir 'superadmin' en cada política —y tener que acordarse en
-- cada una que se agregue—, `mi_rol()` pasa a informar 'admin' cuando quien
-- pregunta es superadministrador. Las políticas quedan como están y el
-- superadmin cumple cualquier regla escrita para un admin.
--
-- Para distinguirlo de verdad sigue estando `es_superadmin()`, que es lo que
-- usan las políticas de `organizaciones` y el módulo de plataforma.

CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT CASE WHEN rol = 'superadmin' THEN 'admin' ELSE rol END
  FROM public.miembros
  WHERE usuario_id = auth.uid();
$func$;
