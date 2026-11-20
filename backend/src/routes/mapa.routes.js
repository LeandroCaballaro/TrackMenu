import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { obtenerMapa, guardarMapa } from '../controllers/mapa.controller.js';

const router = Router();

router.use(requireAuth);

// Dibujar el salón define cuántas mesas hay: es del dueño.
router.get('/', obtenerMapa);
router.put('/', requireRole('admin'), guardarMapa);

export default router;
