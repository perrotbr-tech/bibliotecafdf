import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { rutas } from '../../docs/js/config-publica.js';
import { generarCalendario } from '../../scripts/generar-calendario.mjs';
import { abrirBase, PROYECTO_DEMO } from '../../scripts/comun/destino.mjs';

let db;
let Timestamp;

before(async () => {
  ({ db, Timestamp } = await abrirBase({ proyecto: PROYECTO_DEMO }));
});

after(async () => {
  const docs = await db.collection(rutas.calendario()).get();
  await Promise.all(docs.docs.map((d) => d.ref.delete()));
});

test('generar-calendario escribe sábados y rechaza reescritura sin --reemplazar', async () => {
  const primero = await generarCalendario({
    db,
    Timestamp,
    desde: '2026-10-01',
    hasta: '2026-10-31',
  });
  assert.ok(primero.creados.length > 0);
  assert.equal(primero.omitidos.length, 0);

  const segundo = await generarCalendario({
    db,
    Timestamp,
    desde: '2026-10-01',
    hasta: '2026-10-31',
  });
  assert.equal(segundo.creados.length, 0);
  assert.ok(segundo.omitidos.length > 0);

  const uno = await db.doc(rutas.diaCalendario('2026-10-10')).get();
  assert.equal(uno.exists, true);
  assert.equal(uno.data().temporada, '2026-5');
  assert.equal(uno.data().vencimientos.length, 4);
});
