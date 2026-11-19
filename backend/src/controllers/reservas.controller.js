// Reservas con seña. El frontend las guardaba en el localStorage del
// navegador: existían en una sola máquina y se perdían al limpiarlo.
//
// El cobro de la seña NO se procesa acá: se guarda su estado (monto, método y
// comprobante) tal como lo informa quien toma la reserva. Cobrar de verdad
// exige integrar Mercado Pago con credenciales del local.

import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// El mismo valor que muestra la pantalla al cobrar (SENA_POR_PERSONA en el
// frontend): con dos cifras distintas, al cliente se le cobraba una y se le
// registraba otra.
const SENA_POR_PERSONA = 2500;
const montoSena = (personas) => personas * SENA_POR_PERSONA;

const codigoConfirmacion = () => randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

export const validarReserva = (body) => {
  const errores = {};
  const campos = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const texto = (v) => (typeof v === 'string' ? v.trim() : '');

  if (!FECHA.test(texto(campos.fecha))) {
    errores.fecha = 'La fecha debe tener el formato AAAA-MM-DD';
  } else if (campos.fecha < new Date().toISOString().slice(0, 10)) {
    errores.fecha = 'No se puede reservar para una fecha que ya pasó';
  }

  if (!HORA.test(texto(campos.hora))) errores.hora = 'La hora debe tener el formato HH:MM';

  const personas = Number(campos.personas);
  if (!Number.isInteger(personas) || personas < 1 || personas > 50) {
    errores.personas = 'La cantidad de personas debe ser un entero entre 1 y 50';
  }

  const mesa = Number(campos.mesa_numero);
  if (!Number.isInteger(mesa) || mesa < 1 || mesa > 999) {
    errores.mesa_numero = 'El número de mesa debe ser un entero entre 1 y 999';
  }

  const nombre = texto(campos.nombre_cliente);
  if (nombre.length < 2 || nombre.length > 80) {
    errores.nombre_cliente = 'El nombre debe tener entre 2 y 80 caracteres';
  }

  if (campos.telefono !== undefined && texto(campos.telefono).length > 40) {
    errores.telefono = 'El teléfono no puede superar los 40 caracteres';
  }
  if (campos.notas !== undefined && texto(campos.notas).length > 500) {
    errores.notas = 'Las notas no pueden superar los 500 caracteres';
  }

  // La seña es la condición para confirmar: sin ella la mesa no se bloquea.
  if (campos.sena_pagada !== true) {
    errores.sena_pagada = 'La reserva se confirma con la seña paga';
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datos: {
      fecha: texto(campos.fecha),
      hora: texto(campos.hora),
      personas,
      mesa_numero: mesa,
      mesa_capacidad: Number.isInteger(Number(campos.mesa_capacidad)) ? Number(campos.mesa_capacidad) : 4,
      nombre_cliente: nombre,
      telefono: texto(campos.telefono) || null,
      notas: texto(campos.notas) || null,
      sena_monto: montoSena(personas),
      sena_pagada: true,
      sena_metodo: texto(campos.sena_metodo) || 'mercadopago',
      sena_comprobante: texto(campos.sena_comprobante) || null,
    },
  };
};

// GET /api/reservas?fecha=AAAA-MM-DD&estado=confirmada
export const listarReservas = async (req, res, next) => {
  try {
    const { fecha, estado } = req.query;
    if (fecha && !FECHA.test(String(fecha))) {
      return res.status(400).json({
        success: false,
        message: 'Hay datos inválidos o incompletos',
        errors: { fecha: 'La fecha debe tener el formato AAAA-MM-DD' },
      });
    }

    let query = req.auth.db
      .from('reservas')
      .select('*')
      .eq('organizacion_id', req.auth.organizacionId);

    if (fecha) query = query.eq('fecha', fecha);
    query = estado ? query.eq('estado', estado) : query.neq('estado', 'cancelada');

    const { data, error } = await query.order('fecha').order('hora');
    if (error) throw error;

    res.json({ success: true, total: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const crearReserva = async (req, res, next) => {
  try {
    const { valido, errores, datos } = validarReserva(req.body);
    if (!valido) {
      return res.status(400).json({ success: false, message: 'Hay datos inválidos o incompletos', errors: errores });
    }

    if (datos.personas > datos.mesa_capacidad) {
      return res.status(409).json({
        success: false,
        message: `La mesa ${datos.mesa_numero} es para ${datos.mesa_capacidad} personas y la reserva es para ${datos.personas}`,
      });
    }

    const { data, error } = await req.auth.db
      .from('reservas')
      .insert([{
        ...datos,
        organizacion_id: req.auth.organizacionId,
        codigo_confirmacion: codigoConfirmacion(),
        creada_por: req.auth.usuarioId,
      }])
      .select()
      .single();

    // El índice único de mesa + fecha + hora es lo que corta el doble turno.
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        message: `La mesa ${datos.mesa_numero} ya está reservada ese día a las ${datos.hora}`,
      });
    }
    if (error) throw error;

    res.status(201).json({ success: true, message: 'Reserva confirmada correctamente', data });
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next, cambios, mensaje) => {
  try {
    if (!UUID.test(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    }

    const { data, error } = await req.auth.db
      .from('reservas')
      .update(cambios)
      .eq('id', req.params.id)
      .eq('organizacion_id', req.auth.organizacionId)
      .eq('estado', 'confirmada')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Reserva no encontrada o ya cerrada' });

    res.json({ success: true, message: mensaje, data });
  } catch (err) {
    next(err);
  }
};

export const confirmarAsistencia = (req, res, next) =>
  actualizar(
    req, res, next,
    { asistencia_confirmada: true, asistencia_confirmada_en: new Date().toISOString(), estado: 'cumplida' },
    'Asistencia confirmada: la reserva queda cumplida',
  );

export const cancelarReserva = (req, res, next) =>
  actualizar(req, res, next, { estado: 'cancelada' }, 'Reserva cancelada correctamente');
