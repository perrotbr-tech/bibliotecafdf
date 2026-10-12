// Catálogo. Llega en la Etapa 2.
import { disponiblePronto } from '../ui/estados.js';
import { el } from '../ui/dom.js';

export function pantallaCatalogo() {
  return el('div', { 'data-prueba': 'catalogo' }, [disponiblePronto('El catálogo de libros')]);
}
