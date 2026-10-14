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
  for (const coleccion of [
    rutas.voluntarios(),
    rutas.libros(),
    rutas.lectores(),
    rutas.lectoresClave(),
    rutas.prestamos(),
    rutas.calendario(),
  ]) {
    const documentos = await base.collection(coleccion).get();
    await Promise.all(documentos.docs.map((uno) => uno.ref.delete()));
  }
}

/**
 * Deja la base como después de `inicializar.mjs`, más la gente que pida la
 * prueba.
 * @param {{voluntarios?: Array<{correo:string,nombre:string,rol?:string,activo?:boolean}>, bloqueo?:object|null}} opciones
 */
export async function sembrarBaseDemo({ voluntarios = [], libros = [], lectores = [], bloqueo = null } = {}) {
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
  for (const libro of libros) await ponerLibro(libro);
  for (const lector of lectores) await ponerLector(lector);
}

/** Un libro ya en el catálogo, puesto sin pasar por la app. */
export async function ponerLibro({
  codigo,
  titulo = `Libro ${codigo}`,
  autor = 'Alguien',
  categoria = 'Infantil',
  baja = false,
  prestamoAbierto = null,
  vecesPrestado = 0,
}) {
  const { db: base, FieldValue: campos } = await baseDemo();
  await base.doc(rutas.libro(codigo)).set({
    codigo,
    titulo,
    autor,
    categoria,
    baja,
    prestamoAbierto,
    vecesPrestado,
    creadoEn: campos.serverTimestamp(),
    creadoPor: 'prueba',
    creacionId: 'a'.repeat(32),
  });
}

/** Un lector con su documento de clave y el contador al día. */
export async function ponerLector({ id, nombre, clave = null, telefono = null }) {
  const { db: base, FieldValue: campos } = await baseDemo();
  const { claveDeNombre } = await import('../../docs/js/texto.js');
  const laClave = clave ?? claveDeNombre(nombre);
  const comunes = { creadoEn: campos.serverTimestamp(), creadoPor: 'prueba', creacionId: 'b'.repeat(32) };
  await base.doc(rutas.lector(id)).set({
    nombre,
    clave: laClave,
    telefono,
    avisoDatos: null,
    fusionadoEn: null,
    esDestinoFusion: false,
    ...comunes,
  });
  await base.doc(rutas.lectorClave(laClave)).set({ lector: id, ...comunes });
  const numero = Number(String(id).slice(1));
  const contadores = await base.doc(rutas.configContadores()).get();
  if ((contadores.data()?.ultimoLector ?? 0) < numero) {
    await base.doc(rutas.configContadores()).update({ ultimoLector: numero, ultimoLectorId: id });
  }
}

export async function leerLibro(codigo) {
  const { db: base } = await baseDemo();
  const documento = await base.doc(rutas.libro(codigo)).get();
  return documento.exists ? documento.data() : null;
}

export async function leerLector(id) {
  const { db: base } = await baseDemo();
  const documento = await base.doc(rutas.lector(id)).get();
  return documento.exists ? documento.data() : null;
}

export async function leerClave(clave) {
  const { db: base } = await baseDemo();
  const documento = await base.doc(rutas.lectorClave(clave)).get();
  return documento.exists ? documento.data() : null;
}

export async function leerContadores() {
  const { db: base } = await baseDemo();
  return (await base.doc(rutas.configContadores()).get()).data() ?? null;
}

export async function listarLectores() {
  const { db: base } = await baseDemo();
  const documentos = await base.collection(rutas.lectores()).get();
  return documentos.docs.map((uno) => ({ id: uno.id, ...uno.data() }));
}

