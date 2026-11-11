import { supabase, isSupabaseConfigured, userClient } from '../config/supabase.js';

const isMissingTableError = (err) =>
  err?.code === 'PGRST205' || err?.code === '42P01' || String(err?.message || '').includes('schema cache');

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
    let { data: miembro, error: errorMiembro } = await db
      .from('miembros')
      .select('organizacion_id, rol, organizaciones(nombre)')
      .eq('usuario_id', data.user.id)
      .maybeSingle();

    let organizacionNombre = miembro?.organizaciones?.nombre || data.user.user_metadata?.organizacion || 'Mi Negocio';

    if (errorMiembro) {
      if (isMissingTableError(errorMiembro)) {
        miembro = {
          organizacion_id: data.user.user_metadata?.organizacion_id || data.user.id,
          rol: data.user.user_metadata?.rol || 'admin',
        };
      } else {
        throw errorMiembro;
      }
    } else if (!miembro) {
      try {
        const org = await crearOrganizacion(
          data.session.access_token,
          data.user.id,
          data.user.user_metadata?.organizacion || data.user.user_metadata?.name
        );
        miembro = { organizacion_id: org.id, rol: 'admin' };
        organizacionNombre = org.nombre;
      } catch (orgErr) {
        if (isMissingTableError(orgErr)) {
          miembro = {
            organizacion_id: data.user.user_metadata?.organizacion_id || data.user.id,
            rol: data.user.user_metadata?.rol || 'admin',
          };
        } else {
          throw orgErr;
        }
      }
    }

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: data.user,
        session: data.session,
        organizacion_id: miembro.organizacion_id,
        organizacion_nombre: organizacionNombre,
        rol: miembro.rol,
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
