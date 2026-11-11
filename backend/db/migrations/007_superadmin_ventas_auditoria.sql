-- Migration: 007_superadmin_ventas_auditoria.sql
-- Módulo de Super-Administración y Permisos Granulares:
-- Ventas/tickets, detalle de comanda, trazabilidad de stock y logs inmutables de auditoría.

-- 1. Tabla ventas / tickets
CREATE TABLE IF NOT EXISTS public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  mesa_numero INT NOT NULL,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  metodo_pago VARCHAR(50) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia_qr')),
  estado VARCHAR(20) NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'anulada')),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado_en TIMESTAMPTZ,
  anulado_por UUID REFERENCES auth.users(id),
  motivo_anulacion TEXT
);

CREATE INDEX IF NOT EXISTS ventas_organizacion_idx ON public.ventas (organizacion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ventas_estado_idx ON public.ventas (estado);

-- 2. Tabla detalle_ventas
CREATE TABLE IF NOT EXISTS public.detalle_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS detalle_ventas_venta_idx ON public.detalle_ventas (venta_id);
CREATE INDEX IF NOT EXISTS detalle_ventas_producto_idx ON public.detalle_ventas (producto_id);

-- 3. Tabla movimientos_stock
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('ingreso', 'merma', 'venta', 'ajuste', 'restitucion')),
  cantidad INT NOT NULL,
  motivo TEXT,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimientos_stock_org_idx ON public.movimientos_stock (organizacion_id, created_at DESC);

-- 4. Tabla auditoria_logs
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  accion VARCHAR(50) NOT NULL CHECK (accion IN ('anulacion_ticket', 'cambio_precio', 'baja_producto', 'cambio_rol', 'ajuste_stock')),
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_logs_org_idx ON public.auditoria_logs (organizacion_id, created_at DESC);

-- 5. Habilitar RLS
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ventas TO authenticated;
GRANT SELECT, INSERT ON TABLE public.detalle_ventas TO authenticated;
GRANT SELECT, INSERT ON TABLE public.movimientos_stock TO authenticated;
GRANT SELECT, INSERT ON TABLE public.auditoria_logs TO authenticated;

-- Políticas ventas:
-- Admin lee histórico completo de su organización
DROP POLICY IF EXISTS "Admin lee ventas de su organizacion" ON public.ventas;
CREATE POLICY "Admin lee ventas de su organizacion" ON public.ventas
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

-- Empleado y admin crean ventas al cobrar mesas
DROP POLICY IF EXISTS "Empleado crea ventas en su organizacion" ON public.ventas;
CREATE POLICY "Empleado crea ventas en su organizacion" ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

-- Admin anula ventas (UPDATE estado/anulacion)
DROP POLICY IF EXISTS "Admin anula ventas" ON public.ventas;
CREATE POLICY "Admin anula ventas" ON public.ventas
  FOR UPDATE TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin')
  WITH CHECK (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

-- Políticas detalle_ventas:
DROP POLICY IF EXISTS "Leer detalle ventas asociadas a mi organizacion" ON public.detalle_ventas;
CREATE POLICY "Leer detalle ventas asociadas a mi organizacion" ON public.detalle_ventas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ventas v
    WHERE v.id = detalle_ventas.venta_id
    AND v.organizacion_id = public.mi_organizacion()
    AND public.mi_rol() = 'admin'
  ));

DROP POLICY IF EXISTS "Crear detalle de ventas" ON public.detalle_ventas;
CREATE POLICY "Crear detalle de ventas" ON public.detalle_ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ventas v
    WHERE v.id = detalle_ventas.venta_id
    AND v.organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  ));

-- Políticas movimientos_stock:
DROP POLICY IF EXISTS "Admin lee movimientos de stock" ON public.movimientos_stock;
CREATE POLICY "Admin lee movimientos de stock" ON public.movimientos_stock
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

DROP POLICY IF EXISTS "Admin y empleado registran movimientos de stock" ON public.movimientos_stock;
CREATE POLICY "Admin y empleado registran movimientos de stock" ON public.movimientos_stock
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

-- Políticas auditoria_logs:
DROP POLICY IF EXISTS "Admin lee auditoria" ON public.auditoria_logs;
CREATE POLICY "Admin lee auditoria" ON public.auditoria_logs
  FOR SELECT TO authenticated
  USING (organizacion_id = public.mi_organizacion() AND public.mi_rol() = 'admin');

DROP POLICY IF EXISTS "Sistema registra auditoria" ON public.auditoria_logs;
CREATE POLICY "Sistema registra auditoria" ON public.auditoria_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organizacion_id = public.mi_organizacion()
    AND public.mi_rol() IN ('admin', 'empleado')
  );

