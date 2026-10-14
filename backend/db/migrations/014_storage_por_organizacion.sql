INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productos',
  'productos',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE OR REPLACE FUNCTION public.carpeta_es_organizacion_propia(p_nombre TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carpeta TEXT := (storage.foldername(p_nombre))[1];
BEGIN
  IF v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  RETURN public.pertenece_a_organizacion(v_carpeta::UUID);
END;
$$;

GRANT EXECUTE ON FUNCTION public.carpeta_es_organizacion_propia(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Usuarios suben imagenes de productos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios ven sus imagenes de productos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios eliminan sus imagenes de productos" ON storage.objects;

DROP POLICY IF EXISTS "Miembros suben imagenes de su organizacion" ON storage.objects;
CREATE POLICY "Miembros suben imagenes de su organizacion"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'productos'
    AND public.carpeta_es_organizacion_propia(name)
  );

DROP POLICY IF EXISTS "Miembros ven imagenes de su organizacion" ON storage.objects;
CREATE POLICY "Miembros ven imagenes de su organizacion"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'productos'
    AND public.carpeta_es_organizacion_propia(name)
  );

DROP POLICY IF EXISTS "Miembros eliminan imagenes de su organizacion" ON storage.objects;
CREATE POLICY "Miembros eliminan imagenes de su organizacion"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'productos'
    AND public.carpeta_es_organizacion_propia(name)
  );
