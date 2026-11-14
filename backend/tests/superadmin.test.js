import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDiasMora } from '../src/controllers/superadmin.controller.js';
import { requireRole } from '../src/middlewares/auth.js';
import superadminRoutes from '../src/routes/superadmin.routes.js';

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

test('calcularDiasMora devuelve 0 para organizaciones al día o fechas futuras', () => {
  assert.equal(calcularDiasMora(new Date(Date.now() + 86400000).toISOString(), 'al_dia'), 0);
  assert.equal(calcularDiasMora(new Date(Date.now() + 86400000).toISOString(), 'pendiente'), 0);
});

test('calcularDiasMora calcula días de retraso correctamente para fechas pasadas en mora', () => {
  const haceDiezDias = new Date(Date.now() - 10 * 86400000).toISOString();
  const dias = calcularDiasMora(haceDiezDias, 'mora');
  assert.ok(dias >= 9 && dias <= 11, `Días calculados (${dias}) deben rondar los 10 días`);
});

test('requireRole("superadmin") rechaza admin regular con 403 y permite superadmin', () => {
  const middleware = requireRole('superadmin');
  const resAdmin = mockRes();
  let nextLlamado = false;

  middleware({ auth: { rol: 'admin' } }, resAdmin, () => {
    nextLlamado = true;
  });

  assert.equal(resAdmin.statusCode, 403, 'Un admin de restaurante no debe acceder al panel de superadmin');
  assert.equal(nextLlamado, false);

  const resSuper = mockRes();
  let nextSuperLlamado = false;
  middleware({ auth: { rol: 'superadmin' } }, resSuper, () => {
    nextSuperLlamado = true;
  });

  assert.equal(nextSuperLlamado, true, 'El rol superadmin debe pasar exitosamente');
});

test('superadminRoutes registra todos los endpoints de organizaciones, mora y pagos', () => {
  const routes = superadminRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  assert.ok(routes.some((r) => r.path === '/kpis' && r.methods.includes('get')));
  assert.ok(routes.some((r) => r.path === '/organizaciones' && r.methods.includes('get')));
  assert.ok(routes.some((r) => r.path === '/organizaciones' && r.methods.includes('post')));
  assert.ok(routes.some((r) => r.path === '/organizaciones/:id' && r.methods.includes('put')));
  assert.ok(routes.some((r) => r.path === '/organizaciones/:id/pago' && r.methods.includes('post')));
  assert.ok(routes.some((r) => r.path === '/organizaciones/:id/suspender-mora' && r.methods.includes('post')));
  assert.ok(routes.some((r) => r.path === '/organizaciones/:id' && r.methods.includes('delete')));
});

