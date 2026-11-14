// Recorrido de las comandas por mesa: tomar pedidos en mesas distintas, sumar
// a una comanda abierta, cancelarla y que el cobro la cierre.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.comandas.mjs
//
// Deja la base como la encontró: cancela o cobra y anula lo que abre.

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

// Mesas altas, para no pisar nada que esté abierto de verdad.
const MESA_A = 101;
const MESA_B = 102;

const main = async () => {
  if ((await api('GET', '/health')).status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  const admin = await entrar(process.env.EMAIL_ADMIN || 'e2e.admin@example.org');
  const empleado = await entrar(process.env.EMAIL_EMPLEADO || 'e2e.empleado@example.org');
  const consulta = await entrar(process.env.EMAIL_CONSULTA || 'e2e.consulta@example.org');
  const otraOrg = await entrar(process.env.EMAIL_OTRA_ORG || 'e2e.otraorg@example.org');

  const productos = (await api('GET', '/productos?activo=true&limite=2', { token: admin })).json.data;
  if (productos.length < 2) {
    console.error('Hacen falta al menos dos productos activos: corré db/seeds/005_seed_demostracion.sql');
    process.exit(1);
  }
  const [p1, p2] = productos;
  const abiertasAlEmpezar = (await api('GET', '/comandas', { token: admin })).json.total;

  // --- Permisos
  ok((await api('GET', '/comandas')).status === 401, 'sin token no se ven las comandas');
  ok((await api('GET', '/comandas', { token: consulta })).status === 200, 'el rol consulta ve el mapa de mesas');
  ok((await api('POST', '/comandas', { token: consulta, body: { mesa_numero: MESA_A, items: [{ producto_id: p1.id, cantidad: 1 }] } })).status === 403,
    'el rol consulta no puede tomar pedidos');

  // --- Validación
  const vacio = await api('POST', '/comandas', { token: empleado, body: {} });
  ok(vacio.status === 400 && vacio.json.errors?.mesa_numero && vacio.json.errors?.items,
    'pedido sin datos: 400 con el detalle por campo');
  ok((await api('POST', '/comandas', { token: empleado, body: { mesa_numero: 0, items: [{ producto_id: p1.id, cantidad: 1 }] } })).status === 400,
    'mesa 0: 400');
  ok((await api('POST', '/comandas', { token: empleado, body: { mesa_numero: MESA_A, items: [{ producto_id: p1.id, cantidad: 0 }] } })).status === 400,
    'cantidad 0: 400');
  ok((await api('POST', '/comandas', { token: empleado, body: { mesa_numero: MESA_A, items: [{ producto_id: crypto.randomUUID(), cantidad: 1 }] } })).status === 404,
    'producto inexistente: 404');
  ok((await api('POST', '/comandas', { token: otraOrg, body: { mesa_numero: MESA_A, items: [{ producto_id: p1.id, cantidad: 1 }] } })).status === 404,
    'productos de otra organización: 404');

  // --- Dos mesas en paralelo
  ok((await api('POST', '/comandas', { token: empleado, body: { mesa_numero: MESA_A, items: [{ producto_id: p1.id, cantidad: 2 }] } })).status === 201,
    `pedido enviado a la mesa ${MESA_A}`);
  ok((await api('POST', '/comandas', { token: empleado, body: { mesa_numero: MESA_B, items: [{ producto_id: p2.id, cantidad: 1 }] } })).status === 201,
    `pedido enviado a la mesa ${MESA_B}`);

  const abiertas = await api('GET', '/comandas', { token: empleado });
  ok(abiertas.json.total === abiertasAlEmpezar + 2, 'las dos mesas quedan abiertas a la vez');

  const comandaA = abiertas.json.data.find((c) => c.mesa_numero === MESA_A);
  ok(Number(comandaA.total) === Number(p1.precio) * 2, `el total sale de los precios de la base ($${comandaA.total})`);

  // --- Un segundo pedido a la misma mesa se suma
  await api('POST', '/comandas', { token: empleado, body: { mesa_numero: MESA_A, items: [{ producto_id: p1.id, cantidad: 1 }] } });
  const trasSumar = (await api('GET', '/comandas', { token: empleado })).json;
  const comandaAhora = trasSumar.data.find((c) => c.mesa_numero === MESA_A);
  ok(trasSumar.total === abiertasAlEmpezar + 2, 'no se abre una segunda comanda para la misma mesa');
  ok(comandaAhora.items.find((i) => i.producto_id === p1.id).cantidad === 3, 'las cantidades se suman a la comanda abierta');

  ok((await api('GET', '/comandas', { token: otraOrg })).json.data.every((c) => ![MESA_A, MESA_B].includes(c.mesa_numero)),
    'la otra organización no ve estas comandas');

  // --- Cobrar cierra la comanda de esa mesa
  const cobro = await api('POST', '/ventas', {
    token: empleado,
    body: { mesa_numero: MESA_A, metodo_pago: 'efectivo', items: comandaAhora.items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })) },
  });
  ok(cobro.status === 201, `cobro de la mesa ${MESA_A}: ${cobro.json.message}`);
  const trasCobrar = (await api('GET', '/comandas', { token: empleado })).json;
  ok(!trasCobrar.data.some((c) => c.mesa_numero === MESA_A), 'la mesa cobrada queda libre');
  ok(trasCobrar.data.some((c) => c.mesa_numero === MESA_B), 'la otra mesa sigue abierta');

  // --- Cancelar
  const comandaB = trasCobrar.data.find((c) => c.mesa_numero === MESA_B);
  ok((await api('DELETE', '/comandas/abc', { token: empleado })).status === 404, 'id que no es UUID: 404');
  ok((await api('DELETE', `/comandas/${comandaB.id}`, { token: consulta })).status === 403, 'el rol consulta no cancela');
  ok((await api('DELETE', `/comandas/${comandaB.id}`, { token: empleado })).status === 200, 'la comanda se cancela');
  ok((await api('DELETE', `/comandas/${comandaB.id}`, { token: empleado })).status === 404, 'no se puede cancelar dos veces');

  const final = (await api('GET', '/comandas', { token: admin })).json;
  ok(final.total === abiertasAlEmpezar, `la limpieza deja ${abiertasAlEmpezar} comanda(s) abiertas, como al empezar`);

  // Se anula la venta de prueba para no ensuciar la facturación.
  await api('POST', `/admin/ventas/${cobro.json.data.id}/anular`, { token: admin, body: { motivo: 'prueba automatizada de comandas' } });

  console.log(fallas === 0 ? '\nComandas por mesa sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
