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

// El cliente consulta su reserva con el código que le dieron, sin sesión.
// reserva_por_codigo() devuelve sólo lo que necesita ver quien ya tiene el
// código: ni el teléfono, ni las notas internas, ni el comprobante de la seña.
export const reservaPorCodigo = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ success: false, message: 'Supabase no está configurado en backend/.env' });
    }

    const codigo = String(req.params.codigo || '').trim();
    if (!/^[A-Za-z0-9]{4,16}$/.test(codigo)) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    const { data, error } = await supabase.rpc('reserva_por_codigo', { codigo });
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'No encontramos ninguna reserva con ese código' });
    }

    const r = data[0];
    res.json({
      success: true,
      data: {
        organizacion: r.organizacion_nombre,
        codigo_confirmacion: r.codigo_confirmacion,
        fecha: r.fecha,
        hora: r.hora,
        personas: r.personas,
        mesa_numero: r.mesa_numero,
        nombre_cliente: r.nombre_cliente,
        sena_monto: Number(r.sena_monto),
        sena_pagada: r.sena_pagada,
        asistencia_confirmada: r.asistencia_confirmada,
        estado: r.estado,
      },
    });
  } catch (err) {
    next(err);
  }
};
