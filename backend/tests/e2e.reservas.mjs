// Reservas con seña y plano del salón: lo que el frontend guardaba en el
// localStorage del navegador.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.reservas.mjs
//
// Deja la base como la encontró: cancela las reservas que crea.

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

const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
// Mesas altas, para no pisar reservas reales.
const MESA = 201;

const main = async () => {
  if ((await api('GET', '/health')).status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  const admin = await entrar(process.env.EMAIL_ADMIN || 'e2e.admin@example.org');
  const empleado = await entrar(process.env.EMAIL_EMPLEADO || 'e2e.empleado@example.org');
  const consulta = await entrar(process.env.EMAIL_CONSULTA || 'e2e.consulta@example.org');
  const otraOrg = await entrar(process.env.EMAIL_OTRA_ORG || 'e2e.otraorg@example.org');

  const reserva = {
    fecha: manana, hora: '21:30', personas: 4, mesa_numero: MESA, mesa_capacidad: 4,
    nombre_cliente: 'Prueba automatizada', telefono: '1155550000', sena_pagada: true,
  };

  // --- Permisos
  ok((await api('GET', '/reservas')).status === 401, 'sin token no se ve la agenda');
  ok((await api('GET', '/reservas', { token: consulta })).status === 200, 'el rol consulta ve la agenda');
  ok((await api('POST', '/reservas', { token: consulta, body: reserva })).status === 403,
    'el rol consulta no puede tomar reservas');

  // --- Validación
  const vacia = await api('POST', '/reservas', { token: empleado, body: {} });
  ok(vacia.status === 400 && vacia.json.errors?.fecha && vacia.json.errors?.hora,
    'reserva sin datos: 400 con el detalle por campo');
  ok((await api('POST', '/reservas', { token: empleado, body: { ...reserva, fecha: '2020-01-01' } })).status === 400,
    'fecha que ya pasó: 400');
  ok((await api('POST', '/reservas', { token: empleado, body: { ...reserva, hora: '25:99' } })).status === 400,
    'hora inexistente: 400');
  const sinSena = await api('POST', '/reservas', { token: empleado, body: { ...reserva, sena_pagada: false } });
  ok(sinSena.status === 400 && sinSena.json.errors?.sena_pagada, 'sin la seña paga no se confirma');
  ok((await api('POST', '/reservas', { token: empleado, body: { ...reserva, personas: 8 } })).status === 409,
    'más personas que la capacidad de la mesa: 409');
  ok((await api('GET', '/reservas?fecha=noesunafecha', { token: empleado })).status === 400, 'fecha de filtro inválida: 400');

  // --- Reserva real
  const creada = await api('POST', '/reservas', { token: empleado, body: reserva });
  ok(creada.status === 201 && creada.json.data.codigo_confirmacion, `reserva confirmada: ${creada.json.message}`);
  ok(Number(creada.json.data.sena_monto) === reserva.personas * 2000,
    `la seña se calcula por persona ($${creada.json.data.sena_monto})`);
  const { id, codigo_confirmacion: codigo } = creada.json.data;

  ok((await api('POST', '/reservas', { token: empleado, body: { ...reserva, nombre_cliente: 'Otro' } })).status === 409,
    'la misma mesa en el mismo turno: 409, no hay doble reserva');

  ok((await api('GET', `/reservas?fecha=${manana}`, { token: empleado })).json.data.some((r) => r.id === id),
    'aparece al filtrar por su fecha');
  ok((await api('GET', '/reservas', { token: otraOrg })).json.data.every((r) => r.id !== id),
    'la otra organización no ve esta reserva');

  // --- El cliente la consulta con su código, sin sesión
  const publica = await api('GET', `/publico/reserva/${codigo}`);
  ok(publica.status === 200 && publica.json.data.codigo_confirmacion === codigo, 'el código abre la reserva sin sesión');
  ok(publica.json.data.telefono === undefined && publica.json.data.notas === undefined,
    'la consulta pública no expone el teléfono ni las notas internas');
  ok((await api('GET', `/publico/reserva/${codigo.toLowerCase()}`)).status === 200, 'el código no distingue mayúsculas');
  ok((await api('GET', '/publico/reserva/ZZZZZZZZ')).status === 404, 'un código que no existe: 404');

  // --- Asistencia
  ok((await api('PATCH', '/reservas/abc/asistencia', { token: empleado })).status === 404, 'id que no es UUID: 404');
  const asistio = await api('PATCH', `/reservas/${id}/asistencia`, { token: empleado });
  ok(asistio.status === 200 && asistio.json.data.estado === 'cumplida', `asistencia confirmada: ${asistio.json.message}`);
  ok((await api('PATCH', `/reservas/${id}/asistencia`, { token: empleado })).status === 404,
    'no se confirma dos veces la misma reserva');

  // La mesa vuelve a estar libre para ese turno una vez cerrada la reserva.
  const reusa = await api('POST', '/reservas', { token: empleado, body: { ...reserva, nombre_cliente: 'Segundo turno' } });
  ok(reusa.status === 201, 'cerrada la anterior, la mesa se puede volver a reservar');
  await api('DELETE', `/reservas/${reusa.json.data.id}`, { token: empleado });

  // --- Plano del salón
  const plano = {
    formaLocal: 'rectangular',
    mesas: [{ numero: 1, capacidad: 4, x: 10, y: 20 }, { numero: 2, capacidad: 2, x: 40, y: 20 }],
    caja: { x: 12, y: 15 },
    entrada: { x: 45, y: 96 },
  };
  ok((await api('PUT', '/mapa', { token: empleado, body: { config: plano } })).status === 403,
    'el empleado no dibuja el salón');
  ok((await api('PUT', '/mapa', { token: admin, body: { config: { mesas: [] } } })).status === 400,
    'un plano sin mesas: 400');
  ok((await api('PUT', '/mapa', { token: admin, body: { config: { mesas: [{ numero: 1 }, { numero: 1 }] } } })).status === 400,
    'números de mesa repetidos: 400');

  const guardado = await api('PUT', '/mapa', { token: admin, body: { config: plano } });
  ok(guardado.status === 200, `el admin guarda el plano: ${guardado.json.message}`);
  const leido = await api('GET', '/mapa', { token: consulta });
  ok(leido.status === 200 && leido.json.data.mesas.length === 2, 'todo el equipo lee el plano guardado');
  ok((await api('GET', '/mapa', { token: otraOrg })).json.data?.mesas?.length !== 2 ||
     JSON.stringify((await api('GET', '/mapa', { token: otraOrg })).json.data) !== JSON.stringify(plano),
    'la otra organización tiene su propio plano');

  console.log(fallas === 0 ? '\nReservas y plano sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
