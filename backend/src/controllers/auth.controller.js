import { supabase, isSupabaseConfigured, userClient } from '../config/supabase.js';

// Alta de la organización del usuario que se registra: queda como admin.
// Se hace con el token del propio usuario, así RLS sigue aplicando.
const crearOrganizacion = async (token, usuarioId, nombre) => {
  const db = userClient(token);
  const { data: org, error: errorOrg } = await db
    .from('organizaciones')
    .insert([{ nombre: nombre?.trim() || 'Mi negocio' }])
    .select()
    .single();
  if (errorOrg) throw errorOrg;

  const { error: errorMiembro } = await db
    .from('miembros')
    .insert([{ usuario_id: usuarioId, organizacion_id: org.id, rol: 'admin' }]);
  if (errorMiembro) throw errorMiembro;

  return org;
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

    const db = userClient(data.session.access_token);
    let { data: miembro } = await db
      .from('miembros')
      .select('organizacion_id, rol')
      .eq('usuario_id', data.user.id)
      .maybeSingle();

    if (!miembro) {
      const org = await crearOrganizacion(data.session.access_token, data.user.id, data.user.user_metadata?.name);
      miembro = { organizacion_id: org.id, rol: 'admin' };
    }

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: data.user,
        session: data.session,
        organizacion_id: miembro.organizacion_id,
        rol: miembro.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { email, password, name, organizacion } = req.body;

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

    // Sin sesión (Supabase pide confirmar el email) no se puede crear la
    // organización todavía: se crea en el primer login.
    const org = data.session
      ? await crearOrganizacion(data.session.access_token, data.user.id, organizacion || name)
      : null;

    res.status(201).json({
      success: true,
      message: org
        ? 'Usuario y organización registrados exitosamente'
        : 'Usuario registrado. Confirmá tu email e iniciá sesión para crear tu organización',
      data: {
        user: data.user,
        session: data.session,
        organizacion: org,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Protegida con requireAuth: devuelve también organización y rol.
export const getCurrentUser = async (req, res) => {
  const { usuarioId, organizacionId, rol } = req.auth;
  res.json({ success: true, data: { id: usuarioId, organizacion_id: organizacionId, rol } });
};
