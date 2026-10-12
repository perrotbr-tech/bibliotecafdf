// El botón de guardar, una sola vez para toda la app (base §6.2 y §6.5).
//
// Desde el toque hasta la respuesta: deshabilitado, con «Guardando…», sin
// aceptar otro toque. Si pasan 5 segundos sin respuesta, «Confirmando… no
// cierres la app». El éxito lo canta quien llama, nunca este botón.

import { MENSAJES } from '../datos.js';

/**
 * Envuelve un botón para que una acción se ejecute UNA sola vez por toque.
 *
 * @param {HTMLButtonElement} boton
 * @param {()=>Promise<any>} accion
 * @param {{alTardar?:(texto:string)=>void}} [opciones]
 */
export function prepararBotonGuardar(boton, accion, { alTardar } = {}) {
  const textoOriginal = boton.textContent;
  let enCurso = false;

  async function manejar(evento) {
    evento?.preventDefault();
    // Doble toque: el segundo no hace nada. La guarda es la bandera, no el
    // atributo, porque el atributo se pinta después del evento.
    if (enCurso || boton.disabled) return;
    enCurso = true;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    boton.setAttribute('aria-busy', 'true');

    try {
      return await accion();
    } finally {
      enCurso = false;
      boton.disabled = false;
      boton.textContent = textoOriginal;
      boton.removeAttribute('aria-busy');
    }
  }

  boton.addEventListener('click', manejar);

  return {
    /** Para pasarle a `datos.guardar` el aviso de demora. */
    alTardar: (texto = MENSAJES.demora) => {
      boton.textContent = texto;
      alTardar?.(texto);
    },
    desconectar: () => boton.removeEventListener('click', manejar),
  };
}
