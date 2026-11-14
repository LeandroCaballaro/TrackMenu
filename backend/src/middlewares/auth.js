import { isSupabaseConfigured, userClient } from '../config/supabase.js';

// Sólo valida la sesión. Lo usan las rutas a las que se entra antes de
// pertenecer a una organización (por ejemplo, aceptar una invitación).
export const requireSesion = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ success: false, message: 'Supabase no está configurado en backend/.env' });
    }

    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Sesión requerida' });
    }

    const db = userClient(token);
    const { data: userData, error } = await db.auth.getUser(token);
    if (error || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
    }

    req.auth = { db, token, usuarioId: userData.user.id, usuarioEmail: userData.user.email };
    next();
  } catch (err) {
    next(err);
  }
};

// Valida el token, resuelve organización y rol, y los deja en req.auth.
export const requireAuth = async (req, res, next) => {
  requireSesion(req, res, async () => {
    try {
      const { data: miembro, error } = await req.auth.db
        .from('miembros')
        .select('organizacion_id, rol')
        .eq('usuario_id', req.auth.usuarioId)
        .maybeSingle();

      if (error) throw error;
      if (!miembro) {
        return res.status(403).json({ success: false, message: 'El usuario no pertenece a ninguna organización' });
      }

      req.auth.organizacionId = miembro.organizacion_id;
      req.auth.rol = miembro.rol;
      next();
    } catch (err) {
      next(err);
    }
  });
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
