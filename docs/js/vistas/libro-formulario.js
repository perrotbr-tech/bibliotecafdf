// Agregar y editar un libro. El mismo formulario, porque los campos son los
// mismos; lo que cambia es si el código se puede escribir.
//
// Solo el administrador llega aquí: la pantalla no ofrece el botón, y si
// alguien lo forzara, las reglas lo deniegan igual (C-01).

import { ErrorDeNegocio } from '../datos.js';
import { codigosDeCategoria } from '../listas.js';
import { agregarLibro, editarLibro } from '../operaciones.js';
import { codigoSugerido, nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { campoSelect, campoTexto, errorDeFormulario } from '../ui/campos.js';
import { el } from '../ui/dom.js';

const AVISO = 'libro';

/**
 * @param {object} entrada
 * @param {object[]} entrada.libros   Para proponer el código siguiente.
 * @param {object|null} [entrada.libro]  Si viene, se edita; si no, se agrega.
 * @param {(resultado:object)=>void} entrada.alGuardar  Cierra la hoja.
 */
export function formularioDeLibro({ datos, permiso, categorias, libros, libro = null, alGuardar }) {
  const esEdicion = libro !== null;

  const categoria = campoSelect({
    id: 'libro-categoria',
    etiqueta: 'Categoría',
    opciones: categorias.map((una) => ({ valor: una.nombre, texto: una.nombre })),
    valor: libro?.categoria ?? categorias[0]?.nombre ?? '',
  });

  const codigo = campoTexto({
    id: 'libro-codigo',
    etiqueta: 'Código',
    valor: libro?.codigo ?? '',
    ayuda: esEdicion ? 'El código no se cambia: identifica al libro.' : 'Se guarda en mayúsculas y sin espacios.',
    autocomplete: 'off',
  });
  if (esEdicion) codigo.control.disabled = true;

  const titulo = campoTexto({ id: 'libro-titulo', etiqueta: 'Título', valor: libro?.titulo ?? '', maxlength: 120 });
  const autor = campoTexto({
    id: 'libro-autor',
    etiqueta: 'Autor',
    valor: libro?.autor ?? '',
    ayuda: 'Se puede dejar vacío.',
    maxlength: 80,
  });

  const fallo = errorDeFormulario('error-libro');

  // El código sugerido sale del mayor de la categoría más uno. Se recalcula al
  // cambiar de categoría, pero NO si la persona ya escribió uno a mano.
  let codigoTocado = esEdicion;
  codigo.control.addEventListener('input', () => {
    codigoTocado = true;
  });
  function sugerir() {
    if (codigoTocado) return;
    const prefijo = categorias.find((una) => una.nombre === categoria.control.value)?.prefijo ?? '';
    codigo.control.value = codigoSugerido(prefijo, codigosDeCategoria(libros, prefijo));
  }
  categoria.control.addEventListener('change', sugerir);
  sugerir();

  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'submit',
    texto: esEdicion ? 'Guardar cambios' : 'Agregar libro',
    'data-prueba': 'guardar-libro',
  });

  const nodo = el('form', { clase: 'formulario', 'data-prueba': 'formulario-libro', novalidate: true }, [
    categoria.nodo,
    codigo.nodo,
    titulo.nodo,
    autor.nodo,
    fallo.nodo,
    boton,
  ]);
  nodo.addEventListener('submit', (evento) => evento.preventDefault());

  // La intención vive mientras el formulario no cambie: un reintento con los
  // mismos datos conserva su identidad, y uno distinto estrena la suya.
  let operacionId = null;
  for (const entrada of [categoria.control, codigo.control, titulo.control, autor.control]) {
    entrada.addEventListener('input', () => {
      operacionId = null;
      fallo.limpiar();
    });
  }

  prepararBotonGuardar(
    boton,
    async () => {
      fallo.limpiar();
      operacionId ??= nuevoId();
      try {
        const comun = {
          datos,
          permiso,
          titulo: titulo.control.value,
          autor: autor.control.value,
          categoria: categoria.control.value,
          categorias,
          operacionId,
          alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
        };
        const resultado = esEdicion
          ? await editarLibro({ ...comun, libro, baja: libro.baja === true })
          : await agregarLibro({ ...comun, codigo: codigo.control.value });

        if (resultado.esExito) {
          operacionId = null;
          avisar(esEdicion ? 'Libro actualizado' : 'Libro agregado', 'exito', { id: AVISO, duracionMs: 4000 });
          alGuardar?.(resultado);
        } else {
          fallo.mostrar(resultado.mensaje);
        }
        return resultado;
      } catch (error) {
        // Lo que no pasó la validación del cliente: mensaje junto al botón, y
        // la intención se suelta porque los datos van a cambiar.
        if (error instanceof ErrorDeNegocio) {
          operacionId = null;
          fallo.mostrar(error.message);
          return null;
        }
        throw error;
      }
    },
    { deshabilitadoAlTerminar: () => !datos.hayRed() },
  );

  // Abierto sin conexión, el botón nace deshabilitado. Si la red se cae con el
  // formulario ya abierto, el botón sigue tocable y el intento responde «Sin
  // conexión: no se puede guardar», que dice más que un botón apagado sin
  // explicación.
  if (!datos.hayRed()) boton.disabled = true;

  return nodo;
}
