// A-22, A-23, A-24, A-32, A-33 y A-34: hora verificada (contrato §2).
//
// `tomarMuestra` y el reloj monotónico se inyectan, así que estas pruebas no
// necesitan red. Lo que se prueba aquí es la decisión: cuándo una muestra vale,
// cuándo se descarta y cuándo `ahora()` tiene que devolver null.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESFASE_AVISABLE_MS,
  crearReloj,
  crearRelojDePrueba,
  instanteDeParametro,
} from '../../docs/js/reloj.js';

/** Reloj monotónico de mentira, que solo avanza cuando la prueba lo dice. */
function monotonicoDeMentira(inicio = 1000) {
  let valor = inicio;
  return {
    leer: () => valor,
    avanzar: (ms) => {
      valor += ms;
    },
    retroceder: (ms) => {
      valor -= ms;
    },
  };
}

const SERVIDOR = new Date('2026-10-10T18:00:00Z');

test('A-22 con el teléfono adelantado 3 días, ahora() da la hora del servidor', async () => {
  const reloj = monotonicoDeMentira();
  const telefono = SERVIDOR.getTime() + 3 * 24 * 60 * 60 * 1000;

  const verificado = crearReloj({
    tomarMuestra: async (id) => {
      reloj.avanzar(120); // ida y vuelta de 120 ms
      return { instante: SERVIDOR, sincronizacionId: id };
    },
    monotonico: reloj.leer,
    relojTelefono: () => telefono,
  });

  assert.equal(await verificado.sincronizar(), true);
  const error = Math.abs(verificado.ahora().getTime() - SERVIDOR.getTime());
  assert.ok(error < 5000, `error de ${error} ms`);
  assert.ok(verificado.incertidumbreMs() <= 120);

  // El desfase del teléfono solo sirve para avisar.
  assert.ok(Math.abs(verificado.desfaseMs()) > DESFASE_AVISABLE_MS);
  assert.equal(verificado.hayDesfaseAvisable(), true);
});

test('A-23 sin hora del servidor, ahora() devuelve null y dice por qué', async () => {
  const verificado = crearReloj({
    tomarMuestra: async () => {
      throw Object.assign(new Error('sin conexión'), { code: 'unavailable' });
    },
    monotonico: monotonicoDeMentira().leer,
  });

  assert.equal(await verificado.sincronizar(), false);
  assert.equal(verificado.ahora(), null);
  assert.equal(verificado.hayHora(), false);
  assert.match(verificado.motivoSinHora(), /no se pudo obtener la hora/);
  // La sincronización siempre se puede reintentar.
  assert.equal(verificado.descartes().length, 3);
});

test('A-32 un cambio del reloj del teléfono no altera la muestra', async () => {
  const reloj = monotonicoDeMentira();
  let telefono = SERVIDOR.getTime();

  const verificado = crearReloj({
    tomarMuestra: async (id) => ({ instante: SERVIDOR, sincronizacionId: id }),
    monotonico: reloj.leer,
    relojTelefono: () => telefono,
  });
  await verificado.sincronizar();

  reloj.avanzar(30_000);
  telefono += 5 * 24 * 60 * 60 * 1000; // alguien mueve la hora del teléfono

  const esperado = SERVIDOR.getTime() + 30_000;
  assert.equal(verificado.ahora().getTime(), esperado);
});

test('A-33 una muestra que tarda más de 4 s se descarta', async () => {
  const reloj = monotonicoDeMentira();
  const verificado = crearReloj({
    tomarMuestra: async (id) => {
      reloj.avanzar(4500);
      return { instante: SERVIDOR, sincronizacionId: id };
    },
    monotonico: reloj.leer,
  });

  assert.equal(await verificado.sincronizar(), false);
  assert.equal(verificado.ahora(), null);
  assert.ok(verificado.descartes().every((d) => d.motivo === 'ida y vuelta mayor que el máximo'));
});

test('A-33 la muestra caduca a los 5 minutos', async () => {
  const reloj = monotonicoDeMentira();
  const verificado = crearReloj({
    tomarMuestra: async (id) => ({ instante: SERVIDOR, sincronizacionId: id }),
    monotonico: reloj.leer,
  });
  await verificado.sincronizar();

  reloj.avanzar(5 * 60 * 1000 - 1);
  assert.notEqual(verificado.ahora(), null);

  reloj.avanzar(2);
  assert.equal(verificado.ahora(), null);
  assert.match(verificado.motivoSinHora(), /caducó/);
});

test('A-33 volver de suspensión invalida la muestra', async () => {
  const reloj = monotonicoDeMentira();
  const verificado = crearReloj({
    tomarMuestra: async (id) => ({ instante: SERVIDOR, sincronizacionId: id }),
    monotonico: reloj.leer,
  });
  await verificado.sincronizar();
  assert.notEqual(verificado.ahora(), null);

  verificado.invalidar('la app volvió a primer plano');
  assert.equal(verificado.ahora(), null);
  assert.match(verificado.motivoSinHora(), /primer plano/);
});

test('A-33 un reloj monotónico que retrocede no se usa', async () => {
  const reloj = monotonicoDeMentira();
  const verificado = crearReloj({
    tomarMuestra: async (id) => ({ instante: SERVIDOR, sincronizacionId: id }),
    monotonico: reloj.leer,
  });
  await verificado.sincronizar();

  reloj.retroceder(10);
  assert.equal(verificado.ahora(), null);
});

test('A-34 no se acepta una muestra cuyo identificador es de otro dispositivo', async () => {
  const reloj = monotonicoDeMentira();
  // El otro teléfono sobrescribe la muestra antes de que este la lea.
  const verificado = crearReloj({
    tomarMuestra: async () => ({ instante: SERVIDOR, sincronizacionId: 'de'.repeat(16) }),
    monotonico: reloj.leer,
  });

  assert.equal(await verificado.sincronizar(), false);
  assert.equal(verificado.ahora(), null);
  assert.ok(verificado.descartes().every((d) => d.motivo === 'identificador de otra muestra'));
});

test('A-34 cuando la segunda muestra sí es propia, se acepta', async () => {
  const reloj = monotonicoDeMentira();
  let intento = 0;
  const verificado = crearReloj({
    tomarMuestra: async (id) => {
      intento += 1;
      return { instante: SERVIDOR, sincronizacionId: intento === 1 ? 'ajeno' : id };
    },
    monotonico: reloj.leer,
  });

  assert.equal(await verificado.sincronizar(), true);
  assert.equal(intento, 2);
  assert.notEqual(verificado.ahora(), null);
});

test('A-24 el parámetro ?ahora= se lee o se ignora, nunca se adivina', () => {
  assert.equal(instanteDeParametro('2026-10-10T15:00:00-03:00').toISOString(), '2026-10-10T18:00:00.000Z');
  assert.equal(instanteDeParametro(''), null);
  assert.equal(instanteDeParametro(null), null);
  assert.equal(instanteDeParametro('el sábado'), null);
});

test('A-24 el reloj de prueba queda en el instante pedido y avanza', () => {
  const reloj = monotonicoDeMentira();
  const dePrueba = crearRelojDePrueba(new Date('2026-10-10T15:00:00-03:00'), { monotonico: reloj.leer });
  assert.equal(dePrueba.ahora().toISOString(), '2026-10-10T18:00:00.000Z');
  reloj.avanzar(1000);
  assert.equal(dePrueba.ahora().toISOString(), '2026-10-10T18:00:01.000Z');
  assert.equal(dePrueba.hayHora(), true);
});
