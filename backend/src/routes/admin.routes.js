import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  getKpis,
  getVentas,
  anularVenta,
  getAuditoria,
  getUsuarios,
  crearUsuario,
  cambiarRolUsuario,
} from '../controllers/admin.controller.js';

const router = Router();

// Todas las rutas de este módulo requieren sesión autenticada y ROL ADMIN
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/dashboard/kpis', getKpis);
router.get('/ventas', getVentas);
router.post('/ventas/:id/anular', anularVenta);
router.get('/auditoria', getAuditoria);
router.get('/usuarios', getUsuarios);
router.post('/usuarios', crearUsuario);
router.post('/usuarios/rol', cambiarRolUsuario);

export default router;

