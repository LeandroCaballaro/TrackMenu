// Recorrido completo con datos ficticios contra la API corriendo.
//   1) npm run dev   (en otra terminal, con backend/.env configurado)
//   2) node tests/e2e.productos.mjs
//
// Crea dos usuarios nuevos (cada uno admin de su propia organización) y
// verifica: alta, consulta, búsqueda, orden, modificación, baja con
// confirmación, errores de validación, aislamiento entre organizaciones y
// bloqueo sin sesión.
//
// Para probar los roles empleado/consulta, en el SQL Editor de Supabase:
//   UPDATE public.miembros SET rol = 'consulta' WHERE usuario_id = '<uuid>';
// y volver a correr con ROL_ESPERADO=consulta (ver el final del archivo).

const API = process.env.API_URL || 'http://localhost:3000/api';
const sello = Date.now();
let fallas = 0;

const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✖'} ${msg}`);
  if (!cond) fallas++;
};

const api = async (metodo, ruta, { token, body } = {}) => {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// Con EMAIL_A/PASSWORD_A y EMAIL_B/PASSWORD_B en el entorno usa cuentas ya
// creadas (sirve cuando Supabase exige confirmar el email); si no, registra dos
// cuentas nuevas.
const registrar = async (etiqueta) => {
  const sufijo = etiqueta.toUpperCase();
  const email = process.env[`EMAIL_${sufijo}`] || `e2e_${etiqueta}_${sello}@trackmenu.test`;
  const password = process.env[`PASSWORD_${sufijo}`] || 'Prueba12345!';

  if (process.env[`EMAIL_${sufijo}`]) {
    const r = await api('POST', '/auth/login', { body: { email, password } });
    if (r.status !== 200) {
      console.error(`No se pudo iniciar sesión con ${email}:`, r.status, r.json);
      process.exit(1);
    }
    return {
      email,
      token: r.json.data.session.access_token,
      org: { id: r.json.data.organizacion_id },
    };
  }

  const r = await api('POST', '/auth/register', {
    body: { email, password, name: etiqueta, organizacion: `Negocio ${etiqueta}` },
  });
  if (r.status !== 201 || !r.json?.data?.session) {
    console.error(`No se pudo registrar ${email}:`, r.status, r.json);
    console.error('Si Supabase exige confirmar el email, desactivá "Confirm email" en');
    console.error('Authentication > Sign In / Providers, o pasá cuentas ya creadas con');
    console.error('EMAIL_A/PASSWORD_A y EMAIL_B/PASSWORD_B.');
    process.exit(1);
  }
  return { email, token: r.json.data.session.access_token, org: r.json.data.organizacion };
};

const main = async () => {
  const salud = await api('GET', '/health');
  if (salud.status !== 200) {
    console.error(`La API no responde en ${API}. Levantá el backend con npm run dev.`);
    process.exit(1);
  }

  // --- Ingreso
  const a = await registrar('a');
  const b = await registrar('b');
  ok(!!a.org?.id && a.org.id !== b.org?.id, 'cada usuario queda en su propia organización');

  const me = await api('GET', '/auth/me', { token: a.token });
  ok(me.json?.data?.rol === 'admin', 'el usuario que registra el negocio es admin');

  // --- Sin sesión no se entra a las pantallas privadas
  ok((await api('GET', '/productos')).status === 401, 'sin token: 401 en /productos');
  ok((await api('GET', '/productos', { token: 'token-vencido' })).status === 401, 'token inválido/vencido: 401');

  // --- Alta (se comparan deltas, por si las cuentas ya tenían productos)
  const baseA = (await api('GET', '/productos', { token: a.token })).json.total;
  const baseB = (await api('GET', '/productos', { token: b.token })).json.total;

  const alta = await api('POST', '/productos', {
    token: a.token,
    body: { nombre: 'Milanesa napolitana', precio: 9500, stock: 12, descripcion: 'Con papas' },
  });
  ok(alta.status === 201 && alta.json.success, `alta OK: ${alta.json.message}`);
  const id = alta.json?.data?.id;

  await api('POST', '/productos', { token: a.token, body: { nombre: 'Agua mineral', precio: 1200, stock: 50 } });
  await api('POST', '/productos', { token: a.token, body: { nombre: 'Flan casero', precio: 3000, stock: 5 } });

  // --- Alta con datos faltantes / mal formato
  const sinDatos = await api('POST', '/productos', { token: a.token, body: { descripcion: 'sin nombre' } });
  ok(sinDatos.status === 400 && sinDatos.json.errors?.nombre && sinDatos.json.errors?.precio,
    'faltan obligatorios: 400 con el detalle por campo');
  const malFormato = await api('POST', '/productos', { token: a.token, body: { nombre: 'X', precio: 'gratis' } });
  ok(malFormato.status === 400, 'formato inválido: 400');

  // --- Consulta, búsqueda y orden
  const lista = await api('GET', '/productos', { token: a.token });
  ok(lista.json.total === baseA + 3, `listado de la organización: +3 productos (${lista.json.total})`);

  const busqueda = await api('GET', '/productos?q=mila', { token: a.token });
  ok(busqueda.json.data.every((p) => /mila/i.test(p.nombre)) && busqueda.json.total >= 1, 'búsqueda por nombre');

  const orden = await api('GET', '/productos?orden=precio&dir=asc', { token: a.token });
  const precios = orden.json.data.map((p) => Number(p.precio));
  ok(precios.every((v, i) => i === 0 || precios[i - 1] <= v), `orden por precio asc: ${precios.join(', ')}`);

  ok((await api('GET', '/productos?orden=inventado', { token: a.token })).status === 400, 'orden inválido: 400');

  const detalle = await api('GET', `/productos/${id}`, { token: a.token });
  ok(detalle.status === 200 && detalle.json.data.id === id, 'página de detalle');

  // --- Modificación (mismas reglas que el alta)
  const mod = await api('PUT', `/productos/${id}`, { token: a.token, body: { precio: 10500, stock: 8 } });
  ok(mod.status === 200 && Number(mod.json.data.precio) === 10500, `modificación OK: ${mod.json.message}`);
  ok((await api('PUT', `/productos/${id}`, { token: a.token, body: { precio: -5 } })).status === 400,
    'modificación con precio negativo: 400');
  ok((await api('PUT', `/productos/${id}`, { token: a.token, body: {} })).status === 400,
    'modificación sin campos: 400');

  // --- Aislamiento entre organizaciones
  ok((await api('GET', '/productos', { token: b.token })).json.total === baseB,
    'la otra organización no ve estos productos');
  ok((await api('GET', `/productos/${id}`, { token: b.token })).status === 404,
    'la otra organización no puede consultar el producto por id');
  ok((await api('PUT', `/productos/${id}`, { token: b.token, body: { precio: 1 } })).status === 404,
    'la otra organización no puede modificarlo');
  ok((await api('DELETE', `/productos/${id}`, { token: b.token })).status === 404,
    'la otra organización no puede eliminarlo');

  // --- Baja (el frontend pide confirmación antes de llamar acá)
  const baja = await api('DELETE', `/productos/${id}`, { token: a.token });
  ok(baja.status === 200, `baja OK: ${baja.json.message}`);
  ok((await api('GET', `/productos/${id}`, { token: a.token })).status === 404, 'el producto eliminado ya no existe');

  // --- Rol no autorizado (opcional, requiere bajar el rol en la base)
  if (process.env.TOKEN_CONSULTA) {
    const t = process.env.TOKEN_CONSULTA;
    ok((await api('GET', '/productos', { token: t })).status === 200, 'rol consulta: puede leer');
    ok((await api('POST', '/productos', { token: t, body: { nombre: 'Prueba', precio: 1 } })).status === 403,
      'rol consulta: no puede crear');
  } else {
    console.log('… prueba de roles empleado/consulta omitida (definí TOKEN_CONSULTA)');
  }

  console.log(fallas === 0 ? '\nRecorrido completo sin fallas' : `\n${fallas} verificación(es) fallaron`);
  process.exit(fallas === 0 ? 0 : 1);
};

main();
