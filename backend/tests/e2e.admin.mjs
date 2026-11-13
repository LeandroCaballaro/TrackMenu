// Recorrido del módulo de administración: permisos por rol, filtros, y los
// casos que tienen que fallar. Cubre los errores encontrados rompiendo la API.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.admin.mjs
//
// Usa las cuentas de db/seeds/004_seed_usuarios_prueba.sql.

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

const entrar = async (email) => {
  const r = await api('POST', '/auth/login', { body: { email, password: 'Prueba12345!' } });
  if (r.status !== 200) {
    console.error(`No se pudo iniciar sesión con ${email}:`, r.status, r.json);
    process.exit(1);
  }
  return r.json.data.session.access_token;
};

const main = async () => {
  if ((await api('GET', '/health')).status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  const admin = await entrar(process.env.EMAIL_ADMIN || 'e2e.admin@example.org');
  const empleado = await entrar(process.env.EMAIL_EMPLEADO || 'e2e.empleado@example.org');
  const consulta = await entrar(process.env.EMAIL_CONSULTA || 'e2e.consulta@example.org');
  const otraOrg = await entrar(process.env.EMAIL_OTRA_ORG || 'e2e.otraorg@example.org');

  // --- Sólo el admin entra al módulo
  for (const [rol, token] of [['empleado', empleado], ['consulta', consulta]]) {
    for (const ruta of ['/admin/dashboard/kpis', '/admin/ventas', '/admin/auditoria', '/admin/usuarios']) {
      ok((await api('GET', ruta, { token })).status === 403, `${rol} no entra a ${ruta}`);
    }
  }
  ok((await api('GET', '/admin/ventas')).status === 401, 'sin token: 401');

  // --- Lo que el admin sí puede
  ok((await api('GET', '/admin/dashboard/kpis', { token: admin })).status === 200, 'el admin ve los KPIs');
  const equipo = await api('GET', '/miembros', { token: admin });
  const yo = equipo.json.data.find((m) => m.soy_yo).usuario_id;
  const otro = equipo.json.data.find((m) => !m.soy_yo);

  // --- Cambios de rol: lo que antes devolvía un éxito falso
  const inexistente = await api('POST', '/admin/usuarios/rol', {
    token: admin,
    body: { usuario_id: '00000000-0000-0000-0000-000000000000', nuevo_rol: 'admin' },
  });
  ok(inexistente.status === 404, 'cambiar el rol de un usuario inexistente: 404, no un éxito falso');

  ok((await api('POST', '/admin/usuarios/rol', { token: admin, body: { usuario_id: 'abc', nuevo_rol: 'admin' } })).status === 404,
    'id que no es UUID: 404, no el error crudo de Postgres');

  ok((await api('POST', '/admin/usuarios/rol', { token: otraOrg, body: { usuario_id: otro.usuario_id, nuevo_rol: 'admin' } })).status === 404,
    'un admin de otra organización no puede tocar este equipo');

  ok((await api('POST', '/admin/usuarios/rol', { token: admin, body: { usuario_id: yo, nuevo_rol: 'empleado' } })).status === 400,
    'el admin no puede revocarse su propio rol');

  ok((await api('POST', '/admin/usuarios/rol', { token: admin, body: { usuario_id: otro.usuario_id, nuevo_rol: 'jefe' } })).status === 400,
    'rol inexistente: 400');

  // --- La auditoría no registra lo que no pasó
  const auditoriaAntes = (await api('GET', '/admin/auditoria', { token: admin })).json.total;
  await api('POST', '/admin/usuarios/rol', {
    token: admin,
    body: { usuario_id: '00000000-0000-0000-0000-000000000000', nuevo_rol: 'admin' },
  });
  const auditoriaDespues = (await api('GET', '/admin/auditoria', { token: admin })).json.total;
  ok(auditoriaAntes === auditoriaDespues, 'un cambio que falla no deja registro de auditoría');

  // --- Un cambio real sí queda registrado, y se deja todo como estaba
  const cambio = await api('POST', '/admin/usuarios/rol', { token: admin, body: { usuario_id: otro.usuario_id, nuevo_rol: 'empleado' } });
  ok(cambio.status === 200, `cambio de rol real: ${cambio.json.message}`);
  const auditoriaFinal = (await api('GET', '/admin/auditoria', { token: admin })).json.total;
  ok(auditoriaFinal === auditoriaAntes + 1, 'el cambio real sí queda en la auditoría');
  // Se restaura por /api/miembros: /admin/usuarios/rol sólo acepta admin y
  // empleado, así que no puede devolver a alguien a 'consulta'.
  const restaurado = await api('PATCH', `/miembros/${otro.usuario_id}`, { token: admin, body: { rol: otro.rol } });
  ok(restaurado.status === 200 && restaurado.json.data.rol === otro.rol,
    `el rol queda como estaba (${otro.rol})`);

  // --- Filtros y paginado
  ok((await api('GET', '/admin/ventas?limite=-5', { token: admin })).status === 200, 'límite negativo: se acota, no revienta');
  ok((await api('GET', '/admin/ventas?pagina=9999', { token: admin })).status === 200, 'página fuera de rango: página vacía');
  const fechaMal = await api('GET', '/admin/ventas?desde=noesunafecha', { token: admin });
  ok(fechaMal.status === 400 && fechaMal.json.errors?.desde, 'fecha inválida: 400 con el detalle del campo');

  const auditoriaLimitada = await api('GET', '/admin/auditoria?limite=1', { token: admin });
  ok(auditoriaLimitada.json.data.length <= 1, 'la auditoría respeta el límite');
  ok((await api('GET', '/admin/auditoria?accion=inventada', { token: admin })).status === 400, 'acción de auditoría inexistente: 400');

  // --- Anulación de ventas
  ok((await api('POST', '/admin/ventas/abc/anular', { token: admin, body: { motivo: 'una prueba' } })).status === 404,
    'anular con un id que no es UUID: 404');
  ok((await api('POST', `/admin/ventas/${crypto.randomUUID()}/anular`, { token: admin, body: { motivo: 'una prueba' } })).status === 404,
    'anular una venta inexistente: 404');
  ok((await api('POST', `/admin/ventas/${crypto.randomUUID()}/anular`, { token: admin, body: {} })).status === 400,
    'anular sin motivo: 400');

  // --- Alta de usuarios
  ok((await api('POST', '/admin/usuarios', { token: admin, body: {} })).status === 400, 'alta sin datos: 400');
  ok((await api('POST', '/admin/usuarios', { token: admin, body: { nombre: 'A', email: 'sin-arroba', password: 'Prueba12345!' } })).status === 400,
    'email mal formado: 400');
  ok((await api('POST', '/admin/usuarios', { token: admin, body: { nombre: 'Ana', email: 'ana@ejemplo.com', password: 'corta' } })).status === 400,
    'contraseña corta: 400');
  ok((await api('POST', '/admin/usuarios', { token: empleado, body: { nombre: 'Ana', email: 'ana@ejemplo.com', password: 'Prueba12345!' } })).status === 403,
    'un empleado no puede crear usuarios');

  console.log(fallas === 0 ? '\nMódulo de administración sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
