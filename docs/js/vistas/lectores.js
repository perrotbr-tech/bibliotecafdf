// Lectores: buscar por nombre, inscribir y abrir la ficha.
//
// Vive dentro de «Más», como Voluntarios: no es un sexto destino de la barra
// (así lo muestra el prototipo). Inscribir lo puede hacer cualquier
// voluntario; cambiar el nombre, solo el administrador.

import { rutas } from '../config-publica.js';
import { FILAS_POR_TANDA, filtrarLectores, porTandas, prepararLectores } from '../listas.js';
import { el, pintar } from '../ui/dom.js';
import { cargando, error as estadoError, vacio } from '../ui/estados.js';
import { abrirHoja, cerrarHoja } from '../ui/hoja.js';

import { abrirFichaDeLector } from './lector.js';
import { formularioDeInscripcion } from './inscribir-lector.js';

export function pantallaLectores({ datos, permiso, reloj, memoria }) {
  let lectores = [];
  let hayDatos = false;
  let consulta = '';
  let mostrados = FILAS_POR_TANDA;

  const buscador = el('input', {
    clase: 'buscador__control',
    id: 'buscar-lector',
    type: 'search',
    placeholder: 'Nombre del lector',
    'aria-label': 'Buscar un lector',
    autocomplete: 'off',
    spellcheck: 'false',
    'data-prueba': 'buscar-lector',
  });
  buscador.addEventListener('input', () => {
    consulta = buscador.value;
    mostrados = FILAS_POR_TANDA;
    pintarLista();
  });

  const botonInscribir = el('button', {
    clase: 'boton boton--ancho',
    type: 'button',
    texto: 'Inscribir lector',
    'data-prueba': 'inscribir-lector',
    al: {
      click: () =>
        abrirHoja({
          titulo: 'Inscribir lector',
          prueba: 'hoja-inscribir',
          contenido: formularioDeInscripcion({ datos, permiso, alGuardar: () => cerrarHoja() }),
        }),
    },
  });

  const resumen = el('p', { clase: 'lista__detalle', 'data-prueba': 'resumen-lectores' });
  const lista = el('div', { 'data-prueba': 'lista-lectores' }, [cargando('Cargando los lectores…')]);
  const botonMas = el('button', {
    clase: 'boton boton--secundario boton--ancho',
    type: 'button',
    texto: 'Mostrar más',
    'data-prueba': 'mostrar-mas-lectores',
    hidden: true,
    al: {
      click: () => {
        mostrados += FILAS_POR_TANDA;
        pintarLista();
      },
    },
  });

  const nodo = el('div', { 'data-prueba': 'lectores' }, [
    el('div', { clase: 'buscador' }, [buscador]),
    botonInscribir,
    resumen,
    lista,
    botonMas,
  ]);

  function pintarLista() {
    if (!hayDatos) return;
    const filtrados = filtrarLectores(lectores, { consulta });
    const { visibles, faltan, total } = porTandas(filtrados, mostrados);

    resumen.textContent =
      total === 0 ? '' : `${total} ${total === 1 ? 'lector' : 'lectores'}${faltan > 0 ? `, se muestran ${visibles.length}` : ''}`;

    if (total === 0) {
      pintar(
        lista,
        consulta.trim() === ''
          ? vacio('Todavía no hay lectores inscritos.', 'Usa «Inscribir lector» para agregar al primero.')
          : vacio('No se encontró ningún lector', 'Prueba con menos letras.'),
      );
      botonMas.hidden = true;
      return;
    }

    pintar(lista, el('ul', { clase: 'lista' }, visibles.map(filaDeLector)));
    botonMas.hidden = faltan === 0;
    botonMas.textContent = faltan === 0 ? 'Mostrar más' : `Mostrar más (${faltan})`;
  }

  function filaDeLector(lector) {
    return el('li', { clase: 'lista__fila' }, [
      el(
        'button',
        {
          clase: 'fila-boton',
          type: 'button',
          'data-prueba': `lector-${lector.id}`,
          al: { click: () => abrirFichaDeLector({ datos, permiso, lector, reloj, memoria }) },
        },
        [
          el('span', { clase: 'lista__principal' }, [
            el('span', { clase: 'lista__nombre', texto: lector.nombre ?? '' }),
          ]),
          lector.sinTelefono && el('span', { clase: 'etiqueta', texto: 'Sin teléfono' }),
        ],
      ),
    ]);
  }

  const soltar = datos.escucharColeccion(
    rutas.lectores(),
    (documentos, _metadatos, cambios) => {
      // Un evento sin cambios no vuelve a pintar: pintar soltaría el foco de
      // quien está escribiendo en el buscador.
      if (cambios === 0 && hayDatos) return;
      lectores = prepararLectores(documentos);
      hayDatos = true;
      pintarLista();
    },
    (fallo) => {
      pintar(lista, estadoError(`No se pudo leer la lista de lectores (${fallo?.code ?? 'sin código'}).`));
    },
  );

  return {
    nodo,
    desmontar: () => soltar(),
    alCambiarRed: () => {
      botonInscribir.disabled = !datos.hayRed();
    },
  };
}
