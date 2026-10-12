// Préstamos. Llega en la Etapa 3.
import { disponiblePronto } from '../ui/estados.js';
import { el } from '../ui/dom.js';

export function pantallaPrestamos() {
  return el('div', { 'data-prueba': 'prestamos' }, [disponiblePronto('La lista de préstamos')]);
}
