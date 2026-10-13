// Los cinco estados que toda pantalla tiene diseñados (base §9):
// cargando, vacío, sin conexión, sin permiso y error.
import { el } from './dom.js';

export function cargando(texto = 'Cargando…') {
  return el('p', { clase: 'cargando', texto, role: 'status' });
}

export function vacio(texto, detalle = null) {
  return el('div', { clase: 'vacio' }, [el('p', { texto }), detalle && el('p', { clase: 'lista__detalle', texto: detalle })]);
}

export function sinConexion(detalle = 'No se puede guardar hasta que vuelva la señal.') {
  return el('div', { clase: 'tarjeta' }, [
    el('p', { clase: 'lista__nombre', texto: 'Sin conexión' }),
    el('p', { clase: 'lista__detalle', texto: detalle }),
  ]);
}

export function sinPermiso(detalle = 'Pídele al administrador que te dé acceso a esta pantalla.') {
  return el('div', { clase: 'tarjeta' }, [
    el('p', { clase: 'lista__nombre', texto: 'Sin permiso' }),
    el('p', { clase: 'lista__detalle', texto: detalle }),
  ]);
}

export function error(detalle = 'Algo falló al cargar esta pantalla.', alReintentar = null) {
  return el('div', { clase: 'tarjeta' }, [
    el('p', { clase: 'lista__nombre', texto: 'Hubo un problema' }),
    el('p', { clase: 'lista__detalle', texto: detalle }),
    alReintentar &&
      el('button', { clase: 'boton boton--secundario', type: 'button', texto: 'Reintentar', al: { click: alReintentar } }),
  ]);
}

/** Pantalla de un destino que todavía no existe en esta etapa. */
export function disponiblePronto(nombre) {
  return el('div', { clase: 'vacio' }, [
    el('p', { clase: 'lista__nombre', texto: 'Disponible pronto' }),
    el('p', { clase: 'lista__detalle', texto: `${nombre} llega en una etapa siguiente.` }),
  ]);
}
