import { randomUUID } from 'node:crypto';

// Cobro de una mesa: registra la venta, su detalle y el descuento de stock.
//
// Faltaba por completo: la pantalla de mesas escribía la venta en el
// localStorage del navegador, con un total fijo, así que el panel de ventas
// y los KPIs siempre mostraban cero y no había nada que anular.

const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia_qr'];

// Los precios salen de la base, nunca del cliente.
const validarCobro = (body) => {
  const errores = {};
  const campos = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const mesa = Number(campos.mesa_numero);
  if (!Number.isInteger(mesa) || mesa < 1 || mesa > 999) {
    errores.mesa_numero = 'El número de mesa debe ser un entero entre 1 y 999';
  }

  if (!METODOS_PAGO.includes(campos.metodo_pago)) {
    errores.metodo_pago = `El método de pago debe ser uno de: ${METODOS_PAGO.join(', ')}`;
  }

  const items = Array.isArray(campos.items) ? campos.items : [];
  if (items.length === 0) {
    errores.items = 'La comanda no puede estar vacía';
  } else if (items.length > 100) {
    errores.items = 'La comanda no puede tener más de 100 líneas';
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

export const cobrarMesa = async (req, res, next) => {
  try {
    const { valido, errores, mesa, items } = validarCobro(req.body);
    if (!valido) {
      return res.status(400).json({ success: false, message: 'Hay datos inválidos o incompletos', errors: errores });
    }

    const db = req.auth.db;
    const orgId = req.auth.organizacionId;

    // Una misma línea repetida se suma, para no pedir dos veces el mismo producto.
    const cantidadPorProducto = new Map();
    for (const item of items) {
      cantidadPorProducto.set(item.producto_id, (cantidadPorProducto.get(item.producto_id) || 0) + Number(item.cantidad));
    }

    const { data: productos, error: errorProductos } = await db
      .from('productos')
      .select('id, nombre, precio, stock')
      .eq('organizacion_id', orgId)
      .in('id', [...cantidadPorProducto.keys()]);

    if (errorProductos) throw errorProductos;

    const faltantes = [...cantidadPorProducto.keys()].filter((id) => !productos.some((p) => p.id === id));
    if (faltantes.length > 0) {
      return res.status(404).json({ success: false, message: 'Hay productos que no existen en tu organización' });
    }

    const sinStock = productos.filter((p) => p.stock < cantidadPorProducto.get(p.id));
    if (sinStock.length > 0) {
      return res.status(409).json({
        success: false,
        message: `No hay stock suficiente de: ${sinStock.map((p) => p.nombre).join(', ')}`,
      });
    }

    const lineas = productos.map((p) => {
      const cantidad = cantidadPorProducto.get(p.id);
      return {
        producto_id: p.id,
        cantidad,
        precio_unitario: Number(p.precio),
        subtotal: Number((Number(p.precio) * cantidad).toFixed(2)),
      };
    });
    const total = Number(lineas.reduce((acc, l) => acc + l.subtotal, 0).toFixed(2));

    // El id se genera acá a propósito: leer ventas es sólo para el admin, así
    // que pedir el RETURNING del insert hacía fallar el cobro de un empleado
    // contra la política de lectura.
    const venta = {
      id: randomUUID(),
      organizacion_id: orgId,
      mesa_numero: mesa,
      total,
      metodo_pago: req.body.metodo_pago,
      estado: 'completada',
      usuario_id: req.auth.usuarioId,
      created_at: new Date().toISOString(),
    };

    const { error: errorVenta } = await db.from('ventas').insert([venta]);

    if (errorVenta) throw errorVenta;

    const { error: errorDetalle } = await db
      .from('detalle_ventas')
      .insert(lineas.map((l) => ({ ...l, venta_id: venta.id })));

    // Sin detalle la venta no sirve ni se puede anular bien: se deshace.
    if (errorDetalle) {
      await db.from('ventas').delete().eq('id', venta.id);
      throw errorDetalle;
    }

    // Descuento de stock y su rastro. Si algo de esto falla la venta ya está
    // cobrada, así que se avisa en vez de perderla.
    const avisos = [];
    for (const l of lineas) {
      const p = productos.find((x) => x.id === l.producto_id);
      const { error } = await db
        .from('productos')
        .update({ stock: p.stock - l.cantidad, actualizado_en: new Date().toISOString() })
        .eq('id', l.producto_id)
        .eq('organizacion_id', orgId);
      if (error) avisos.push(`No se pudo descontar el stock de ${p.nombre}`);
    }

    const { error: errorMovimientos } = await db.from('movimientos_stock').insert(
      lineas.map((l) => ({
        organizacion_id: orgId,
        producto_id: l.producto_id,
        tipo: 'venta',
        cantidad: -l.cantidad,
        motivo: `Venta mesa ${mesa}`,
        usuario_id: req.auth.usuarioId,
      })),
    );
    if (errorMovimientos) avisos.push('No se pudo registrar el movimiento de stock');

    // La mesa queda libre: sin esto la comanda seguía abierta después de cobrar.
    const { error: errorComanda } = await db
      .from('comandas')
      .update({ estado: 'cobrada', venta_id: venta.id, cerrada_en: new Date().toISOString() })
      .eq('organizacion_id', orgId)
      .eq('mesa_numero', mesa)
      .eq('estado', 'abierta');
    if (errorComanda) avisos.push('No se pudo cerrar la comanda de la mesa');

    res.status(201).json({
      success: true,
      message: 'Venta registrada correctamente',
      data: { ...venta, detalle: lineas },
      ...(avisos.length > 0 ? { avisos } : {}),
    });
  } catch (err) {
    next(err);
  }
};
