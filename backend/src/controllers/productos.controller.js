// ABM de productos (función principal del MVP).
// Todo pasa por req.auth.db: un cliente Supabase con el token del usuario, así
// RLS filtra por organización y rol además de las validaciones de acá.

const CAMPOS_ORDEN = ['nombre', 'precio', 'stock', 'creado_en'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Topes de las columnas: numeric(12,2) e integer. Pasarse hacía fallar el
// INSERT con un 500 de Postgres en vez de un 400.
const PRECIO_MAX = 9999999999.99;
const STOCK_MAX = 2147483647;

// Sólo texto o número: un objeto o un array se convertían en "[object Object]"
// o "a,b" y se guardaban igual.
const esTexto = (v) => typeof v === 'string' || typeof v === 'number';

// Exportada para poder testearla sola.
export const validarProducto = (body, { parcial = false } = {}) => {
  const errores = {};
  const datos = {};
  const campos = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const presente = (campo) => campos[campo] !== undefined && campos[campo] !== null && campos[campo] !== '';

  if (presente('nombre')) {
    const nombre = esTexto(campos.nombre) ? String(campos.nombre).trim() : '';
    if (nombre.length < 2 || nombre.length > 80) errores.nombre = 'El nombre debe tener entre 2 y 80 caracteres';
    else datos.nombre = nombre;
  } else if (!parcial) {
    errores.nombre = 'El nombre es obligatorio';
  }

  if (presente('precio')) {
    const precio = esTexto(campos.precio) ? Number(campos.precio) : NaN;
    if (!Number.isFinite(precio) || precio < 0 || precio > PRECIO_MAX) {
      errores.precio = `El precio debe ser un número entre 0 y ${PRECIO_MAX}`;
    } else {
      datos.precio = precio;
    }
  } else if (!parcial) {
    errores.precio = 'El precio es obligatorio';
  }

  if (presente('stock')) {
    const stock = esTexto(campos.stock) ? Number(campos.stock) : NaN;
    if (!Number.isInteger(stock) || stock < 0 || stock > STOCK_MAX) {
      errores.stock = `El stock debe ser un número entero entre 0 y ${STOCK_MAX}`;
    } else {
      datos.stock = stock;
    }
  } else if (!parcial) {
    datos.stock = 0;
  }

  if (campos.descripcion !== undefined && campos.descripcion !== null) {
    if (!esTexto(campos.descripcion)) {
      errores.descripcion = 'La descripción debe ser texto';
    } else {
      const descripcion = String(campos.descripcion).trim();
      if (descripcion.length > 500) errores.descripcion = 'La descripción no puede superar los 500 caracteres';
      else datos.descripcion = descripcion;
    }
  }

  if (campos.activo !== undefined) {
    if (typeof campos.activo !== 'boolean') errores.activo = 'El campo activo debe ser true o false';
    else datos.activo = campos.activo;
  }

  if (presente('imagen_url')) {
    // Se acepta una URL o una imagen cargada desde el dispositivo (data:), que
    // es lo que manda el formulario del frontend.
    const imagen = typeof campos.imagen_url === 'string' ? campos.imagen_url.trim() : '';
    if (!/^(https?:\/\/\S+|data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+)$/i.test(imagen)) {
      errores.imagen_url = 'La imagen debe ser una URL http(s) válida o una imagen cargada desde el dispositivo';
    } else {
      datos.imagen_url = imagen;
    }
  }

  return { valido: Object.keys(errores).length === 0, errores, datos };
};

// Un id que no es UUID hacía estallar la consulta con un 500 de Postgres.
const idInvalido = (req, res) => {
  if (UUID.test(req.params.id)) return false;
  res.status(404).json({ success: false, message: 'Producto no encontrado' });
  return true;
};

const errorValidacion = (res, errores) =>
  res.status(400).json({ success: false, message: 'Hay datos inválidos o incompletos', errors: errores });

// GET /api/productos?q=&activo=&orden=nombre&dir=asc&pagina=1&limite=20
export const listarProductos = async (req, res, next) => {
  try {
    const { q, activo, orden = 'creado_en', dir = 'desc' } = req.query;
    const limite = Math.min(Math.max(Math.trunc(Number(req.query.limite)) || 20, 1), 100);
    const pagina = Math.max(Math.trunc(Number(req.query.pagina)) || 1, 1);

    if (!CAMPOS_ORDEN.includes(orden)) {
      return res.status(400).json({ success: false, message: `orden debe ser uno de: ${CAMPOS_ORDEN.join(', ')}` });
    }

    let query = req.auth.db
      .from('productos')
      .select('*', { count: 'exact' })
      .eq('organizacion_id', req.auth.organizacionId);

    // % y _ son comodines de LIKE: sin escapar, buscar "%" devolvía todo.
    if (q) query = query.ilike('nombre', `%${String(q).replace(/[\\%_]/g, '\\$&')}%`);
    if (activo === 'true' || activo === 'false') query = query.eq('activo', activo === 'true');

    const desde = (pagina - 1) * limite;
    const { data, error, count } = await query
      .order(orden, { ascending: dir !== 'desc' })
      .range(desde, desde + limite - 1);

    // Pedir una página más allá del final no es un error: es una página vacía.
    if (error && error.code === 'PGRST103') {
      return res.json({ success: true, total: 0, pagina, limite, data: [] });
    }
    if (error) throw error;
    res.json({ success: true, total: count, pagina, limite, data });
  } catch (err) {
    next(err);
  }
};

export const obtenerProducto = async (req, res, next) => {
  try {
    if (idInvalido(req, res)) return;

    const { data, error } = await req.auth.db
      .from('productos')
      .select('*')
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const crearProducto = async (req, res, next) => {
  try {
    const { valido, errores, datos } = validarProducto(req.body);
    if (!valido) return errorValidacion(res, errores);

    const { data, error } = await req.auth.db
      .from('productos')
      .insert([{ ...datos, usuario_id: req.auth.usuarioId, organizacion_id: req.auth.organizacionId }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Producto creado correctamente', data });
  } catch (err) {
    next(err);
  }
};

export const actualizarProducto = async (req, res, next) => {
  try {
    if (idInvalido(req, res)) return;

    const { valido, errores, datos } = validarProducto(req.body, { parcial: true });
    if (!valido) return errorValidacion(res, errores);
    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    // Regla de roles: el empleado NO puede alterar el stock numérico
    if (req.auth?.rol === 'empleado' && datos.stock !== undefined) {
      return res.status(403).json({
        success: false,
        message: 'Permiso denegado: El personal con rol empleado no puede modificar el stock numérico. Utilice la función "Notificar falta de stock".',
      });
    }

    const { data, error } = await req.auth.db
      .from('productos')
      .update({ ...datos, actualizado_en: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, message: 'Producto modificado correctamente', data });
  } catch (err) {
    next(err);
  }
};

// Notificación de falta de stock enviada por empleado al administrador
export const notificarFaltaStock = async (req, res, next) => {
  try {
    if (idInvalido(req, res)) return;

    const { id } = req.params;
    const { motivo } = req.body || {};

    const { data: producto, error: prodErr } = await req.auth.db
      .from('productos')
      .select('id, nombre, stock')
      .eq('id', id)
      .eq('organizacion_id', req.auth.organizacionId)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!producto) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const detalleAlerta = {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      stock_actual: producto.stock,
      usuario_email: req.auth.usuarioEmail || 'empleado',
      motivo: motivo || 'Notificación urgente: falta de stock / producto agotado reportado por empleado.',
      notificado_en: new Date().toISOString(),
    };

    try {
      await req.auth.db.from('auditoria_logs').insert([{
        organizacion_id: req.auth.organizacionId,
        usuario_id: req.auth.usuarioId,
        accion: 'alerta_stock',
        detalles: detalleAlerta,
      }]);
    } catch {
      // Si la tabla no está o RLS no aplica, log local silencioso
    }

    res.json({
      success: true,
      message: `Se notificó exitosamente al administrador la falta de stock de "${producto.nombre}".`,
      data: detalleAlerta,
    });
  } catch (err) {
    next(err);
  }
};

export const eliminarProducto = async (req, res, next) => {
  try {
    if (idInvalido(req, res)) return;

    const { data, error } = await req.auth.db
      .from('productos')
      .delete()
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, message: 'Producto eliminado correctamente', data });
  } catch (err) {
    next(err);
  }
};
