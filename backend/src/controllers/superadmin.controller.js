import { supabase } from '../config/supabase.js';

const isMissingTableError = (err) =>
  err?.code === 'PGRST205' || err?.code === '42P01' || String(err?.message || '').includes('schema cache');

/**
 * Calcula días de mora si la fecha de vencimiento ya pasó y no está al día.
 */
export const calcularDiasMora = (fechaVencimiento, estado) => {
  if (!fechaVencimiento || estado === 'al_dia') return 0;
  const vencimiento = new Date(fechaVencimiento);
  const ahora = new Date();
  if (vencimiento >= ahora) return 0;
  const difMs = ahora.getTime() - vencimiento.getTime();
  return Math.floor(difMs / (1000 * 60 * 60 * 24));
};

/**
 * KPIs globales de la plataforma SaaS y control de suscripciones/mora.
 */
export const getSuperAdminKpis = async (req, res, next) => {
  try {
    const db = req.auth.db;

    // 1. Obtener todas las organizaciones
    const { data: orgs, error: errOrgs } = await db
      .from('organizaciones')
      .select('id, nombre, plan, estado_suscripcion, monto_mensual, fecha_vencimiento, bloqueo_mora, creado_en');

    if (errOrgs && !isMissingTableError(errOrgs)) throw errOrgs;

    const listaOrgs = orgs || [];
    const totalOrgs = listaOrgs.length;

    let totalAlDia = 0;
    let totalEnMora = 0;
    let totalBloqueados = 0;
    let mrrTotal = 0;
    let deudaEnMora = 0;

    const ahora = new Date();

    listaOrgs.forEach((o) => {
      const monto = Number(o.monto_mensual || 0);
      mrrTotal += monto;

      const vencido = o.fecha_vencimiento && new Date(o.fecha_vencimiento) < ahora;
      const esMora = o.estado_suscripcion === 'mora' || o.estado_suscripcion === 'pendiente' || vencido;

      if (esMora) {
        totalEnMora++;
        deudaEnMora += monto;
      } else {
        totalAlDia++;
      }

      if (o.bloqueo_mora) {
        totalBloqueados++;
      }
    });

    // 2. Conteo global de productos
    const { count: totalProductos, error: errProd } = await db
      .from('productos')
      .select('id', { count: 'exact', head: true });
    if (errProd && !isMissingTableError(errProd)) console.warn('Conteo productos superadmin:', errProd.message);

    // 3. Conteo global de miembros/usuarios
    const { count: totalUsuarios, error: errMiembros } = await db
      .from('miembros')
      .select('usuario_id', { count: 'exact', head: true });
    if (errMiembros && !isMissingTableError(errMiembros)) console.warn('Conteo miembros superadmin:', errMiembros.message);

    res.json({
      success: true,
      data: {
        total_organizaciones: totalOrgs,
        organizaciones_al_dia: totalAlDia,
        organizaciones_en_mora: totalEnMora,
        organizaciones_bloqueadas: totalBloqueados,
        mrr_total: mrrTotal,
        deuda_en_mora: deudaEnMora,
        total_productos: totalProductos || 0,
        total_usuarios: totalUsuarios || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Listado de todas las organizaciones con estado de su suscripción y mora.
 */
export const getOrganizaciones = async (req, res, next) => {
  try {
    const db = req.auth.db;

    const { data: orgs, error } = await db
      .from('organizaciones')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error && !isMissingTableError(error)) throw error;

    const ahora = new Date();

    const resultado = (orgs || []).map((o) => {
      const fechaVenc = o.fecha_vencimiento || null;
      const vencido = fechaVenc && new Date(fechaVenc) < ahora;
      let estado = o.estado_suscripcion || 'al_dia';
      if (vencido && estado === 'al_dia') {
        estado = 'pendiente';
      }

      const diasMora = calcularDiasMora(fechaVenc, estado);

      return {
        id: o.id,
        nombre: o.nombre,
        plan: o.plan || 'pro',
        estado_suscripcion: estado,
        monto_mensual: Number(o.monto_mensual || 20000),
        fecha_vencimiento: fechaVenc,
        dias_mora: diasMora,
        bloqueo_mora: Boolean(o.bloqueo_mora),
        notas_facturacion: o.notas_facturacion || '',
        creado_en: o.creado_en,
      };
    });

    res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Creación de una nueva organización / local por parte del SuperAdmin.
 */
export const crearOrganizacion = async (req, res, next) => {
  try {
    const db = req.auth.db;
    const {
      nombre,
      plan = 'pro',
      monto_mensual = 20000,
      fecha_vencimiento,
      estado_suscripcion = 'al_dia',
      notas_facturacion = '',
      admin_nombre,
      admin_email,
      admin_password,
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre del negocio es obligatorio.' });
    }

    const vencimiento = fecha_vencimiento
      ? new Date(fecha_vencimiento).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const nuevaOrg = {
      nombre: nombre.trim(),
      plan,
      monto_mensual: Number(monto_mensual) || 20000,
      fecha_vencimiento: vencimiento,
      estado_suscripcion,
      bloqueo_mora: estado_suscripcion === 'mora',
      notas_facturacion: notas_facturacion.trim(),
    };

    const { data: orgCreada, error: errOrg } = await db
      .from('organizaciones')
      .insert([nuevaOrg])
      .select()
      .single();

    if (errOrg && !isMissingTableError(errOrg)) throw errOrg;

    const orgId = orgCreada?.id || 'org_' + Date.now();

    // Si se enviaron datos del administrador inicial del local, darlo de alta
    let adminCreado = null;
    if (admin_email && admin_password && supabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: userAuth, error: authErr } = await supabase.auth.admin.createUser({
          email: admin_email.trim().toLowerCase(),
          password: admin_password,
          email_confirm: true,
          user_metadata: {
            name: admin_nombre || 'Administrador',
            organizacion_id: orgId,
            rol: 'admin',
          },
        });

        if (!authErr && userAuth?.user) {
          adminCreado = userAuth.user;
          await db.from('miembros').insert([{
            usuario_id: userAuth.user.id,
            organizacion_id: orgId,
            rol: 'admin',
          }]);
        }
      } catch (e) {
        console.warn('No se pudo crear admin de la organizacion:', e.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `Negocio "${nombre}" creado exitosamente.`,
      data: {
        id: orgId,
        ...nuevaOrg,
        admin_asociado: adminCreado ? adminCreado.email : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar datos de una organización, su plan y suscripción.
 */
export const actualizarOrganizacion = async (req, res, next) => {
  try {
    const db = req.auth.db;
    const { id } = req.params;
    const {
      nombre,
      plan,
      monto_mensual,
      fecha_vencimiento,
      estado_suscripcion,
      bloqueo_mora,
      notas_facturacion,
    } = req.body;

    const updates = {};
    if (nombre !== undefined && nombre.trim()) updates.nombre = nombre.trim();
    if (plan !== undefined) updates.plan = plan;
    if (monto_mensual !== undefined) updates.monto_mensual = Number(monto_mensual);
    if (fecha_vencimiento !== undefined) updates.fecha_vencimiento = new Date(fecha_vencimiento).toISOString();
    if (estado_suscripcion !== undefined) {
      updates.estado_suscripcion = estado_suscripcion;
      if (estado_suscripcion === 'al_dia') {
        updates.bloqueo_mora = false;
      }
    }
    if (bloqueo_mora !== undefined) updates.bloqueo_mora = Boolean(bloqueo_mora);
    if (notas_facturacion !== undefined) updates.notas_facturacion = String(notas_facturacion).trim();

    const { data, error } = await db
      .from('organizaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && !isMissingTableError(error)) throw error;

    res.json({
      success: true,
      message: 'Organización y suscripción actualizadas con éxito.',
      data: data || { id, ...updates },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registra el pago del plan por parte de un negocio que estaba en mora o próximo a vencer.
 * Deja la suscripción 'al_dia', desbloquea y suma 30 días de vigencia.
 */
export const registrarPagoSuscripcion = async (req, res, next) => {
  try {
    const db = req.auth.db;
    const { id } = req.params;

    const nuevaFechaVenc = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updates = {
      estado_suscripcion: 'al_dia',
      bloqueo_mora: false,
      fecha_vencimiento: nuevaFechaVenc,
    };

    const { data, error } = await db
      .from('organizaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && !isMissingTableError(error)) throw error;

    res.json({
      success: true,
      message: 'Pago de suscripción registrado. El local quedó al día por 30 días.',
      data: data || { id, ...updates },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Suspender un negocio por falta de pago / mora reiterada.
 */
export const suspenderPorMora = async (req, res, next) => {
  try {
    const db = req.auth.db;
    const { id } = req.params;

    const updates = {
      estado_suscripcion: 'mora',
      bloqueo_mora: true,
    };

    const { data, error } = await db
      .from('organizaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && !isMissingTableError(error)) throw error;

    res.json({
      success: true,
      message: 'Local suspendido por mora en el plan/suscripción.',
      data: data || { id, ...updates },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Eliminar organización de la plataforma.
 */
export const eliminarOrganizacion = async (req, res, next) => {
  try {
    const db = req.auth.db;
    const { id } = req.params;

    const { error } = await db
      .from('organizaciones')
      .delete()
      .eq('id', id);

    if (error && !isMissingTableError(error)) throw error;

    res.json({
      success: true,
      message: 'Organización eliminada de la plataforma.',
    });
  } catch (err) {
    next(err);
  }
};

