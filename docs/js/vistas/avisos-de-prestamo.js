// Los avisos de prestar y devolver, con lo que ofrecen durante diez segundos
// (specs/03 §Pantallas): «Deshacer» siempre, y al prestar además «Prestar otro
// a (nombre)», que abre Prestar con ese lector ya elegido.
//
// «Deshacer» no es un truco de interfaz: es la operación que corresponde
// —anular el préstamo recién hecho, reabrir la devolución recién hecha— y las
// reglas solo la permiten dentro de esos diez minutos y a quien la hizo
// (P-21, P-26). Si la ventana se pasó o la hizo otra persona, el servidor la
// deniega y el aviso lo dice: la pantalla no promete lo que la regla no da.

import { anularPrestamo, reabrirPrestamo } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';

/** Lo que dura el ofrecimiento, según el documento. */
export const DURACION_AVISO_MS = 10_000;

const AVISO_DESHACER = 'deshacer';

async function deshacer({ datos, permiso, prestamoId, operacion, exito }) {
  const resultado = await operacion({
    datos,
    permiso,
    prestamoId,
    operacionId: nuevoId(),
    alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO_DESHACER }),
  });
  avisar(resultado.esExito ? exito : resultado.mensaje, resultado.esExito ? 'exito' : 'error', {
    id: AVISO_DESHACER,
    duracionMs: resultado.esExito ? 4000 : undefined,
  });
}

/**
 * Aviso de un préstamo recién hecho. `alPrestarOtro` abre Prestar con el mismo
 * lector; si no se pasa, esa acción no se ofrece.
 */
export function avisarPrestado({ datos, permiso, texto, prestamoId, lector, alPrestarOtro }) {
  const nombre = lector?.nombre?.split(/\s+/u)[0] ?? '';
  const acciones = [
    {
      texto: 'Deshacer',
      prueba: 'deshacer-prestamo',
      al: () =>
        void deshacer({
          datos,
          permiso,
          prestamoId,
          operacion: anularPrestamo,
          exito: 'El préstamo quedó anulado',
        }),
    },
  ];
  if (alPrestarOtro && lector) {
    acciones.push({
      texto: `Prestar otro a ${nombre}`,
      prueba: 'prestar-otro',
      al: () => alPrestarOtro(lector),
    });
  }
  avisar(texto, 'exito', { id: 'prestar', duracionMs: DURACION_AVISO_MS, acciones });
}

/** Aviso de una devolución recién hecha, con «Deshacer» (reabrir). */
export function avisarDevuelto({ datos, permiso, titulo, prestamoId, id = 'devolver' }) {
  avisar(`Devuelto: ${titulo}`, 'exito', {
    id,
    duracionMs: DURACION_AVISO_MS,
    acciones: [
      {
        texto: 'Deshacer',
        prueba: 'deshacer-devolucion',
        al: () =>
          void deshacer({
            datos,
            permiso,
            prestamoId,
            operacion: reabrirPrestamo,
            exito: 'La devolución quedó deshecha',
          }),
      },
    ],
  });
}
