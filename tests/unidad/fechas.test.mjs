// Fechas en America/Santiago, calculadas con Intl y sin desfase fijo.
// El alcance de la Etapa 1 son el día, su texto y la temporada.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  diaDeVencimiento,
  diaDesplazado,
  diaEnChile,
  documentoDeCalendario,
  esDiaValido,
  esSabado,
  finDelDiaEnChile,
  fueATiempo,
  instanteEnChile,
  mediodiaEnChile,
  primerInstanteEnChile,
  sabadoDeJornada,
  sabadoSiguiente,
  sabadosEnRango,
  sabadosEntre,
  temporadaDe,
  temporadaDeInstante,
  textoAtraso,
  textoFechaLarga,
  textoFechaVencimiento,
  venceElDe,
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

test('sabadosEntre corta en el tope: una fecha disparatada no camina el calendario', () => {
  // `esDiaValido` acepta cualquier año de cuatro cifras, así que un `vence`
  // mal tecleado como 9999-10-17 hacía recorrer tres millones de días en el
  // paso que solo debía validar y no escribir nada.
  const antes = performance.now();
  assert.equal(sabadosEntre('2026-10-03', '9999-10-17', 5), 5);
  const tardo = performance.now() - antes;
  assert.ok(tardo < 50, `tardó ${tardo.toFixed(0)} ms`);
  // Sin alcanzar el tope, la cuenta es exacta.
  assert.equal(sabadosEntre('2026-10-03', '2026-10-24', 5), 3);
  assert.equal(sabadosEntre('2026-10-03', '2026-10-10'), 1);
});

// ---------------------------------------------------------------------------
// Etapa 3: sábados, vencimientos y atrasos.
// ---------------------------------------------------------------------------

test('P-14 préstamo a las 23:30 de un sábado en Chile sigue siendo ese sábado', () => {
  assert.equal(diaEnChile(new Date('2026-10-10T23:30:00-03:00')), '2026-10-10');
  assert.equal(esSabado('2026-10-10'), true);
});

test('P-13 vencimientos: sábado, martes, viernes y fin de año', () => {
  assert.equal(diaDeVencimiento('2026-10-10', 1), '2026-10-17');
  assert.equal(diaDeVencimiento('2026-10-10', 2), '2026-10-24');
  assert.equal(diaDeVencimiento('2026-10-10', 4), '2026-11-07');
  assert.equal(diaDeVencimiento('2026-10-13', 1), '2026-10-17');
  assert.equal(diaDeVencimiento('2026-10-16', 1), '2026-10-17');
  assert.equal(diaDeVencimiento('2026-12-26', 2), '2027-01-09');
});

test('P-12 préstamo del sábado 07-03-2026 a 4 sábados vence el 04-04 con cambio de hora', () => {
  assert.equal(diaDeVencimiento('2026-03-07', 4), '2026-04-04');
  const prestamo = new Date('2026-03-07T00:30:00-03:00');
  const vence = venceElDe('2026-03-07', 4);
  assert.equal(diaEnChile(vence), '2026-04-04');
  assert.equal(diaEnChile(vence.getTime() + 1), '2026-04-05');
  // 29 días y 30 minutos menos un milisegundo desde el préstamo.
  const esperadoMs = 29 * 86_400_000 + 30 * 60_000 - 1;
  assert.equal(vence.getTime() - prestamo.getTime(), esperadoMs);
});

test('P-15 cada sábado de 2026 y 2027 vence en sábado y termina un ms antes del domingo', () => {
  for (const anio of [2026, 2027]) {
    for (const salida of sabadosEnRango(`${anio}-01-01`, `${anio}-12-31`)) {
      for (const plazo of [1, 2, 3, 4]) {
        const dia = diaDeVencimiento(salida, plazo);
        assert.equal(esSabado(dia), true, `${salida} plazo ${plazo} → ${dia}`);
        const vence = venceElDe(salida, plazo);
        assert.equal(diaEnChile(vence), dia, `${salida} plazo ${plazo}`);
        assert.equal(diaEnChile(vence.getTime() + 1), diaDesplazado(dia, 1));
      }
    }
  }
});

