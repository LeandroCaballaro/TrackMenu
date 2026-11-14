// Carta que ve el cliente al escanear el QR de la mesa: sin sesión.
// carta_publica() expone sólo lo que va impreso en una carta; la tabla de
// productos sigue cerrada para quien no pertenece a la organización.

import { supabase, isSupabaseConfigured } from '../config/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cartaPublica = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ success: false, message: 'Supabase no está configurado en backend/.env' });
    }

    const { organizacionId } = req.params;
    if (!UUID.test(organizacionId)) {
      return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    }

    const { data, error } = await supabase.rpc('carta_publica', { organizacion: organizacionId });
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Esta carta no existe o todavía no tiene productos disponibles',
      });
    }

    res.json({
      success: true,
      data: {
        organizacion: data[0].organizacion_nombre,
        productos: data.map((p) => ({
          id: p.producto_id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: Number(p.precio),
          imagen_url: p.imagen_url,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
