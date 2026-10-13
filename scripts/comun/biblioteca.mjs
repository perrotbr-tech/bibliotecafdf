// Recorrer la biblioteca completa y comprobar que lo recorrido es coherente.
//
// Lo usan el respaldo, la restauración y la carga. La verificación de
// referencias es lo que el contrato §6 exige para considerar válido un
// respaldo: «contar documentos o poder abrir el JSON no basta».
import { BIB, rutas } from '../../docs/js/config-publica.js';

import { aExportable, diferencias } from './datos-exportados.mjs';

/** Colecciones que la carga inicial reemplaza. Las demás se preservan. */
export const COLECCIONES_DE_NEGOCIO = ['libros', 'lectores', 'lectoresClave', 'prestamos'];

const TANDA = 40;

/** Corre `hacer` sobre la lista en tandas, para no abrir mil llamadas a la vez. */
async function enTandas(lista, hacer, tamano = TANDA) {
  const salida = [];
  for (let desde = 0; desde < lista.length; desde += tamano) {
    salida.push(...(await Promise.all(lista.slice(desde, desde + tamano).map(hacer))));
  }
  return salida;
}

async function recorrerColeccion(coleccion, documentos) {
  const consulta = await coleccion.get();
  const existentes = new Set();
  for (const instantanea of consulta.docs) {
    existentes.add(instantanea.ref.path);
    documentos.push({
      ruta: instantanea.ref.path,
      datos: aExportable(instantanea.data(), instantanea.ref.path),
    });
  }

  // Subcolecciones. El modelo de esta app no las usa, pero el contrato §6 pide
  // exportar «todas las rutas, incluidas subcolecciones», así que se buscan de
  // verdad en vez de suponer que no hay.
  const referencias = await coleccion.listDocuments();
  const subcolecciones = (await enTandas(referencias, (referencia) => referencia.listCollections())).flat();
  for (const sub of subcolecciones) await recorrerColeccion(sub, documentos);
}

/**
 * Todos los documentos de la biblioteca, ordenados por ruta. Cada uno con sus
 * datos ya exportables.
 */
export async function recorrer(db, { raiz = rutas.biblioteca() } = {}) {
  const documentos = [];
  const referenciaRaiz = db.doc(raiz);

  // El documento raíz puede no existir: en este modelo las colecciones cuelgan
  // de él sin que el documento se cree. Se exporta solo si está.
  const instantaneaRaiz = await referenciaRaiz.get();
  if (instantaneaRaiz.exists) {
    documentos.push({ ruta: raiz, datos: aExportable(instantaneaRaiz.data(), raiz) });
  }

  for (const coleccion of await referenciaRaiz.listCollections()) {
    await recorrerColeccion(coleccion, documentos);
  }
  return documentos.sort((uno, otro) => (uno.ruta < otro.ruta ? -1 : 1));
}

/**
 * Diferencias entre dos versiones de un documento, sin contar el bloqueo del
 * control.
 *
 * Ese campo es el estado del trabajo en curso, no un dato de la biblioteca: un
 * respaldo se toma con el mantenimiento puesto y se guarda con `bloqueo: null`,
 * así que ahí difiere siempre y a propósito. Compararlo haría imposible
 * verificar un respaldo, que es justo lo contrario de lo que se busca.
 */
export function diferenciasDeDocumento(ruta, esperado, obtenido) {
  const todas = diferencias(esperado, obtenido, '');
  if (ruta !== rutas.configControl()) return todas;
  return todas.filter(({ ruta: campo }) => campo !== 'bloqueo' && !campo.startsWith('bloqueo.'));
}

/** El respaldo guarda el control sin candado: no se traslada a otra base. */
export function sinBloqueo(documentos) {
  return documentos.map(({ ruta, datos }) =>
    ruta === rutas.configControl() ? { ruta, datos: { ...datos, bloqueo: null } } : { ruta, datos },
  );
}

/** Cuántos documentos hay por colección, con la ruta relativa como nombre. */
export function conteos(documentos) {
  const cuenta = {};
  for (const { ruta } of documentos) {
    const partes = ruta.split('/');
    const coleccion = partes.length >= 2 ? partes.slice(0, -1).join('/') : ruta;
    cuenta[coleccion] = (cuenta[coleccion] ?? 0) + 1;
  }
  return cuenta;
}

/** Los documentos de una colección de la biblioteca, por identificador. */
export function porColeccion(documentos, coleccion) {
  const prefijo = `bibliotecas/${BIB}/${coleccion}/`;
  const mapa = new Map();
  for (const { ruta, datos } of documentos) {
    if (ruta.startsWith(prefijo) && !ruta.slice(prefijo.length).includes('/')) {
      mapa.set(ruta.slice(prefijo.length), datos);
    }
  }
  return mapa;
}

/**
 * Comprueba las referencias entre colecciones. Devuelve la lista de problemas;
 * vacía significa coherente.
 *
 * Esto es lo que distingue un respaldo verificado de un archivo que se puede
 * abrir: que cada préstamo apunte a un libro y a un lector que existen, que
 * cada lector tenga su documento de clave apuntándolo, que ningún libro tenga
 * dos préstamos abiertos y que los contadores no vayan por detrás de lo que
 * hay escrito.
 */
