// Ayudas para las pruebas de los scripts administrativos, que usan Admin SDK
// contra el emulador. Nunca tocan un proyecto real: `comprobarDestino` lo
// impide, y estas pruebas solo corren dentro de `firebase emulators:exec`.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFIG_APP_INICIAL, rutas } from '../../docs/js/config-publica.js';
import { recorrer } from '../../scripts/comun/biblioteca.mjs';

export const PROYECTO = 'demo-biblioteca';
export const DUENO = 'dueno@example.com';

export const ENTORNO_EMULADOR = {
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
};

/** Abre Admin SDK contra el emulador. */
export async function abrirAdmin() {
  process.env.FIRESTORE_EMULATOR_HOST = ENTORNO_EMULADOR.FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = ENTORNO_EMULADOR.FIREBASE_AUTH_EMULATOR_HOST;
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ projectId: PROYECTO });
  return { db: getFirestore(), FieldValue, Timestamp, proyecto: PROYECTO };
}

/** Borra todo lo que cuelga de la biblioteca. */
export async function vaciar(db) {
  for (;;) {
    const documentos = await recorrer(db);
    if (documentos.length === 0) return;
    const escritura = db.batch();
    for (const { ruta } of documentos.slice(0, 400)) escritura.delete(db.doc(ruta));
    await escritura.commit();
  }
}

/** Deja la base como `scripts/inicializar.mjs`: configuración y un dueño. */
export async function inicializarBase(db, FieldValue, { bloqueo = null } = {}) {
  const comunes = { creadoEn: FieldValue.serverTimestamp(), creadoPor: DUENO };
  await db.doc(rutas.configApp()).set({ ...CONFIG_APP_INICIAL, inicioJuego: '2026-5', ...comunes });
  await db.doc(rutas.configContadores()).set({
    ultimoPrestamo: 0,
    ultimoLector: 0,
    ultimoPrestamoId: null,
    ultimoLectorId: null,
    ...comunes,
  });
  await db.doc(rutas.configControl()).set({ bloqueo, ...comunes });
  await db.doc(rutas.voluntario(DUENO)).set({
    nombre: 'Eduardo',
    rol: 'admin',
    activo: true,
    ultimaConexion: null,
    sincronizacionId: null,
    ...comunes,
  });
}

/** Un libro y un lector con su clave, para tener negocio que respaldar. */
export async function sembrarNegocio(db, FieldValue) {
  const comunes = { creadoEn: FieldValue.serverTimestamp(), creadoPor: 'carga-inicial' };
  await db.doc(rutas.libro('INF006')).set({
    codigo: 'INF006',
    titulo: 'El Dios pródigo',
    autor: 'Tim Keller',
    categoria: 'Vida Cristiana',
    baja: false,
    prestamoAbierto: null,
    vecesPrestado: 0,
    ...comunes,
  });
  await db.doc(rutas.lector('L001')).set({
    nombre: 'Rafaela Toledo',
    clave: 'rafaela toledo',
    telefono: '56900000012',
    avisoDatos: null,
    fusionadoEn: null,
    esDestinoFusion: false,
    ...comunes,
  });
  await db.doc(rutas.lectorClave('rafaela toledo')).set({ lector: 'L001', ...comunes });
  await db.doc(rutas.configContadores()).set({ ultimoLector: 1, ultimoLectorId: 'L001' }, { merge: true });
}

/** Carpeta temporal propia de una prueba, con su limpieza. */
export async function carpetaTemporal(nombre = 'biblioteca-prueba-') {
  const carpeta = await mkdtemp(join(tmpdir(), nombre));
  return { carpeta, limpiar: () => rm(carpeta, { recursive: true, force: true }) };
}

/**
 * Envuelve la base para que el enésimo lote de escritura falle, y así poder
 * probar un corte a mitad de un trabajo (C-41). Todo lo demás pasa de largo.
 */
export function baseQueCortaEnElLote(db, cual) {
  let cuantos = 0;
  return new Proxy(db, {
    get(objetivo, propiedad) {
      if (propiedad === 'batch') {
        return () => {
          cuantos += 1;
          const lote = objetivo.batch();
          if (cuantos !== cual) return lote;
          return {
            set: (...argumentos) => lote.set(...argumentos),
            delete: (...argumentos) => lote.delete(...argumentos),
            commit: async () => {
              throw new Error('corte simulado a mitad del trabajo');
            },
          };
        };
      }
      const valor = objetivo[propiedad];
      return typeof valor === 'function' ? valor.bind(objetivo) : valor;
    },
  });
}
