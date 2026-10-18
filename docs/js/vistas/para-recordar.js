// Para recordar: vencen el próximo sábado + atrasados (specs/04).

import { diaEnChile, esSabado, sabadoSiguiente } from '../fechas.js';
import { prestamosAtrasados, prestamosQueVuelven } from '../listas.js';
import { el, pintar } from '../ui/dom.js';
import { vacio } from '../ui/estados.js';

import { botonesDeRecordatorio } from './recordatorio.js';

export function pantallaParaRecordar({ datos, permiso, reloj, memoria, plantillas = {} }) {
  const raiz = el('div', { 'data-prueba': 'para-recordar' });

  function dibujar() {
    const ahora = reloj.ahora();
    if (!ahora) {
      pintar(raiz, el('p', { clase: 'lista__detalle', texto: 'Hora pendiente' }));
      return;
    }
    const dia = diaEnChile(ahora);
    const sabadoObjetivo = esSabado(dia) ? sabadoSiguiente(dia) : sabadoSiguiente(dia);
    // Si hoy no es sábado, sabadoSiguiente da el próximo; si es sábado, el siguiente.
    const vencen = prestamosQueVuelven(memoria.estado.prestamosAbiertos, sabadoObjetivo);
    const atrasados = prestamosAtrasados(memoria.estado.prestamosAbiertos, ahora, {
      priorizarSinRecordatorio: true,
    });

    pintar(raiz,
      el('p', { clase: 'titulo-seccion', texto: 'Para recordar' }),
      seccion('Vencen el sábado', vencen, 'previo', ahora),
      seccion('Atrasados', atrasados, 'atraso', ahora),
    );
  }

  function seccion(titulo, items, tipo, ahora) {
    return el('section', { 'data-prueba': `grupo-${tipo}` }, [
      el('p', { clase: 'titulo-seccion', texto: `${titulo} (${items.length})` }),
      items.length === 0
        ? vacio('Nadie en esta lista')
        : el('ul', { clase: 'lista' }, items.map((p) => el('li', {
            clase: 'lista__fila',
            'data-prueba': 'fila-recordar',
            'data-id': p.id,
          }, [
            el('div', { clase: 'lista__principal' }, [
              el('p', { clase: 'lista__nombre', texto: p.titulo }),
              el('p', { clase: 'lista__detalle', texto: `${p.libro} · ${p.nombreLector}` }),
            ]),
            botonesDeRecordatorio({
              datos, permiso, prestamo: p, plantillas, ahora, tipo,
            }),
          ]))),
    ]);
  }

  const soltar = memoria.alCambiar(() => dibujar());
  dibujar();
  return { nodo: raiz, desmontar: () => soltar(), alCambiarHora: () => dibujar() };
}
