// Ayudas para las pruebas de reglas. Siempre contra el emulador y el proyecto
// demo-biblioteca: ninguna prueba toca un proyecto real.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { BIB, CONFIG_APP_INICIAL, idDeLector } from '../../docs/js/config-publica.js';

export const PROYECTO = 'demo-biblioteca';
export const RAIZ = join(import.meta.dirname, '..', '..');

export const RUTAS = {
  app: `bibliotecas/${BIB}/config/app`,
  contadores: `bibliotecas/${BIB}/config/contadores`,
  control: `bibliotecas/${BIB}/config/control`,
  voluntario: (correo) => `bibliotecas/${BIB}/voluntarios/${correo}`,
  libro: (codigo) => `bibliotecas/${BIB}/libros/${codigo}`,
  lector: (id) => `bibliotecas/${BIB}/lectores/${id}`,
  clave: (clave) => `bibliotecas/${BIB}/lectoresClave/${clave}`,
  prestamo: (id) => `bibliotecas/${BIB}/prestamos/${id}`,
  calendario: (dia) => `bibliotecas/${BIB}/calendario/${dia}`,
};

export const ADMIN = 'admin@example.com';
export const VOLUNTARIA = 'ana@example.com';
export const INACTIVO = 'inactivo@example.com';
export const AJENA = 'nadie@example.com';

export const ID = (letra) => String(letra).repeat(32).slice(0, 32);

/**
 * Entorno de pruebas con las reglas del repositorio.
 *
 * `limpiar` vacía Firestore al abrirlo, que es lo que quieren las pruebas de
 * reglas. Las pruebas de los scripts lo abren con `limpiar: false`: ahí la base
 * ya está sembrada con Admin SDK y borrarla sería borrar la prueba.
 */
export async function abrirEntorno({ limpiar = true } = {}) {
  const entorno = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(join(RAIZ, 'firestore.rules'), 'utf8'),
    },
  });
  if (limpiar) await entorno.clearFirestore();
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

/**
 * El lote de un alta de lector: los tres documentos que escribe la operación
 * —el lector, su clave y el contador— en una sola escritura atómica.
 *
 * Las pruebas de reglas usan `writeBatch` donde la app usa `runTransaction`:
 * para las reglas ambas son una sola petición con los mismos `getAfter` y el
 * mismo presupuesto de 20 accesos. La diferencia —leer antes de escribir— es
 * del cliente, y se prueba en las pruebas E2E y de concurrencia.
 *
 * Cada parámetro permite romper UNA pieza del enlace para comprobar que la
 * regla la exige de verdad.
 */
export function loteDeAlta(
  db,
  correo,
  {
    numero = 1,
    nombre = 'Rafaela Toledo',
    clave = 'rafaela toledo',
    telefono = null,
    id = idDeLector(numero),
    claveDelLector = clave,
    documentoDeClave = clave,
    lectorEnClave = id,
    numeroEnContador = numero,
    idEnContador = id,
    conClave = true,
    conContador = true,
    avisoDatos,
    lector,
  } = {},
) {
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.lector(id)), {
    nombre,
    clave: claveDelLector,
    telefono,
    avisoDatos: avisoDatos === undefined ? { fecha: serverTimestamp(), por: correo } : avisoDatos,
    fusionadoEn: null,
    esDestinoFusion: false,
    creadoEn: serverTimestamp(),
    creadoPor: correo,
    creacionId: ID('a'),
    ...lector,
  });
  if (conClave) {
    lote.set(doc(db, RUTAS.clave(documentoDeClave)), {
      lector: lectorEnClave,
      creadoEn: serverTimestamp(),
      creadoPor: correo,
      creacionId: ID('b'),
    });
  }
  if (conContador) {
    lote.update(doc(db, RUTAS.contadores), {
      ultimoLector: numeroEnContador,
      ultimoLectorId: idEnContador,
    });
  }
  return lote;
}

/** Un libro ya en la base, puesto sin pasar por reglas. */
export async function sembrarLibro(entorno, codigo, campos = {}) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto
      .firestore()
      .doc(RUTAS.libro(codigo))
      .set({
        codigo,
        titulo: 'El Dios pródigo',
        autor: 'Tim Keller',
        categoria: 'Vida Cristiana',
        baja: false,
        prestamoAbierto: null,
        vecesPrestado: 0,
        creadoEn: new Date('2026-10-10T18:00:00Z'),
        creadoPor: 'carga-inicial',
        ...campos,
      });
  });
}

/** Un lector ya en la base con su documento de clave, sin pasar por reglas. */
export async function sembrarLector(entorno, id, { nombre = 'Rafaela Toledo', clave = 'rafaela toledo', telefono = null, numero } = {}) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    const ahora = new Date('2026-10-10T18:00:00Z');
    await db.doc(RUTAS.lector(id)).set({
      nombre,
      clave,
      telefono,
      avisoDatos: null,
      fusionadoEn: null,
      esDestinoFusion: false,
      creadoEn: ahora,
      creadoPor: 'carga-inicial',
    });
    await db.doc(RUTAS.clave(clave)).set({ lector: id, creadoEn: ahora, creadoPor: 'carga-inicial' });
    if (numero !== undefined) {
      await db.doc(RUTAS.contadores).update({ ultimoLector: numero, ultimoLectorId: id });
    }
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

/**
 * Documento de calendario. Por defecto abre una ventana amplia alrededor de
 * «ahora» del emulador para que las pruebas de reglas puedan prestar sin
 * depender del día civil (contrato §2: calendario sintético solo en demo).
 */
export async function sembrarCalendario(
  entorno,
  salidaDia,
  {
    inicio = new Date(Date.now() - 12 * 60 * 60 * 1000),
    finExclusivo = new Date(Date.now() + 12 * 60 * 60 * 1000),
    temporada = null,
    vencimientos = null,
  } = {},
) {
  const { documentoDeCalendario, temporadaDe } = await import('../../docs/js/fechas.js');
  let datos;
  try {
    datos = documentoDeCalendario(salidaDia);
  } catch {
    datos = {
      temporada: temporadaDe(salidaDia),
      vencimientos: [1, 2, 3, 4].map(() => new Date(Date.now() + 7 * 86_400_000)),
    };
  }
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.calendario(salidaDia)).set({
      inicio,
      finExclusivo,
      temporada: temporada ?? datos.temporada,
      vencimientos: (vencimientos ?? datos.vencimientos).map((v) =>
        v?.toDate ? v : v instanceof Date ? v : new Date(v),
      ),
    });
  });
}

/** Préstamo ya existente, sembrado sin pasar por reglas. */
export async function sembrarPrestamo(entorno, id, campos = {}) {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const ahora = new Date();
    await contexto.firestore().doc(RUTAS.prestamo(id)).set({
      numero: 1,
      libro: 'INF001',
      lector: 'L001',
      prestadoEn: ahora,
      salidaDia: '2026-10-10',
      plazoSabados: 2,
      registroDiferido: false,
      motivoRegistroDiferido: null,
      venceEl: new Date(ahora.getTime() + 14 * 86_400_000),
      temporada: '2026-5',
      estado: 'abierto',
      devueltoEn: null,
      devueltoATiempo: null,
      correccionATiempo: null,
      devueltoPor: null,
      anuladoEn: null,
      anuladoPor: null,
      recordadoEn: null,
      recordadoPor: null,
      creadoEn: ahora,
      creadoPor: VOLUNTARIA,
      creacionId: ID('p'),
      origen: 'app',
      ...campos,
    });
  });
}
