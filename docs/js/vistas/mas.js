// Más: lo que no cabe en la barra.
import { el } from '../ui/dom.js';

function opcion({ nombre, detalle, prueba, alAbrir }) {
  return el('li', { clase: 'lista__fila' }, [
    el('div', { clase: 'lista__principal' }, [
      el('p', { clase: 'lista__nombre', texto: nombre }),
      el('p', { clase: 'lista__detalle', texto: detalle }),
    ]),
    el('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: 'Abrir',
      'data-prueba': prueba,
      al: { click: alAbrir },
    }),
  ]);
}

export function pantallaMas({
  permiso,
  alIrALectores,
  alIrAVoluntarios,
  alIrAParaRecordar,
  alIrAMensajes,
  alIrAPapel,
  alSalir,
}) {
  const opciones = [
    opcion({
      nombre: 'Lectores',
      detalle: 'Buscar, inscribir y ver sus datos',
      prueba: 'abrir-lectores',
      alAbrir: alIrALectores,
    }),
    opcion({
      nombre: 'Para recordar',
      detalle: 'Quienes vencen el sábado y los atrasados',
      prueba: 'abrir-para-recordar',
      alAbrir: alIrAParaRecordar,
    }),
  ];

  if (permiso.rol === 'admin') {
    opciones.push(
      opcion({
        nombre: 'Mensajes',
        detalle: 'Plantillas de WhatsApp',
        prueba: 'abrir-mensajes',
        alAbrir: alIrAMensajes,
      }),
      opcion({
        nombre: 'Registrar desde papel',
        detalle: 'Anotar un préstamo de un sábado anterior',
        prueba: 'abrir-papel',
        alAbrir: alIrAPapel,
      }),
      opcion({
        nombre: 'Voluntarios',
        detalle: 'Quién puede entrar a la app',
        prueba: 'abrir-voluntarios',
        alAbrir: alIrAVoluntarios,
      }),
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

    el('p', { clase: 'titulo-seccion', texto: 'La biblioteca' }),
    el('ul', { clase: 'lista' }, opciones),

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
