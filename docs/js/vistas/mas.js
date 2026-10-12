// Más: lo que no cabe en la barra. En esta etapa, Voluntarios (solo
// administrador) y Cerrar sesión.
import { el } from '../ui/dom.js';

export function pantallaMas({ permiso, alIrAVoluntarios, alSalir }) {
  const opciones = [];

  if (permiso.rol === 'admin') {
    opciones.push(
      el('li', { clase: 'lista__fila' }, [
        el('div', { clase: 'lista__principal' }, [
          el('p', { clase: 'lista__nombre', texto: 'Voluntarios' }),
          el('p', { clase: 'lista__detalle', texto: 'Quién puede entrar a la app' }),
        ]),
        el('button', {
          clase: 'boton boton--secundario',
          type: 'button',
          texto: 'Abrir',
          'data-prueba': 'abrir-voluntarios',
          al: { click: alIrAVoluntarios },
        }),
      ]),
    );
  }

  return el('div', { 'data-prueba': 'mas' }, [
    el('p', { clase: 'titulo-seccion', texto: 'Tu cuenta' }),
    el('div', { clase: 'tarjeta' }, [
      el('p', { clase: 'lista__nombre', texto: permiso.nombre ?? '' }),
      el('p', { clase: 'lista__detalle', texto: permiso.correo ?? '' }),
      el('p', {}, [
        el('span', {
          clase: `etiqueta ${permiso.rol === 'admin' ? 'etiqueta--admin' : ''}`,
          texto: permiso.rol === 'admin' ? 'Administrador' : 'Voluntario',
        }),
      ]),
    ]),

    opciones.length > 0 && el('p', { clase: 'titulo-seccion', texto: 'Administración' }),
    opciones.length > 0 && el('ul', { clase: 'lista' }, opciones),

    el('p', { clase: 'titulo-seccion', texto: 'Sesión' }),
    el('button', {
      clase: 'boton boton--peligro boton--ancho',
      type: 'button',
      texto: 'Cerrar sesión',
      'data-prueba': 'cerrar-sesion',
      al: { click: alSalir },
    }),
  ]);
}
