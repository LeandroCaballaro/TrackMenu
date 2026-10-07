-- Seed: 003_seed_orders.sql
-- Descripción: Carga de pedidos de ejemplo

INSERT INTO public.orders (table_number, status, time, items, total)
VALUES
  (
    4,
    'en_preparacion',
    '20:14',
    '[{"id": 1, "name": "Burger clásica", "price": 1890, "quantity": 1}, {"id": 2, "name": "Papas a la piedra", "price": 950, "quantity": 1}]'::jsonb,
    2840.00
  ),
  (
    7,
    'en_preparacion',
    '20:30',
    '[{"id": 3, "name": "Milanesa de pollo", "price": 1050, "quantity": 1}]'::jsonb,
    1050.00
  );