test('P-16 temporada al borde de octubre y noviembre en Chile', () => {
  assert.equal(temporadaDeInstante(new Date('2026-10-31T23:30:00-03:00')), '2026-5');
  assert.equal(temporadaDeInstante(new Date('2026-11-01T00:10:00-03:00')), '2026-6');
});

test('P-42 texto de atraso a 3, 7, 15 y 70 días', () => {
  const vence = finDelDiaEnChile('2026-10-10');
  assert.equal(textoAtraso(vence, mediodiaEnChile('2026-10-13')), 'Venció el sábado');
  assert.equal(textoAtraso(vence, mediodiaEnChile('2026-10-17')), 'Atrasado 1 sábado');
  assert.equal(textoAtraso(vence, mediodiaEnChile('2026-10-25')), 'Atrasado 2 sábados');
  assert.equal(textoAtraso(vence, mediodiaEnChile('2026-12-19')), 'Atrasado 2 meses');
});

test('sabadoSiguiente y sabadoDeJornada', () => {
  assert.equal(sabadoSiguiente('2026-10-10'), '2026-10-17');
  assert.equal(sabadoSiguiente('2026-10-09'), '2026-10-10');
  assert.equal(sabadoDeJornada('2026-10-10'), '2026-10-10');
  assert.equal(sabadoDeJornada('2026-10-13'), '2026-10-17');
});

test('fueATiempo usa el booleano si existe y si no compara timestamps', () => {
  const vence = finDelDiaEnChile('2026-10-10');
  assert.equal(fueATiempo({ devueltoATiempo: true, devueltoEn: mediodiaEnChile('2026-10-20'), venceEl: vence }), true);
  assert.equal(fueATiempo({ devueltoATiempo: false, devueltoEn: mediodiaEnChile('2026-10-09'), venceEl: vence }), false);
  assert.equal(fueATiempo({ devueltoEn: mediodiaEnChile('2026-10-10'), venceEl: vence }), true);
  assert.equal(fueATiempo({ devueltoEn: mediodiaEnChile('2026-10-11'), venceEl: vence }), false);
});

test('P-17 y P-18 devolver a las 23:00 del vencimiento es a tiempo; al día siguiente, no', () => {
  // El vencimiento termina un milisegundo antes del domingo, así que las 23:00
  // del sábado entran y la mañana del domingo no. Sin booleano adelantado: la
  // decisión sale de los dos timestamps ya confirmados.
  const vence = finDelDiaEnChile('2026-10-10');
  assert.equal(
    fueATiempo({ devueltoEn: instanteEnChile('2026-10-10', 23, 0), venceEl: vence, devueltoATiempo: null }),
    true,
  );
  assert.equal(
    fueATiempo({ devueltoEn: instanteEnChile('2026-10-11', 9, 0), venceEl: vence, devueltoATiempo: null }),
    false,
  );
});

test('textoFechaVencimiento omite el año en curso y lo pone si no lo es', () => {
  assert.equal(
    textoFechaVencimiento('2026-10-24', { anioDeReferencia: 2026 }),
    'sábado 24 de octubre',
  );
  assert.equal(
    textoFechaVencimiento('2025-06-21', { anioDeReferencia: 2026 }),
    'sábado 21 de junio de 2025',
  );
});

test('documentoDeCalendario solo admite sábados y trae cuatro vencimientos', () => {
  const doc = documentoDeCalendario('2026-10-10');
  assert.equal(doc.temporada, '2026-5');
  assert.equal(doc.vencimientos.length, 4);
  assert.equal(diaEnChile(doc.vencimientos[1]), '2026-10-24');
  assert.throws(() => documentoDeCalendario('2026-10-13'), RangeError);
});
