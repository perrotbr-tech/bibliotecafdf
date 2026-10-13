// Serialización canónica, hash y comparación del respaldo (contrato §6).
//
// De esto depende que un respaldo se pueda verificar: si el hash cambiara con
// el orden de las claves, no probaría nada; si una marca de tiempo volviera
// como un mapa de dos números, C-34 —«idéntica documento por documento,
// incluidas las marcas de tiempo»— no se podría cumplir.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aExportable,
  deExportable,
  diferencias,
  hashCanonico,
  textoCanonico,
} from '../../scripts/comun/datos-exportados.mjs';

/** Imitación de la marca de tiempo de Admin SDK: lo que distingue es `toDate`. */
class MarcaFalsa {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
}

test('el texto canónico ordena las claves, así que el hash no depende del orden', () => {
  const uno = { b: 1, a: { d: 2, c: [3, 4] } };
  const otro = { a: { c: [3, 4], d: 2 }, b: 1 };
  assert.equal(textoCanonico(uno), textoCanonico(otro));
  assert.equal(hashCanonico(uno), hashCanonico(otro));
  assert.equal(textoCanonico(uno), '{"a":{"c":[3,4],"d":2},"b":1}');
  // Un cambio de verdad sí cambia el hash.
  assert.notEqual(hashCanonico(uno), hashCanonico({ ...uno, b: 2 }));
});

test('el orden de un arreglo sí importa: no es lo mismo', () => {
  assert.notEqual(hashCanonico([1, 2]), hashCanonico([2, 1]));
});

test('una marca de tiempo va y vuelve siendo una marca de tiempo', () => {
  const exportado = aExportable({ creadoEn: new MarcaFalsa(1760000000, 123456000) });
  assert.deepEqual(exportado, {
    creadoEn: { _tipo: 'hora', seconds: 1760000000, nanoseconds: 123456000 },
  });
  const repuesto = deExportable(exportado, MarcaFalsa);
  assert.ok(repuesto.creadoEn instanceof MarcaFalsa);
  assert.equal(repuesto.creadoEn.seconds, 1760000000);
  assert.equal(repuesto.creadoEn.nanoseconds, 123456000);
});

test('un documento completo va y vuelve igual, con mapas, listas y nulos', () => {
  const documento = {
    nombre: 'María José Peña',
    telefono: null,
    avisoDatos: { fecha: new MarcaFalsa(1760000000, 0), por: 'ana@example.com' },
    categorias: [{ nombre: 'Infantil', prefijo: 'INF' }],
    vecesPrestado: 3,
    baja: false,
  };
  const exportado = aExportable(documento);
  const repuesto = deExportable(exportado, MarcaFalsa);
  assert.equal(hashCanonico(aExportable(repuesto)), hashCanonico(exportado));
  assert.equal(repuesto.nombre, 'María José Peña');
  assert.equal(repuesto.telefono, null);
  assert.equal(repuesto.vecesPrestado, 3);
});

test('un tipo que no se sabe exportar se detiene en vez de perder el campo', () => {
  class Rareza {}
  assert.throws(() => aExportable({ algo: new Rareza() }), /no se sabe exportar/u);
  assert.throws(() => aExportable({ algo: Number.NaN }), /No se puede exportar/u);
  // Y una clave que choca con la etiqueta de tipo, también.
  assert.throws(() => aExportable({ _tipo: 'hora' }), /etiqueta de tipo/u);
  assert.throws(() => deExportable({ _tipo: 'otra-cosa' }, MarcaFalsa), /desconocida/u);
});

test('un decimal no se confunde con un entero al volver', () => {
  const exportado = aExportable({ medida: 1.5, cuenta: 2 });
  assert.deepEqual(exportado, { medida: { _tipo: 'decimal', valor: 1.5 }, cuenta: 2 });
  assert.deepEqual(deExportable(exportado, MarcaFalsa), { medida: 1.5, cuenta: 2 });
});

test('las diferencias dicen QUÉ no coincide, con su ruta', () => {
  assert.deepEqual(diferencias({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }), []);
  assert.deepEqual(diferencias({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }), [
    { ruta: 'b.c', esperado: 2, obtenido: 3 },
  ]);
  assert.deepEqual(diferencias({ a: 1 }, { a: 1, extra: true }), [
    { ruta: 'extra', esperado: null, obtenido: true },
  ]);
  // Una marca de tiempo distinta se nota: es lo que C-34 pide comprobar.
  const unaHora = aExportable({ creadoEn: new MarcaFalsa(1760000000, 0) });
  const otraHora = aExportable({ creadoEn: new MarcaFalsa(1760000001, 0) });
  assert.equal(diferencias(unaHora, otraHora).length, 1);
  assert.equal(diferencias(unaHora, otraHora)[0].ruta, 'creadoEn.seconds');
});