export function verificarReferencias(documentos) {
  const problemas = [];
  const libros = porColeccion(documentos, 'libros');
  const lectores = porColeccion(documentos, 'lectores');
  const claves = porColeccion(documentos, 'lectoresClave');
  const prestamos = porColeccion(documentos, 'prestamos');
  const contadores = porColeccion(documentos, 'config').get('contadores') ?? null;

  const abiertosPorLibro = new Map();
  const vecesPorLibro = new Map();

  for (const [id, prestamo] of prestamos) {
    if (!libros.has(prestamo.libro)) {
      problemas.push(`El préstamo ${id} apunta al libro ${prestamo.libro}, que no existe.`);
    }
    if (!lectores.has(prestamo.lector)) {
      problemas.push(`El préstamo ${id} apunta al lector ${prestamo.lector}, que no existe.`);
    }
    if (prestamo.estado === 'abierto') {
      abiertosPorLibro.set(prestamo.libro, [...(abiertosPorLibro.get(prestamo.libro) ?? []), id]);
    }
    if (prestamo.estado !== 'anulado') {
      vecesPorLibro.set(prestamo.libro, (vecesPorLibro.get(prestamo.libro) ?? 0) + 1);
    }
  }

  for (const [codigo, libro] of libros) {
    if (libro.codigo !== codigo) {
      problemas.push(`El libro ${codigo} lleva el código ${libro.codigo} en sus datos.`);
    }
    const abiertos = abiertosPorLibro.get(codigo) ?? [];
    if (abiertos.length > 1) {
      problemas.push(`El libro ${codigo} tiene ${abiertos.length} préstamos abiertos: ${abiertos.join(', ')}.`);
    }
    const esperado = abiertos.length === 1 ? abiertos[0] : null;
    if ((libro.prestamoAbierto ?? null) !== esperado) {
      problemas.push(
        `El libro ${codigo} dice prestamoAbierto ${libro.prestamoAbierto ?? 'nulo'} y sus préstamos dicen ` +
          `${esperado ?? 'nulo'}.`,
      );
    }
    const veces = vecesPorLibro.get(codigo) ?? 0;
    if (libro.vecesPrestado !== veces) {
      problemas.push(`El libro ${codigo} dice vecesPrestado ${libro.vecesPrestado} y tiene ${veces} préstamos.`);
    }
  }

  for (const [id, lector] of lectores) {
    if (!/^L[0-9]{3,}$/u.test(id)) problemas.push(`El lector ${id} no tiene la forma L + correlativo.`);
    const clave = claves.get(lector.clave);
    if (clave === undefined) {
      problemas.push(`El lector ${id} tiene la clave «${lector.clave}» sin documento en lectoresClave.`);
    } else if (clave.lector !== id) {
      problemas.push(`La clave «${lector.clave}» apunta a ${clave.lector} y el lector ${id} la declara suya.`);
    }
  }

  for (const [clave, datos] of claves) {
    if (!lectores.has(datos.lector)) {
      problemas.push(`La clave «${clave}» apunta al lector ${datos.lector}, que no existe.`);
    }
  }

  if (contadores !== null) {
    const mayorLector = Math.max(0, ...[...lectores.keys()].map((id) => Number(id.slice(1))));
    const mayorPrestamo = Math.max(0, ...[...prestamos.values()].map((p) => Number(p.numero ?? 0)));
    if ((contadores.ultimoLector ?? 0) < mayorLector) {
      problemas.push(`contadores.ultimoLector es ${contadores.ultimoLector} y hay un lector L${mayorLector}.`);
    }
    if ((contadores.ultimoPrestamo ?? 0) < mayorPrestamo) {
      problemas.push(`contadores.ultimoPrestamo es ${contadores.ultimoPrestamo} y hay un préstamo ${mayorPrestamo}.`);
    }
  } else if (lectores.size > 0 || prestamos.size > 0) {
    problemas.push('No hay config/contadores y sí hay lectores o préstamos.');
  }

  return problemas;
}

/** ¿Están vacías las colecciones de negocio? Devuelve las que tienen datos. */
export async function coleccionesConDatos(db) {
  const conDatos = [];
  for (const nombre of COLECCIONES_DE_NEGOCIO) {
    const consulta = await db.collection(`bibliotecas/${BIB}/${nombre}`).limit(1).get();
    if (!consulta.empty) conDatos.push(nombre);
  }
  return conDatos;
}

/** Borra una colección completa en lotes acotados. Solo lo usa --reemplazar. */
export async function borrarColeccion(db, nombre, { lote = 300 } = {}) {
  const coleccion = db.collection(`bibliotecas/${BIB}/${nombre}`);
  let borrados = 0;
  for (;;) {
    const consulta = await coleccion.limit(lote).get();
    if (consulta.empty) return borrados;
    const escritura = db.batch();
    for (const instantanea of consulta.docs) escritura.delete(instantanea.ref);
    await escritura.commit();
    borrados += consulta.size;
    // Si una pasada no avanza, algo impide borrar y hay que detenerse: un
    // bucle que gira para siempre con el mantenimiento puesto es peor que un
    // error.
    const quedan = await coleccion.limit(lote).get();
    if (quedan.size === consulta.size && quedan.docs[0]?.id === consulta.docs[0]?.id) {
      throw new Error(`No se pudo borrar ${nombre}: la colección no avanza (${quedan.size} documentos).`);
    }
  }
}
