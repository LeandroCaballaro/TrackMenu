-- Migration: 004_enable_rls_and_policies.sql
-- Descripción: Habilita Row Level Security (RLS) y crea políticas de acceso

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para Productos
DROP POLICY IF EXISTS "Lectura pública de productos" ON public.products;
CREATE POLICY "Lectura pública de productos" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Modificación de productos" ON public.products;
CREATE POLICY "Modificación de productos" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Políticas para Mesas
DROP POLICY IF EXISTS "Lectura pública de mesas" ON public.tables;
CREATE POLICY "Lectura pública de mesas" ON public.tables
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Actualización pública de mesas" ON public.tables;
CREATE POLICY "Actualización pública de mesas" ON public.tables
  FOR UPDATE USING (true);

-- 4. Políticas para Pedidos
DROP POLICY IF EXISTS "Lectura pública de pedidos" ON public.orders;
CREATE POLICY "Lectura pública de pedidos" ON public.orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción pública de pedidos" ON public.orders;
CREATE POLICY "Inserción pública de pedidos" ON public.orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actualización pública de pedidos" ON public.orders;
CREATE POLICY "Actualización pública de pedidos" ON public.orders
  FOR UPDATE USING (true);
