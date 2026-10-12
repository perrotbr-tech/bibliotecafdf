// Inicio: la jornada del sábado. Llega en la Etapa 3, cuando existan los
// préstamos. Por ahora, estado vacío.
import { disponiblePronto } from '../ui/estados.js';
import { el } from '../ui/dom.js';

export function pantallaInicio() {
  return el('div', { 'data-prueba': 'inicio' }, [disponiblePronto('La jornada del sábado')]);
}
