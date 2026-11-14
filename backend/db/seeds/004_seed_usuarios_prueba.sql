-- Seed SÓLO para pruebas: cuentas de los tres roles en dos organizaciones.
-- Se crean confirmadas y sin mandar emails, para no depender de la
-- confirmación por correo ni del límite de mails del plan free.
-- Contraseña de todas: Prueba12345!
--
-- No ejecutar en producción. Para borrarlas:
--   DELETE FROM auth.users WHERE email LIKE 'e2e.%@example.org';

DO $$
DECLARE
  org_a UUID;
  org_b UUID;
  uid UUID;
  cuenta RECORD;
BEGIN
  -- Organizaciones (idempotente por nombre)
  SELECT id INTO org_a FROM public.organizaciones WHERE nombre = 'Negocio A de prueba';
  IF org_a IS NULL THEN
    INSERT INTO public.organizaciones (nombre) VALUES ('Negocio A de prueba') RETURNING id INTO org_a;
  END IF;

  SELECT id INTO org_b FROM public.organizaciones WHERE nombre = 'Negocio B de prueba';
  IF org_b IS NULL THEN
    INSERT INTO public.organizaciones (nombre) VALUES ('Negocio B de prueba') RETURNING id INTO org_b;
  END IF;

  FOR cuenta IN
    SELECT * FROM (VALUES
      ('e2e.admin@example.org',    'admin',    'a'),
      ('e2e.empleado@example.org', 'empleado', 'a'),
      ('e2e.consulta@example.org', 'consulta', 'a'),
      ('e2e.otraorg@example.org',  'admin',    'b')
    ) AS t(email, rol, org)
  LOOP
    SELECT id INTO uid FROM auth.users WHERE email = cuenta.email;

    IF uid IS NULL THEN
      uid := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        cuenta.email, extensions.crypt('Prueba12345!', extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', cuenta.email)
      );

      INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', cuenta.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;

    -- GoTrue lee estas columnas como texto no nulo: con NULL el login falla
    -- con "Database error querying schema".
    UPDATE auth.users SET
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
    WHERE id = uid;

    INSERT INTO public.miembros (usuario_id, organizacion_id, rol)
    VALUES (uid, CASE WHEN cuenta.org = 'a' THEN org_a ELSE org_b END, cuenta.rol)
    ON CONFLICT (usuario_id) DO UPDATE
      SET organizacion_id = EXCLUDED.organizacion_id, rol = EXCLUDED.rol;
  END LOOP;
END $$;
