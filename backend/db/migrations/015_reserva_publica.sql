-- Migration: 015_reserva_publica.sql
--
-- El cliente reserva desde la portada, sin sesión. Hasta ahora esa reserva no
-- llegaba a ningún lado: la pantalla le decía "RESERVA CONFIRMADA" y el local
-- nunca la veía.
--
-- Igual que `carta_publica`, se expone una función acotada en vez de abrir la
-- tabla: inserta una reserva en la organización que se indica y devuelve el
-- código. No permite leer nada —para eso está `reserva_por_codigo`— ni tocar
-- reservas existentes.

CREATE OR REPLACE FUNCTION public.crear_reserva_publica(
  organizacion UUID,
  p_fecha DATE,
  p_hora TEXT,
  p_personas INT,
  p_mesa_numero INT,
  p_mesa_capacidad INT,
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_notas TEXT,
  p_sena_monto NUMERIC,
  p_sena_comprobante TEXT
)
RETURNS TABLE (codigo_confirmacion TEXT, mesa_numero INT, sena_monto NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  nuevo_codigo TEXT := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizaciones WHERE id = organizacion) THEN
    RAISE EXCEPTION 'El local no existe';
  END IF;

  -- La fecha pasada y los rangos los valida igual el backend; acá se repite lo
  -- imprescindible porque esta función queda expuesta a cualquiera.
  IF p_fecha < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede reservar para una fecha que ya pasó';
  END IF;

  IF p_personas < 1 OR p_personas > 50 OR p_mesa_numero < 1 OR p_mesa_numero > 999 THEN
    RAISE EXCEPTION 'Los datos de la reserva están fuera de rango';
  END IF;

  IF btrim(COALESCE(p_nombre_cliente, '')) = '' THEN
    RAISE EXCEPTION 'Falta el nombre de quien reserva';
  END IF;

  INSERT INTO public.reservas (
    organizacion_id, codigo_confirmacion, fecha, hora, personas,
    mesa_numero, mesa_capacidad, nombre_cliente, telefono, notas,
    sena_monto, sena_pagada, sena_metodo, sena_comprobante
  ) VALUES (
    organizacion, nuevo_codigo, p_fecha, p_hora, p_personas,
    p_mesa_numero, COALESCE(p_mesa_capacidad, 4), btrim(p_nombre_cliente),
    NULLIF(btrim(COALESCE(p_telefono, '')), ''), NULLIF(btrim(COALESCE(p_notas, '')), ''),
    COALESCE(p_sena_monto, 0), TRUE, 'mercadopago',
    NULLIF(btrim(COALESCE(p_sena_comprobante, '')), '')
  );

  RETURN QUERY SELECT nuevo_codigo, p_mesa_numero, COALESCE(p_sena_monto, 0);
END;
$func$;

REVOKE ALL ON FUNCTION public.crear_reserva_publica(UUID, DATE, TEXT, INT, INT, INT, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_reserva_publica(UUID, DATE, TEXT, INT, INT, INT, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;
