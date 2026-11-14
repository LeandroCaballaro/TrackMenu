import { supabase, userClient, isSupabaseConfigured } from '../config/supabase.js';
import { initialTables } from '../data/mockData.js';

let localTables = JSON.parse(JSON.stringify(initialTables));

const normalizeOrderItems = (rawItems = []) => {
  return rawItems
    .map((item) => {
      const cantidad = Math.max(1, Number(item.cantidad ?? item.quantity ?? 1));
      const precio = Math.max(0, Number(item.precio_unitario ?? item.price ?? 0));
      const productoId = item.producto_id ?? item.id ?? null;
      const nombre = String(item.nombre ?? item.name ?? 'Producto').trim();
      const opciones = Array.isArray(item.opciones) ? item.opciones : [];
      return {
        producto_id: productoId,
        id: productoId,
        nombre,
        name: nombre,
        precio_unitario: precio,
        price: precio,
        cantidad,
        quantity: cantidad,
        opciones,
        subtotal: precio * cantidad,
      };
    })
    .filter((item) => item.cantidad > 0 && Number.isFinite(item.precio_unitario));
};

const mergeOrderItems = (existingItems = [], incomingItems = []) => {
  const merged = normalizeOrderItems(existingItems).map((item) => ({ ...item }));
  for (const nextItem of normalizeOrderItems(incomingItems)) {
    const keyOpciones = JSON.stringify([...(nextItem.opciones || [])].sort());
    const match = merged.find(
      (prev) =>
        (prev.producto_id && nextItem.producto_id
          ? String(prev.producto_id) === String(nextItem.producto_id)
          : prev.nombre === nextItem.nombre) &&
        JSON.stringify([...(prev.opciones || [])].sort()) === keyOpciones,
    );
    if (match) {
      match.cantidad += nextItem.cantidad;
      match.quantity = match.cantidad;
      match.subtotal = match.precio_unitario * match.cantidad;
    } else {
      merged.push(nextItem);
    }
  }
  return merged;
};

export const getTables = async (req, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('number', { ascending: true });

      if (error) throw error;
      return res.json({ success: true, count: data.length, data });
    }

    res.json({ success: true, count: localTables.length, data: localTables, note: 'Usando datos locales (configurá Supabase en .env)' });
  } catch (err) {
    next(err);
  }
};

export const getTableById = async (req, res, next) => {
  try {
    const number = Number(req.params.number);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('number', number)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
      }
      return res.json({ success: true, data });
    }

    const table = localTables.find((t) => t.number === number);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }
    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
};

export const releaseTable = async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    const { metodo_pago = 'efectivo', organizacion_id, usuario_id, cancelar = false } = req.body || {};
    const metodoPago = ['efectivo', 'tarjeta', 'transferencia_qr'].includes(metodo_pago)
      ? metodo_pago
      : 'efectivo';

    if (isSupabaseConfigured()) {
      const { data: table, error: errFetch } = await supabase
        .from('tables')
        .select('*')
        .eq('number', number)
        .maybeSingle();

      if (errFetch) throw errFetch;
      if (!table) {
        return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
      }

      const comandaCobrada = table.current_order || null;

      if (!cancelar && comandaCobrada && Array.isArray(comandaCobrada.items) && comandaCobrada.items.length > 0) {
        const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        const db = bearer ? userClient(bearer) : supabase;

        if (organizacion_id && usuario_id) {
          try {
            const totalCalculado = comandaCobrada.items.reduce(
              (sum, i) => sum + Number(i.precio_unitario ?? i.price ?? 0) * Number(i.cantidad ?? i.quantity ?? 1),
              0,
            );
            const { data: ventaCreada } = await db
              .from('ventas')
              .insert([
                {
                  organizacion_id,
                  mesa_numero: number,
                  total: Number(comandaCobrada.total ?? totalCalculado),
                  metodo_pago: metodoPago,
                  estado: 'completada',
                  usuario_id,
                },
              ])
              .select()
              .single();

            if (ventaCreada) {
              const detalles = comandaCobrada.items
                .filter((i) => i.producto_id)
                .map((i) => {
                  const precio = Number(i.precio_unitario ?? i.price ?? 0);
                  const cantidad = Number(i.cantidad ?? i.quantity ?? 1);
                  return {
                    venta_id: ventaCreada.id,
                    producto_id: i.producto_id,
                    cantidad,
                    precio_unitario: precio,
                    subtotal: precio * cantidad,
                  };
                });

              if (detalles.length > 0) {
                await db.from('detalle_ventas').insert(detalles);
              }
            }
          } catch {
            // Si no aplica esquema UUID multi-tenant para la mesa pública, continuar liberando la mesa
          }
        }
      }

      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'libre', current_order: null })
        .eq('number', number)
        .select()
        .single();

      if (error) throw error;
      return res.json({
        success: true,
        message: `Mesa ${number} cobrada y liberada con éxito`,
        data: { ...data, comanda_cobrada: comandaCobrada, metodo_pago: metodoPago },
      });
    }

    const tableIndex = localTables.findIndex((t) => t.number === number);
    if (tableIndex === -1) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    const comandaCobrada = localTables[tableIndex].currentOrder || null;
    localTables[tableIndex].status = 'libre';
    localTables[tableIndex].currentOrder = null;

    res.json({
      success: true,
      message: `Mesa ${number} cobrada y liberada con éxito`,
      data: {
        ...localTables[tableIndex],
        comanda_cobrada: comandaCobrada,
        metodo_pago: metodoPago,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const occupyTable = async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    const { order, items } = req.body || {};
    const rawIncoming = Array.isArray(order?.items) ? order.items : (Array.isArray(items) ? items : []);
    const incomingItems = normalizeOrderItems(rawIncoming);

    if (incomingItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren ítems reales del pedido para ocupar la mesa',
      });
    }

    if (isSupabaseConfigured()) {
      const { data: existingTable, error: errFetch } = await supabase
        .from('tables')
        .select('*')
        .eq('number', number)
        .maybeSingle();

      if (errFetch) throw errFetch;
      if (!existingTable) {
        return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
      }

      const existingOrder = existingTable.status === 'ocupada' ? existingTable.current_order : null;
      const mergedItems = mergeOrderItems(existingOrder?.items || [], incomingItems);
      const total = mergedItems.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
      const orderData = {
        id: existingOrder?.id || order?.id || Date.now(),
        time: existingOrder?.time || order?.time || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        items: mergedItems,
        total,
      };

      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'ocupada', current_order: orderData })
        .eq('number', number)
        .select()
        .single();

      if (error) throw error;
      return res.json({
        success: true,
        message: `Mesa ${number} ahora está ocupada`,
        data,
      });
    }

    const tableIndex = localTables.findIndex((t) => t.number === number);
    if (tableIndex === -1) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    const existingOrder = localTables[tableIndex].status === 'ocupada' ? localTables[tableIndex].currentOrder : null;
    const mergedItems = mergeOrderItems(existingOrder?.items || [], incomingItems);
    const total = mergedItems.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
    const orderData = {
      id: existingOrder?.id || order?.id || Date.now(),
      time: existingOrder?.time || order?.time || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      items: mergedItems,
      total,
    };

    localTables[tableIndex].status = 'ocupada';
    localTables[tableIndex].currentOrder = orderData;

    res.json({
      success: true,
      message: `Mesa ${number} ahora está ocupada`,
      data: localTables[tableIndex],
    });
  } catch (err) {
    next(err);
  }
};
