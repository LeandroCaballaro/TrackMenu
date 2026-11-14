import { supabase, isSupabaseConfigured, userClient } from '../config/supabase.js';


// Alta de la organización del usuario que se registra: queda como admin.
// fundar_organizacion() crea la organización y la membresía en un solo paso,
// con el token del propio usuario, y falla si ya pertenece a alguna.
const crearOrganizacion = async (token, nombre) => {
  const { data, error } = await userClient(token)
    .rpc('fundar_organizacion', { nombre_organizacion: nombre ?? '' });

  if (error) throw error;
  return { id: data[0].organizacion_id, nombre: nombre?.trim() || 'Mi negocio' };
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Supabase no está configurado. Por favor define SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env',
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ success: false, message: error.message });
    }

    // No se funda una organización acá: si entrás antes de aceptar una
    // invitación, te quedarías con un negocio propio y la invitación dejaría
    // de servir. Sin organización, el cliente ofrece crearla o usar un código.
    const { data: miembro } = await userClient(data.session.access_token)
      .from('miembros')
      .select('organizacion_id, rol, organizaciones(nombre)')
      .eq('usuario_id', data.user.id)
      .maybeSingle();


    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: data.user,
        session: data.session,
        organizacion_id: miembro?.organizacion_id ?? null,
        organizacion_nombre: miembro?.organizaciones?.nombre ?? null,
        rol: miembro?.rol ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { email, password, name, organizacion, codigo_invitacion } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Supabase no está configurado. Por favor define SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env',
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
        },
      },
    });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Sin sesión (Supabase pide confirmar el email) no se puede resolver la
    // organización todavía: se resuelve en el primer login.
    let org = null;
    let rol = null;

    if (data.session) {
      if (codigo_invitacion) {
        // Se suma a una organización existente con el rol de la invitación.
        const { data: aceptada, error: errorInv } = await userClient(data.session.access_token)
          .rpc('aceptar_invitacion', { codigo_invitacion });

        if (errorInv) {
          return res.status(400).json({ success: false, message: errorInv.message });
        }
        org = { id: aceptada[0].organizacion_id };
        rol = aceptada[0].rol;
      } else {
        org = await crearOrganizacion(data.session.access_token, organizacion || name);
        rol = 'admin';
      }
    }

    res.status(201).json({
      success: true,
      message: org
        ? 'Usuario y organización registrados exitosamente'
        : 'Usuario registrado. Confirmá tu email e iniciá sesión para completar el alta',
      data: {
        user: data.user,
        session: data.session,
        organizacion: org,
        rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Para quien se registró, confirmó el email y todavía no tiene negocio.
export const fundarOrganizacion = async (req, res, next) => {
  try {
    const { nombre } = req.body ?? {};
    if (nombre !== undefined && typeof nombre !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Hay datos inválidos o incompletos',
        errors: { nombre: 'El nombre debe ser texto' },
      });
    }

    const { data, error } = await req.auth.db
      .rpc('fundar_organizacion', { nombre_organizacion: nombre ?? '' });

    if (error) return res.status(400).json({ success: false, message: error.message });

    res.status(201).json({
      success: true,
      message: 'Organización creada correctamente',
      data: { organizacion_id: data[0].organizacion_id, rol: data[0].rol },
    });
  } catch (err) {
    next(err);
  }
};

// Para un usuario ya registrado que todavía no pertenece a ninguna organización.
export const aceptarInvitacion = async (req, res, next) => {
  try {
    const codigo = req.body?.codigo;
    if (!codigo || typeof codigo !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Hay datos inválidos o incompletos',
        errors: { codigo: 'El código de invitación es obligatorio' },
      });
    }

    const { data, error } = await req.auth.db.rpc('aceptar_invitacion', { codigo_invitacion: codigo });
    if (error) return res.status(400).json({ success: false, message: error.message });

    res.json({
      success: true,
      message: 'Te sumaste a la organización correctamente',
      data: { organizacion_id: data[0].organizacion_id, rol: data[0].rol },
    });
  } catch (err) {
    next(err);
  }
};

// Protegida con requireAuth: devuelve también organización y rol.
export const getCurrentUser = async (req, res, next) => {
  try {
    const { usuarioId, usuarioEmail, organizacionId, rol } = req.auth;

    const { data: org } = await req.auth.db
      .from('organizaciones')
      .select('nombre')
      .eq('id', organizacionId)
      .maybeSingle();

    res.json({
      success: true,
      data: {
        id: usuarioId,
        email: usuarioEmail,
        organizacion_id: organizacionId,
        organizacion_nombre: org?.nombre ?? null,
        rol,
      },
    });
  } catch (err) {
    next(err);
  }
};
