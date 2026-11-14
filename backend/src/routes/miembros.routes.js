import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  listarMiembros,
  cambiarRol,
  quitarMiembro,
  listarInvitaciones,
  crearInvitacion,
  revocarInvitacion,
} from '../controllers/miembros.controller.js';

const router = Router();

router.use(requireAuth);

// Ver quién integra la organización lo puede hacer cualquier rol; administrarla,
// sólo el admin.
router.get('/', listarMiembros);
router.patch('/:usuarioId', requireRole('admin'), cambiarRol);
router.delete('/:usuarioId', requireRole('admin'), quitarMiembro);

export const invitacionesRouter = Router();
invitacionesRouter.use(requireAuth, requireRole('admin'));
invitacionesRouter.get('/', listarInvitaciones);
invitacionesRouter.post('/', crearInvitacion);
invitacionesRouter.delete('/:id', revocarInvitacion);

export default router;
