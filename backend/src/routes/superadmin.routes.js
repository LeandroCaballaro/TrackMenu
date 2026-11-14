import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  getSuperAdminKpis,
  getOrganizaciones,
  crearOrganizacion,
  actualizarOrganizacion,
  registrarPagoSuscripcion,
  suspenderPorMora,
  eliminarOrganizacion,
} from '../controllers/superadmin.controller.js';

const router = Router();

// Todas las rutas de SuperAdmin requieren sesión autenticada y rol estricto 'superadmin'
router.use(requireAuth);
router.use(requireRole('superadmin'));

router.get('/kpis', getSuperAdminKpis);
router.get('/organizaciones', getOrganizaciones);
router.post('/organizaciones', crearOrganizacion);
router.put('/organizaciones/:id', actualizarOrganizacion);
router.post('/organizaciones/:id/pago', registrarPagoSuscripcion);
router.post('/organizaciones/:id/suspender-mora', suspenderPorMora);
router.delete('/organizaciones/:id', eliminarOrganizacion);

export default router;

