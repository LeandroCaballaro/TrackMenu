// Recorrido de gestión de usuarios: invitar, aceptar, cambiar rol y dar de
// baja, más los intentos que tienen que fallar.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.miembros.mjs
//
// Usa las cuentas de db/seeds/004_seed_usuarios_prueba.sql. El usuario invitado
// se crea y se borra solo, salvo que falte el PAT de Supabase: en ese caso esa
// parte se omite y se avisa.

const API = process.env.API_URL || 'http://localhost:3000/api';
let fallas = 0;

const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✖'} ${msg}`);
  if (!cond) fallas++;
};

const api = async (metodo, ruta, { token, body } = {}) => {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const entrar = async (email, password = 'Prueba12345!') => {
  const r = await api('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) {
    console.error(`No se pudo iniciar sesión con ${email}:`, r.status, r.json);
    process.exit(1);
  }
  return r.json.data.session.access_token;
};

const CUENTAS = {
  admin: process.env.EMAIL_ADMIN || 'e2e.admin@example.org',
  empleado: process.env.EMAIL_EMPLEADO || 'e2e.empleado@example.org',
  consulta: process.env.EMAIL_CONSULTA || 'e2e.consulta@example.org',
};

const main = async () => {
  if ((await api('GET', '/health')).status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  const admin = await entrar(CUENTAS.admin);
  const empleado = await entrar(CUENTAS.empleado);
  const consulta = await entrar(CUENTAS.consulta);

  // --- Ver el equipo
  const equipo = await api('GET', '/miembros', { token: admin });
  ok(equipo.status === 200 && equipo.json.total >= 3, `el admin ve el equipo (${equipo.json.total} miembros)`);
  ok(equipo.json.data.filter((m) => m.soy_yo).length === 1, 'se marca cuál de los miembros soy yo');
  ok((await api('GET', '/miembros', { token: consulta })).status === 200, 'el rol consulta también puede ver el equipo');

  const yo = equipo.json.data.find((m) => m.soy_yo).usuario_id;
  const elConsulta = equipo.json.data.find((m) => m.rol === 'consulta' && !m.soy_yo).usuario_id;

  // --- Invitaciones: sólo el admin
  ok((await api('POST', '/invitaciones', { token: consulta, body: { rol: 'admin' } })).status === 403,
    'el rol consulta no puede invitar');
  ok((await api('POST', '/invitaciones', { token: empleado, body: { rol: 'admin' } })).status === 403,
    'el rol empleado no puede invitar');
  ok((await api('GET', '/invitaciones', { token: empleado })).status === 403,
    'el rol empleado no puede ver las invitaciones');

  const rolMal = await api('POST', '/invitaciones', { token: admin, body: { rol: 'jefe' } });
  ok(rolMal.status === 400 && rolMal.json.errors?.rol, 'rol inválido en la invitación: 400 con el detalle');
  const mailMal = await api('POST', '/invitaciones', { token: admin, body: { rol: 'empleado', email: 'no-es-mail' } });
  ok(mailMal.status === 400 && mailMal.json.errors?.email, 'email inválido en la invitación: 400 con el detalle');

  const invitacion = await api('POST', '/invitaciones', { token: admin, body: { rol: 'empleado' } });
  ok(invitacion.status === 201 && invitacion.json.data.codigo, `invitación creada: ${invitacion.json.message}`);
  const codigo = invitacion.json.data.codigo;

  ok((await api('GET', '/invitaciones', { token: admin })).json.data.some((i) => i.codigo === codigo),
    'la invitación aparece en el listado del admin');

  // --- Cambios de rol
  ok((await api('PATCH', `/miembros/${elConsulta}`, { token: empleado, body: { rol: 'admin' } })).status === 403,
    'el rol empleado no puede cambiar roles');
  ok((await api('PATCH', `/miembros/${yo}`, { token: admin, body: { rol: 'consulta' } })).status === 403,
    'el admin no puede cambiar su propio rol');
  ok((await api('DELETE', `/miembros/${yo}`, { token: admin })).status === 403,
    'el admin no puede darse de baja a sí mismo');
  ok((await api('PATCH', `/miembros/${elConsulta}`, { token: admin, body: { rol: 'jefe' } })).status === 400,
    'rol inexistente: 400');
  ok((await api('PATCH', '/miembros/abc', { token: admin, body: { rol: 'admin' } })).status === 404,
    'id que no es UUID: 404');
  ok((await api('PATCH', `/miembros/${crypto.randomUUID()}`, { token: admin, body: { rol: 'admin' } })).status === 404,
    'usuario que no es de mi organización: 404');

  const subida = await api('PATCH', `/miembros/${elConsulta}`, { token: admin, body: { rol: 'empleado' } });
  ok(subida.status === 200 && subida.json.data.rol === 'empleado', `cambio de rol OK: ${subida.json.message}`);
  // y lo dejo como estaba
  await api('PATCH', `/miembros/${elConsulta}`, { token: admin, body: { rol: 'consulta' } });

  // --- Alta de un invitado (necesita poder crear un usuario de prueba)
  const invitado = process.env.EMAIL_INVITADO;
  if (invitado) {
    const token = await entrar(invitado);
    ok((await api('GET', '/productos', { token })).status === 403,
      'sin organización no se entra a los productos');
    ok((await api('POST', '/auth/aceptar-invitacion', { token, body: {} })).status === 400,
      'aceptar sin código: 400');
    ok((await api('POST', '/auth/aceptar-invitacion', { token, body: { codigo: 'noexiste' } })).status === 400,
      'código inexistente: 400');

    const aceptada = await api('POST', '/auth/aceptar-invitacion', { token, body: { codigo } });
    ok(aceptada.status === 200 && aceptada.json.data.rol === 'empleado',
      `el invitado se suma con el rol de la invitación: ${aceptada.json.data.rol}`);
    ok((await api('POST', '/auth/aceptar-invitacion', { token, body: { codigo } })).status === 400,
      'el código no se puede reusar');

    const nuevoToken = await entrar(invitado);
    ok((await api('GET', '/productos', { token: nuevoToken })).status === 200,
      'ahora el invitado ve los productos de la organización');

    // baja del invitado (su id sale de su propia sesión, no de adivinar en la lista)
    const suId = (await api('GET', '/auth/me', { token: nuevoToken })).json.data.id;
    const baja = await api('DELETE', `/miembros/${suId}`, { token: admin });
    ok(baja.status === 200, `baja del miembro OK: ${baja.json.message}`);
    ok((await api('GET', '/productos', { token: nuevoToken })).status === 403,
      'dado de baja, deja de ver los productos');
  } else {
    console.log('… alta de un invitado omitida (definí EMAIL_INVITADO con una cuenta sin organización)');
    const revocada = await api('DELETE', `/invitaciones/${invitacion.json.data.id}`, { token: admin });
    ok(revocada.status === 200, `invitación revocada: ${revocada.json.message}`);
  }

  console.log(fallas === 0 ? '\nGestión de usuarios sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