export async function contarLibros() {
  const { db: base } = await baseDemo();
  return (await base.collection(rutas.libros()).count().get()).data().count;
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

/**
 * Siembra masiva para las pruebas de carga: libros y lectores generados.
 *
 * Usa `BulkWriter` porque son once mil documentos: con lotes de 500 tardaría
 * minutos. Los nombres son sintéticos y numerados a propósito: en este
 * repositorio no hay nombres de lectores reales (AGENTS.md).
 */
export async function sembrarVolumen({ libros = 0, lectores = 0 } = {}) {
  const { db: base, FieldValue: campos } = await baseDemo();
  const { claveDeNombre } = await import('../../docs/js/texto.js');
  const escritor = base.bulkWriter();
  const marca = campos.serverTimestamp();
  const comunes = { creadoEn: marca, creadoPor: 'carga-inicial', creacionId: 'c'.repeat(32) };

  const categorias = CONFIG_APP_INICIAL.categorias;
  for (let i = 1; i <= libros; i += 1) {
    const categoria = categorias[i % categorias.length];
    const codigo = `${categoria.prefijo}${String(i).padStart(4, '0')}`;
    void escritor.set(base.doc(rutas.libro(codigo)), {
      codigo,
      titulo: `Título número ${i} de la biblioteca`,
      autor: `Autor ${i % 300}`,
      categoria: categoria.nombre,
      baja: i % 97 === 0,
      prestamoAbierto: i % 11 === 0 ? `prestamo-${i}` : null,
      vecesPrestado: i % 7,
      ...comunes,
    });
  }

  for (let i = 1; i <= lectores; i += 1) {
    const id = `L${String(i).padStart(4, '0')}`;
    const nombre = `Lectora Numero ${i}`;
    const clave = claveDeNombre(nombre);
    void escritor.set(base.doc(rutas.lector(id)), {
      nombre,
      clave,
      telefono: i % 3 === 0 ? null : `569${String(10000000 + i).slice(0, 8)}`,
      avisoDatos: null,
      fusionadoEn: null,
      esDestinoFusion: false,
      ...comunes,
    });
    void escritor.set(base.doc(rutas.lectorClave(clave)), { lector: id, ...comunes });
  }

  await escritor.close();
  if (lectores > 0) {
    await base.doc(rutas.configContadores()).update({
      ultimoLector: lectores,
      ultimoLectorId: `L${String(lectores).padStart(4, '0')}`,
    });
  }
  return { libros, lectores };
}

/** Cambia las categorías de `config/app`, como lo haría otro teléfono. */
export async function cambiarCategorias(categorias) {
  const { db: base } = await baseDemo();
  await base.doc(rutas.configApp()).update({ categorias });
}

/**
 * Calendario sintético cuya ventana incluye `ahora` (contrato §2). Solo demo.
 * Si `salidaDia` es sábado usa vencimientos canónicos; si no, inventa cuatro.
 */
export async function sembrarCalendarioSintetico(salidaDia, { ahora = new Date() } = {}) {
  const { db: base, FieldValue: _fv } = await baseDemo();
  const { Timestamp } = await import('firebase-admin/firestore');
  const { documentoDeCalendario, esSabado, temporadaDe, venceElDe } = await import('../../docs/js/fechas.js');
  const inicio = new Date(ahora.getTime() - 12 * 60 * 60 * 1000);
  const finExclusivo = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
  let vencimientos;
  let temporada;
  if (esSabado(salidaDia)) {
    const doc = documentoDeCalendario(salidaDia);
    vencimientos = doc.vencimientos;
    temporada = doc.temporada;
  } else {
    temporada = temporadaDe(salidaDia);
    vencimientos = [1, 2, 3, 4].map((k) => {
      try {
        return venceElDe(salidaDia, k);
      } catch {
        return new Date(ahora.getTime() + k * 7 * 86_400_000);
      }
    });
  }
  await base.doc(rutas.diaCalendario(salidaDia)).set({
    inicio: Timestamp.fromDate(inicio),
    finExclusivo: Timestamp.fromDate(finExclusivo),
    temporada,
    vencimientos: vencimientos.map((v) => Timestamp.fromDate(v instanceof Date ? v : new Date(v))),
    sintetico: true,
  });
}

export async function ponerPrestamo(id, campos = {}) {
  const { db: base, FieldValue: camposFv } = await baseDemo();
  const ahora = new Date();
  await base.doc(rutas.prestamo(id)).set({
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
    creadoEn: camposFv.serverTimestamp(),
    creadoPor: VOLUNTARIA,
    creacionId: 'p'.repeat(32),
    origen: 'app',
    ...campos,
  });
}
