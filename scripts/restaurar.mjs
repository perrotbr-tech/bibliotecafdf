// Repone un respaldo verificado (Etapa 2 · contrato §6).
//
// Qué hace, en este orden:
//   1. Lee el archivo y lo verifica: esquema, SHA-256 y referencias. Un
//      archivo que no verifica no se repone.
//   2. Exige una base vacía. Para reponer sobre datos existentes hace falta
//      `--reemplazar`, y entonces respalda y verifica ANTES de tocar nada.
//   3. Toma mantenimiento y escribe en lotes acotados, anotando cada lote en
//      un manifiesto reanudable. Un corte a mitad de camino deja la base
//      cerrada y el manifiesto con lo que ya se escribió (C-41).
//   4. Compara documento por documento contra el archivo (C-34).
//   5. Recién entonces escribe `config/control` con `bloqueo: null`, que es a
//      la vez la normalización que pide el contrato —no se traslada el candado
//      de otra base— y la liberación del mantenimiento.
//
// Uso:
//   node scripts/restaurar.mjs --archivo datos/respaldo-20261012-0530.json
//   node scripts/restaurar.mjs --archivo … --reemplazar
//   node scripts/restaurar.mjs --archivo … --reanudar

import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { BIB, rutas } from '../docs/js/config-publica.js';

import { diferenciasDeDocumento, recorrer } from './comun/biblioteca.mjs';
import { deExportable } from './comun/datos-exportados.mjs';
import { PROYECTO_DEMO, abrirBase } from './comun/destino.mjs';
import {
  CARPETA_DATOS,
  abrirManifiesto,
  cerrarManifiesto,
  crearManifiesto,
  guardarJson,
} from './comun/manifiesto.mjs';
import * as mantenimiento from './comun/mantenimiento.mjs';
import { respaldar, verificar } from './respaldar.mjs';

export const TRABAJO = 'restauracion';
export const LOTE = 200;

const rutaDeControl = () => rutas.configControl();

/** Borra todos los documentos de la biblioteca salvo el control, en lotes. */
export async function vaciarBiblioteca(db, { lote = LOTE } = {}) {
  let borrados = 0;
  let cuantosHabia = Number.POSITIVE_INFINITY;
  for (;;) {
    const documentos = (await recorrer(db)).filter(({ ruta }) => ruta !== rutaDeControl());
    if (documentos.length === 0) return borrados;
    // Una pasada que no reduce la cuenta significa que algo impide borrar: se
    // detiene en vez de girar para siempre con el mantenimiento puesto.
    if (documentos.length >= cuantosHabia) {
      throw new Error(`No se pudo vaciar la biblioteca: quedan ${documentos.length} documentos y no bajan.`);
    }
    cuantosHabia = documentos.length;
    for (let desde = 0; desde < documentos.length; desde += lote) {
      const escritura = db.batch();
      for (const { ruta } of documentos.slice(desde, desde + lote)) escritura.delete(db.doc(ruta));
      await escritura.commit();
      borrados += Math.min(lote, documentos.length - desde);
    }
  }
}

/**
 * Repone los documentos del respaldo. `manifiesto` permite reanudar: las rutas
 * que ya figuran en `hechos` no se vuelven a escribir.
 */
export async function reponer({ db, Timestamp, respaldo, token, manifiesto, rutaManifiesto, lote = LOTE }) {
  const yaHechos = new Set(manifiesto.hechos);
  const pendientes = respaldo.documentos.filter(
    ({ ruta }) => ruta !== rutaDeControl() && !yaHechos.has(ruta),
  );

  for (let desde = 0; desde < pendientes.length; desde += lote) {
    // El token se comprueba antes de cada lote: si el bloqueo dejó de ser
    // nuestro, se para aquí y no se escribe el lote siguiente.
    await mantenimiento.comprobar(db, token);
    const tanda = pendientes.slice(desde, desde + lote);
    const escritura = db.batch();
    for (const { ruta, datos } of tanda) {
      escritura.set(db.doc(ruta), deExportable(datos, Timestamp, ruta));
    }
    await escritura.commit();
    manifiesto.hechos.push(...tanda.map(({ ruta }) => ruta));
    await guardarJson(rutaManifiesto, manifiesto);
  }
  return manifiesto.hechos.length;
}

/**
 * Compara la base con el respaldo, documento por documento. El bloqueo del
 * control queda fuera: mientras se compara, el candado del trabajo sigue
 * puesto, y se normaliza a nulo al final.
 */
export async function comparar({ db, respaldo }) {
  const enLaBase = new Map((await recorrer(db)).map(({ ruta, datos }) => [ruta, datos]));
  const problemas = [];

  for (const { ruta, datos: esperado } of respaldo.documentos) {
    if (!enLaBase.has(ruta)) {
      problemas.push(`${ruta} no quedó escrito.`);
      continue;
    }
    for (const uno of diferenciasDeDocumento(ruta, esperado, enLaBase.get(ruta))) {
      problemas.push(`${ruta} difiere en ${uno.ruta}: esperaba ${JSON.stringify(uno.esperado)} y hay ${JSON.stringify(uno.obtenido)}.`);
    }
    enLaBase.delete(ruta);
  }
  for (const ruta of enLaBase.keys()) problemas.push(`${ruta} está en la base y no en el respaldo.`);
  return problemas;
}

