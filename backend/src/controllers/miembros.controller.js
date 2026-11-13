// Gestión de usuarios de la organización: ver quién la integra, cambiar roles,
// dar de baja e invitar gente nueva. Todo pasa por req.auth.db (el token del
// usuario), así RLS vuelve a validar organización y rol en la base.

const ROLES = ['admin', 'empleado', 'consulta'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noEncontrado = (res, que = 'Miembro') =>
  res.status(404).json({ success: false, message: `${que} no encontrado` });

export const listarMiembros = async (req, res, next) => {
  try {
    // mi_equipo() trae también nombre y correo, que auth.users no deja leer
    // directamente con el token del usuario.
    const { data, error } = await req.auth.db.rpc('mi_equipo');

    if (error) throw error;
    res.json({
      success: true,
      total: data.length,
      data: data.map((m) => ({ ...m, soy_yo: m.usuario_id === req.auth.usuarioId })),
    });
  } catch (err) {
    next(err);
  }
};

export const cambiarRol = async (req, res, next) => {
  try {
    if (!UUID.test(req.params.usuarioId)) return noEncontrado(res);

    const { rol } = req.body ?? {};
    if (!ROLES.includes(rol)) {
      return res.status(400).json({
        success: false,
        message: 'Hay datos inválidos o incompletos',
        errors: { rol: `El rol debe ser uno de: ${ROLES.join(', ')}` },
      });
    }

    // La base también lo impide, pero así el mensaje es claro.
    if (req.params.usuarioId === req.auth.usuarioId) {
      return res.status(403).json({ success: false, message: 'No podés cambiar tu propio rol' });
    }

    const { data, error } = await req.auth.db
      .from('miembros')
      .update({ rol })
      .eq('usuario_id', req.params.usuarioId)
      .eq('organizacion_id', req.auth.organizacionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return noEncontrado(res);
    res.json({ success: true, message: 'Rol actualizado correctamente', data });
  } catch (err) {
    next(err);
  }
};

export const quitarMiembro = async (req, res, next) => {
  try {
    if (!UUID.test(req.params.usuarioId)) return noEncontrado(res);

    if (req.params.usuarioId === req.auth.usuarioId) {
      return res.status(403).json({ success: false, message: 'No podés darte de baja a vos mismo' });
    }

    const { data, error } = await req.auth.db
      .from('miembros')
      .delete()
      .eq('usuario_id', req.params.usuarioId)
      .eq('organizacion_id', req.auth.organizacionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return noEncontrado(res);
    res.json({ success: true, message: 'Miembro dado de baja correctamente', data });
  } catch (err) {
    next(err);
  }
};

export const listarInvitaciones = async (req, res, next) => {
  try {
    const { data, error } = await req.auth.db
      .from('invitaciones')
      .select('*')
      .eq('organizacion_id', req.auth.organizacionId)
      .order('creada_en', { ascending: false });

    if (error) throw error;
    res.json({ success: true, total: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const crearInvitacion = async (req, res, next) => {
  try {
    const { rol = 'empleado', email } = req.body ?? {};

    const errores = {};
    if (!ROLES.includes(rol)) errores.rol = `El rol debe ser uno de: ${ROLES.join(', ')}`;
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errores.email = 'El email no tiene un formato válido';
      }
    }
    if (Object.keys(errores).length > 0) {
      return res.status(400).json({ success: false, message: 'Hay datos inválidos o incompletos', errors: errores });
    }

    const { data, error } = await req.auth.db
      .from('invitaciones')
      .insert([{
        organizacion_id: req.auth.organizacionId,
        rol,
        email: email || null,
        creada_por: req.auth.usuarioId,
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Invitación creada correctamente', data });
  } catch (err) {
    next(err);
  }
};

export const revocarInvitacion = async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return noEncontrado(res, 'Invitación');

    const { data, error } = await req.auth.db
      .from('invitaciones')
      .delete()
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return noEncontrado(res, 'Invitación');
    res.json({ success: true, message: 'Invitación revocada correctamente', data });
  } catch (err) {
    next(err);
  }
};
