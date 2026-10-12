// Fechas en America/Santiago, calculadas con Intl y sin desfase fijo.
// El alcance de la Etapa 1 son el día, su texto y la temporada.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diaEnChile, temporadaDe, temporadaDeInstante, textoFechaLarga } from '../../docs/js/fechas.js';

test('el día de la biblioteca es la fecha en Chile, no en UTC', () => {
  // Sábado 10-10-2026, 23:30 en Chile: en UTC ya es domingo 11.
  const instante = new Date('2026-10-10T23:30:00-03:00');
  assert.equal(instante.toISOString().slice(0, 10), '2026-10-11');
  assert.equal(diaEnChile(instante), '2026-10-10');
});

test('A-24 el texto de la barra es el de la fecha de Chile', () => {
  assert.equal(textoFechaLarga(new Date('2026-10-10T15:00:00-03:00')), 'sábado 10 de octubre de 2026');
});

test('el cambio de hora de Chile no mueve el día', () => {
  // Chile adelanta la hora en septiembre y la atrasa en abril. Con un desfase
  // fijo, estos dos instantes caerían en el día equivocado.
  assert.equal(diaEnChile(new Date('2026-09-06T04:30:00Z')), '2026-09-06');
  assert.equal(diaEnChile(new Date('2026-04-05T03:30:00Z')), '2026-04-04');
});

test('la temporada es el bimestre del día', () => {
  assert.equal(temporadaDe('2026-01-15'), '2026-1');
  assert.equal(temporadaDe('2026-02-28'), '2026-1');
  assert.equal(temporadaDe('2026-03-01'), '2026-2');
  assert.equal(temporadaDe('2026-09-01'), '2026-5');
  assert.equal(temporadaDe('2026-10-31'), '2026-5');
  assert.equal(temporadaDe('2026-11-01'), '2026-6');
  assert.equal(temporadaDe('2026-12-31'), '2026-6');
  assert.equal(temporadaDe('2028-01-01'), '2028-1');
});

test('la temporada de un instante usa el día de Chile', () => {
  // 31-10-2026 23:30 en Chile sigue siendo la temporada 2026-5, aunque en UTC
  // ya sea noviembre.
  assert.equal(temporadaDeInstante(new Date('2026-10-31T23:30:00-03:00')), '2026-5');
});

test('un día mal formado se rechaza en vez de inventar una temporada', () => {
  assert.throws(() => temporadaDe('10-10-2026'), TypeError);
  assert.throws(() => temporadaDe(''), TypeError);
  assert.throws(() => temporadaDe('2026-13-01'), RangeError);
});
