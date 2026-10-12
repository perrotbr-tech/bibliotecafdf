// Respaldo verificable de la biblioteca (Etapa 2 · contrato §6).
//
// El plan gratuito de Firestore no incluye respaldos automáticos, así que esto
// es el único respaldo que existe. Por eso no se da por bueno hasta haberlo
// releído: toma mantenimiento para no copiar una base a medio escribir,
// exporta todas las rutas, calcula un SHA-256 del contenido canónico, vuelve a
// leer el archivo del disco, recalcula el hash, comprueba las referencias y
// compara documento por documento contra la base. Solo entonces libera el
// bloqueo.
//
// Si algo falla, el mantenimiento QUEDA PUESTO: una base a medio copiar no se
// reabre sola (contrato §6).
//
// Uso:
//   node scripts/respaldar.mjs
//   node scripts/respaldar.mjs --salida datos/respaldo-a-mano.json
//   node scripts/respaldar.mjs --liberar          (suelta un bloqueo propio)

import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { BIB } from '../docs/js/config-publica.js';

import {
  conteos,
  diferenciasDeDocumento,
  recorrer,
  sinBloqueo,
  verificarReferencias,
} from './comun/biblioteca.mjs';
import { ESQUEMA, hashCanonico } from './comun/datos-exportados.mjs';
import { CARPETA_DATOS, guardarJson, leerJson, marcaDeArchivo } from './comun/manifiesto.mjs';
import { PROYECTO_DEMO, abrirBase } from './comun/destino.mjs';
import * as mantenimiento from './comun/mantenimiento.mjs';

export const TRABAJO = 'respaldo';

/**
 * Arma el contenido del archivo. El hash cubre esquema, rutas y datos.
 *
 * El control se guarda con `bloqueo: null`: un respaldo se toma con el
 * mantenimiento puesto, y guardar ese candado lo trasladaría a cualquier base
 * donde se repusiera el archivo (contrato §6).
 */
export function armarRespaldo({ proyecto, documentos, generadoEn = new Date() }) {
  const limpios = sinBloqueo(documentos);
  const cuerpo = {
    esquema: ESQUEMA,
    proyecto,
    biblioteca: BIB,
    generadoEn: generadoEn.toISOString(),
    conteos: conteos(limpios),
    total: limpios.length,
    documentos: limpios,
  };
  return { ...cuerpo, hash: hashCanonico(cuerpo) };
}

/** Recalcula el hash de un archivo ya leído y lo compara con el que trae. */
export function comprobarHash(respaldo) {
  const { hash, ...cuerpo } = respaldo;
  const recalculado = hashCanonico(cuerpo);
  if (hash !== recalculado) {
    throw new Error(`El hash del respaldo no coincide: dice ${hash} y los datos dan ${recalculado}.`);
  }
  return recalculado;
}

/**
 * Verifica un archivo de respaldo. Con `db`, además compara documento por
 * documento contra la base. Sin `db`, verifica archivo y referencias.
 */
export async function verificar(archivo, { db = null } = {}) {
  const respaldo = await leerJson(archivo);
  if (respaldo.esquema !== ESQUEMA) {
    throw new Error(`El respaldo dice esquema ${respaldo.esquema} y este script entiende ${ESQUEMA}.`);
  }
  comprobarHash(respaldo);

  if (respaldo.total !== respaldo.documentos.length) {
    throw new Error(`El respaldo dice ${respaldo.total} documentos y trae ${respaldo.documentos.length}.`);
  }

  const problemas = verificarReferencias(respaldo.documentos);
  if (problemas.length > 0) {
    throw new Error(`El respaldo no es coherente:\n  - ${problemas.join('\n  - ')}`);
  }

  if (db !== null) {
    // Lectura completa de la base y comparación: no basta con contar.
    const enLaBase = await recorrer(db);
    const porRuta = new Map(enLaBase.map(({ ruta, datos }) => [ruta, datos]));
    const faltantes = [];
    for (const { ruta, datos } of respaldo.documentos) {
      if (!porRuta.has(ruta)) {
        faltantes.push(`${ruta} está en el respaldo y no en la base.`);
        continue;
      }
      const distintos = diferenciasDeDocumento(ruta, datos, porRuta.get(ruta));
      for (const uno of distintos) faltantes.push(`${ruta} difiere en ${uno.ruta}.`);
      porRuta.delete(ruta);
    }
    for (const ruta of porRuta.keys()) faltantes.push(`${ruta} está en la base y no en el respaldo.`);
    if (faltantes.length > 0) {
      throw new Error(`El respaldo no coincide con la base:\n  - ${faltantes.join('\n  - ')}`);
    }
  }

  return respaldo;
}

/**
 * Toma mantenimiento, exporta, guarda y verifica. Devuelve el archivo y el
 * informe. Lo usan `restaurar.mjs` y `cargar-datos.mjs` antes de reemplazar.
 */
export async function respaldar({ db, FieldValue, proyecto, por, salida = null, instante = new Date() }) {
  const archivo = salida ?? join(CARPETA_DATOS, `respaldo-${marcaDeArchivo(instante)}.json`);
  const token = mantenimiento.nuevoToken();

  const informe = await mantenimiento.conMantenimiento(db, FieldValue, { por, token }, async (puesto) => {
    // El control acaba de cambiar para tomar el bloqueo: lo que se exporta es
    // la base CON el bloqueo puesto, y así queda en el archivo. La
    // restauración lo normaliza a nulo para no trasladar un candado.
    const documentos = await recorrer(db);
    await mantenimiento.comprobar(db, puesto);
    const respaldo = armarRespaldo({ proyecto, documentos, generadoEn: instante });
    await guardarJson(archivo, respaldo);
    await verificar(archivo, { db });
    await mantenimiento.comprobar(db, puesto);
    return { archivo, total: respaldo.total, conteos: respaldo.conteos, hash: respaldo.hash };
  });

  return informe;
}

async function principal() {
  const { values } = parseArgs({
    options: {
      proyecto: { type: 'string', default: PROYECTO_DEMO },
      salida: { type: 'string' },
      por: { type: 'string', default: 'dueno' },
      liberar: { type: 'boolean', default: false },
      token: { type: 'string' },
      'confirmo-proyecto-real': { type: 'boolean', default: false },
    },
  });

  const { db, FieldValue, proyecto, destino } = await abrirBase({
    proyecto: values.proyecto,
    confirmaProyectoReal: values['confirmo-proyecto-real'],
  });
  process.stdout.write(`respaldar: proyecto ${proyecto} (${destino})\n`);

  if (values.liberar) {
    if (!values.token) {
      process.stderr.write('Para liberar hace falta --token, el del bloqueo que quedó puesto.\n');
      process.exit(2);
    }
    await mantenimiento.liberar(db, values.token);
    process.stdout.write('respaldar: mantenimiento liberado.\n');
    return;
  }

  try {
    const informe = await respaldar({ db, FieldValue, proyecto, por: values.por, salida: values.salida });
    for (const [coleccion, cuantos] of Object.entries(informe.conteos)) {
      process.stdout.write(`  ${cuantos.toString().padStart(6)}  ${coleccion}\n`);
    }
    process.stdout.write(
      `respaldar: ${informe.total} documentos en ${informe.archivo}\n` +
        `respaldar: sha256 ${informe.hash}\nrespaldar: verificado contra la base, documento por documento.\n`,
    );
  } catch (error) {
    process.stderr.write(`respaldar: ${error.message}\n`);
    if (error.mensajeDeBloqueo) process.stderr.write(`respaldar: ${error.mensajeDeBloqueo}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await principal();
}
