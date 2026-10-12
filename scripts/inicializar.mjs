// Prepara una base vacía: config/app, config/contadores, config/control y el
// primer administrador. Si un documento ya existe, NO lo toca y lo informa.
//
// Admin SDK no pasa por las reglas del cliente. Por eso este script comprueba
// contra qué proyecto está apuntando antes de escribir:
//   - Un proyecto `demo-*` exige los dos hosts de emulador (AGENTS.md).
//   - Un proyecto real exige la bandera explícita del dueño. El agente nunca la
//     usa: el despliegue y la inicialización remota las hace el dueño con sus
//     credenciales locales, según PASOS-DEL-DUENO.md.
//
// Uso:
//   node scripts/inicializar.mjs --correo tu@correo.cl --nombre "Tu Nombre"
//   node scripts/inicializar.mjs --correo … --nombre … --proyecto biblioteca-real --confirmo-proyecto-real

import { parseArgs } from 'node:util';

import { CONFIG_APP_INICIAL, rutas } from '../docs/js/config-publica.js';
import { diaEnChile, temporadaDe } from '../docs/js/fechas.js';
import { esCorreoValido, esNombreValido, normalizarCorreo, normalizarNombre, nuevoId } from '../docs/js/texto.js';

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
          'Arranca los emuladores o usa `npm run inicializar` dentro de `firebase emulators:exec`.',
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

/**
 * Escribe los cuatro documentos que faltan. Devuelve el informe de lo que creó
 * y de lo que encontró.
 */
export async function inicializar({ db, FieldValue, correo, nombre, ahora = new Date() }) {
  const correoLimpio = normalizarCorreo(correo);
  const nombreLimpio = normalizarNombre(nombre);
  if (!esCorreoValido(correoLimpio)) throw new Error(`Correo con forma inválida: ${correo}`);
  if (!esNombreValido(nombreLimpio)) throw new Error('El nombre debe tener de 1 a 60 caracteres.');

  const marca = FieldValue.serverTimestamp();
  const comunes = { creadoEn: marca, creadoPor: correoLimpio };
  const temporada = temporadaDe(diaEnChile(ahora));

  const documentos = [
    {
      ruta: rutas.configApp(),
      datos: { ...CONFIG_APP_INICIAL, inicioJuego: temporada, ...comunes, creacionId: nuevoId() },
    },
    {
      ruta: rutas.configContadores(),
      datos: {
        ultimoPrestamo: 0,
        ultimoLector: 0,
        ultimoPrestamoId: null,
        ultimoLectorId: null,
        ...comunes,
        creacionId: nuevoId(),
      },
    },
    {
      ruta: rutas.configControl(),
      datos: { bloqueo: null, ...comunes, creacionId: nuevoId() },
    },
    {
      ruta: rutas.voluntario(correoLimpio),
      datos: {
        nombre: nombreLimpio,
        rol: 'admin',
        activo: true,
        ultimaConexion: null,
        sincronizacionId: null,
        ...comunes,
        creacionId: nuevoId(),
      },
    },
  ];

  const creados = [];
  const yaExistian = [];
  for (const { ruta, datos } of documentos) {
    const referencia = db.doc(ruta);
    // Una transacción por documento: así una base a medio inicializar se puede
    // completar volviendo a correr el script.
    const creado = await db.runTransaction(async (transaccion) => {
      const actual = await transaccion.get(referencia);
      if (actual.exists) return false;
      transaccion.set(referencia, datos);
      return true;
    });
    (creado ? creados : yaExistian).push(ruta);
  }

  return { creados, yaExistian, temporada, correo: correoLimpio, nombre: nombreLimpio };
}

async function principal() {
  const { values } = parseArgs({
    options: {
      correo: { type: 'string' },
      nombre: { type: 'string' },
      proyecto: { type: 'string', default: PROYECTO_DEMO },
      'confirmo-proyecto-real': { type: 'boolean', default: false },
    },
  });

  if (!values.correo || !values.nombre) {
    process.stderr.write(
      'Faltan datos del primer administrador.\n' +
        'Uso: node scripts/inicializar.mjs --correo tu@correo.cl --nombre "Tu Nombre"\n',
    );
    process.exit(2);
  }

  const { proyecto, destino } = comprobarDestino({
    proyecto: values.proyecto,
    confirmaProyectoReal: values['confirmo-proyecto-real'],
  });

  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ projectId: proyecto });
  const db = getFirestore();

  process.stdout.write(`inicializar: proyecto ${proyecto} (${destino})\n`);
  const informe = await inicializar({ db, FieldValue, correo: values.correo, nombre: values.nombre });

  for (const ruta of informe.creados) process.stdout.write(`  creado    ${ruta}\n`);
  for (const ruta of informe.yaExistian) process.stdout.write(`  ya existía ${ruta} (no se tocó)\n`);
  process.stdout.write(
    `inicializar: ${informe.creados.length} creado(s), ${informe.yaExistian.length} intacto(s). ` +
      `inicioJuego = ${informe.temporada}\n`,
  );
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await principal();
}
