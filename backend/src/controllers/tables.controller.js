import { initialTables } from '../data/mockData.js';

let tables = JSON.parse(JSON.stringify(initialTables));

export const getTables = (req, res) => {
  res.json({ success: true, count: tables.length, data: tables });
};

export const getTableById = (req, res) => {
  const number = Number(req.params.number);
  const table = tables.find((t) => t.number === number);

  if (!table) {
    return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
  }

  res.json({ success: true, data: table });
};

export const releaseTable = (req, res) => {
  const number = Number(req.params.number);
  const tableIndex = tables.findIndex((t) => t.number === number);

  if (tableIndex === -1) {
    return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
  }

  tables[tableIndex].status = 'libre';
  tables[tableIndex].currentOrder = null;

  res.json({
    success: true,
    message: `Mesa ${number} cobrada y liberada con éxito`,
    data: tables[tableIndex],
  });
};

export const occupyTable = (req, res) => {
  const number = Number(req.params.number);
  const { order } = req.body;
  const tableIndex = tables.findIndex((t) => t.number === number);

  if (tableIndex === -1) {
    return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
  }

  tables[tableIndex].status = 'ocupada';
  tables[tableIndex].currentOrder = order || {
    id: 100 + number,
    time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    items: [],
    total: 0,
  };

  res.json({
    success: true,
    message: `Mesa ${number} ahora está ocupada`,
    data: tables[tableIndex],
  });
};
