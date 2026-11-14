// Recorrido del cobro de mesa: cobrar, descontar stock, ver el ticket, anular
// y que el stock vuelva. Cubre los errores encontrados probando la pantalla.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.ventas.mjs
//
// Deja la base como la encontró: anula su propia venta y repone el stock.

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

  const productos = (await api('GET', '/productos?activo=true&limite=2', { token: admin })).json.data;
  if (productos.length < 2) {
    console.error('Hacen falta al menos dos productos activos: corré db/seeds/005_seed_demostracion.sql');
    process.exit(1);
  }
  const [p1, p2] = productos;
  const stockInicial = { [p1.id]: p1.stock, [p2.id]: p2.stock };

  const comanda = { mesa_numero: 7, metodo_pago: 'tarjeta', items: [{ producto_id: p1.id, cantidad: 2 }, { producto_id: p2.id, cantidad: 1 }] };

  // --- Permisos
  ok((await api('POST', '/ventas', { body: comanda })).status === 401, 'sin token no se puede cobrar');
  ok((await api('POST', '/ventas', { token: consulta, body: comanda })).status === 403, 'el rol consulta no puede cobrar');

  // --- Validación
  const vacio = await api('POST', '/ventas', { token: empleado, body: {} });
  ok(vacio.status === 400 && vacio.json.errors?.mesa_numero && vacio.json.errors?.metodo_pago,
    'cobro sin datos: 400 con el detalle por campo');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, metodo_pago: 'bitcoin' } })).status === 400,
    'método de pago inexistente: 400');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, mesa_numero: 0 } })).status === 400,
    'mesa 0: 400');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, items: [] } })).status === 400,
    'comanda vacía: 400');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, items: [{ producto_id: p1.id, cantidad: -1 }] } })).status === 400,
    'cantidad negativa: 400');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, items: [{ producto_id: crypto.randomUUID(), cantidad: 1 }] } })).status === 404,
    'producto que no existe: 404');
  ok((await api('POST', '/ventas', { token: otraOrg, body: comanda })).status === 404,
    'productos de otra organización: 404');
  ok((await api('POST', '/ventas', { token: empleado, body: { ...comanda, items: [{ producto_id: p1.id, cantidad: 999 }] } })).status === 409,
    'sin stock suficiente: 409');

  // --- Cobro real (lo hace el empleado, que es quien cobra)
  const cobro = await api('POST', '/ventas', { token: empleado, body: comanda });
  const esperado = Number(p1.precio) * 2 + Number(p2.precio);
  ok(cobro.status === 201 && Number(cobro.json.data.total) === esperado,
    `cobro OK: $${cobro.json.data?.total} (esperado $${esperado})`);
  ok(!cobro.json.avisos, 'el cobro no deja avisos de stock sin descontar');
  const ventaId = cobro.json.data.id;

  const tras = (await api('GET', '/productos?limite=100', { token: admin })).json.data;
  ok(tras.find((p) => p.id === p1.id).stock === stockInicial[p1.id] - 2, 'descuenta 2 unidades del primer producto');
  ok(tras.find((p) => p.id === p2.id).stock === stockInicial[p2.id] - 1, 'descuenta 1 unidad del segundo');

  const historial = await api('GET', '/admin/ventas', { token: admin });
  const enHistorial = historial.json.data.find((v) => v.id === ventaId);
  ok(enHistorial && enHistorial.detalle_ventas.length === 2, 'el ticket aparece en el historial con sus dos líneas');
  ok((await api('GET', '/admin/ventas', { token: otraOrg })).json.data.every((v) => v.id !== ventaId),
    'la otra organización no ve este ticket');

  const kpis = (await api('GET', '/admin/dashboard/kpis', { token: admin })).json.data;
  ok(kpis.facturacionTotal >= esperado, `la facturación del día incluye el ticket ($${kpis.facturacionTotal})`);

  // --- Anulación
  ok((await api('POST', `/admin/ventas/${ventaId}/anular`, { token: empleado, body: { motivo: 'una prueba' } })).status === 403,
    'el empleado no puede anular');
  const anulada = await api('POST', `/admin/ventas/${ventaId}/anular`, { token: admin, body: { motivo: 'prueba automatizada' } });
  ok(anulada.status === 200, `anulación OK: ${anulada.json.message}`);
  ok((await api('POST', `/admin/ventas/${ventaId}/anular`, { token: admin, body: { motivo: 'prueba automatizada' } })).status === 400,
    'no se puede anular dos veces');

  const repuesto = (await api('GET', '/productos?limite=100', { token: admin })).json.data;
  ok(repuesto.find((p) => p.id === p1.id).stock === stockInicial[p1.id], 'la anulación repone el stock del primer producto');
  ok(repuesto.find((p) => p.id === p2.id).stock === stockInicial[p2.id], 'y el del segundo');

  const auditoria = (await api('GET', '/admin/auditoria?accion=anulacion_ticket', { token: admin })).json.data;
  ok(auditoria.some((a) => a.detalles?.venta_id === ventaId), 'la anulación queda registrada en la auditoría');

  console.log(fallas === 0 ? '\nCobro de mesas sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
