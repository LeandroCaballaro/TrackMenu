import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  listarReservas,
  crearReserva,
  confirmarAsistencia,
  cancelarReserva,
} from '../controllers/reservas.controller.js';

const router = Router();

router.use(requireAuth);

// La agenda la mira todo el equipo; tomarlas y cerrarlas, el mostrador.
router.get('/', listarReservas);
router.post('/', requireRole('admin', 'empleado'), crearReserva);
router.patch('/:id/asistencia', requireRole('admin', 'empleado'), confirmarAsistencia);
router.delete('/:id', requireRole('admin', 'empleado'), cancelarReserva);

export default router;