export async function restaurar({
  db,
  FieldValue,
  Timestamp,
  proyecto,
  archivo,
  por = 'dueno',
  reemplazar = false,
  reanudar = false,
  lote = LOTE,
  rutaManifiesto = join(CARPETA_DATOS, `manifiesto-${TRABAJO}.json`),
}) {
  const respaldo = await verificar(archivo);

  // Un respaldo sin documento de control es un respaldo que no se puede
  // reponer: la base quedaría sin el documento que decide si se escribe
  // (contrato §6). Y no se puede dar: `respaldar.mjs` necesita ese documento
  // para tomar el mantenimiento.
  const control = respaldo.documentos.find(({ ruta }) => ruta === rutaDeControl());
  if (!control) {
    throw new Error(`El respaldo ${archivo} no trae ${rutaDeControl()}: no se repone una base que no se podría escribir.`);
  }

  const antes = await recorrer(db);
  const conDatos = antes.filter(({ ruta }) => ruta !== rutaDeControl());
  if (conDatos.length > 0 && !reemplazar && !reanudar) {
    throw new Error(
      `La base no está vacía: tiene ${conDatos.length} documentos. ` +
        'Para reponer encima usa --reemplazar, que respalda y verifica antes de tocar nada.',
    );
  }

  let respaldoPrevio = null;
  if (reemplazar && !reanudar) {
    respaldoPrevio = await respaldar({ db, FieldValue, proyecto, por });
  }

  const token = mantenimiento.nuevoToken();
  const nuevo = crearManifiesto({
    trabajo: TRABAJO,
    token,
    proyecto,
    origen: archivo,
    total: respaldo.documentos.length,
  });
  const manifiesto = reanudar ? await abrirManifiesto(rutaManifiesto, nuevo) : nuevo;
  if (manifiesto.origen !== archivo) {
    throw new Error(`El manifiesto es de ${manifiesto.origen} y se pidió reanudar con ${archivo}.`);
  }

  // Al reanudar se reusa el bloqueo que quedó puesto, no se toma otro: el
  // anterior sigue vigente justamente porque la base quedó a medias.
  const puesto = await mantenimiento.tomarOReusar(db, FieldValue, {
    por,
    token: reanudar ? manifiesto.token : token,
    // Reponer sobre una base vacía crea el control con el candado puesto.
    crearSiFalta: true,
  });
  manifiesto.token = puesto;
  await guardarJson(rutaManifiesto, manifiesto);
  try {
    if (reemplazar && manifiesto.hechos.length === 0) await vaciarBiblioteca(db, { lote });

    // El control se repone AHORA, conservando nuestro candado en su sitio: así
    // el resto de sus campos queda como en el respaldo y la comparación de
    // abajo lo puede incluir. Lo único que falta después es soltar el candado.
    const bloqueoPropio = (await db.doc(rutaDeControl()).get()).data()?.bloqueo ?? null;
    const { bloqueo: _delRespaldo, ...restoDelControl } = deExportable(
      control.datos,
      Timestamp,
      rutaDeControl(),
    );
    await db.doc(rutaDeControl()).set({ ...restoDelControl, bloqueo: bloqueoPropio });

    const escritos = await reponer({ db, Timestamp, respaldo, token: puesto, manifiesto, rutaManifiesto, lote });

    const problemas = await comparar({ db, respaldo });
    if (problemas.length > 0) {
      throw new Error(`La restauración no quedó idéntica:\n  - ${problemas.join('\n  - ')}`);
    }

    // Normalizar el bloqueo a nulo es lo último, y de paso libera el
    // mantenimiento: el contrato §6 pide no trasladar el candado de otra base.
    await db.doc(rutaDeControl()).update({ bloqueo: null });

    await cerrarManifiesto(rutaManifiesto, manifiesto);
    return {
      archivo,
      escritos,
      total: respaldo.documentos.length,
      respaldoPrevio,
      manifiesto: rutaManifiesto,
    };
  } catch (error) {
    await cerrarManifiesto(rutaManifiesto, manifiesto, { estado: 'interrumpido', motivo: error.message });
    error.mensajeDeBloqueo =
      `La restauración se interrumpió y el mantenimiento QUEDA PUESTO (token ${puesto}). ` +
      `El manifiesto ${rutaManifiesto} dice qué se escribió: reanuda con --reanudar o repón otro respaldo. ` +
      'La base no se reabre con datos a medias.';
    throw error;
  }
}

async function principal() {
  const { values } = parseArgs({
    options: {
      archivo: { type: 'string' },
      proyecto: { type: 'string', default: PROYECTO_DEMO },
      por: { type: 'string', default: 'dueno' },
      reemplazar: { type: 'boolean', default: false },
      reanudar: { type: 'boolean', default: false },
      'confirmo-proyecto-real': { type: 'boolean', default: false },
    },
  });

  if (!values.archivo) {
    process.stderr.write('Falta --archivo con el respaldo que se quiere reponer.\n');
    process.exit(2);
  }

  const { db, FieldValue, Timestamp, proyecto, destino } = await abrirBase({
    proyecto: values.proyecto,
    confirmaProyectoReal: values['confirmo-proyecto-real'],
  });
  process.stdout.write(`restaurar: proyecto ${proyecto} (${destino}), biblioteca ${BIB}\n`);

  try {
    const informe = await restaurar({
      db,
      FieldValue,
      Timestamp,
      proyecto,
      archivo: values.archivo,
      por: values.por,
      reemplazar: values.reemplazar,
      reanudar: values.reanudar,
    });
    if (informe.respaldoPrevio) {
      process.stdout.write(`restaurar: respaldo previo verificado en ${informe.respaldoPrevio.archivo}\n`);
    }
    process.stdout.write(
      `restaurar: ${informe.escritos} de ${informe.total} documentos repuestos y comparados uno por uno.\n` +
        'restaurar: control normalizado a bloqueo nulo y mantenimiento liberado.\n',
    );
  } catch (error) {
    process.stderr.write(`restaurar: ${error.message}\n`);
    if (error.mensajeDeBloqueo) process.stderr.write(`restaurar: ${error.mensajeDeBloqueo}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await principal();
}
