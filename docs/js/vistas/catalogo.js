// Catálogo: buscar, filtrar y abrir la ficha de un libro.
//
// Dos cosas que esta pantalla promete y que son la razón de cómo está escrita:
//
//   · Escribir en el buscador NO relee la base. El filtro corre sobre lo que
//     la escucha ya trajo, con el texto de cada libro normalizado una sola vez
//     al recibir la colección.
//   · Un cambio hecho en otro teléfono aparece sin recargar y sin borrar lo
//     que la persona está escribiendo (C-27). Para eso se vuelve a pintar SOLO
//     la lista, nunca el buscador ni los filtros.

import { rutas } from '../config-publica.js';
import {
  ESTADOS_DE_LIBRO,
  FILAS_POR_TANDA,
  TEXTO_DE_ESTADO,
  claseDeTejuelo,
  filtrarLibros,
  porTandas,
  prepararLibros,
} from '../listas.js';
import { el, pintar } from '../ui/dom.js';
import { cargando, error as estadoError, vacio } from '../ui/estados.js';
import { abrirHoja } from '../ui/hoja.js';

import { abrirFichaDeLibro } from './libro.js';
import { formularioDeLibro } from './libro-formulario.js';

export function pantallaCatalogo({ datos, permiso, categorias: categoriasIniciales = [] }) {
  let categorias = categoriasIniciales;
  let crudos = [];
  let libros = [];
  let hayDatos = false;
  let consulta = '';
  let categoriaElegida = 'todas';
  let estadoElegido = 'todos';
  let mostrados = FILAS_POR_TANDA;

  const buscador = el('input', {
    clase: 'buscador__control',
    id: 'buscar-libro',
    type: 'search',
    placeholder: 'Título, autor o código',
    'aria-label': 'Buscar un libro',
    autocomplete: 'off',
    spellcheck: 'false',
    'data-prueba': 'buscar-libro',
  });
  buscador.addEventListener('input', () => {
    consulta = buscador.value;
    mostrados = FILAS_POR_TANDA;
    pintarLista();
  });

  const fichasDeCategoria = el('div', { clase: 'fichas', 'data-prueba': 'filtros-categoria', role: 'group', 'aria-label': 'Categorías' });
  const fichasDeEstado = el('div', { clase: 'fichas', 'data-prueba': 'filtros-estado', role: 'group', 'aria-label': 'Estado' });
  const resumen = el('p', { clase: 'lista__detalle', 'data-prueba': 'resumen-catalogo' });
  const lista = el('div', { 'data-prueba': 'lista-libros' }, [cargando('Cargando el catálogo…')]);
  const botonMas = el('button', {
    clase: 'boton boton--secundario boton--ancho',
    type: 'button',
    texto: 'Mostrar más',
    'data-prueba': 'mostrar-mas',
    hidden: true,
    al: {
      click: () => {
        mostrados += FILAS_POR_TANDA;
        pintarLista();
      },
    },
  });

  const botonAgregar =
    permiso.rol === 'admin'
      ? el('button', {
          clase: 'boton boton--ancho',
          type: 'button',
          texto: 'Agregar libro',
          'data-prueba': 'agregar-libro',
          al: {
            click: () =>
              abrirHoja({
                titulo: 'Agregar libro',
                prueba: 'hoja-libro-formulario',
                contenido: formularioDeLibro({
                  datos,
                  permiso,
                  categorias,
                  libros,
                  alGuardar: () => {},
                }).nodo,
              }),
          },
        })
      : null;

  const nodo = el('div', { 'data-prueba': 'catalogo' }, [
    el('div', { clase: 'buscador' }, [buscador]),
    fichasDeCategoria,
    fichasDeEstado,
    botonAgregar,
    resumen,
    lista,
    botonMas,
  ]);

  // ------------------------------------------------------------- filtros

  function pintarFichas() {
    const porCategoria = [{ nombre: 'todas', texto: 'Todas' }, ...categorias.map((una) => ({ nombre: una.nombre, texto: una.nombre }))];
    pintar(
      fichasDeCategoria,
      porCategoria.map((una) =>
        el('button', {
          clase: `ficha-filtro ${categoriaElegida === una.nombre ? 'ficha-filtro--puesta' : ''}`,
          type: 'button',
          texto: una.texto,
          'aria-pressed': categoriaElegida === una.nombre ? 'true' : 'false',
          'data-prueba': `filtro-categoria-${una.nombre}`,
          al: {
            click: () => {
              categoriaElegida = una.nombre;
              mostrados = FILAS_POR_TANDA;
              pintarFichas();
              pintarLista();
            },
          },
        }),
      ),
    );
    pintar(
      fichasDeEstado,
      ESTADOS_DE_LIBRO.map((uno) =>
        el('button', {
          clase: `ficha-filtro ${estadoElegido === uno.id ? 'ficha-filtro--puesta' : ''}`,
          type: 'button',
          texto: uno.texto,
          'aria-pressed': estadoElegido === uno.id ? 'true' : 'false',
          'data-prueba': `filtro-estado-${uno.id}`,
          al: {
            click: () => {
              estadoElegido = uno.id;
              mostrados = FILAS_POR_TANDA;
              pintarFichas();
              pintarLista();
            },
          },
        }),
      ),
    );
  }

  // --------------------------------------------------------------- lista

  function pintarLista() {
    if (!hayDatos) return;
    const filtrados = filtrarLibros(libros, {
      consulta,
      categoria: categoriaElegida,
      estado: estadoElegido,
    });
    const { visibles, faltan, total } = porTandas(filtrados, mostrados);

    resumen.textContent =
      total === 0 ? '' : `${total} ${total === 1 ? 'libro' : 'libros'}${faltan > 0 ? `, se muestran ${visibles.length}` : ''}`;

    if (total === 0) {
      // C-26: una búsqueda con signos raros no da error, da lista vacía con
      // su mensaje.
      pintar(lista, vacio('No se encontró ningún libro', 'Prueba con menos palabras, o revisa el código.'));
      botonMas.hidden = true;
      return;
    }

    pintar(lista, el('ul', { clase: 'lista' }, visibles.map(filaDeLibro)));
    botonMas.hidden = faltan === 0;
    botonMas.textContent = faltan === 0 ? 'Mostrar más' : `Mostrar más (${faltan})`;
  }

  function filaDeLibro(libro) {
    return el('li', { clase: 'lista__fila' }, [
      el(
        'button',
        {
          clase: 'fila-boton',
          type: 'button',
          'data-prueba': `libro-${libro.codigo}`,
          al: { click: () => abrirFichaDeLibro({ datos, permiso, categorias, libros, libro }) },
        },
        [
          el('span', { clase: claseDeTejuelo(libro.categoria, categorias), texto: libro.codigo }),
          el('span', { clase: 'lista__principal' }, [
            el('span', { clase: 'lista__nombre', texto: libro.titulo ?? '' }),
            el('span', { clase: 'lista__detalle', texto: libro.autor ? libro.autor : 'Sin autor anotado' }),
          ]),
          el('span', {
            clase: `etiqueta ${libro.estado === 'disponible' ? 'etiqueta--disponible' : 'etiqueta--inactivo'}`,
            texto: TEXTO_DE_ESTADO[libro.estado],
          }),
        ],
      ),
    ]);
  }

  // -------------------------------------------------------------- escuchas

  const soltarConfig = datos.escucharDocumento(rutas.configApp(), (configuracion) => {
    const nuevas = configuracion?.categorias;
    if (!Array.isArray(nuevas)) return;
    categorias = nuevas;
    pintarFichas();
    if (hayDatos) {
      // Los prefijos de los tejuelos salen de las categorías.
      libros = prepararLibros(crudos, { categorias });
      pintarLista();
    }
  });

  const soltarLibros = datos.escucharColeccion(
    rutas.libros(),
    (documentos, _metadatos, cambios) => {
      // Un evento sin cambios —por ejemplo al perder la conexión— no vuelve a
      // pintar nada: pintar soltaría el foco de quien está escribiendo.
      if (cambios === 0 && hayDatos) return;
      crudos = documentos;
      libros = prepararLibros(documentos, { categorias });
      hayDatos = true;
      pintarLista();
    },
    (fallo) => {
      pintar(lista, estadoError(`No se pudo leer el catálogo (${fallo?.code ?? 'sin código'}).`));
    },
  );

  pintarFichas();

  return {
    nodo,
    desmontar: () => {
      soltarLibros();
      soltarConfig();
    },
    alCambiarRed: () => {
      if (botonAgregar) botonAgregar.disabled = !datos.hayRed();
    },
  };
}
