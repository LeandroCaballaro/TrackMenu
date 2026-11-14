import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  getKpis,
  getVentas,
  anularVenta,
  getAuditoria,
  getUsuarios,
  getUsuario,
  crearUsuario,
  cambiarRolUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from '../controllers/admin.controller.js';

const router = Router();

// Todas las rutas de este módulo requieren sesión autenticada y ROL ADMIN o SUPERADMIN
router.use(requireAuth);
router.use(requireRole('admin', 'superadmin'));

router.get('/dashboard/kpis', getKpis);
router.get('/ventas', getVentas);
router.post('/ventas/:id/anular', anularVenta);
router.get('/auditoria', getAuditoria);
router.get('/usuarios', getUsuarios);
router.get('/usuarios/:id', getUsuario);
router.post('/usuarios', crearUsuario);
router.post('/usuarios/rol', cambiarRolUsuario);
router.put('/usuarios/:id', actualizarUsuario);
router.delete('/usuarios/:id', eliminarUsuario);

export default router;

