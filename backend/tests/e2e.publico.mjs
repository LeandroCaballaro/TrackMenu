// La carta que ve el cliente al escanear el QR: sin sesión, y sin filtrar
// nada que no vaya impreso en una carta.
//
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.publico.mjs

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

const main = async () => {
  if ((await api('GET', '/health')).status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  // Se necesita una sesión sólo para saber qué organización mirar después.
  const login = await api('POST', '/auth/login', {
    body: { email: process.env.EMAIL_ADMIN || 'e2e.admin@example.org', password: 'Prueba12345!' },
  });
  if (login.status !== 200) {
    console.error('No se pudo iniciar sesión para preparar la prueba:', login.json);
    process.exit(1);
  }
  const token = login.json.data.session.access_token;
  const orgId = login.json.data.organizacion_id;

  const propios = (await api('GET', '/productos?limite=100', { token })).json.data;
  const activos = propios.filter((p) => p.activo);
  const inactivo = propios.find((p) => !p.activo);

  // --- La carta, sin ningún token
  const carta = await api('GET', `/publico/carta/${orgId}`);
  ok(carta.status === 200, 'la carta se abre sin iniciar sesión');
  ok(carta.json.data.organizacion === login.json.data.organizacion_nombre,
    `muestra el nombre del negocio (${carta.json.data.organizacion})`);
  ok(carta.json.data.productos.length === activos.length,
    `trae los ${activos.length} productos activos`);

  if (inactivo) {
    ok(!carta.json.data.productos.some((p) => p.id === inactivo.id),
      'no muestra los productos inactivos');
  }

  // --- No se filtra nada más que la carta
  const campos = Object.keys(carta.json.data.productos[0]).sort();
  ok(JSON.stringify(campos) === JSON.stringify(['descripcion', 'id', 'imagen_url', 'nombre', 'precio']),
    `sólo expone lo que va en una carta: ${campos.join(', ')}`);

  // --- Errores
  ok((await api('GET', '/publico/carta/abc')).status === 404, 'id que no es UUID: 404');
  ok((await api('GET', `/publico/carta/${crypto.randomUUID()}`)).status === 404, 'organización inexistente: 404');

  // --- El resto sigue cerrado sin sesión
  for (const ruta of ['/productos', '/comandas', '/miembros', '/admin/ventas']) {
    ok((await api('GET', ruta)).status === 401, `${ruta} sigue pidiendo sesión`);
  }

  console.log(fallas === 0 ? '\nCarta pública sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
