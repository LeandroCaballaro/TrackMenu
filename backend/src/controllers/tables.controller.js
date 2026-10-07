import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { initialTables } from '../data/mockData.js';

let localTables = JSON.parse(JSON.stringify(initialTables));

export const getTables = async (req, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('number', { ascending: true });

      if (error) throw error;
      return res.json({ success: true, count: data.length, data });
    }

    res.json({ success: true, count: localTables.length, data: localTables, note: 'Usando datos locales (configurá Supabase en .env)' });
  } catch (err) {
    next(err);
  }
};

export const getTableById = async (req, res, next) => {
  try {
    const number = Number(req.params.number);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('number', number)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
      }
      return res.json({ success: true, data });
    }

    const table = localTables.find((t) => t.number === number);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }
    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
};

export const releaseTable = async (req, res, next) => {
  try {
    const number = Number(req.params.number);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'libre', current_order: null })
        .eq('number', number)
        .select()
        .single();

      if (error) throw error;
      return res.json({
        success: true,
        message: `Mesa ${number} cobrada y liberada con éxito`,
        data,
      });
    }

    const tableIndex = localTables.findIndex((t) => t.number === number);
    if (tableIndex === -1) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    localTables[tableIndex].status = 'libre';
    localTables[tableIndex].currentOrder = null;

    res.json({
      success: true,
      message: `Mesa ${number} cobrada y liberada con éxito`,
      data: localTables[tableIndex],
    });
  } catch (err) {
    next(err);
  }
};

export const occupyTable = async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    const { order } = req.body;

    const newOrderData = order || {
      id: 100 + number,
      time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      items: [],
      total: 0,
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'ocupada', current_order: newOrderData })
        .eq('number', number)
        .select()
        .single();

      if (error) throw error;
      return res.json({
        success: true,
        message: `Mesa ${number} ahora está ocupada`,
        data,
      });
    }

    const tableIndex = localTables.findIndex((t) => t.number === number);
    if (tableIndex === -1) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    localTables[tableIndex].status = 'ocupada';
    localTables[tableIndex].currentOrder = newOrderData;

    res.json({
      success: true,
      message: `Mesa ${number} ahora está ocupada`,
      data: localTables[tableIndex],
    });
  } catch (err) {
    next(err);
  }
};
