import { supabase } from '../config/supabase.js';

// Controlador del Módulo de Super-Administración
// Solo accesible por usuarios con rol 'admin' de su respectiva organización.

const ROLES_VALIDOS = ['admin', 'empleado'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isMissingTableError = (err) =>
  err?.code === 'PGRST205' || err?.code === '42P01' || String(err?.message || '').includes('schema cache');

/**
 * Valida y normaliza los datos de entrada para el alta de usuarios por parte del admin.
 */
export const validarDatosUsuario = ({ nombre, email, password, rol = 'empleado' } = {}) => {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!nombreLimpio || !emailLimpio || !EMAIL_REGEX.test(emailLimpio)) {
    return { valido: false, mensaje: 'Ingresá un nombre completo y un correo electrónico válido.' };
  }

  if (typeof password !== 'string' || password.length < 8) {
    return { valido: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return { valido: false, mensaje: 'Rol inválido. Debe ser: admin o empleado.' };
  }

  return {
    valido: true,
    datos: { nombre: nombreLimpio, email: emailLimpio, password, rol },
  };
};

export const getKpis = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioDia = hoy.toISOString();

    // 1. Ventas del día (completadas)
    const { data: ventasDia, error: errVentas } = await db
      .from('ventas')
      .select('id, total, metodo_pago, created_at')
      .eq('organizacion_id', orgId)
      .eq('estado', 'completada')
      .gte('created_at', inicioDia);

    if (errVentas) throw errVentas;

    const ticketsTotal = ventasDia?.length || 0;
    const facturacionTotal = (ventasDia || []).reduce((acc, v) => acc + Number(v.total || 0), 0);
    const ticketMedio = ticketsTotal > 0 ? facturacionTotal / ticketsTotal : 0;

    // Desglose de métodos de pago
    const pagosCount = { efectivo: 0, tarjeta: 0, transferencia_qr: 0 };
    (ventasDia || []).forEach((v) => {
      if (pagosCount[v.metodo_pago] !== undefined) {
        pagosCount[v.metodo_pago]++;
      }
    });

    const pagosPorcentaje = {
      efectivo: ticketsTotal > 0 ? Math.round((pagosCount.efectivo / ticketsTotal) * 100) : 0,
      tarjeta: ticketsTotal > 0 ? Math.round((pagosCount.tarjeta / ticketsTotal) * 100) : 0,
      transferencia_qr: ticketsTotal > 0 ? Math.round((pagosCount.transferencia_qr / ticketsTotal) * 100) : 0,
    };

    // 2. Alertas de stock crítico (stock <= 5)
    const { data: stockCritico, error: errStock } = await db
      .from('productos')
      .select('id, nombre, stock, precio, activo')
      .eq('organizacion_id', orgId)
      .lte('stock', 5)
      .order('stock', { ascending: true })
      .limit(10);

    if (errStock) throw errStock;

    // 3. Platos más vendidos (últimos 30 días)
    const { data: topDetalles, error: errDetalles } = await db
      .from('detalle_ventas')
      .select('producto_id, cantidad, productos(id, nombre, precio)')
      .limit(100);

    // Agrupación de más vendidos
    const vendidosMap = {};
    (topDetalles || []).forEach((d) => {
      const pId = d.producto_id;
      const nombre = d.productos?.nombre || 'Producto';
      if (!vendidosMap[pId]) {
        vendidosMap[pId] = { id: pId, nombre, cantidad: 0 };
      }
      vendidosMap[pId].cantidad += d.cantidad;
    });

    const platosMasVendidos = Object.values(vendidosMap)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        facturacionTotal,
        ticketsTotal,
        ticketMedio,
        pagosPorcentaje,
        pagosCount,
        stockCritico: stockCritico || [],
        platosMasVendidos,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getVentas = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;
    const { desde, hasta, metodo_pago, estado } = req.query;
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const limite = Math.min(Number(req.query.limite) || 20, 100);

    let query = db
      .from('ventas')
      .select('*, detalle_ventas(*, productos(id, nombre))', { count: 'exact' })
      .eq('organizacion_id', orgId);

    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);
    if (metodo_pago) query = query.eq('metodo_pago', metodo_pago);
    if (estado) query = query.eq('estado', estado);

    const desdeOffset = (pagina - 1) * limite;
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(desdeOffset, desdeOffset + limite - 1);

    if (error) throw error;

    res.json({
      success: true,
      total: count,
      pagina,
      limite,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
};

export const anularVenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;

    if (!motivo || String(motivo).trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar un motivo de anulación válido (mínimo 5 caracteres)',
      });
    }

    // 1. Obtener la venta con sus detalles
    const { data: venta, error: errVenta } = await db
      .from('ventas')
      .select('*, detalle_ventas(*)')
      .eq('id', id)
      .eq('organizacion_id', orgId)
      .maybeSingle();

    if (errVenta) throw errVenta;
    if (!venta) {
      return res.status(404).json({ success: false, message: 'Ticket de venta no encontrado' });
    }

    if (venta.estado === 'anulada') {
      return res.status(400).json({ success: false, message: 'La venta ya se encuentra anulada' });
    }

    // 2. Anular la venta
    const { error: errUpdate } = await db
      .from('ventas')
      .update({
        estado: 'anulada',
        anulado_en: new Date().toISOString(),
        anulado_por: req.auth.usuarioId,
        motivo_anulacion: motivo.trim(),
      })
      .eq('id', id)
      .eq('organizacion_id', orgId);

    if (errUpdate) throw errUpdate;

    // 3. Restituir stock de cada producto involucrado
    for (const item of venta.detalle_ventas || []) {
      // Registrar movimiento de stock
      await db.from('movimientos_stock').insert([
        {
          organizacion_id: orgId,
          producto_id: item.producto_id,
          tipo: 'restitucion',
          cantidad: item.cantidad,
          motivo: `Restitución por anulación de Ticket #${venta.id.slice(0, 8)} (${motivo.trim()})`,
          usuario_id: req.auth.usuarioId,
        },
      ]);

      // Incrementar stock en productos
      const { data: prod } = await db
        .from('productos')
        .select('stock')
        .eq('id', item.producto_id)
        .maybeSingle();

      if (prod) {
        await db
          .from('productos')
          .update({ stock: (prod.stock || 0) + item.cantidad })
          .eq('id', item.producto_id);
      }
    }

    // 4. Log inmutable de auditoría
    await db.from('auditoria_logs').insert([
      {
        organizacion_id: orgId,
        usuario_id: req.auth.usuarioId,
        accion: 'anulacion_ticket',
        detalles: {
          venta_id: venta.id,
          mesa_numero: venta.mesa_numero,
          total: venta.total,
          motivo: motivo.trim(),
          items_restituidos: (venta.detalle_ventas || []).length,
        },
      },
    ]);

    res.json({
      success: true,
      message: 'Ticket anulado correctamente y stock restituido.',
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditoria = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;

    const { data, error } = await db
      .from('auditoria_logs')
      .select('*')
      .eq('organizacion_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
};

export const getUsuarios = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;

    const { data, error } = await db
      .from('miembros')
      .select('usuario_id, rol, creado_en')
      .eq('organizacion_id', orgId);

    if (error && !isMissingTableError(error)) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Alta de usuario restringida exclusivamente al rol 'admin' dentro de su organización.
 * Evita el auto-registro público asignando organizacion_id y rol desde el servidor.
 */
export const crearUsuario = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;
    const validacion = validarDatosUsuario(req.body);

    if (!validacion.valido) {
      return res.status(400).json({
        success: false,
        message: validacion.mensaje,
      });
    }

    const { nombre: nombreLimpio, email: emailLimpio, password, rol } = validacion.datos;

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: 'Supabase no está configurado en el servidor.',
      });
    }

    const userMetadata = {
      name: nombreLimpio,
      organizacion_id: orgId,
      rol,
    };

    let nuevoUsuario = null;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: emailLimpio,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      nuevoUsuario = data.user;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: emailLimpio,
        password,
        options: { data: userMetadata },
      });
      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      nuevoUsuario = data.user;
    }

    const { error: errMiembro } = await db
      .from('miembros')
      .insert([{ usuario_id: nuevoUsuario.id, organizacion_id: orgId, rol }]);

    if (errMiembro && !isMissingTableError(errMiembro)) throw errMiembro;

    const { error: errAudit } = await db.from('auditoria_logs').insert([
      {
        organizacion_id: orgId,
        usuario_id: req.auth.usuarioId,
        accion: 'alta_usuario',
        detalles: {
          usuario_creado: nuevoUsuario.id,
          nombre: nombreLimpio,
          email: emailLimpio,
          rol,
        },
      },
    ]);
    if (errAudit && !isMissingTableError(errAudit)) {
      console.warn('No se pudo registrar auditoría de alta_usuario:', errAudit.message);
    }

    return res.status(201).json({
      success: true,
      message: `Usuario ${nombreLimpio} creado con rol ${rol}.`,
      data: {
        usuario_id: nuevoUsuario.id,
        nombre: nombreLimpio,
        email: emailLimpio,
        rol,
        creado_en: nuevoUsuario.created_at || new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const cambiarRolUsuario = async (req, res, next) => {
  try {
    const orgId = req.auth.organizacionId;
    const db = req.auth.db;
    const { usuario_id, nuevo_rol } = req.body;

    if (!ROLES_VALIDOS.includes(nuevo_rol)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido. Debe ser: admin o empleado',
      });
    }

    if (usuario_id === req.auth.usuarioId && nuevo_rol !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No puedes revocar tu propio rol de administrador.',
      });
    }

    const { error: errUpdate } = await db
      .from('miembros')
      .update({ rol: nuevo_rol })
      .eq('usuario_id', usuario_id)
      .eq('organizacion_id', orgId);

    if (errUpdate && !isMissingTableError(errUpdate)) throw errUpdate;

    // Log de auditoría
    const { error: errAudit } = await db.from('auditoria_logs').insert([
      {
        organizacion_id: orgId,
        usuario_id: req.auth.usuarioId,
        accion: 'cambio_rol',
        detalles: {
          usuario_afectado: usuario_id,
          nuevo_rol,
        },
      },
    ]);
    if (errAudit && !isMissingTableError(errAudit)) {
      console.warn('No se pudo registrar auditoría de cambio_rol:', errAudit.message);
    }

    res.json({
      success: true,
      message: `Rol actualizado a ${nuevo_rol} exitosamente.`,
    });
  } catch (err) {
    next(err);
  }
};

