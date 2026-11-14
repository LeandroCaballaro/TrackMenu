// Comandas abiertas por mesa. Antes vivían en la memoria del navegador: había
// una sola mesa, se perdían al recargar y el equipo no las compartía.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validarComanda = (body) => {
  const errores = {};
  const campos = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const mesa = Number(campos.mesa_numero);
  if (!Number.isInteger(mesa) || mesa < 1 || mesa > 999) {
    errores.mesa_numero = 'El número de mesa debe ser un entero entre 1 y 999';
  }

  const items = Array.isArray(campos.items) ? campos.items : [];
  if (items.length === 0) {
    errores.items = 'El pedido no puede estar vacío';
  } else if (items.length > 100) {
    errores.items = 'El pedido no puede tener más de 100 líneas';
  } else {
    for (const item of items) {
      const cantidad = Number(item?.cantidad);
      if (typeof item?.producto_id !== 'string' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
        errores.items = 'Cada línea necesita un producto y una cantidad entera entre 1 y 999';
        break;
      }
    }
  }

  return { valido: Object.keys(errores).length === 0, errores, mesa, items };
};

// Las comandas abiertas, con su detalle y su total ya calculado.
export const listarComandas = async (req, res, next) => {
  try {
    const { data, error } = await req.auth.db
      .from('comandas')
      .select('id, mesa_numero, estado, creada_en, comanda_items(producto_id, cantidad, productos(nombre, precio))')
      .eq('organizacion_id', req.auth.organizacionId)
      .eq('estado', 'abierta')
      .order('creada_en', { ascending: true });

    if (error) throw error;

    const comandas = (data || []).map((c) => {
      const items = (c.comanda_items || []).map((i) => ({
        producto_id: i.producto_id,
        nombre: i.productos?.nombre ?? '',
        precio: Number(i.productos?.precio ?? 0),
        cantidad: i.cantidad,
      }));
      return {
        id: c.id,
        mesa_numero: c.mesa_numero,
        estado: c.estado,
        creada_en: c.creada_en,
        items,
        total: Number(items.reduce((acc, i) => acc + i.precio * i.cantidad, 0).toFixed(2)),
      };
    });

    res.json({ success: true, total: comandas.length, data: comandas });
  } catch (err) {
    next(err);
  }
};

// Envía el pedido a una mesa. Si la mesa ya tiene comanda abierta se le suman
// las cantidades, que es lo que pasa cuando una mesa pide dos veces.
export const enviarPedido = async (req, res, next) => {
  try {
    const { valido, errores, mesa, items } = validarComanda(req.body);
    if (!valido) {
      return res.status(400).json({ success: false, message: 'Hay datos inválidos o incompletos', errors: errores });
    }

    const db = req.auth.db;
    const orgId = req.auth.organizacionId;

    const pedidos = new Map();
    for (const item of items) {
      pedidos.set(item.producto_id, (pedidos.get(item.producto_id) || 0) + Number(item.cantidad));
    }

    const { data: productos, error: errorProductos } = await db
      .from('productos')
      .select('id')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .in('id', [...pedidos.keys()]);

    if (errorProductos) throw errorProductos;
    if (productos.length !== pedidos.size) {
      return res.status(404).json({
        success: false,
        message: 'Hay productos que no existen o no están disponibles en tu organización',
      });
    }

    const { data: abierta, error: errorAbierta } = await db
      .from('comandas')
      .select('id')
      .eq('organizacion_id', orgId)
      .eq('mesa_numero', mesa)
      .eq('estado', 'abierta')
      .maybeSingle();

    if (errorAbierta) throw errorAbierta;

    let comandaId = abierta?.id;

    if (!comandaId) {
      const { data: nueva, error: errorNueva } = await db
        .from('comandas')
        .insert([{ organizacion_id: orgId, mesa_numero: mesa, abierta_por: req.auth.usuarioId }])
        .select('id')
        .single();

      if (errorNueva) throw errorNueva;
      comandaId = nueva.id;
    }

    const { data: yaCargados, error: errorItems } = await db
      .from('comanda_items')
      .select('producto_id, cantidad')
      .eq('comanda_id', comandaId);

    if (errorItems) throw errorItems;

    for (const [productoId, cantidad] of pedidos) {
      const existente = yaCargados.find((i) => i.producto_id === productoId);
      // .select() para enterarse si el UPDATE no tocó nada: sin eso, sumar a
      // una comanda abierta fallaba en silencio.
      const { data: tocadas, error } = existente
        ? await db.from('comanda_items').update({ cantidad: existente.cantidad + cantidad })
            .eq('comanda_id', comandaId).eq('producto_id', productoId).select()
        : await db.from('comanda_items').insert([{ comanda_id: comandaId, producto_id: productoId, cantidad }]).select();
      if (error) throw error;
      if (!tocadas || tocadas.length === 0) {
        return res.status(409).json({ success: false, message: 'No se pudo cargar el pedido en la comanda' });
      }
    }

    res.status(201).json({
      success: true,
      message: `Pedido enviado a la mesa ${mesa}`,
      data: { comanda_id: comandaId, mesa_numero: mesa },
    });
  } catch (err) {
    next(err);
  }
};

export const cancelarComanda = async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
    }

    const { data, error } = await req.auth.db
      .from('comandas')
      .update({ estado: 'cancelada', cerrada_en: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .eq('estado', 'abierta')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Comanda no encontrada o ya cerrada' });

    res.json({ success: true, message: `Comanda de la mesa ${data.mesa_numero} cancelada`, data });
  } catch (err) {
    next(err);
  }
};
