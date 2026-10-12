// Prestar. Llega en la Etapa 3.
import { disponiblePronto } from '../ui/estados.js';
import { el } from '../ui/dom.js';

export function pantallaPrestar() {
  return el('div', { 'data-prueba': 'prestar' }, [disponiblePronto('Prestar un libro')]);
}
