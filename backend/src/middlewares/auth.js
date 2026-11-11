import { isSupabaseConfigured, userClient } from '../config/supabase.js';

// Valida el token, resuelve organización y rol, y los deja en req.auth.
export const requireAuth = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ success: false, message: 'Supabase no está configurado en backend/.env' });
    }

    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Sesión requerida' });
    }

    const db = userClient(token);
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
    }

    let { data: miembro, error } = await db
      .from('miembros')
      .select('organizacion_id, rol')
      .eq('usuario_id', userData.user.id)
      .maybeSingle();

    if (error) {
      const missingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        String(error.message || '').includes('schema cache');

      if (missingTable) {
        miembro = {
          organizacion_id: userData.user.user_metadata?.organizacion_id || userData.user.id,
          rol: userData.user.user_metadata?.rol || 'admin',
        };
      } else {
        throw error;
      }
    }
    if (!miembro) {
      return res.status(403).json({ success: false, message: 'El usuario no pertenece a ninguna organización' });
    }

    req.auth = {
      db,
      token,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      organizacionId: miembro.organizacion_id,
      rol: miembro.rol,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth.rol)) {
    return res.status(403).json({
      success: false,
      message: `Tu rol (${req.auth.rol}) no tiene permiso para esta acción`,
    });
  }
  next();
};
