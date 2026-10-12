// Hoja emergente: la ficha de un libro, la de un lector y los formularios de
// alta y edición.
//
// Lo que tiene que cumplir, y por eso tiene pruebas propias:
//   · Al abrir, el foco entra en la hoja. Al cerrar, vuelve exactamente a
//     donde estaba, para no perder el lugar en una lista de cien filas.
//   · Mientras está abierta, Tab no se escapa: la hoja es modal de verdad.
//   · El botón Atrás del teléfono la CIERRA, en vez de salirse de la pantalla.
//     Para eso añade su propia entrada al historial, y `main.js` ignora un
//     `popstate` que no cambia de pantalla.
//   · Esc y un toque en el fondo también cierran.
//
// Se retiró en la Etapa 1 por no tener ningún uso real. Vuelve ahora con sus
// usos y sus pruebas.

import { el, enfocables } from './dom.js';

let hojaAbierta = null;

/**
 * Abre una hoja.
 *
 * @param {object} entrada
 * @param {string} entrada.titulo       Lo lee el lector de pantalla.
 * @param {Node} entrada.contenido
 * @param {string} [entrada.prueba]     Valor de `data-prueba` del panel.
 * @param {()=>void} [entrada.alCerrar]
 */
export function abrirHoja({ titulo, contenido, prueba = 'hoja', alCerrar = null }) {
  // Una hoja a la vez: abrir otra REEMPLAZA la que estaba. Es lo que conviene
  // en un teléfono —dos capas de hojas no caben— y evita una pila de entradas
  // de historial que haría falta deshacer de a una.
  const heredaLaEntrada = hojaAbierta !== null;
  if (hojaAbierta) hojaAbierta.cerrar({ moverHistorial: false });

  const devolverElFocoA = document.activeElement;

  const botonCerrar = el('button', {
    clase: 'boton boton--icono hoja__cerrar',
    type: 'button',
    texto: '✕',
    'aria-label': 'Cerrar',
    'data-prueba': `${prueba}-cerrar`,
  });

  const panel = el(
    'div',
    {
      clase: 'hoja__panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': titulo,
      'data-prueba': prueba,
      tabindex: '-1',
    },
    [
      el('div', { clase: 'hoja__barra' }, [
        el('p', { clase: 'hoja__titulo', texto: titulo }),
        botonCerrar,
      ]),
      el('div', { clase: 'hoja__cuerpo' }, [contenido]),
    ],
  );

  const marco = el('div', { clase: 'hoja', 'data-prueba': `${prueba}-marco` }, [panel]);
  document.body.append(marco);
  document.body.classList.add('con-hoja');

  // Entrada propia en el historial: el botón Atrás cierra la hoja. Si ya
  // había una hoja abierta, su entrada sirve para esta: una sola, para que un
  // Atrás devuelva a la pantalla y no a una entrada muerta.
  if (!heredaLaEntrada) {
    const estadoPrevio = globalThis.history?.state ?? null;
    globalThis.history?.pushState?.({ ...estadoPrevio, hoja: true }, '', globalThis.location?.hash || undefined);
  }

  let cerrada = false;

  function cerrar({ moverHistorial = true } = {}) {
    if (cerrada) return;
    cerrada = true;
    if (hojaAbierta?.panel === panel) hojaAbierta = null;

    globalThis.removeEventListener('popstate', alVolverAtras);
    document.removeEventListener('keydown', alTeclear);
    marco.remove();
    if (!document.querySelector('.hoja')) document.body.classList.remove('con-hoja');

    // Si se cerró con el botón o con Esc, hay que deshacer la entrada que se
    // añadió; si se cerró POR el botón Atrás, el historial ya se movió.
    if (moverHistorial && globalThis.history?.state?.hoja === true) globalThis.history.back();

    devolverElFocoA?.focus?.({ preventScroll: true });
    alCerrar?.();
  }

  function alVolverAtras() {
    cerrar({ moverHistorial: false });
  }

  function alTeclear(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    // Trampa de foco: Tab da la vuelta dentro de la hoja.
    const lista = enfocables(panel);
    if (lista.length === 0) return;
    const primero = lista[0];
    const ultimo = lista.at(-1);
    const dentro = panel.contains(document.activeElement);
    if (!dentro) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primero).focus();
      return;
    }
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  globalThis.addEventListener('popstate', alVolverAtras);
  document.addEventListener('keydown', alTeclear);
  botonCerrar.addEventListener('click', () => cerrar());
  marco.addEventListener('click', (evento) => {
    if (evento.target === marco) cerrar();
  });

  (enfocables(panel)[0] ?? panel).focus({ preventScroll: true });
  hojaAbierta = { cerrar, panel };
  return { cerrar, panel, marco };
}

/** Cierra la hoja abierta, si hay. No toca el historial. */
export function cerrarHoja() {
  hojaAbierta?.cerrar({ moverHistorial: false });
}

export function hayHojaAbierta() {
  return hojaAbierta !== null;
}

/** Una fila de datos de una ficha: etiqueta arriba, valor abajo. */
export function datoDeFicha(etiqueta, valor, { prueba = null } = {}) {
  return el('div', { clase: 'ficha__dato' }, [
    el('p', { clase: 'ficha__etiqueta', texto: etiqueta }),
    el('p', { clase: 'ficha__valor', texto: valor, ...(prueba ? { 'data-prueba': prueba } : {}) }),
  ]);
}
