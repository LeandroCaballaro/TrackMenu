let orders = [
  {
    id: 104,
    tableNumber: 4,
    time: '20:14',
    status: 'en_preparacion',
    items: [
      { id: 1, name: 'Burger clásica', price: 1890, quantity: 1 },
      { id: 2, name: 'Papas a la piedra', price: 950, quantity: 1 },
    ],
    total: 2840,
    createdAt: new Date().toISOString(),
  },
];

export const getOrders = (req, res) => {
  const { table } = req.query;
  if (table) {
    const filtered = orders.filter((o) => o.tableNumber === Number(table));
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: orders.length, data: orders });
};

export const createOrder = (req, res) => {
  const { tableNumber, items } = req.body;

  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Número de mesa e items son requeridos para crear una orden',
    });
  }

  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

  const newOrder = {
    id: orders.length > 0 ? Math.max(...orders.map((o) => o.id)) + 1 : 101,
    tableNumber: Number(tableNumber),
    status: 'en_preparacion',
    time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    items,
    total,
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder);

  res.status(201).json({
    success: true,
    message: 'Pedido enviado a cocina correctamente',
    data: newOrder,
  });
};

export const updateOrderStatus = (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const order = orders.find((o) => o.id === id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
  }

  if (status) {
    order.status = status;
  }

  res.json({ success: true, message: 'Estado de pedido actualizado', data: order });
};
