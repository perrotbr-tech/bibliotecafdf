// Ficha de un libro, en una hoja: código, categoría, autor, estado y veces
// prestado. Para el administrador, «Editar» y «Dar de baja», esta última con
// su propia confirmación.

import { TEXTO_DE_ESTADO, claseDeTejuelo, estadoDeLibro } from '../listas.js';
import { darDeBajaLibro } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { el } from '../ui/dom.js';
import { abrirHoja, cerrarHoja, datoDeFicha } from '../ui/hoja.js';

import { formularioDeLibro } from './libro-formulario.js';

const AVISO = 'libro';

/** Abre la ficha de un libro. */
export function abrirFichaDeLibro({ datos, permiso, categorias, libros, libro }) {
  const estado = estadoDeLibro(libro);
  const esAdmin = permiso.rol === 'admin';

  const acciones = [];
  if (esAdmin) {
    acciones.push(
      el('button', {
        clase: 'boton boton--secundario',
        type: 'button',
        texto: 'Editar',
        'data-prueba': 'editar-libro',
        al: {
          click: () => {
            abrirHoja({
              titulo: `Editar ${libro.codigo}`,
              prueba: 'hoja-libro-formulario',
              contenido: formularioDeLibro({
                datos,
                permiso,
                categorias,
                libros,
                libro,
                alGuardar: () => cerrarHoja(),
              }),
            });
          },
        },
      }),
      el('button', {
        clase: 'boton boton--peligro',
        type: 'button',
        texto: 'Dar de baja',
        'data-prueba': 'dar-de-baja',
        // Ya de baja no hay nada que dar de baja; para reactivarlo está
        // «Editar», que ahora trae la casilla.
        disabled: libro.baja === true,
        title: libro.baja === true ? 'Ya está de baja. Para reactivarlo, usa Editar' : '',
        al: {
          click: () =>
            abrirHoja({
              titulo: 'Dar de baja',
              prueba: 'hoja-dar-de-baja',
              contenido: confirmacionDeBaja({ datos, categorias, libro, alTerminar: () => cerrarHoja() }),
            }),
        },
      }),
    );
  }

  const contenido = el('div', { clase: 'ficha' }, [
    el('div', { clase: 'ficha__cabeza' }, [
      el('span', { clase: claseDeTejuelo(libro.categoria, categorias), texto: libro.codigo }),
      el('span', {
        clase: `etiqueta ${estado === 'disponible' ? 'etiqueta--disponible' : 'etiqueta--inactivo'}`,
        texto: TEXTO_DE_ESTADO[estado],
        'data-prueba': 'estado-libro',
      }),
    ]),
    el('h3', { clase: 'ficha__titulo', texto: libro.titulo ?? '', 'data-prueba': 'titulo-libro' }),
    datoDeFicha('Autor', libro.autor ? libro.autor : 'Sin autor anotado', { prueba: 'autor-libro' }),
    datoDeFicha('Categoría', libro.categoria ?? '', { prueba: 'categoria-libro' }),
    datoDeFicha('Veces prestado', String(libro.vecesPrestado ?? 0), { prueba: 'veces-prestado' }),
    acciones.length > 0 && el('div', { clase: 'ficha__acciones' }, acciones),
  ]);

  return abrirHoja({ titulo: libro.titulo ?? libro.codigo, prueba: 'hoja-libro', contenido });
}

function confirmacionDeBaja({ datos, categorias, libro, alTerminar }) {
  const boton = el('button', {
    clase: 'boton boton--peligro boton--ancho',
    type: 'button',
    texto: 'Sí, dar de baja',
    'data-prueba': 'confirmar-baja',
  });

  let operacionId = null;
  prepararBotonGuardar(
    boton,
    async () => {
      operacionId ??= nuevoId();
      const resultado = await darDeBajaLibro({
        datos,
        libro,
        categorias,
        operacionId,
        alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
      });
      if (resultado.esExito) {
        operacionId = null;
        avisar(`${libro.codigo} quedó de baja`, 'exito', { id: AVISO, duracionMs: 4000 });
        alTerminar?.();
      } else {
        avisar(resultado.mensaje, 'error', { id: AVISO });
      }
      return resultado;
    },
    { deshabilitadoAlTerminar: () => !datos.hayRed() },
  );

  return el('div', { clase: 'ficha' }, [
    el('p', {
      clase: 'lista__nombre',
      texto: `¿Dar de baja «${libro.titulo ?? libro.codigo}»?`,
    }),
    el('p', {
      clase: 'lista__detalle',
      texto:
        'Un libro de baja no se presta y no se borra: sigue en el catálogo con su historia. ' +
        'Se puede volver a activar editándolo.',
    }),
    boton,
  ]);
}
