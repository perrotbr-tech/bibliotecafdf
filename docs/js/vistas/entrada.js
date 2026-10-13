// Pantalla de entrada. NO lee la base: solo el nombre que trae
// `config-publica.js` y el botón de Google.
import { NOMBRE_ENTRADA } from '../config-publica.js';
import { el } from '../ui/dom.js';

export function pantallaEntrada({ alEntrar, nombre = NOMBRE_ENTRADA }) {
  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'button',
    texto: 'Entrar con Google',
    'data-prueba': 'entrar',
  });
  boton.addEventListener('click', () => alEntrar(boton));

  return el('div', { clase: 'entrada' }, [
    el('img', { src: 'iconos/icono.svg', alt: '', width: '72', height: '72', 'aria-hidden': 'true' }),
    el('h2', { clase: 'entrada__nombre', texto: nombre }),
    boton,
    el('p', { clase: 'entrada__nota', texto: 'Solo entran los voluntarios autorizados' }),
  ]);
}
