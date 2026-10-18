// Avisos de la app. Van en una región que se anuncia sola, sin robar el foco.
import { el, vaciar } from './dom.js';

const TIPOS = { exito: 'aviso--exito', error: 'aviso--error', atencion: 'aviso--atencion' };

function contenedor() {
  return document.getElementById('avisos');
}

/**
 * Muestra un aviso. Devuelve la función que lo quita.
 *
 * Un aviso puede ofrecer acciones mientras está visible: es lo que pide
 * specs/03 para «Deshacer» y «Prestar otro a (nombre)» durante diez segundos.
 * Tocar una acción la ejecuta y quita el aviso.
 *
 * @param {string} texto
 * @param {'exito'|'error'|'atencion'} [tipo]
 * @param {{id?:string, duracionMs?:number, acciones?:Array<{texto:string, prueba?:string, al:Function}>}} [opciones]
 */
export function avisar(texto, tipo = 'atencion', { id, duracionMs, acciones = [] } = {}) {
  const caja = contenedor();
  if (!caja) return () => {};

  if (id) quitarAviso(id);
  const clase = `aviso ${TIPOS[tipo] ?? TIPOS.atencion}`;
  const nodo =
    acciones.length === 0
      ? el('p', { clase, texto, 'data-aviso': id ?? '' })
      : el('div', { clase: `${clase} aviso--con-acciones`, 'data-aviso': id ?? '' }, [
          el('p', { clase: 'aviso__texto', texto }),
          el(
            'div',
            { clase: 'aviso__acciones' },
            acciones.map((accion) =>
              el('button', {
                clase: 'boton boton--chico boton--en-aviso',
                type: 'button',
                texto: accion.texto,
                'data-prueba': accion.prueba ?? '',
                al: {
                  click: () => {
                    quitar();
                    accion.al();
                  },
                },
              }),
            ),
          ),
        ]);
  caja.append(nodo);

  let reloj = null;
  function quitar() {
    if (reloj) clearTimeout(reloj);
    nodo.remove();
  }
  if (duracionMs) reloj = setTimeout(quitar, duracionMs);
  return quitar;
}

export function quitarAviso(id) {
  for (const nodo of contenedor()?.querySelectorAll(`[data-aviso="${CSS.escape(id)}"]`) ?? []) nodo.remove();
}

export function limpiarAvisos() {
  const caja = contenedor();
  if (caja) vaciar(caja);
}
