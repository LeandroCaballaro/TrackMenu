import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { cobrarMesa } from '../controllers/ventas.controller.js';

const router = Router();

// Cobrar es tarea del mostrador: admin y empleado. El rol de sólo lectura no.
router.use(requireAuth);
router.post('/', requireRole('admin', 'empleado'), cobrarMesa);

export default router;
