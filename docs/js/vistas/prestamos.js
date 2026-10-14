// Pantalla Préstamos: En curso, Atrasados y Devueltos (specs/03 + 04).

import { rutas } from '../config-publica.js';
import { diaEnChile, textoFechaVencimiento } from '../fechas.js';
import {
  DEVUELTOS_POR_PAGINA,
  etiquetaAtraso,
  filtrarPrestamos,
  porTandas,
  prestamosAtrasados,
  prestamosEnCurso,
} from '../listas.js';
import { devolverPrestamo } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { el, pintar } from '../ui/dom.js';
import { cargando, vacio } from '../ui/estados.js';

import { abrirFichaDePrestamo } from './prestamo.js';
import { botonesDeRecordatorio } from './recordatorio.js';

export function pantallaPrestamos({
  datos,
  permiso,
  reloj,
  memoria,
  plantillas = {},
  vistaInicial = 'curso',
  enfocarBusqueda = false,
}) {
  let vista = vistaInicial;
  let consulta = '';
  let mostrados = DEVUELTOS_POR_PAGINA;
  let devueltos = [];
  let cursorDevueltos = null;
  let cargandoDevueltos = false;
  let hayMasDevueltos = true;

  const buscador = el('input', {
    clase: 'campo__control',
    type: 'search',
    placeholder: 'Título, código, lector o número',
    'aria-label': 'Buscar préstamos',
    'data-prueba': 'buscar-prestamos',
  });
  buscador.addEventListener('input', () => {
    consulta = buscador.value;
    mostrados = DEVUELTOS_POR_PAGINA;
    pintarLista();
  });

  const pestanas = el('div', { clase: 'fichas', role: 'tablist', 'data-prueba': 'pestanas-prestamos' });
  const rotulo = el('p', { clase: 'rotulo-orden', 'data-prueba': 'rotulo-orden', hidden: true });
  const lista = el('div', { 'data-prueba': 'lista-prestamos' }, [cargando('Cargando…')]);
  const botonMas = el('button', {
    clase: 'boton boton--secundario boton--ancho',
    type: 'button',
    texto: 'Cargar más',
    'data-prueba': 'cargar-mas',
    hidden: true,
    al: {
      click: () => {
        if (vista === 'devueltos') void cargarMasDevueltos();
        else {
          mostrados += DEVUELTOS_POR_PAGINA;
          pintarLista();
        }
      },
    },
  });

  const raiz = el('div', { 'data-prueba': 'prestamos' }, [
    el('p', { clase: 'titulo-seccion', texto: 'Préstamos' }),
    pestanas,
    el('div', { clase: 'campo' }, [buscador]),
    rotulo,
    lista,
    botonMas,
  ]);

  function pintarPestanas(ahora) {
    const abiertos = memoria.estado.prestamosAbiertos;
    const nCurso = prestamosEnCurso(abiertos, ahora).length;
    const nAtrasados = prestamosAtrasados(abiertos, ahora).length;
    const tabs = [
      { id: 'curso', texto: `En curso (${nCurso})` },
      { id: 'atrasados', texto: `Atrasados (${nAtrasados})` },
      { id: 'devueltos', texto: 'Devueltos' },
    ];
    pintar(
      pestanas,
      ...tabs.map((t) =>
        el('button', {
          clase: 'ficha-filtro' + (vista === t.id ? ' ficha-filtro--puesta' : ''),
          type: 'button',
          role: 'tab',
          'aria-selected': vista === t.id,
          texto: t.texto,
          'data-prueba': `pestana-${t.id}`,
          al: {
            click: () => {
              vista = t.id;
              consulta = '';
              buscador.value = '';
              mostrados = DEVUELTOS_POR_PAGINA;
              if (vista === 'devueltos' && devueltos.length === 0) void cargarMasDevueltos(true);
              pintarPestanas(ahora);
              pintarLista();
            },
          },
        }),
      ),
    );
  }

  function pintarLista() {
    const ahora = reloj.ahora();
    if (!ahora) {
      pintar(lista, el('p', { clase: 'lista__detalle', texto: 'Hora pendiente' }));
      return;
    }
    pintarPestanas(ahora);

    if (vista === 'devueltos') {
      rotulo.hidden = false;
      rotulo.textContent = 'Orden por registro';
      const filtrados = filtrarPrestamos(
        devueltos.map((p) => memoria.enriquecer(p)),
        consulta,
      );
      const notaBusqueda = consulta
        ? el('p', {
            clase: 'lista__detalle',
            texto: `Buscando en los ${devueltos.length} cargados`,
            'data-prueba': 'busqueda-devueltos',
          })
        : null;
      if (filtrados.length === 0) {
        pintar(lista, notaBusqueda, vacio(cargandoDevueltos ? 'Cargando…' : 'No hay devoluciones cargadas'));
      } else {
        pintar(lista, notaBusqueda, el('ul', { clase: 'lista' }, filtrados.map((p) => fila(p, ahora, false))));
      }
      botonMas.hidden = !hayMasDevueltos || Boolean(consulta);
      botonMas.textContent = 'Cargar más';
      return;
    }

    rotulo.hidden = true;
    const abiertos = memoria.estado.prestamosAbiertos;
    let base = vista === 'atrasados'
      ? prestamosAtrasados(abiertos, ahora, { priorizarSinRecordatorio: true })
      : prestamosEnCurso(abiertos, ahora);
    base = filtrarPrestamos(base, consulta);
    const tanda = porTandas(base, mostrados);
    if (tanda.visibles.length === 0) {
      pintar(lista, vacio(vista === 'atrasados' ? 'Sin atrasos' : 'Nada en curso'));
    } else {
      pintar(
        lista,
        el('ul', { clase: 'lista' }, tanda.visibles.map((p) => fila(p, ahora, vista === 'atrasados'))),
      );
    }
    botonMas.hidden = tanda.faltan === 0;
    botonMas.textContent = 'Mostrar más';
  }

  function fila(prestamo, ahora, conRecordatorio) {
    const atraso = etiquetaAtraso(prestamo, ahora);
    const anio = Number(diaEnChile(ahora).slice(0, 4));
    const acciones = [];

    if (prestamo.estado === 'abierto') {
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
        if (resultado.esExito) avisar(`Devuelto: ${prestamo.titulo}`, 'exito', { id: 'devolver', duracionMs: 10_000 });
        else avisar(resultado.mensaje, 'error', { id: 'devolver' });
        return resultado;
      }, { deshabilitadoAlTerminar: () => !datos.hayRed() });
      acciones.push(boton);
    }

    if (conRecordatorio) {
      acciones.push(botonesDeRecordatorio({
        datos, permiso, prestamo, plantillas, ahora, tipo: 'atraso',
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
          texto: [
            prestamo.libro,
            prestamo.nombreLector,
            prestamo.numero != null ? `P${prestamo.numero}` : null,
            prestamo.salidaDia ? `salió el ${prestamo.salidaDia}` : null,
            prestamo.venceEl ? `vence el ${textoFechaVencimiento(prestamo.venceEl, { anioDeReferencia: anio })}` : null,
            atraso,
            prestamo.estado === 'devuelto' ? 'devuelto' : null,
          ].filter(Boolean).join(' · '),
        }),
      ]),
      acciones.length ? el('div', { clase: 'fila-btn' }, acciones) : null,
    ]);
  }

  async function cargarMasDevueltos(reiniciar = false) {
    if (cargandoDevueltos) return;
    cargandoDevueltos = true;
    if (reiniciar) {
      devueltos = [];
      cursorDevueltos = null;
      hayMasDevueltos = true;
    }
    const restricciones = [
      datos.where('estado', '==', 'devuelto'),
      datos.orderBy('prestadoEn', 'desc'),
      datos.limit(DEVUELTOS_POR_PAGINA),
    ];
    if (cursorDevueltos) restricciones.push(datos.startAfter(cursorDevueltos));
    const resultado = await datos.consultar(datos.consultaDe(rutas.prestamos(), ...restricciones));
    if (resultado.estado === 'ok') {
      const nuevos = resultado.documentos.map(({ __snap, ...rest }) => rest);
      devueltos = reiniciar ? nuevos : [...devueltos, ...nuevos];
      cursorDevueltos = resultado.ultimoDoc;
      hayMasDevueltos = nuevos.length === DEVUELTOS_POR_PAGINA;
    }
    cargandoDevueltos = false;
    pintarLista();
  }

  const soltar = memoria.alCambiar(() => pintarLista());
  pintarLista();
  if (vista === 'devueltos') void cargarMasDevueltos(true);
  if (enfocarBusqueda) queueMicrotask(() => buscador.focus());

  return {
    nodo: raiz,
    desmontar: () => soltar(),
    alCambiarRed: () => pintarLista(),
  };
}
