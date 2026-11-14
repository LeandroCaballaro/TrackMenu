import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listarComandas, enviarPedido, cancelarComanda } from '../controllers/comandas.controller.js';

const router = Router();

router.use(requireAuth);

// El mapa de mesas lo mira todo el equipo; tomar y cerrar pedidos, el mostrador.
router.get('/', listarComandas);
router.post('/', requireRole('admin', 'empleado'), enviarPedido);
router.delete('/:id', requireRole('admin', 'empleado'), cancelarComanda);

export default router;
