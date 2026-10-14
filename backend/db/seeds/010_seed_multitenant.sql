INSERT INTO public.organizacion (id, nombre, slug, cuit, direccion, telefono)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Burger House', 'burger-house', '30-71234567-9', 'Av. Corrientes 1234, CABA', '+54 11 4000-1111'),
  ('a0000000-0000-4000-8000-000000000002', 'Cantina Nonna', 'cantina-nonna', '30-70987654-3', 'Belgrano 456, Rosario', '+54 341 500-2222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categoria (id, organizacion_id, nombre, orden)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Hamburguesas', 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Bebidas', 2),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Postres', 3),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'Pastas', 1),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'Bebidas', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.producto (id, organizacion_id, categoria_id, nombre, descripcion, precio, stock)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Burger clasica', 'Doble smash, cheddar y cebolla caramelizada', 1890.00, 40),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Papas a la piedra', 'Crocantes, con romero y sal de escamas', 950.00, 60),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Limonada casera', 'Limon natural, menta y jengibre', 780.00, 35),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Cheesecake de frutos rojos', 'Cremoso, con salsa de frutos rojos', 1200.00, 15),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', 'Sorrentinos de jamon y queso', 'Con salsa rosa o fileto', 2400.00, 25),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', 'Ñoquis del 29', 'Con estofado de la casa', 2100.00, 30),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'Vino de la casa', 'Malbec, copa', 1500.00, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mesa (id, organizacion_id, numero, capacidad, estado)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 4, 'ocupada'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 2, 2, 'libre'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 3, 6, 'libre'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 1, 4, 'ocupada'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 2, 4, 'reservada')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pedido (id, organizacion_id, mesa_id, estado, medio_pago)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'en_preparacion', 'efectivo'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'listo', 'tarjeta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pedido_item (pedido_id, producto_id, cantidad, precio_unitario)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 2, 1890.00),
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 2, 780.00),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', 1, 2400.00),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000007', 2, 1500.00)
ON CONFLICT (pedido_id, producto_id) DO NOTHING;

DO $$
DECLARE
  v_usuario UUID;
  v_asignacion RECORD;
BEGIN
  FOR v_asignacion IN
    SELECT * FROM (VALUES
      ('propietario@burger-house.test', 'a0000000-0000-4000-8000-000000000001'::UUID, 'propietario'),
      ('mozo@burger-house.test', 'a0000000-0000-4000-8000-000000000001'::UUID, 'mozo'),
      ('propietario@cantina-nonna.test', 'a0000000-0000-4000-8000-000000000002'::UUID, 'propietario')
    ) AS t(correo, organizacion_id, rol)
  LOOP
    SELECT id INTO v_usuario FROM auth.users WHERE email = v_asignacion.correo;

    IF v_usuario IS NULL THEN
      RAISE NOTICE 'Sin usuario % en auth.users: se omite la membresia', v_asignacion.correo;
    ELSE
      INSERT INTO public.usuario_organizacion (usuario_id, organizacion_id, rol)
      VALUES (v_usuario, v_asignacion.organizacion_id, v_asignacion.rol)
      ON CONFLICT (usuario_id, organizacion_id) DO UPDATE SET rol = EXCLUDED.rol;
    END IF;
  END LOOP;
END;
$$;
