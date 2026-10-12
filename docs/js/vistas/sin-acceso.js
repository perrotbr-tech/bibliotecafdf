// Pantalla para una cuenta que no está en la lista o está inactiva.
import { el } from '../ui/dom.js';

export function pantallaSinAcceso({ correo, alUsarOtraCuenta }) {
  return el('div', { clase: 'entrada', 'data-prueba': 'sin-acceso' }, [
    el('h2', { clase: 'entrada__nombre', texto: 'Tu cuenta no tiene acceso' }),
    el('p', { clase: 'entrada__correo', texto: correo ?? '' }),
    el('p', { clase: 'entrada__nota', texto: 'Pídele al administrador que te agregue.' }),
    el('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: 'Usar otra cuenta',
      'data-prueba': 'usar-otra-cuenta',
      al: { click: alUsarOtraCuenta },
    }),
  ]);
}
