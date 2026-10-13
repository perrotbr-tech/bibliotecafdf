// Listas largas: preparar, filtrar, ordenar y mostrar por tandas.
//
// Funciones puras. Ni base ni documento: reciben los documentos tal como
// llegan de la escucha y devuelven lo que la pantalla pinta. Así el filtro se
// puede probar sin navegador, que es donde de verdad se rompe.
//
// Una decisión de rendimiento que importa (base §12): el texto de búsqueda de
// cada libro se normaliza UNA vez, al recibir la colección, no en cada tecla.
// Con cinco mil libros, normalizar por pulsación no entra en los 100 ms que
// pide la etapa.

import {
  coincideBusqueda,
  normalizarCodigo,
  prepararBusquedaDeLector,
  prepararBusquedaDeLibro,
} from './texto.js';

/** Filas que se muestran antes de «Mostrar más» (etapa 2 §Pantallas). */
export const FILAS_POR_TANDA = 40;

export const ESTADOS_DE_LIBRO = [
  { id: 'todos', texto: 'Todos' },
  { id: 'disponibles', texto: 'Disponibles' },
  { id: 'prestados', texto: 'Prestados' },
];

const PARTES_DE_CODIGO = /^([A-Z]*)([0-9]*)([A-Z]*)$/u;

/**
 * Compara dos códigos como los lee una persona: primero la categoría, después
 * el número como NÚMERO y al final la letra. Así `INF999` va antes que
 * `INF1000`, que es lo que el orden alfabético simple no haría.
 */
export function compararCodigos(uno, otro) {
  const [, letrasUno = '', numeroUno = '', finUno = ''] = PARTES_DE_CODIGO.exec(normalizarCodigo(uno)) ?? [];
  const [, letrasOtro = '', numeroOtro = '', finOtro = ''] = PARTES_DE_CODIGO.exec(normalizarCodigo(otro)) ?? [];
  if (letrasUno !== letrasOtro) return letrasUno < letrasOtro ? -1 : 1;
  const comoNumero = (Number(numeroUno) || 0) - (Number(numeroOtro) || 0);
  if (comoNumero !== 0) return comoNumero;
  if (finUno !== finOtro) return finUno < finOtro ? -1 : 1;
  return 0;
}

/** Estado de un libro para mostrarlo: de baja, prestado o disponible. */
export function estadoDeLibro(libro) {
  if (libro?.baja === true) return 'de-baja';
  return (libro?.prestamoAbierto ?? null) !== null ? 'prestado' : 'disponible';
}

export const TEXTO_DE_ESTADO = {
  'de-baja': 'De baja',
  prestado: 'Prestado',
  disponible: 'Disponible',
};

/**
 * Prepara los libros para la pantalla: texto de búsqueda, estado y orden por
 * código.
 *
 * Llevaba también el prefijo de la categoría, que nadie leía: el color del
 * tejuelo sale de `claseDeTejuelo` y el código sugerido, de `categorias`. Eran
 * cinco mil expresiones regulares por evento de escucha para nada, y la
 * revisión del diff lo hizo notar.
 */
export function prepararLibros(documentos) {
  return [...(documentos ?? [])]
    .map((libro) => ({
      ...libro,
      codigo: libro.codigo ?? libro.id ?? '',
      estado: estadoDeLibro(libro),
      busqueda: prepararBusquedaDeLibro(libro),
    }))
    .sort((uno, otro) => compararCodigos(uno.codigo, otro.codigo));
}

/**
 * Filtra por texto, categoría y estado.
 *
 * Un libro de baja NO cuenta como disponible: no se puede prestar. Pero sigue
 * apareciendo en «Todos», porque el administrador tiene que poder encontrarlo.
 */
export function filtrarLibros(libros, { consulta = '', categoria = 'todas', estado = 'todos' } = {}) {
  return (libros ?? []).filter((libro) => {
    if (categoria !== 'todas' && libro.categoria !== categoria) return false;
    if (estado === 'disponibles' && libro.estado !== 'disponible') return false;
    if (estado === 'prestados' && libro.estado !== 'prestado') return false;
    return coincideBusqueda(libro.busqueda, consulta);
  });
}

/** Prepara los lectores: texto de búsqueda y orden alfabético en español. */
export function prepararLectores(documentos) {
  return [...(documentos ?? [])]
    .map((lector) => ({
      ...lector,
      sinTelefono: (lector.telefono ?? null) === null,
      busqueda: prepararBusquedaDeLector(lector),
    }))
    .sort((uno, otro) =>
      String(uno.nombre ?? '').localeCompare(String(otro.nombre ?? ''), 'es', { sensitivity: 'base' }),
    );
}

export function filtrarLectores(lectores, { consulta = '' } = {}) {
  return (lectores ?? []).filter((lector) => coincideBusqueda(lector.busqueda, consulta));
}

/**
 * Lo que se muestra de una lista larga y si queda más.
 * `mostrados` crece de tanda en tanda con «Mostrar más».
 */
export function porTandas(lista, mostrados = FILAS_POR_TANDA) {
  const cuantos = Math.max(0, mostrados);
  return {
    visibles: lista.slice(0, cuantos),
    faltan: Math.max(0, lista.length - cuantos),
    total: lista.length,
  };
}

/** Códigos ya usados en una categoría, para proponer el siguiente. */
export function codigosDeCategoria(libros, prefijo) {
  const marca = String(prefijo ?? '').toUpperCase();
  return (libros ?? [])
    .map((libro) => normalizarCodigo(libro.codigo ?? libro.id))
    .filter((codigo) => codigo.startsWith(marca));
}

/**
 * Clase del tejuelo de un código: un color por categoría, estable, sacado del
 * orden en que están configuradas. Sin orden alfabético ni azar: si mañana se
 * agrega una categoría, las de antes conservan su color.
 */
export function claseDeTejuelo(categoria, categorias = []) {
  const posicion = categorias.findIndex((una) => una?.nombre === categoria);
  return `tejuelo tejuelo--${posicion < 0 ? 0 : (posicion % 6) + 1}`;
}
