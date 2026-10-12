// Hoja emergente. Retiene el foco mientras está abierta y lo devuelve al
// cerrar (base §9). El botón Atrás del teléfono la cierra: eso lo maneja
// `main.js` con el historial del navegador.
import { enfocables, pintar } from './dom.js';

let devolverFocoA = null;
let alCerrarActual = null;

function nodos() {
  return {
    hoja: document.getElementById('hoja'),
    panel: document.getElementById('hoja-panel'),
    titulo: document.getElementById('hoja-titulo'),
    cuerpo: document.getElementById('hoja-cuerpo'),
  };
}

export function hojaAbierta() {
  return nodos().hoja?.hidden === false;
}

/**
 * Abre la hoja con un título y un contenido.
 * @param {{titulo:string, contenido:Node|Node[], alCerrar?:()=>void, enfocar?:string}} opciones
 */
export function abrirHoja({ titulo, contenido, alCerrar = null, enfocar = null }) {
  const { hoja, panel, titulo: tituloNodo, cuerpo } = nodos();
  if (!hoja) return;

  devolverFocoA = document.activeElement;
  alCerrarActual = alCerrar;
  tituloNodo.textContent = titulo;
  pintar(cuerpo, contenido);
  hoja.hidden = false;

  const destino = (enfocar && panel.querySelector(enfocar)) || enfocables(panel)[0] || panel;
  destino.focus();
}

export function cerrarHoja() {
  const { hoja, cuerpo } = nodos();
  if (!hoja || hoja.hidden) return;
  hoja.hidden = true;
  pintar(cuerpo);
  const volver = devolverFocoA;
  const avisar = alCerrarActual;
  devolverFocoA = null;
  alCerrarActual = null;
  // El foco nunca vuelve al inicio del documento.
  if (volver && document.contains(volver)) volver.focus();
  else document.getElementById('pantalla')?.focus();
  avisar?.();
}

/** Conecta el cierre por fondo, por botón, por Escape y la retención del foco. */
export function conectarHoja({ alPedirCierre }) {
  const { hoja, panel } = nodos();
  if (!hoja) return;

  hoja.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar-hoja]')) alPedirCierre();
  });

  document.addEventListener('keydown', (evento) => {
    if (hoja.hidden) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      alPedirCierre();
      return;
    }
    if (evento.key !== 'Tab') return;

    const lista = enfocables(panel);
    if (lista.length === 0) return;
    const primero = lista[0];
    const ultimo = lista.at(-1);
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });
}
