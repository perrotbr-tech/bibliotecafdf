// Pantalla para una cuenta que no está en la lista o está inactiva.
import { el } from '../ui/dom.js';

export function pantallaSinAcceso({ correo, alUsarOtraCuenta, alVolverAComprobar = null }) {
  return el('div', { clase: 'entrada', 'data-prueba': 'sin-acceso' }, [
    el('h2', { clase: 'entrada__nombre', texto: 'Tu cuenta no tiene acceso' }),
    el('p', { clase: 'entrada__correo', texto: correo ?? '' }),
    el('p', { clase: 'entrada__nota', texto: 'Pídele al administrador que te agregue.' }),
    // Cuando el administrador agrega o reactiva a alguien que tiene la app
    // abierta, este botón evita tener que cerrarla y volver a entrar.
    alVolverAComprobar &&
      el('button', {
        clase: 'boton',
        type: 'button',
        texto: 'Volver a comprobar',
        'data-prueba': 'volver-a-comprobar',
        al: { click: alVolverAComprobar },
      }),
    el('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: 'Usar otra cuenta',
      'data-prueba': 'usar-otra-cuenta',
      al: { click: alUsarOtraCuenta },
    }),
  ]);
}
