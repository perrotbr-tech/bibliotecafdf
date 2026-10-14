// Memoria de sesión: catálogo, lectores y préstamos abiertos en vivo.
// Las pantallas de Préstamos leen de aquí; Devueltos se pagina aparte.

import { rutas } from './config-publica.js';
import { enriquecerPrestamo, prepararLectores, prepararLibros } from './listas.js';

/**
 * @returns {{
 *   libros: Array, lectores: Array, prestamosAbiertos: Array,
 *   librosPorCodigo: Map, lectoresPorId: Map,
 *   escuchar: Function, soltar: Function, enriquecer: Function
 * }}
 */
export function crearMemoria() {
  const estado = {
    libros: [],
    lectores: [],
    prestamosAbiertos: [],
    librosPorCodigo: new Map(),
    lectoresPorId: new Map(),
  };
  const oyentes = new Set();
  const soltarEscuchas = [];

  function avisar() {
    for (const oyente of oyentes) oyente(estado);
  }

  function enriquecer(prestamo) {
    return enriquecerPrestamo(prestamo, {
      librosPorCodigo: estado.librosPorCodigo,
      lectoresPorId: estado.lectoresPorId,
    });
  }

  function escuchar(datos) {
    soltar();
    soltarEscuchas.push(
      datos.escucharColeccion(rutas.libros(), (docs) => {
        estado.libros = prepararLibros(docs);
        estado.librosPorCodigo = new Map(estado.libros.map((l) => [l.codigo, l]));
        avisar();
      }),
    );
    soltarEscuchas.push(
      datos.escucharColeccion(rutas.lectores(), (docs) => {
        estado.lectores = prepararLectores(docs).filter((l) => l.fusionadoEn == null);
        estado.lectoresPorId = new Map(estado.lectores.map((l) => [l.id, l]));
        avisar();
      }),
    );
    soltarEscuchas.push(
      datos.escucharConsulta(
        datos.consultaDe(rutas.prestamos(), datos.where('estado', '==', 'abierto')),
        (docs) => {
          estado.prestamosAbiertos = docs.map((p) => enriquecer(p));
          avisar();
        },
      ),
    );
  }

  function soltar() {
    while (soltarEscuchas.length) soltarEscuchas.pop()?.();
  }

  function alCambiar(oyente) {
    oyentes.add(oyente);
    oyente(estado);
    return () => oyentes.delete(oyente);
  }

  return {
    get estado() {
      return estado;
    },
    escuchar,
    soltar,
    alCambiar,
    enriquecer,
  };
}
