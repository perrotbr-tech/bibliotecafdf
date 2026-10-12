// Siembra de la base demo para las pruebas de extremo a extremo y de carga.
// Usa Admin SDK contra el emulador: no pasa por las reglas, así que prepara el
// estado inicial sin depender de la app.
import { CONFIG_APP_INICIAL, rutas } from '../../docs/js/config-publica.js';

export const PROYECTO = 'demo-biblioteca';
export const ADMIN = 'admin@example.com';
export const VOLUNTARIA = 'ana@example.com';
export const AJENA = 'nadie@example.com';

let db = null;
let FieldValue = null;

export async function baseDemo() {
  if (db) return { db, FieldValue };
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const firestore = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ projectId: PROYECTO });
  db = firestore.getFirestore();
  FieldValue = firestore.FieldValue;
  return { db, FieldValue };
}

/**
 * Borra las cuentas del emulador de Authentication.
 *
 * Hace falta entre pruebas: el emulador de Auth NO se limpia solo, así que una
 * prueba que entra con el correo sin verificar deja esa cuenta guardada así, y
 * la siguiente que usa el mismo correo hereda `emailVerified: false`.
 */
export async function limpiarCuentas() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  await fetch(`http://${host}/emulator/v1/projects/${PROYECTO}/accounts`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
}

export async function limpiarBase() {
  const { db: base } = await baseDemo();
  for (const ruta of [rutas.configApp(), rutas.configContadores(), rutas.configControl()]) {
    await base.doc(ruta).delete();
  }
  const voluntarios = await base.collection(rutas.voluntarios()).get();
  await Promise.all(voluntarios.docs.map((d) => d.ref.delete()));
}

/**
 * Deja la base como después de `inicializar.mjs`, más la gente que pida la
 * prueba.
 * @param {{voluntarios?: Array<{correo:string,nombre:string,rol?:string,activo?:boolean}>, bloqueo?:object|null}} opciones
 */
export async function sembrarBaseDemo({ voluntarios = [], bloqueo = null } = {}) {
  const { db: base, FieldValue: campos } = await baseDemo();
  await limpiarBase();
  await limpiarCuentas();

  const comunes = { creadoEn: campos.serverTimestamp(), creadoPor: 'prueba' };
  await base.doc(rutas.configApp()).set({ ...CONFIG_APP_INICIAL, inicioJuego: '2026-5', ...comunes });
  await base.doc(rutas.configContadores()).set({
    ultimoPrestamo: 0,
    ultimoLector: 0,
    ultimoPrestamoId: null,
    ultimoLectorId: null,
    ...comunes,
  });
  await base.doc(rutas.configControl()).set({ bloqueo, ...comunes });

  const gente = [
    { correo: ADMIN, nombre: 'Eduardo', rol: 'admin', activo: true },
    { correo: VOLUNTARIA, nombre: 'Ana', rol: 'voluntario', activo: true },
    ...voluntarios,
  ];
  for (const persona of gente) await ponerVoluntario(persona);
}

export async function ponerVoluntario({ correo, nombre, rol = 'voluntario', activo = true, creacionId = null }) {
  const { db: base, FieldValue: campos } = await baseDemo();
  await base.doc(rutas.voluntario(correo)).set({
    nombre,
    rol,
    activo,
    ultimaConexion: null,
    sincronizacionId: null,
    creadoEn: campos.serverTimestamp(),
    creadoPor: 'prueba',
    creacionId: creacionId ?? 'e'.repeat(32),
  });
}

export async function leerVoluntario(correo) {
  const { db: base } = await baseDemo();
  const documento = await base.doc(rutas.voluntario(correo)).get();
  return documento.exists ? documento.data() : null;
}

export async function contarVoluntarios() {
  const { db: base } = await baseDemo();
  return (await base.collection(rutas.voluntarios()).get()).size;
}

export async function cambiarActivo(correo, activo) {
  const { db: base } = await baseDemo();
  await base.doc(rutas.voluntario(correo)).update({ activo });
}
