// Ayudas para las pruebas de reglas. Siempre contra el emulador y el proyecto
// demo-biblioteca: ninguna prueba toca un proyecto real.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

import { BIB, CONFIG_APP_INICIAL } from '../../docs/js/config-publica.js';

export const PROYECTO = 'demo-biblioteca';
export const RAIZ = join(import.meta.dirname, '..', '..');

export const RUTAS = {
  app: `bibliotecas/${BIB}/config/app`,
  contadores: `bibliotecas/${BIB}/config/contadores`,
  control: `bibliotecas/${BIB}/config/control`,
  voluntario: (correo) => `bibliotecas/${BIB}/voluntarios/${correo}`,
};

export const ADMIN = 'admin@example.com';
export const VOLUNTARIA = 'ana@example.com';
export const INACTIVO = 'inactivo@example.com';
export const AJENA = 'nadie@example.com';

export const ID = (letra) => String(letra).repeat(32).slice(0, 32);

/** Entorno de pruebas con las reglas del repositorio. */
export async function abrirEntorno() {
  const entorno = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(join(RAIZ, 'firestore.rules'), 'utf8'),
    },
  });
  await entorno.clearFirestore();
  return entorno;
}

/** Sesión de una cuenta de Google con el correo verificado. */
export function comoCuenta(entorno, correo, { verificado = true } = {}) {
  return entorno
    .authenticatedContext(correo.replace(/[^a-z0-9]/gu, ''), { email: correo, email_verified: verificado })
    .firestore();
}

export function sinSesion(entorno) {
  return entorno.unauthenticatedContext().firestore();
}

/**
 * Siembra la base como la deja `scripts/inicializar.mjs`: configuración,
 * contadores, control sin bloqueo, un administrador, una voluntaria activa y
 * un voluntario inactivo.
 */
export async function sembrarBase(entorno, { bloqueo = null } = {}) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    const ahora = new Date('2026-10-10T18:00:00Z');
    await db.doc(RUTAS.app).set({
      ...CONFIG_APP_INICIAL,
      inicioJuego: '2026-5',
      creadoEn: ahora,
      creadoPor: 'carga-inicial',
    });
    await db.doc(RUTAS.contadores).set({
      ultimoPrestamo: 0,
      ultimoLector: 0,
      ultimoPrestamoId: null,
      ultimoLectorId: null,
      creadoEn: ahora,
      creadoPor: 'carga-inicial',
    });
    await db.doc(RUTAS.control).set({ bloqueo, creadoEn: ahora, creadoPor: 'carga-inicial' });

    const base = { creadoEn: ahora, creadoPor: 'carga-inicial', creacionId: ID('f'), ultimaConexion: null, sincronizacionId: null };
    await db.doc(RUTAS.voluntario(ADMIN)).set({ nombre: 'Eduardo', rol: 'admin', activo: true, ...base });
    await db.doc(RUTAS.voluntario(VOLUNTARIA)).set({ nombre: 'Ana', rol: 'voluntario', activo: true, ...base });
    await db.doc(RUTAS.voluntario(INACTIVO)).set({ nombre: 'Luis', rol: 'voluntario', activo: false, ...base });
  });
}

/** Bloqueo de mantenimiento vigente, como lo deja un script del dueño. */
export function bloqueoMantenimiento() {
  return {
    tipo: 'mantenimiento',
    token: ID('a'),
    por: ADMIN,
    iniciadoEn: new Date('2026-10-10T18:00:00Z'),
    hasta: null,
    temporada: null,
  };
}
