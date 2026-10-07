-- Seed: 002_seed_tables.sql
-- Descripción: Carga de 12 mesas con mesas 4 y 7 ocupadas con pedidos activos

INSERT INTO public.tables (number, status, current_order)
VALUES
  (1, 'libre', NULL),
  (2, 'libre', NULL),
  (3, 'libre', NULL),
  (4, 'ocupada', '{"id": 104, "time": "20:14", "items": [{"name": "Burger clásica", "quantity": 1, "price": 1890}, {"name": "Papas a la piedra", "quantity": 1, "price": 950}], "total": 2840}'::jsonb),
  (5, 'libre', NULL),
  (6, 'libre', NULL),
  (7, 'ocupada', '{"id": 107, "time": "20:30", "items": [{"name": "Milanesa de pollo", "quantity": 1, "price": 1050}], "total": 1050}'::jsonb),
  (8, 'libre', NULL),
  (9, 'libre', NULL),
  (10, 'libre', NULL),
  (11, 'libre', NULL),
  (12, 'libre', NULL)
ON CONFLICT (number) DO UPDATE
  SET status = EXCLUDED.status,
      current_order = EXCLUDED.current_order;
