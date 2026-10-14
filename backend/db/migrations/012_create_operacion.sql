CREATE TABLE IF NOT EXISTS public.mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizacion(id) ON DELETE CASCADE,
  numero SMALLINT NOT NULL CHECK (numero > 0),
  capacidad SMALLINT NOT NULL DEFAULT 4 CHECK (capacidad > 0),
  estado TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'reservada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, numero)
);

COMMENT ON TABLE public.mesa IS 'Mesas del salon de cada organizacion. El numero es unico dentro de la organizacion.';

CREATE INDEX IF NOT EXISTS idx_mesa_organizacion ON public.mesa(organizacion_id);

CREATE TABLE IF NOT EXISTS public.pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizacion(id) ON DELETE CASCADE,
  mesa_id UUID NOT NULL REFERENCES public.mesa(id) ON DELETE RESTRICT,
  atendido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'en_preparacion'
    CHECK (estado IN ('en_preparacion', 'listo', 'entregado', 'cancelado')),
  medio_pago TEXT CHECK (medio_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en TIMESTAMPTZ
);

COMMENT ON TABLE public.pedido IS 'Comanda asociada a una mesa. El total se recalcula desde pedido_item.';

CREATE INDEX IF NOT EXISTS idx_pedido_organizacion ON public.pedido(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_pedido_mesa ON public.pedido(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedido_estado ON public.pedido(estado);

CREATE TABLE IF NOT EXISTS public.pedido_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedido(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.producto(id) ON DELETE RESTRICT,
  cantidad SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  nota TEXT,
  UNIQUE (pedido_id, producto_id)
);

COMMENT ON TABLE public.pedido_item IS 'Detalle del pedido. Guarda el precio del momento para no alterar el historial.';

CREATE INDEX IF NOT EXISTS idx_pedido_item_pedido ON public.pedido_item(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_item_producto ON public.pedido_item(producto_id);

CREATE OR REPLACE FUNCTION public.validar_coherencia_de_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_organizacion UUID;
BEGIN
  SELECT organizacion_id INTO v_organizacion FROM public.mesa WHERE id = NEW.mesa_id;

  IF v_organizacion IS DISTINCT FROM NEW.organizacion_id THEN
    RAISE EXCEPTION 'La mesa % no pertenece a la organizacion %', NEW.mesa_id, NEW.organizacion_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_coherencia_de_pedido ON public.pedido;
CREATE TRIGGER trg_validar_coherencia_de_pedido
  BEFORE INSERT OR UPDATE ON public.pedido
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_coherencia_de_pedido();

CREATE OR REPLACE FUNCTION public.validar_producto_de_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_organizacion_pedido UUID;
  v_organizacion_producto UUID;
BEGIN
  SELECT organizacion_id INTO v_organizacion_pedido FROM public.pedido WHERE id = NEW.pedido_id;
  SELECT organizacion_id INTO v_organizacion_producto FROM public.producto WHERE id = NEW.producto_id;

  IF v_organizacion_pedido IS DISTINCT FROM v_organizacion_producto THEN
    RAISE EXCEPTION 'El producto % no pertenece a la organizacion del pedido %', NEW.producto_id, NEW.pedido_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_producto_de_item ON public.pedido_item;
CREATE TRIGGER trg_validar_producto_de_item
  BEFORE INSERT OR UPDATE ON public.pedido_item
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_producto_de_item();

CREATE OR REPLACE FUNCTION public.recalcular_total_de_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pedido := OLD.pedido_id;
  ELSE
    v_pedido := NEW.pedido_id;
  END IF;

  UPDATE public.pedido p
  SET total = COALESCE((
    SELECT SUM(i.subtotal) FROM public.pedido_item i WHERE i.pedido_id = v_pedido
  ), 0)
  WHERE p.id = v_pedido;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_total_de_pedido ON public.pedido_item;
CREATE TRIGGER trg_recalcular_total_de_pedido
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_item
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_total_de_pedido();
