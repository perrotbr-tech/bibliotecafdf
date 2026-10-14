import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esSabado } from '../../docs/js/fechas.js';
import { planDeCalendario } from '../../scripts/generar-calendario.mjs';

test('el plan cubre sábados del rango y los cuatro vencimientos posteriores', () => {
  const plan = planDeCalendario({ desde: '2026-10-01', hasta: '2026-10-31' });
  assert.ok(plan.sabados.every((d) => esSabado(d)));
  assert.equal(plan.ultimoSabadoDelRangoPedido, '2026-10-31');
  // Tras el 31-10 hacen falta cuatro sábados más para plazo 4.
  assert.ok(plan.ultimoSabado > '2026-10-31');
  assert.equal(plan.documentos[0].datos.vencimientos.length, 4);
});

test('un rango sin sábados (lunes a viernes) no inventa documentos', () => {
  const plan = planDeCalendario({ desde: '2026-10-12', hasta: '2026-10-16' });
  assert.equal(plan.sabados.length, 0);
  assert.equal(plan.ultimoSabado, null);
});

test('días inválidos se rechazan', () => {
  assert.throws(() => planDeCalendario({ desde: '2026-02-30', hasta: '2026-03-01' }), /válido/u);
});
