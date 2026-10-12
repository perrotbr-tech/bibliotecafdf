// A qué base escribe un script administrativo, y cómo se abre.
//
// Admin SDK no pasa por las reglas del cliente: lo que esta comprobación
// protege es que un script del repositorio no pueda tocar un proyecto real por
// descuido. Un proyecto `demo-*` exige los DOS hosts de emulador (AGENTS.md);
// un proyecto real exige la bandera explícita del dueño, que el agente no usa.
//
// Vivía en `inicializar.mjs`, que sigue reexportándolo. La Etapa 2 lo movió
// aquí porque la carga, el respaldo y la restauración necesitan lo mismo.

export const PROYECTO_DEMO = 'demo-biblioteca';

/**
 * Comprueba a qué proyecto se va a escribir. Devuelve el proyecto o lanza con
 * la razón por la que no se puede seguir.
 */
export function comprobarDestino({ proyecto, confirmaProyectoReal, entorno = process.env }) {
  const esDemo = proyecto.startsWith('demo-');
  if (esDemo) {
    const faltan = [];
    if (!entorno.FIRESTORE_EMULATOR_HOST) faltan.push('FIRESTORE_EMULATOR_HOST');
    if (!entorno.FIREBASE_AUTH_EMULATOR_HOST) faltan.push('FIREBASE_AUTH_EMULATOR_HOST');
    if (faltan.length > 0) {
      throw new Error(
        `El proyecto ${proyecto} es de emulador, pero falta ${faltan.join(' y ')}. ` +
          'Arranca los emuladores o usa el script dentro de `firebase emulators:exec`.',
      );
    }
    return { proyecto, destino: 'emulador' };
  }
  if (!confirmaProyectoReal) {
    throw new Error(
      `${proyecto} no es un proyecto de emulador. Si de verdad quieres escribir ahí, ` +
        'agrega --confirmo-proyecto-real. El agente no usa esta bandera.',
    );
  }
  if (entorno.FIRESTORE_EMULATOR_HOST || entorno.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'Hay variables de emulador definidas y se pidió un proyecto real. ' +
        'Quítalas para no escribir en el lugar equivocado.',
    );
  }
  return { proyecto, destino: 'real' };
}

/** Abre la base con Admin SDK después de comprobar el destino. */
export async function abrirBase({ proyecto = PROYECTO_DEMO, confirmaProyectoReal = false } = {}) {
  const comprobado = comprobarDestino({ proyecto, confirmaProyectoReal });
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ projectId: proyecto });
  return { db: getFirestore(), FieldValue, Timestamp, ...comprobado };
}
