// Cómo se convierte un documento de Firestore en JSON y de vuelta, y cómo se
// resume en un SHA-256 (contrato §6).
//
// Tres decisiones que importan:
//
//   · Las marcas de tiempo se guardan como `{seconds, nanoseconds}` con una
//     etiqueta `_tipo`, para que al reponerlas vuelvan a ser marcas de tiempo
//     y no un mapa de dos números. Sin la etiqueta, una restauración no podría
//     distinguirlas y C-34 —«idéntica documento por documento, incluidas las
//     marcas de tiempo»— sería imposible de cumplir.
//   · Un tipo que este módulo no sepa exportar LANZA. Es preferible un
//     respaldo que no se genera a uno que pierde un campo en silencio.
//   · El hash se calcula sobre un texto canónico con las claves ordenadas, no
//     sobre `JSON.stringify` tal cual: el orden de las claves de un documento
//     que llega de la red no es estable, y un hash que cambia sin que cambien
//     los datos no sirve para verificar nada.
import { createHash } from 'node:crypto';

/** Versión del formato del archivo. Si cambia la forma, cambia el número. */
export const ESQUEMA = 1;

const ETIQUETA_HORA = 'hora';
const ETIQUETA_DECIMAL = 'decimal';

function esMarcaDeTiempo(valor) {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    typeof valor.seconds === 'number' &&
    typeof valor.nanoseconds === 'number' &&
    typeof valor.toDate === 'function'
  );
}

/** Un documento de Firestore a JSON puro. */
export function aExportable(valor, ruta = '') {
  if (valor === null) return null;
  if (typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') {
    if (Number.isInteger(valor)) return valor;
    // Un decimal pasaría por entero al releerlo si quedara como número suelto.
    if (Number.isFinite(valor)) return { _tipo: ETIQUETA_DECIMAL, valor };
    throw new TypeError(`No se puede exportar ${valor} en ${ruta || '(raíz)'}`);
  }
  if (esMarcaDeTiempo(valor)) {
    return { _tipo: ETIQUETA_HORA, seconds: valor.seconds, nanoseconds: valor.nanoseconds };
  }
  if (Array.isArray(valor)) return valor.map((uno, i) => aExportable(uno, `${ruta}[${i}]`));
  if (valor instanceof Date) {
    const milisegundos = valor.getTime();
    return {
      _tipo: ETIQUETA_HORA,
      seconds: Math.floor(milisegundos / 1000),
      nanoseconds: (((milisegundos % 1000) + 1000) % 1000) * 1e6,
    };
  }
  if (Object.getPrototypeOf(valor) === Object.prototype || Object.getPrototypeOf(valor) === null) {
    const salida = {};
    for (const [clave, dentro] of Object.entries(valor)) {
      if (clave.startsWith('_tipo')) {
        throw new TypeError(`Una clave llamada «${clave}» chocaría con la etiqueta de tipo (${ruta})`);
      }
      salida[clave] = aExportable(dentro, ruta ? `${ruta}.${clave}` : clave);
    }
    return salida;
  }
  // Referencias, GeoPoint, Bytes: el modelo no los usa. Si aparecieran, este
  // módulo no sabe exportarlos y se detiene en vez de perderlos.
  throw new TypeError(`Tipo que no se sabe exportar en ${ruta || '(raíz)'}: ${valor?.constructor?.name}`);
}

/** De JSON puro a los valores que espera Admin SDK. */
export function deExportable(valor, Timestamp, ruta = '') {
  if (valor === null) return null;
  if (typeof valor === 'string' || typeof valor === 'boolean' || typeof valor === 'number') return valor;
  if (Array.isArray(valor)) return valor.map((uno, i) => deExportable(uno, Timestamp, `${ruta}[${i}]`));
  if (typeof valor === 'object') {
    if (valor._tipo === ETIQUETA_HORA) return new Timestamp(valor.seconds, valor.nanoseconds);
    if (valor._tipo === ETIQUETA_DECIMAL) return valor.valor;
    if (typeof valor._tipo === 'string') {
      throw new TypeError(`Etiqueta de tipo desconocida en ${ruta || '(raíz)'}: ${valor._tipo}`);
    }
    const salida = {};
    for (const [clave, dentro] of Object.entries(valor)) {
      salida[clave] = deExportable(dentro, Timestamp, ruta ? `${ruta}.${clave}` : clave);
    }
    return salida;
  }
  throw new TypeError(`Valor que no se sabe reponer en ${ruta || '(raíz)'}`);
}

/**
 * Texto canónico de un valor JSON: claves ordenadas, sin espacios. Dos
 * documentos con los mismos datos dan el mismo texto, venga como venga el
 * orden de sus claves.
 */
export function textoCanonico(valor) {
  if (valor === null) return 'null';
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new TypeError(`Número que no se puede serializar: ${valor}`);
    return JSON.stringify(valor);
  }
  if (typeof valor === 'string' || typeof valor === 'boolean') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(textoCanonico).join(',')}]`;
  if (typeof valor === 'object') {
    const claves = Object.keys(valor).sort();
    return `{${claves.map((clave) => `${JSON.stringify(clave)}:${textoCanonico(valor[clave])}`).join(',')}}`;
  }
  throw new TypeError(`Valor que no se puede serializar: ${typeof valor}`);
}

/** SHA-256 en hexadecimal del texto canónico de un valor. */
export function hashCanonico(valor) {
  return createHash('sha256').update(textoCanonico(valor), 'utf8').digest('hex');
}

/**
 * Compara dos documentos exportados. Devuelve la lista de diferencias, con la
 * ruta de cada una, para que una restauración pueda decir QUÉ no coincide y no
 * solo que algo no coincide (C-34).
 */
export function diferencias(esperado, obtenido, ruta = '') {
  const donde = ruta || '(raíz)';
  if (textoCanonico(esperado ?? null) === textoCanonico(obtenido ?? null)) return [];
  const sonMapas = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!sonMapas(esperado) || !sonMapas(obtenido)) {
    return [{ ruta: donde, esperado: esperado ?? null, obtenido: obtenido ?? null }];
  }
  const claves = [...new Set([...Object.keys(esperado), ...Object.keys(obtenido)])].sort();
  return claves.flatMap((clave) =>
    diferencias(esperado[clave], obtenido[clave], ruta ? `${ruta}.${clave}` : clave),
  );
}
