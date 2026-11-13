// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarProducto } from '../src/controllers/productos.controller.js';

test('rechaza alta sin campos obligatorios', () => {
  const r = validarProducto({});
  assert.equal(r.valido, false);
  assert.ok(r.errores.nombre);
  assert.ok(r.errores.precio);
});

test('rechaza formatos inválidos', () => {
  const r = validarProducto({ nombre: 'A', precio: 'abc', stock: 1.5, activo: 'si', imagen_url: 'foto.png' });
  assert.equal(r.valido, false);
  assert.deepEqual(
    Object.keys(r.errores).sort(),
    ['activo', 'imagen_url', 'nombre', 'precio', 'stock']
  );
});

test('acepta un alta válida y normaliza', () => {
  const r = validarProducto({ nombre: '  Milanesa  ', precio: '1500.50', descripcion: ' rica ' });
  assert.equal(r.valido, true);
  assert.equal(r.datos.nombre, 'Milanesa');
  assert.equal(r.datos.precio, 1500.5);
  assert.equal(r.datos.descripcion, 'rica');
  assert.equal(r.datos.stock, 0);
});

test('la modificación usa las mismas reglas que el alta', () => {
  assert.equal(validarProducto({ precio: -1 }, { parcial: true }).valido, false);
  assert.equal(validarProducto({ nombre: 'X' }, { parcial: true }).valido, false);
  // parcial: no exige los obligatorios, pero sí valida lo que llega
  const ok = validarProducto({ precio: 10 }, { parcial: true });
  assert.equal(ok.valido, true);
  assert.deepEqual(ok.datos, { precio: 10 });
});

test('precio y stock en cero son válidos', () => {
  const r = validarProducto({ nombre: 'Agua', precio: 0, stock: 0 });
  assert.equal(r.valido, true);
});

test('rechaza objetos y arrays en vez de texto o número', () => {
  assert.equal(validarProducto({ nombre: { a: 1 }, precio: 10 }).valido, false);
  assert.equal(validarProducto({ nombre: ['a', 'b'], precio: 10 }).valido, false);
  assert.equal(validarProducto({ nombre: 'Ok', precio: true }).valido, false);
  assert.equal(validarProducto({ nombre: 'Ok', precio: [1] }).valido, false);
  assert.ok(validarProducto({ nombre: 'Ok', precio: 1, descripcion: { x: 1 } }).errores.descripcion);
});

test('rechaza valores que no entran en la columna', () => {
  assert.ok(validarProducto({ nombre: 'Ok', precio: 1e21 }).errores.precio);
  assert.ok(validarProducto({ nombre: 'Ok', precio: 1, stock: 99999999999999 }).errores.stock);
  // los topes exactos sí entran
  assert.equal(validarProducto({ nombre: 'Ok', precio: 9999999999.99, stock: 2147483647 }).valido, true);
});

test('no explota con un cuerpo que no es objeto', () => {
  for (const body of [null, undefined, 'hola', 42, ['a']]) {
    assert.equal(validarProducto(body).valido, false);
  }
});

test('acepta imágenes http(s) y data URLs cargadas desde dispositivo', () => {
  const rHttp = validarProducto({ nombre: 'Pizza', precio: 100, imagen_url: 'https://images.unsplash.com/photo-1' });
  assert.equal(rHttp.valido, true);
  assert.equal(rHttp.datos.imagen_url, 'https://images.unsplash.com/photo-1');

  const rData = validarProducto({ nombre: 'Burger', precio: 120, imagen_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' });
  assert.equal(rData.valido, true);
  assert.equal(rData.datos.imagen_url, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
});
