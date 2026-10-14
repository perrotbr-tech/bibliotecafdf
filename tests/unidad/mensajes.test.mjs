import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  armarRecordatorio,
  primerNombre,
  recordadoReciente,
  sustituirPlantilla,
} from '../../docs/js/mensajes.js';
import { textoFechaVencimiento } from '../../docs/js/fechas.js';

const ATRASO =
  'Hola {nombre}, te escribimos de la biblioteca. El libro «{titulo}» venció el {fecha}. ¿Puedes traerlo este sábado? ¡Gracias!';

test('R-01 mensaje de atraso con Ana Rojas y Radical', () => {
  const fecha = textoFechaVencimiento('2026-10-24', { anioDeReferencia: 2026 });
  const mensaje = sustituirPlantilla(ATRASO, {
    nombre: primerNombre('Ana Rojas'),
    titulo: 'Radical',
    fecha,
  });
  assert.equal(
    mensaje,
    'Hola Ana, te escribimos de la biblioteca. El libro «Radical» venció el sábado 24 de octubre. ¿Puedes traerlo este sábado? ¡Gracias!',
  );
});

test('R-02 fecha de otro año incluye el año', () => {
  assert.equal(
    textoFechaVencimiento('2025-06-21', { anioDeReferencia: 2026 }),
    'sábado 21 de junio de 2025',
  );
});

test('R-03 un solo nombre', () => {
  assert.equal(primerNombre('Pepita'), 'Pepita');
});

test('R-04 nombre literal {titulo}', () => {
  const mensaje = sustituirPlantilla(ATRASO, {
    nombre: '{titulo}',
    titulo: 'Radical',
    fecha: 'sábado 24 de octubre',
  });
  assert.match(mensaje, /^Hola \{titulo\},/u);
  assert.doesNotMatch(mensaje, /Hola Radical/u);
});

test('R-05 título con llaves sale literal', () => {
  const mensaje = sustituirPlantilla(ATRASO, {
    nombre: 'Ana',
    titulo: '{fecha} y {nombre}',
    fecha: 'sábado 24 de octubre',
  });
  assert.match(mensaje, /«\{fecha\} y \{nombre\}»/u);
});

test('R-06 $& $1 $$ y comillas salen tal cual', () => {
  const mensaje = sustituirPlantilla(ATRASO, {
    nombre: '$&',
    titulo: '$1 $$ "hola"',
    fecha: 'sábado 24 de octubre',
  });
  assert.match(mensaje, /Hola \$&,/u);
  assert.match(mensaje, /«\$1 \$\$ "hola"»/u);
});

test('R-07 enlace wa.me con teléfono de fixture', () => {
  const armado = armarRecordatorio({
    plantilla: ATRASO,
    nombre: 'Ana Rojas',
    titulo: 'Radical',
    fecha: 'sábado 24 de octubre',
    telefono: '56900000012',
  });
  assert.equal(armado.ok, true);
  assert.match(armado.enlace, /^https:\/\/wa\.me\/56900000012\?text=/u);
  assert.doesNotMatch(armado.mensaje, /\{nombre\}|\{titulo\}|\{fecha\}/u);
});

test('R-08 sin teléfono deja Copiar y no WhatsApp', () => {
  const armado = armarRecordatorio({
    plantilla: ATRASO,
    nombre: 'Ana',
    titulo: 'Radical',
    fecha: 'sábado 24 de octubre',
    telefono: null,
  });
  assert.equal(armado.ok, true);
  assert.equal(armado.sinTelefono, true);
  assert.equal(armado.enlace, null);
});

test('R-13 recordado reciente: 3 días sí, 7 días no', () => {
  const ahora = new Date('2026-10-31T15:00:00Z');
  assert.equal(recordadoReciente(new Date('2026-10-28T15:00:00Z'), ahora), true);
  assert.equal(recordadoReciente(new Date('2026-10-24T15:00:00Z'), ahora), false);
});

test('R-20 emojis y saltos de línea se codifican', () => {
  const armado = armarRecordatorio({
    plantilla: 'Hola {nombre} 🙂\n«{titulo}» vence {fecha}',
    nombre: 'Ana',
    titulo: 'Radical',
    fecha: 'sábado 24 de octubre',
    telefono: '56900000012',
  });
  assert.equal(armado.ok, true);
  assert.match(armado.enlace, /%0A|%F0%9F/u);
});
