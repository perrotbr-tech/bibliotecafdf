// Barra inferior con los cinco destinos.
import { el, pintar } from './dom.js';

export const DESTINOS = [
  { id: 'inicio', nombre: 'Inicio', icono: '🏠' },
  { id: 'prestar', nombre: 'Prestar', icono: '📕' },
  { id: 'prestamos', nombre: 'Préstamos', icono: '📋' },
  { id: 'catalogo', nombre: 'Catálogo', icono: '📚' },
  { id: 'mas', nombre: 'Más', icono: '⋯' },
];

export function esDestino(id) {
  return DESTINOS.some((destino) => destino.id === id);
}

export function dibujarBarraInferior({ actual, alIr }) {
  const barra = document.getElementById('barra-inferior');
  if (!barra) return;
  barra.hidden = false;
  pintar(
    barra,
    DESTINOS.map((destino) =>
      el(
        'button',
        {
          clase: 'destino',
          type: 'button',
          'data-destino': destino.id,
          'aria-current': destino.id === actual ? 'page' : false,
          al: { click: () => alIr(destino.id) },
        },
        [
          el('span', { clase: 'destino__icono', texto: destino.icono, 'aria-hidden': 'true' }),
          el('span', { texto: destino.nombre }),
        ],
      ),
    ),
  );
}

export function ocultarBarraInferior() {
  const barra = document.getElementById('barra-inferior');
  if (barra) barra.hidden = true;
}
