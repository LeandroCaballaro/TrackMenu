// Plano del salón: formas, mesas, caja y entrada que dibuja el admin.
// Se guardaba en el localStorage del navegador, así que el plano existía en
// una sola máquina y el resto del equipo no lo veía.

// El editor cambia la forma del JSON seguido; acá sólo se comprueba que tenga
// mesas usables y un tamaño razonable, no su estructura entera.
export const validarConfigMapa = (config) => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valido: false, error: 'La configuración del plano debe ser un objeto' };
  }

  if (!Array.isArray(config.mesas) || config.mesas.length === 0) {
    return { valido: false, error: 'El plano necesita al menos una mesa' };
  }

  if (config.mesas.length > 200) {
    return { valido: false, error: 'El plano no puede tener más de 200 mesas' };
  }

  for (const mesa of config.mesas) {
    const numero = Number(mesa?.numero);
    if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
      return { valido: false, error: 'Cada mesa necesita un número entero entre 1 y 999' };
    }
  }

  const numeros = config.mesas.map((m) => Number(m.numero));
  if (new Set(numeros).size !== numeros.length) {
    return { valido: false, error: 'Hay números de mesa repetidos en el plano' };
  }

  // 256 KB es de sobra para un plano y evita que un dibujo libre descontrolado
  // llene la fila.
  if (JSON.stringify(config).length > 256 * 1024) {
    return { valido: false, error: 'El plano es demasiado grande (máximo 256 KB)' };
  }

  return { valido: true };
};

export const obtenerMapa = async (req, res, next) => {
  try {
    const { data, error } = await req.auth.db
      .from('configuracion_mapa')
      .select('config, actualizado_en')
      .eq('organizacion_id', req.auth.organizacionId)
      .maybeSingle();

    if (error) throw error;

    // Sin plano guardado no es un error: la pantalla usa el suyo por defecto.
    res.json({ success: true, data: data?.config ?? null, actualizado_en: data?.actualizado_en ?? null });
  } catch (err) {
    next(err);
  }
};

export const guardarMapa = async (req, res, next) => {
  try {
    const config = req.body?.config ?? req.body;
    const { valido, error: motivo } = validarConfigMapa(config);
    if (!valido) {
      return res.status(400).json({ success: false, message: motivo });
    }

    const { data, error } = await req.auth.db
      .from('configuracion_mapa')
      .upsert({
        organizacion_id: req.auth.organizacionId,
        config,
        actualizado_en: new Date().toISOString(),
        actualizado_por: req.auth.usuarioId,
      }, { onConflict: 'organizacion_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'Plano guardado correctamente', data: data.config });
  } catch (err) {
    next(err);
  }
};
