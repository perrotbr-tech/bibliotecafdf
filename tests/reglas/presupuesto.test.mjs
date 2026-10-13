// Presupuesto de accesos de las reglas (contrato §7): máximo 10 por operación
// y 20 por transacción, «sin depender de ahorro por caché».
//
// Esta prueba MIDE el techo contra el emulador en vez de confiar en una cuenta
// escrita a mano. El instrumento es el documento de clave: cada `create` de
// `lectoresClave` consulta con `getAfter` a SU propio lector, un documento que
// la transacción no escribe, así que se puede añadir exactamente un acceso a
// la vez y encontrar dónde se corta.
//
// Lo que la medición dejó a la vista, y que conviene tener escrito:
//
//   1. El techo de una transacción son 20 documentos DISTINTOS. 18 claves
//      sueltas entran —18 lectores consultados más el voluntario y el
//      control— y 19 no. Los accesos repetidos al mismo documento no se
//      cobran dos veces.
//   2. Un `getAfter` a un documento que la propia transacción escribe no
//      cuesta nada: el alta de lector añade tres —contadores, el lector y su
//      clave— y el techo no se mueve ni un lugar.
//
// De ahí las dos cifras que el informe anota por separado:
//
//   · la CONSERVADORA, que es la que se promete porque el contrato manda
//     contar sin suponer ahorro: 10 accesos en la transacción del alta y 4 en
//     su operación más cara;
//   · la MEDIDA, que es el margen real: 2 documentos distintos —el voluntario
//     y el control—, con 18 lugares libres de los 20.
//
// No se promete la segunda. Se mide para saber que la primera entra con
// holgura, y para que un cambio futuro que gaste accesos de verdad se note.
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';

import {
  ADMIN,
  ID,
  RUTAS,
  abrirEntorno,
  comoCuenta,
  loteDeAlta,
  sembrarBase,
  sembrarLector,
} from '../ayuda/reglas.mjs';

let entorno;

/** El techo del contrato: documentos distintos por transacción. */
const TECHO = 20;
/** Lo que ocupan el voluntario y el control, que toda escritura consulta. */
const FIJO = 2;
/** Accesos de relleno que todavía caben: 18. */
const MARGEN = TECHO - FIJO;

before(async () => {
  entorno = await abrirEntorno();
});
after(async () => {
  await entorno?.cleanup();
});
beforeEach(async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno);
});

/** Lectores de relleno, con su clave libre: cada uno vale un acceso. */
const idRelleno = (i) => `L${500 + i}`;
const claveRelleno = (i) => `relleno ${i}`;

async function sembrarRelleno(cuantos) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    for (let i = 1; i <= cuantos; i += 1) {
      await db.doc(RUTAS.lector(idRelleno(i))).set({
        nombre: `Relleno ${i}`,
        clave: claveRelleno(i),
        telefono: null,
        avisoDatos: null,
        fusionadoEn: null,
        esDestinoFusion: false,
        creadoEn: new Date('2026-10-10T18:00:00Z'),
        creadoPor: 'carga-inicial',
      });
    }
  });
}

/** Añade `cuantos` accesos a un lote: una clave por lector de relleno. */
function agregarRelleno(lote, db, cuantos) {
  for (let i = 1; i <= cuantos; i += 1) {
    lote.set(doc(db, RUTAS.clave(claveRelleno(i))), {
      lector: idRelleno(i),
      creadoEn: serverTimestamp(),
      creadoPor: ADMIN,
      creacionId: ID('b'),
    });
  }
  return lote;
}

/**
 * Mide el techo de una transacción: cuántos accesos de relleno admite antes de
 * que el emulador la deniegue. `armar` devuelve el lote con la operación que
 * se quiere medir ya dentro.
 */
async function medirTecho(armar, { esperado }) {
  for (const [cuantos, cabe] of [
    [esperado, true],
    [esperado + 1, false],
  ]) {
    await entorno.clearFirestore();
    await sembrarBase(entorno);
    await sembrarRelleno(cuantos);
    const db = comoCuenta(entorno, ADMIN);
    const lote = agregarRelleno(await armar(db), db, cuantos);
    const comprobar = cabe ? assertSucceeds : assertFails;
    await comprobar(lote.commit(), `relleno ${cuantos}`);
  }
}

test('el instrumento: una transacción admite 20 documentos distintos, y no 21', async () => {
  await medirTecho((db) => writeBatch(db), { esperado: MARGEN });
});

test('el alta de un lector no gasta margen: sus tres getAfter son del propio lote', async () => {
  // Los tres documentos enlazados —contadores, el lector y su clave— los
  // escribe esta misma transacción, así que consultarlos con `getAfter` no
  // añade ningún documento al presupuesto. Quedan los dos fijos.
  await medirTecho((db) => loteDeAlta(db, ADMIN), { esperado: MARGEN });
});

test('cambiar el nombre de un lector tampoco gasta margen', async () => {
  await medirTecho(
    async (db) => {
      await sembrarLector(entorno, 'L001', { numero: 1 });
      const lote = writeBatch(db);
      lote.update(doc(db, RUTAS.lector('L001')), {
        nombre: 'Rafaela Toledo Soto',
        clave: 'rafaela toledo soto',
        ultimaOperacionId: ID('1'),
        modificadoEn: serverTimestamp(),
      });
      lote.set(doc(db, RUTAS.clave('rafaela toledo soto')), {
        lector: 'L001',
        creadoEn: serverTimestamp(),
        creadoPor: ADMIN,
        creacionId: ID('c'),
      });
      return lote;
    },
    { esperado: MARGEN },
  );
});
