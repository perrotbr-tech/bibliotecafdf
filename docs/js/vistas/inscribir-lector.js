// Inscribir un lector. Lo puede hacer cualquier voluntario.
//
// La casilla del aviso de datos es obligatoria: sin ella no se puede guardar
// (C-18), y las reglas tampoco lo permitirían, porque el documento tiene que
// llegar con `avisoDatos` completo y con la hora del servidor.

import { ErrorDeNegocio } from '../datos.js';
import { inscribirLector } from '../operaciones.js';
import { MENSAJE_NOMBRE_CORTO, normalizarTelefono, nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { campoCasilla, campoTexto, errorDeFormulario } from '../ui/campos.js';
import { el } from '../ui/dom.js';

const AVISO = 'lector';

export const TEXTO_DEL_AVISO =
  'Le avisé que su nombre y su teléfono se usan solo para los préstamos de la biblioteca';

export function formularioDeInscripcion({ datos, permiso, alGuardar }) {
  const nombre = campoTexto({
    id: 'lector-nombre',
    etiqueta: 'Nombre',
    ayuda: 'Como lo conocen en la biblioteca. Un apodo sirve.',
    maxlength: 60,
  });
  const telefono = campoTexto({
    id: 'lector-telefono',
    etiqueta: 'Teléfono (opcional)',
    tipo: 'tel',
    inputmode: 'tel',
    ayuda: 'Un celular chileno: 9 1234 5678.',
  });
  const aviso = campoCasilla({ id: 'lector-aviso', etiqueta: TEXTO_DEL_AVISO });
  const fallo = errorDeFormulario('error-lector');

  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'submit',
    texto: 'Inscribir lector',
    'data-prueba': 'guardar-lector',
  });

  const nodo = el('form', { clase: 'formulario', 'data-prueba': 'formulario-lector', novalidate: true }, [
    nombre.nodo,
    telefono.nodo,
    aviso.nodo,
    fallo.nodo,
    boton,
  ]);
  nodo.addEventListener('submit', (evento) => evento.preventDefault());

  let operacionId = null;
  for (const entrada of [nombre.control, telefono.control, aviso.control]) {
    entrada.addEventListener('input', () => {
      operacionId = null;
      fallo.limpiar();
      nombre.limpiarError();
      telefono.limpiarError();
      aviso.limpiarError();
    });
  }

  prepararBotonGuardar(
    boton,
    async () => {
      fallo.limpiar();
      // La casilla se comprueba antes de estrenar una intención: no marcarla
      // no es un intento de guardar.
      if (!aviso.marcada) {
        aviso.mostrarError('Marca la casilla: el lector tiene que saberlo');
        return null;
      }
      // El teléfono se revisa aquí para que el error salga JUNTO al campo, no
      // al pie del formulario. La operación lo vuelve a comprobar igual.
      const revisado = normalizarTelefono(telefono.control.value);
      if (!revisado.ok) {
        telefono.mostrarError(revisado.motivo);
        return null;
      }
      operacionId ??= nuevoId();
      try {
        const resultado = await inscribirLector({
          datos,
          permiso,
          nombre: nombre.control.value,
          telefono: telefono.control.value,
          avisoDado: true,
          operacionId,
          alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
        });

        if (resultado.esExito) {
          operacionId = null;
          const inscrito = resultado.valor ?? {};
          avisar(`${inscrito.nombre ?? 'El lector'} quedó inscrito como ${inscrito.id ?? ''}`.trim(), 'exito', {
            id: AVISO,
            duracionMs: 4000,
          });
          alGuardar?.(resultado);
        } else {
          // Lo escrito se conserva: nadie tiene que volver a tipearlo.
          fallo.mostrar(resultado.mensaje);
        }
        return resultado;
      } catch (error) {
        if (error instanceof ErrorDeNegocio) {
          operacionId = null;
          if (error.message === MENSAJE_NOMBRE_CORTO) nombre.mostrarError(error.message);
          else fallo.mostrar(error.message);
          return null;
        }
        throw error;
      }
    },
    { deshabilitadoAlTerminar: () => !datos.hayRed() },
  );

  if (!datos.hayRed()) boton.disabled = true;

  return {
    nodo,
    reflejarRed: () => {
      boton.disabled = !datos.hayRed();
    },
  };
}
