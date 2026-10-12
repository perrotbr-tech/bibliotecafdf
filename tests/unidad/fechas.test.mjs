// Fechas en America/Santiago, calculadas con Intl y sin desfase fijo.
// El alcance de la Etapa 1 son el día, su texto y la temporada.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  diaDesplazado,
  diaEnChile,
  esDiaValido,
  finDelDiaEnChile,
  instanteEnChile,
  mediodiaEnChile,
  primerInstanteEnChile,
  temporadaDe,
  temporadaDeInstante,
  textoFechaLarga,
} from '../../docs/js/fechas.js';

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

// ---------------------------------------------------------------------------
// Etapa 2: de una fecha del archivo a un instante.
// ---------------------------------------------------------------------------

test('el mediodía de Chile se calcula con el desfase de ese día, no con uno fijo', () => {
  // En enero Chile va en -03; en junio, en -04. El mediodía de pared es el
  // mediodía de pared en los dos casos.
  assert.equal(mediodiaEnChile('2026-01-15').toISOString(), '2026-01-15T15:00:00.000Z');
  assert.equal(mediodiaEnChile('2026-06-20').toISOString(), '2026-06-20T16:00:00.000Z');
  for (const dia of ['2026-01-15', '2026-04-04', '2026-04-05', '2026-09-05', '2026-09-06', '2026-06-20']) {
    assert.equal(diaEnChile(mediodiaEnChile(dia)), dia, dia);
  }
});

test('el fin de un día es un milisegundo antes del primer instante del siguiente', () => {
  const fin = finDelDiaEnChile('2026-01-15');
  assert.equal(fin.toISOString(), '2026-01-16T02:59:59.999Z');
  assert.equal(diaEnChile(fin), '2026-01-15');
  assert.equal(diaEnChile(fin.getTime() + 1), '2026-01-16');
});

test('el día que el reloj atrasa dura 25 horas, y el que adelanta, 23', () => {
  // OJO con cuál es cuál. El reloj de Chile se mueve a las 00:00, así que la
  // hora que sobra o falta cae en el BORDE entre dos días:
  //   · la madrugada del 05-04-2026 el reloj vuelve a las 23:00 del día 4, de
  //     modo que el día largo es el SÁBADO 4, no el domingo 5;
  //   · la madrugada del 06-09-2026 el reloj salta de las 00:00 a la 01:00, y
  //     ahí sí el día corto es el domingo 6, que empieza una hora más tarde.
  // Lo comprobé contra Intl antes de escribirlo, porque el primer supuesto
  // —que el día largo era el 5— estaba equivocado.
  const horas = (dia) =>
    (finDelDiaEnChile(dia).getTime() - primerInstanteEnChile(dia).getTime() + 1) / (60 * 60 * 1000);
  assert.equal(horas('2026-04-04'), 25);
  assert.equal(horas('2026-04-05'), 24);
  assert.equal(horas('2026-09-06'), 23);
  assert.equal(horas('2026-09-05'), 24);
});

test('el día que adelanta el reloj no empieza a medianoche, y la bisección lo sabe', () => {
  // El 06-09-2026 la medianoche de Chile NO existe: el día empieza a la 01:00.
  // Por eso el primer instante se busca por bisección y no se supone.
  const primero = primerInstanteEnChile('2026-09-06');
  assert.equal(primero.toISOString(), '2026-09-06T04:00:00.000Z');
  assert.equal(diaEnChile(primero), '2026-09-06');
  assert.equal(diaEnChile(primero.getTime() - 1), '2026-09-05');
  // Pedir «las 00:00» de ese día cae en el día anterior: no se usa para esto.
  assert.equal(diaEnChile(instanteEnChile('2026-09-06', 0)), '2026-09-05');
});

test('todo día del año tiene un primer instante que le pertenece', () => {
  // Barrido de 2026 completo: ni un día sin principio ni un principio ajeno.
  for (let dia = '2026-01-01'; dia <= '2026-12-31'; dia = diaDesplazado(dia, 1)) {
    const primero = primerInstanteEnChile(dia);
    assert.equal(diaEnChile(primero), dia, dia);
    assert.equal(diaEnChile(primero.getTime() - 1), diaDesplazado(dia, -1), dia);
  }
});

test('C-42 una fecha que no existe en el calendario se reconoce como tal', () => {
  for (const malo of ['2025-02-30', '2025-02-29', '2025-13-01', '2025-00-10', '2025-04-31', '10-10-2026', '', null]) {
    assert.equal(esDiaValido(malo), false, JSON.stringify(malo));
  }
  for (const bueno of ['2024-02-29', '2025-02-28', '2026-12-31', '2026-01-01']) {
    assert.equal(esDiaValido(bueno), true, bueno);
  }
});

test('el desplazamiento de días cruza meses, años y cambios de hora', () => {
  assert.equal(diaDesplazado('2026-12-31', 1), '2027-01-01');
  assert.equal(diaDesplazado('2026-01-01', -1), '2025-12-31');
  assert.equal(diaDesplazado('2024-02-28', 1), '2024-02-29');
  assert.equal(diaDesplazado('2026-04-04', 1), '2026-04-05');
  assert.equal(diaDesplazado('2026-10-10', 14), '2026-10-24');
});
