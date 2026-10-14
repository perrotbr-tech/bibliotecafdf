// Pantalla Mensajes: editar plantillas (solo administrador).

import { sustituirPlantilla } from '../mensajes.js';
import { guardarPlantillas } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { errorDeFormulario } from '../ui/campos.js';
import { el } from '../ui/dom.js';

export function pantallaMensajes({ datos, mensajeAtraso = '', mensajePrevio = '' }) {
  let atraso = mensajeAtraso;
  let previo = mensajePrevio;

  const areaAtraso = el('textarea', {
    clase: 'campo__control',
    rows: '4',
    'data-prueba': 'mensaje-atraso',
  });
  areaAtraso.value = atraso;
  const areaPrevio = el('textarea', {
    clase: 'campo__control',
    rows: '4',
    'data-prueba': 'mensaje-previo',
  });
  areaPrevio.value = previo;

  const previaAtraso = el('p', { clase: 'lista__detalle', 'data-prueba': 'previa-atraso' });
  const previaPrevio = el('p', { clase: 'lista__detalle', 'data-prueba': 'previa-previo' });
  const fallo = errorDeFormulario('error-mensajes');

  function refrescarPrevias() {
    const ejemplo = {
      nombre: 'Ana',
      titulo: 'Radical',
      fecha: 'sábado 24 de octubre',
    };
    atraso = areaAtraso.value;
    previo = areaPrevio.value;
    previaAtraso.textContent = sustituirPlantilla(atraso, ejemplo);
    previaPrevio.textContent = sustituirPlantilla(previo, ejemplo);
  }

  areaAtraso.addEventListener('input', refrescarPrevias);
  areaPrevio.addEventListener('input', refrescarPrevias);
  refrescarPrevias();

  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'button',
    texto: 'Guardar',
    'data-prueba': 'guardar-mensajes',
  });
  prepararBotonGuardar(boton, async () => {
    fallo.limpiar();
    try {
      const resultado = await guardarPlantillas({
        datos,
        mensajeAtraso: areaAtraso.value,
        mensajePrevio: areaPrevio.value,
        operacionId: nuevoId(),
        alTardar: (t) => avisar(t, 'atencion', { id: 'mensajes' }),
      });
      if (resultado.esExito) avisar('Mensajes guardados', 'exito', { id: 'mensajes', duracionMs: 4000 });
      else avisar(resultado.mensaje, 'error', { id: 'mensajes' });
      return resultado;
    } catch (error) {
      fallo.mostrar(error.message);
      return null;
    }
  }, { deshabilitadoAlTerminar: () => !datos.hayRed() });

  const raiz = el('div', { 'data-prueba': 'mensajes' }, [
    el('p', { clase: 'titulo-seccion', texto: 'Mensajes' }),
    el('div', { clase: 'campo' }, [
      el('label', { clase: 'campo__etiqueta', texto: 'Mensaje de atraso' }),
      areaAtraso,
      previaAtraso,
    ]),
    el('div', { clase: 'campo' }, [
      el('label', { clase: 'campo__etiqueta', texto: 'Mensaje previo' }),
      areaPrevio,
      previaPrevio,
    ]),
    fallo.nodo,
    boton,
  ]);

  return { nodo: raiz, desmontar: () => {} };
}
