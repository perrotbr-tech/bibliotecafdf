// Exclusión temporal para los trabajos del dueño (contrato §6).
//
// Un bloqueo de mantenimiento NO expira solo: su `hasta` es nulo y se libera
// explícitamente al verificar que el trabajo terminó. Eso es deliberado: si un
// respaldo o una restauración se cortan a la mitad, la base tiene que seguir
// cerrada hasta que el dueño mire el manifiesto y decida.
//
// El token se comprueba ANTES de cada bloque de escritura. Si otra persona o
// otro trabajo tomó el control, el script se detiene en vez de seguir
// escribiendo sobre una base que ya no es suya.
import { randomUUID } from 'node:crypto';

import { rutas } from '../../docs/js/config-publica.js';

export const TIPO = 'mantenimiento';

export function nuevoToken() {
  return randomUUID().replace(/-/gu, '');
}

/**
 * Toma el bloqueo de mantenimiento. Falla si ya hay un bloqueo vigente —de
 * mantenimiento o de cierre—, sin tocar nada.
 */
export async function tomar(db, FieldValue, { por, token = nuevoToken(), crearSiFalta = false }) {
  const referencia = db.doc(rutas.configControl());
  await db.runTransaction(async (transaccion) => {
    const actual = await transaccion.get(referencia);
    if (!actual.exists) {
      // Una restauración sobre una base vacía todavía no tiene control, y su
      // primer acto es crearlo CON el candado puesto: así la base no pasa ni
      // un instante escribible y vacía. Para cualquier otro trabajo, la falta
      // del control es denegación (contrato §6).
      if (!crearSiFalta) {
        throw new Error(
          `No existe ${rutas.configControl()}. Sin documento de control no se escribe (contrato §6): ` +
            'corre `scripts/inicializar.mjs` primero.',
        );
      }
      transaccion.set(referencia, {
        bloqueo: { tipo: TIPO, token, por, iniciadoEn: FieldValue.serverTimestamp(), hasta: null, temporada: null },
        creadoEn: FieldValue.serverTimestamp(),
        creadoPor: por,
      });
      return;
    }
    const bloqueo = actual.data().bloqueo ?? null;
    if (bloqueo !== null) {
      const hasta = bloqueo?.hasta?.toDate?.() ?? null;
      const vencido = hasta !== null && hasta.getTime() < Date.now();
      if (!vencido) {
        throw new Error(
          `Ya hay un bloqueo de tipo «${bloqueo?.tipo ?? '(sin tipo)'}» puesto por ${bloqueo?.por ?? '(nadie)'}` +
            `${hasta ? ` hasta ${hasta.toISOString()}` : ' sin vencimiento'}. No se toca nada.`,
        );
      }
    }
    transaccion.update(referencia, {
      bloqueo: {
        tipo: TIPO,
        token,
        por,
        iniciadoEn: FieldValue.serverTimestamp(),
        hasta: null,
        temporada: null,
      },
    });
  });
  return token;
}

/** Comprueba que el bloqueo sigue siendo el nuestro. Lanza si no lo es. */
export async function comprobar(db, token) {
  const actual = await db.doc(rutas.configControl()).get();
  const bloqueo = actual.exists ? (actual.data().bloqueo ?? null) : null;
  if (bloqueo === null) throw new Error('Se perdió el bloqueo de mantenimiento: ya no hay ninguno.');
  if (bloqueo.tipo !== TIPO) throw new Error(`El bloqueo ahora es de tipo «${bloqueo.tipo}», no de mantenimiento.`);
  if (bloqueo.token !== token) throw new Error('El bloqueo de mantenimiento es de otro trabajo. Se detiene.');
  return bloqueo;
}

/**
 * Toma el bloqueo, o reusa el que este mismo trabajo dejó puesto al
 * interrumpirse. Reanudar con un token nuevo sería imposible: el bloqueo
 * anterior sigue vigente a propósito, porque la base quedó incompleta.
 *
 * Si el bloqueo ya no existe —alguien lo liberó a mano— se toma uno nuevo. Si
 * existe y es de otro, `tomar` se detiene, que es lo que corresponde.
 */
export async function tomarOReusar(db, FieldValue, { por, token, crearSiFalta = false }) {
  if (token) {
    try {
      await comprobar(db, token);
      return token;
    } catch {
      // No es nuestro o ya no está: se intenta tomar uno.
    }
  }
  return tomar(db, FieldValue, { por, token: token ?? nuevoToken(), crearSiFalta });
}

/** Libera el bloqueo, solo si sigue siendo el nuestro. */
export async function liberar(db, token) {
  const referencia = db.doc(rutas.configControl());
  await db.runTransaction(async (transaccion) => {
    const actual = await transaccion.get(referencia);
    const bloqueo = actual.exists ? (actual.data().bloqueo ?? null) : null;
    if (bloqueo === null) return;
    if (bloqueo.token !== token) {
      throw new Error('No se libera un bloqueo ajeno: el token no coincide.');
    }
    transaccion.update(referencia, { bloqueo: null });
  });
}

/**
 * Corre una tarea con el bloqueo tomado. Si la tarea falla, el bloqueo QUEDA
 * PUESTO a propósito: un trabajo parcial debe seguir cerrado hasta que el dueño
 * revise el manifiesto (contrato §6). El mensaje de error lo dice.
 */
export async function conMantenimiento(db, FieldValue, { por, token }, tarea) {
  const puesto = await tomar(db, FieldValue, { por, token });
  let resultado;
  try {
    resultado = await tarea(puesto);
  } catch (error) {
    error.bloqueoPuesto = puesto;
    error.mensajeDeBloqueo =
      `El trabajo falló y el mantenimiento QUEDA PUESTO (token ${puesto}). ` +
      'Revisa el manifiesto, repón o reanuda, y libéralo con --liberar cuando la base esté íntegra.';
    throw error;
  }
  await liberar(db, puesto);
  return resultado;
}
