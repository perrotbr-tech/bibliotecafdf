// Avisos de la app. Van en una región que se anuncia sola, sin robar el foco.
import { el, vaciar } from './dom.js';

const TIPOS = { exito: 'aviso--exito', error: 'aviso--error', atencion: 'aviso--atencion' };

function contenedor() {
  return document.getElementById('avisos');
}

/**
 * Muestra un aviso. Devuelve la función que lo quita.
 * @param {string} texto
 * @param {'exito'|'error'|'atencion'} [tipo]
 * @param {{id?:string, duracionMs?:number}} [opciones]
 */
export function avisar(texto, tipo = 'atencion', { id, duracionMs } = {}) {
  const caja = contenedor();
  if (!caja) return () => {};

  if (id) quitarAviso(id);
  const nodo = el('p', { clase: `aviso ${TIPOS[tipo] ?? TIPOS.atencion}`, texto, 'data-aviso': id ?? '' });
  caja.append(nodo);

  let reloj = null;
  if (duracionMs) reloj = setTimeout(() => nodo.remove(), duracionMs);
  return () => {
    if (reloj) clearTimeout(reloj);
    nodo.remove();
  };
}

export function quitarAviso(id) {
  for (const nodo of contenedor()?.querySelectorAll(`[data-aviso="${CSS.escape(id)}"]`) ?? []) nodo.remove();
}

export function limpiarAvisos() {
  const caja = contenedor();
  if (caja) vaciar(caja);
}
