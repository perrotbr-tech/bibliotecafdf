// A-13 y validaciones de forma. Funciones puras: sin base, sin reloj.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  esCorreoValido,
  esIdValido,
  esNombreValido,
  esRolValido,
  normalizarCorreo,
  normalizarNombre,
  nuevoId,
  sustituirUnaPasada,
} from '../../docs/js/texto.js';

test('A-13 el correo se guarda en minúsculas y sin espacios', () => {
  assert.equal(normalizarCorreo(' Ana.Rojas@Example.com '), 'ana.rojas@example.com');
  assert.equal(normalizarCorreo('ANA@EXAMPLE.COM'), 'ana@example.com');
  // Espacios internos y tabulaciones también se van: un correo no los lleva.
  assert.equal(normalizarCorreo('ana rojas@example.com'), 'anarojas@example.com');
  assert.equal(normalizarCorreo('\tana@example.com\n'), 'ana@example.com');
  assert.equal(normalizarCorreo(null), '');
});

test('A-13 la forma del correo se valida después de normalizar', () => {
  assert.ok(esCorreoValido(' Ana.Rojas@Example.com '));
  assert.ok(!esCorreoValido('ana@example'));
  assert.ok(!esCorreoValido('ana'));
  assert.ok(!esCorreoValido('@example.com'));
  assert.ok(!esCorreoValido(''));
});

test('el nombre de un voluntario va de 1 a 60 caracteres', () => {
  assert.equal(normalizarNombre('  Ana   Rojas  '), 'Ana Rojas');
  assert.ok(esNombreValido('A'));
  assert.ok(esNombreValido('x'.repeat(60)));
  assert.ok(!esNombreValido('x'.repeat(61)));
  assert.ok(!esNombreValido('   '));
});

test('solo hay dos roles', () => {
  assert.ok(esRolValido('admin'));
  assert.ok(esRolValido('voluntario'));
  assert.ok(!esRolValido('jefe'));
  assert.ok(!esRolValido(''));
});

test('los identificadores tienen el formato que exigen las reglas', () => {
  const id = nuevoId();
  assert.ok(esIdValido(id), id);
  assert.equal(id.length, 32);
  assert.ok(!esIdValido('ABC'));
  assert.ok(!esIdValido(`${id}x`));
  assert.notEqual(nuevoId(), nuevoId());
});

test('las plantillas se sustituyen en una sola pasada', () => {
  // Si el valor trae otra marca, no se vuelve a sustituir.
  assert.equal(
    sustituirUnaPasada('Hola {nombre}, vence el {fecha}', { nombre: '{fecha}', fecha: 'sábado' }),
    'Hola {fecha}, vence el sábado',
  );
  // Una marca sin valor queda tal cual, no desaparece.
  assert.equal(sustituirUnaPasada('Hola {nombre}', {}), 'Hola {nombre}');
});
