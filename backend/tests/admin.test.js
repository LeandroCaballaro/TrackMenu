import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDatosUsuario } from '../src/controllers/admin.controller.js';
import { requireRole } from '../src/middlewares/auth.js';
import authRoutes from '../src/routes/auth.routes.js';

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

test('validarDatosUsuario rechaza nombre/email inválidos, contraseñas cortas y roles no permitidos', () => {
  assert.equal(validarDatosUsuario({ nombre: '', email: 'a@b.com', password: 'password1' }).valido, false);
  assert.equal(validarDatosUsuario({ nombre: 'Ana', email: 'no-es-email', password: 'password1' }).valido, false);
  assert.equal(validarDatosUsuario({ nombre: 'Ana', email: 'ana@demo.com', password: '123' }).valido, false);
  assert.equal(validarDatosUsuario({ nombre: 'Ana', email: 'ana@demo.com', password: 'password1', rol: 'consulta' }).valido, false);
  assert.equal(validarDatosUsuario({ nombre: 'Ana', email: 'ana@demo.com', password: 'password1', rol: 'superadmin' }).valido, false);
});

test('validarDatosUsuario normaliza nombre y email correctamente', () => {
  const res = validarDatosUsuario({
    nombre: '  Sofía González  ',
    email: '  SOFIA@Demo.com ',
    password: 'password123',
    rol: 'empleado',
  });
  assert.equal(res.valido, true);
  assert.deepEqual(res.datos, {
    nombre: 'Sofía González',
    email: 'sofia@demo.com',
    password: 'password123',
    rol: 'empleado',
  });
});

test('requireRole("admin") rechaza empleado con 403 y permite admin', () => {
  const guard = requireRole('admin');

  let llamadoNext = false;
  const res = mockRes();
  guard({ auth: { rol: 'empleado' } }, res, () => { llamadoNext = true; });
  assert.equal(llamadoNext, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);

  let llamadoAdmin = false;
  const resAdmin = mockRes();
  guard({ auth: { rol: 'admin' } }, resAdmin, () => { llamadoAdmin = true; });
  assert.equal(llamadoAdmin, true);
});

test('authRoutes no expone el endpoint público /register', () => {
  const paths = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.equal(paths.includes('/register'), false);
  assert.equal(paths.includes('/login'), true);
  assert.equal(paths.includes('/me'), true);
});

