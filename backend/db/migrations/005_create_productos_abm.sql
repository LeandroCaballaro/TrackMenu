CREATE TABLE IF NOT EXISTS public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  imagen_url TEXT,
  imagen_ruta TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_ruta TEXT;

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.productos TO authenticated;

DROP POLICY IF EXISTS "Usuarios leen sus productos" ON public.productos;
CREATE POLICY "Usuarios leen sus productos"
  ON public.productos
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "Usuarios crean sus productos" ON public.productos;
CREATE POLICY "Usuarios crean sus productos"
  ON public.productos
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "Usuarios modifican sus productos" ON public.productos;
CREATE POLICY "Usuarios modifican sus productos"
  ON public.productos
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id)
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus productos" ON public.productos;
CREATE POLICY "Usuarios eliminan sus productos"
  ON public.productos
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

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

DROP POLICY IF EXISTS "Usuarios suben imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios suben imagenes de productos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'productos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Usuarios ven sus imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios ven sus imagenes de productos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'productos'
    AND owner_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Usuarios eliminan sus imagenes de productos" ON storage.objects;
CREATE POLICY "Usuarios eliminan sus imagenes de productos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'productos'
    AND owner_id = auth.uid()::text
  );
