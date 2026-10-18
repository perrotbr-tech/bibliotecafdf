// Inicio: la jornada del sábado (specs/03) y recordatorios fuera de sábado (04).

import { rutas } from '../config-publica.js';
import {
  diaEnChile,
  esSabado,
  primerInstanteEnChile,
  sabadoDeJornada,
  textoFechaLarga,
} from '../fechas.js';
import {
  etiquetaAtraso,
  prestamosAtrasados,
  prestamosQueVuelven,
} from '../listas.js';
import { devolverPrestamo } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { el, pintar } from '../ui/dom.js';
import { cargando } from '../ui/estados.js';

import { abrirFichaDePrestamo } from './prestamo.js';
import { botonesDeRecordatorio } from './recordatorio.js';

export function pantallaInicio({
  datos,
  permiso,
  reloj,
  memoria,
  plantillas = {},
  alPrestar,
  alPrestamos,
  alRegistrarPapel,
}) {
  const raiz = el('div', { 'data-prueba': 'inicio' }, [cargando('Cargando la jornada…')]);
  let soltarMemoria = () => {};

  function pintarTodo() {
    const ahora = reloj.ahora();
    if (!ahora) {
      pintar(raiz, el('p', { clase: 'lista__detalle', texto: 'Hora pendiente', 'data-prueba': 'hora-pendiente' }));
      return;
    }

    const dia = diaEnChile(ahora);
    const esSab = esSabado(dia);
    const sabadoJornada = sabadoDeJornada(dia);
    const abiertos = memoria.estado.prestamosAbiertos;
    const vuelven = prestamosQueVuelven(abiertos, sabadoJornada);
    const atrasados = prestamosAtrasados(abiertos, ahora);
    const encabezado = esSab
      ? textoFechaLarga(ahora).replace(/^(\w)/u, (c) => c.toUpperCase()).replace(/ de \d{4}$/u, '')
      : `Próximo sábado, ${textoCorto(sabadoJornada)}`;

    const hijos = [
      el('h2', { clase: 'titulo-seccion', texto: encabezado, 'data-prueba': 'encabezado-inicio' }),
      el('div', { clase: 'fila-btn' }, [
        el('button', {
          clase: 'boton boton--ancho',
          type: 'button',
          texto: 'Prestar un libro',
          'data-prueba': 'ir-prestar',
          disabled: !esSab && permiso.rol !== 'admin',
          al: { click: () => alPrestar?.() },
        }),
        el('button', {
          clase: 'boton boton--secundario boton--ancho',
          type: 'button',
          texto: 'Registrar devolución',
          'data-prueba': 'ir-devolucion',
          al: { click: () => alPrestamos?.({ vista: 'curso', enfocarBusqueda: true }) },
        }),
      ]),
    ];

    if (!esSab && permiso.rol === 'admin') {
      hijos.push(
        el('button', {
          clase: 'boton boton--secundario boton--ancho',
          type: 'button',
          texto: 'Registrar desde papel',
          'data-prueba': 'ir-papel',
          al: { click: () => alRegistrarPapel?.() },
        }),
      );
    }

    hijos.push(
      el('div', { clase: 'cifras' }, [
        el('button', {
          clase: 'cifra',
          type: 'button',
          'data-prueba': 'cifra-vuelven',
          al: { click: () => alPrestamos?.({ vista: 'curso' }) },
        }, [
          el('b', { texto: String(vuelven.length) }),
          el('span', { texto: esSab ? 'Vuelven hoy' : 'Vuelven ese día' }),
        ]),
        el('button', {
          clase: 'cifra cifra--atraso',
          type: 'button',
          'data-prueba': 'cifra-atrasados',
          al: { click: () => alPrestamos?.({ vista: 'atrasados' }) },
        }, [
          el('b', { texto: String(atrasados.length) }),
          el('span', { texto: 'Atrasados' }),
        ]),
      ]),
    );

    hijos.push(seccionLista({
      titulo: esSab ? `Vuelven hoy (${vuelven.length})` : `Vuelven ese día (${vuelven.length})`,
      prueba: 'lista-vuelven',
      items: vuelven.slice(0, 10),
      ahora,
      datos,
      permiso,
      plantillas,
      conDevolver: esSab,
      conRecordatorio: !esSab,
      tipoRecordatorio: 'previo',
      vacio: 'Nadie tiene que devolver ese día',
    }));

    hijos.push(seccionLista({
      titulo: `Atrasados (${atrasados.length})`,
      prueba: 'lista-atrasados-inicio',
      items: atrasados.slice(0, 3),
      ahora,
      datos,
      permiso,
      plantillas,
      conDevolver: true,
      conRecordatorio: !esSab,
      tipoRecordatorio: 'atraso',
      vacio: 'Sin atrasos',
      pie: atrasados.length > 3
        ? el('button', {
            clase: 'boton boton--secundario boton--ancho',
            type: 'button',
            texto: 'Ver todos los atrasados',
            'data-prueba': 'ver-atrasados',
            al: { click: () => alPrestamos?.({ vista: 'atrasados' }) },
          })
        : null,
    }));

    // Movimientos de hoy se cargan aparte (solo lectura puntual / escucha).
    hijos.push(el('div', { 'data-prueba': 'movimientos-hoy' }, [
      el('p', { clase: 'titulo-seccion', texto: 'Movimientos de hoy' }),
      el('p', { clase: 'lista__detalle', texto: 'Se actualizan solos.', 'data-prueba': 'nota-movimientos' }),
      el('div', { 'data-prueba': 'lista-movimientos' }, [el('p', { clase: 'lista__detalle', texto: 'Cargando…' })]),
    ]));

    pintar(raiz, ...hijos);
    void cargarMovimientos(raiz.querySelector('[data-prueba="lista-movimientos"]'), datos, ahora, memoria);
  }

  soltarMemoria = memoria.alCambiar(() => pintarTodo());

  return {
    nodo: raiz,
    desmontar: () => {
      soltarMemoria();
    },
    alCambiarRed: () => pintarTodo(),
    alCambiarHora: () => pintarTodo(),
  };
}

