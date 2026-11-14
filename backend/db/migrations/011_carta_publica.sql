-- Migration: 011_carta_publica.sql
--
-- El menú por QR es la propuesta del producto, pero la carta sólo se podía ver
-- con sesión iniciada: un cliente sentado en la mesa no veía nada.
--
-- En vez de abrir la tabla `productos` a cualquiera, se expone una función que
-- devuelve sólo lo que va impreso en una carta —nombre, descripción, precio e
-- imagen de los productos activos— de la organización que se pide por su id.
-- Stock, usuarios, ventas y productos inactivos siguen sin ser visibles.

CREATE OR REPLACE FUNCTION public.carta_publica(organizacion UUID)
RETURNS TABLE (
  organizacion_nombre TEXT,
  producto_id UUID,
  nombre TEXT,
  descripcion TEXT,
  precio NUMERIC,
  imagen_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.nombre,
         p.id,
         p.nombre,
         p.descripcion,
         p.precio,
         p.imagen_url
  FROM public.productos p
  JOIN public.organizaciones o ON o.id = p.organizacion_id
  WHERE p.organizacion_id = organizacion
    AND p.activo
  ORDER BY p.nombre;
$$;

REVOKE ALL ON FUNCTION public.carta_publica(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carta_publica(UUID) TO anon, authenticated;
