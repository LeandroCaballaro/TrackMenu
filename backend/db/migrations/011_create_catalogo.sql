CREATE TABLE IF NOT EXISTS public.categoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizacion(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, nombre)
);

COMMENT ON TABLE public.categoria IS 'Secciones del menu de cada organizacion (Hamburguesas, Bebidas, Postres).';

CREATE INDEX IF NOT EXISTS idx_categoria_organizacion ON public.categoria(organizacion_id);

CREATE TABLE IF NOT EXISTS public.producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizacion(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categoria(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  imagen_url TEXT,
  imagen_ruta TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, nombre)
);

COMMENT ON TABLE public.producto IS 'Items del menu que una organizacion ofrece a sus comensales.';

CREATE INDEX IF NOT EXISTS idx_producto_organizacion ON public.producto(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_producto_categoria ON public.producto(categoria_id);

CREATE OR REPLACE FUNCTION public.validar_categoria_de_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.categoria_id IS NOT NULL THEN
    PERFORM 1
    FROM public.categoria c
    WHERE c.id = NEW.categoria_id
      AND c.organizacion_id = NEW.organizacion_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La categoria % no pertenece a la organizacion %', NEW.categoria_id, NEW.organizacion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_categoria_de_producto ON public.producto;
CREATE TRIGGER trg_validar_categoria_de_producto
  BEFORE INSERT OR UPDATE ON public.producto
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_categoria_de_producto();
