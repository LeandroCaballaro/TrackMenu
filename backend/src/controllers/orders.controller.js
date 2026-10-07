import { supabase, isSupabaseConfigured } from '../config/supabase.js';

let localOrders = [
  {
    id: 104,
    table_number: 4,
    time: '20:14',
    status: 'en_preparacion',
    items: [
      { id: 1, name: 'Burger clásica', price: 1890, quantity: 1 },
      { id: 2, name: 'Papas a la piedra', price: 950, quantity: 1 },
    ],
    total: 2840,
    created_at: new Date().toISOString(),
  },
];

export const getOrders = async (req, res, next) => {
  try {
    const { table } = req.query;

    if (isSupabaseConfigured()) {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (table) {
        query = query.eq('table_number', Number(table));
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ success: true, count: data.length, data });
    }

    let filtered = localOrders;
    if (table) {
      filtered = filtered.filter((o) => o.table_number === Number(table));
    }
    res.json({ success: true, count: filtered.length, data: filtered, note: 'Usando datos locales (configurá Supabase en .env)' });
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const { tableNumber, items } = req.body;

    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Número de mesa e items son requeridos para crear una orden',
      });
    }

    const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const timeStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('orders')
        .insert([
          {
            table_number: Number(tableNumber),
            status: 'en_preparacion',
            time: timeStr,
            items,
            total,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({
        success: true,
        message: 'Pedido enviado a cocina correctamente',
        data,
      });
    }

    const newOrder = {
      id: localOrders.length > 0 ? Math.max(...localOrders.map((o) => o.id)) + 1 : 101,
      table_number: Number(tableNumber),
      status: 'en_preparacion',
      time: timeStr,
      items,
      total,
      created_at: new Date().toISOString(),
    };

    localOrders.push(newOrder);

    res.status(201).json({
      success: true,
      message: 'Pedido enviado a cocina correctamente',
      data: newOrder,
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, message: 'Estado de pedido actualizado', data });
    }

    const order = localOrders.find((o) => o.id === id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    if (status) {
      order.status = status;
    }

    res.json({ success: true, message: 'Estado de pedido actualizado', data: order });
  } catch (err) {
    next(err);
  }
};