function textoCorto(dia) {
  const [anio, mes, num] = dia.split('-').map(Number);
  const meses = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${num} de ${meses[mes]}`;
}

function seccionLista({
  titulo, prueba, items, ahora, datos, permiso, plantillas,
  conDevolver, conRecordatorio, tipoRecordatorio, vacio, pie,
}) {
  const cuerpo = items.length === 0
    ? [el('p', { clase: 'lista__detalle', texto: vacio })]
    : items.map((p) => filaPrestamoInicio({
      prestamo: p,
      ahora,
      datos,
      permiso,
      plantillas,
      conDevolver,
      conRecordatorio,
      tipoRecordatorio,
    }));
  return el('section', { 'data-prueba': prueba }, [
    el('p', { clase: 'titulo-seccion', texto: titulo }),
    el('ul', { clase: 'lista' }, cuerpo),
    pie,
  ]);
}

function filaPrestamoInicio({
  prestamo, ahora, datos, permiso, plantillas, conDevolver, conRecordatorio, tipoRecordatorio,
}) {
  const atraso = etiquetaAtraso(prestamo, ahora);
  const acciones = [];

  if (conDevolver) {
    const boton = el('button', {
      clase: 'boton boton--chico',
      type: 'button',
      texto: 'Devolver',
      'data-prueba': 'devolver',
      'data-prestamo': prestamo.id,
    });
    prepararBotonGuardar(boton, async () => {
      const resultado = await devolverPrestamo({
        datos,
        permiso,
        prestamoId: prestamo.id,
        operacionId: nuevoId(),
        alTardar: (t) => avisar(t, 'atencion', { id: 'devolver' }),
      });
      if (resultado.esExito) {
        avisar(`Devuelto: ${prestamo.titulo}`, 'exito', { id: 'devolver', duracionMs: 10_000 });
      } else {
        avisar(resultado.mensaje, 'error', { id: 'devolver' });
      }
      return resultado;
    }, { deshabilitadoAlTerminar: () => !datos.hayRed() });
    acciones.push(boton);
  }

  if (conRecordatorio) {
    acciones.push(botonesDeRecordatorio({
      datos,
      permiso,
      prestamo,
      plantillas,
      ahora,
      tipo: tipoRecordatorio,
    }));
  }

  return el('li', {
    clase: 'lista__fila',
    'data-prueba': 'fila-prestamo',
    'data-id': prestamo.id,
    al: {
      click: (ev) => {
        if (ev.target.closest('button, a')) return;
        abrirFichaDePrestamo({ datos, permiso, prestamo, ahora });
      },
    },
  }, [
    el('div', { clase: 'lista__principal' }, [
      el('p', { clase: 'lista__nombre', texto: prestamo.titulo }),
      el('p', {
        clase: 'lista__detalle',
        texto: `${prestamo.libro} · ${prestamo.nombreLector}${atraso ? ` · ${atraso}` : ''}`,
      }),
    ]),
    acciones.length ? el('div', { clase: 'fila-btn' }, acciones) : null,
  ]);
}

async function cargarMovimientos(contenedor, datos, ahora, memoria) {
  if (!contenedor) return;
  const desde = primerInstanteEnChile(diaEnChile(ahora));
  const ts = datos.timestampDesdeDate(desde);

  const prestados = await datos.consultar(
    datos.consultaDe(rutas.prestamos(), datos.where('prestadoEn', '>=', ts)),
  );
  const devueltos = await datos.consultar(
    datos.consultaDe(rutas.prestamos(), datos.where('devueltoEn', '>=', ts)),
  );

  const filas = [];
  for (const p of prestados.documentos) {
    filas.push({
      cuando: p.prestadoEn,
      texto: `Prestado ${p.libro} a ${memoria.enriquecer(p).nombreLector} por ${corto(p.creadoPor)}`,
    });
  }
  for (const p of devueltos.documentos) {
    filas.push({
      cuando: p.devueltoEn,
      texto: `Devuelto ${p.libro} por ${corto(p.devueltoPor)}`,
    });
  }
  filas.sort((a, b) => (b.cuando?.toMillis?.() ?? 0) - (a.cuando?.toMillis?.() ?? 0));

  if (filas.length === 0) {
    pintar(contenedor, el('p', { clase: 'lista__detalle', texto: 'Todavía no hay movimientos hoy' }));
    return;
  }
  pintar(
    contenedor,
    el('ul', { clase: 'lista' }, filas.slice(0, 20).map((f) =>
      el('li', { clase: 'lista__fila' }, [el('p', { clase: 'lista__detalle', texto: f.texto })]),
    )),
  );
}

function corto(correo) {
  return String(correo ?? '').split('@')[0] || 'alguien';
}
