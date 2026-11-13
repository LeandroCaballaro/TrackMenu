-- Datos ficticios para la demo (punto 12 de la etapa final).
-- Carga un menú completo en "Negocio A de prueba" y uno distinto en
-- "Negocio B de prueba", para mostrar en vivo que cada organización ve lo suyo.
-- Requiere haber corrido antes 004_seed_usuarios_prueba.sql.
--
-- Es idempotente: vuelve a dejar exactamente este menú cada vez que se corre.

DO $$
DECLARE
  org_a UUID;
  org_b UUID;
  admin_a UUID;
  admin_b UUID;
BEGIN
  SELECT id INTO org_a FROM public.organizaciones WHERE nombre = 'Negocio A de prueba';
  SELECT id INTO org_b FROM public.organizaciones WHERE nombre = 'Negocio B de prueba';

  IF org_a IS NULL OR org_b IS NULL THEN
    RAISE EXCEPTION 'Faltan las organizaciones de prueba: corré antes 004_seed_usuarios_prueba.sql';
  END IF;

  SELECT id INTO admin_a FROM auth.users WHERE email = 'e2e.admin@example.org';
  SELECT id INTO admin_b FROM auth.users WHERE email = 'e2e.otraorg@example.org';

  DELETE FROM public.productos WHERE organizacion_id IN (org_a, org_b);

  INSERT INTO public.productos (organizacion_id, usuario_id, nombre, descripcion, precio, stock, activo)
  VALUES
    (org_a, admin_a, 'Burger clásica',      'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.', 1890, 25, TRUE),
    (org_a, admin_a, 'Papas a la piedra',   'Crocantes por fuera, suaves por dentro, con romero.',             950, 40, TRUE),
    (org_a, admin_a, 'Milanesa de pollo',   'Rebozada crocante con limón y ensalada fresca.',                 1050, 18, TRUE),
    (org_a, admin_a, 'Provoleta',           'A la parrilla, con orégano y aceite de oliva.',                  1400, 12, TRUE),
    (org_a, admin_a, 'Limonada casera',     'Limón natural, menta y un toque de jengibre.',                    780, 60, TRUE),
    (org_a, admin_a, 'Cerveza artesanal',   'Rubia de la casa, pinta de 500 ml.',                             1600, 30, TRUE),
    (org_a, admin_a, 'Cheesecake',          'Cremoso, con salsa de frutos rojos.',                            1200,  9, TRUE),
    (org_a, admin_a, 'Flan casero',         'Con dulce de leche y crema.',                                     900, 10, TRUE),
    (org_a, admin_a, 'Helado artesanal',    'Dos bochas a elección.',                                          850,  0, FALSE),
    (org_a, admin_a, 'Tarta de verdura',    'Masa casera, acelga y salsa blanca.',                            1100,  6, TRUE),
    (org_b, admin_b, 'Café con leche',      'En taza grande, con medialuna.',                                  700, 50, TRUE),
    (org_b, admin_b, 'Tostado de jamón y queso', 'En pan de campo, con manteca.',                              980, 20, TRUE),
    (org_b, admin_b, 'Medialunas (3)',      'De manteca, recién horneadas.',                                   650, 35, TRUE),
    (org_b, admin_b, 'Exprimido de naranja','Natural, medio litro.',                                           820, 15, TRUE),
    (org_b, admin_b, 'Budín de limón',      'Con glaseado.',                                                   600,  8, TRUE);
END $$;
