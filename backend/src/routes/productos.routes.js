import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  notificarFaltaStock,
} from '../controllers/productos.controller.js';

const router = Router();

// Toda la sección es privada: sin sesión válida no se entra por ninguna ruta.
router.use(requireAuth);

router.get('/', listarProductos);
router.get('/:id', obtenerProducto);
router.post('/', requireRole('admin', 'empleado'), crearProducto);
router.post('/:id/notificar-stock', requireRole('admin', 'empleado'), notificarFaltaStock);
router.put('/:id', requireRole('admin', 'empleado'), actualizarProducto);
router.patch('/:id', requireRole('admin', 'empleado'), actualizarProducto);
router.delete('/:id', requireRole('admin'), eliminarProducto);

export default router;
