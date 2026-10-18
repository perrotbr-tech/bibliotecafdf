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

export async function listarPrestamos() {
  const { db: base } = await baseDemo();
  const documentos = await base.collection(rutas.prestamos()).get();
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
 * Código del libro número `i` de la siembra masiva. Lo usan `sembrarVolumen` y
 * `sembrarPrestamos`: los préstamos tienen que apuntar a libros que existen, o
 * las listas mostrarían «(no encontrado)» y la medición no sería la real.
 */
export function codigoDeVolumen(i) {
  const categorias = CONFIG_APP_INICIAL.categorias;
  const categoria = categorias[i % categorias.length];
  return `${categoria.prefijo}${String(i).padStart(4, '0')}`;
}

/** Identificador de 32 cifras hexadecimales, el formato que exigen las reglas. */
export function idDeVolumen(numero, inicial = '0') {
  return `${inicial}${String(numero).padStart(31, '0')}`;
}

/**
 * Siembra masiva para las pruebas de carga: libros y lectores generados.
 *
 * Usa `BulkWriter` porque son once mil documentos: con lotes de 500 tardaría
 * minutos. Los nombres son sintéticos y numerados a propósito: en este
 * repositorio no hay nombres de lectores reales (AGENTS.md).
 */
export async function sembrarVolumen({ libros = 0, lectores = 0, prestamosFalsos = true } = {}) {
  const { db: base, FieldValue: campos } = await baseDemo();
  const { claveDeNombre } = await import('../../docs/js/texto.js');
  const escritor = base.bulkWriter();
  const marca = campos.serverTimestamp();
  const comunes = { creadoEn: marca, creadoPor: 'carga-inicial', creacionId: 'c'.repeat(32) };

  const categorias = CONFIG_APP_INICIAL.categorias;
  for (let i = 1; i <= libros; i += 1) {
    const categoria = categorias[i % categorias.length];
    const codigo = codigoDeVolumen(i);
    void escritor.set(base.doc(rutas.libro(codigo)), {
      codigo,
      titulo: `Título número ${i} de la biblioteca`,
      autor: `Autor ${i % 300}`,
      categoria: categoria.nombre,
      baja: i % 97 === 0,
      // Marca de «prestado» sin préstamo detrás: a las pruebas de catálogo les
      // basta para filtrar y contar. Las de préstamos la apagan, porque un
      // libro marcado sin su documento es un estado que no puede existir y
      // haría fallar un préstamo real sobre ese libro.
      prestamoAbierto: prestamosFalsos && i % 11 === 0 ? `prestamo-${i}` : null,
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

/**
 * Borra los préstamos con `BulkWriter`.
 *
 * `limpiarBase` borra documento por documento, que con veinte mil préstamos
 * tardaría minutos. Se llama ANTES de `sembrarBaseDemo` para que esa limpieza
 * encuentre la colección vacía.
 */
/**
 * Ritmo sostenible para el emulador. Sin frenarlo, `BulkWriter` acelera hasta
 * donde le dejan y el emulador empieza a devolver `DEADLINE_EXCEEDED` a los
 * sesenta segundos: veinte mil escrituras no entran a su velocidad máxima.
 */
function escritorFrenado(base) {
  return base.bulkWriter({ throttling: { initialOpsPerSecond: 100, maxOpsPerSecond: 300 } });
}

export async function limpiarPrestamos() {
  const { db: base } = await baseDemo();
  // Por lotes y a ritmo frenado: borrar veinte mil documentos de una tanda
  // agota el plazo del emulador.
  await base.recursiveDelete(base.collection(rutas.prestamos()), escritorFrenado(base));
}

/**
 * Siembra masiva de préstamos para las pruebas de carga de specs/03 y specs/04.
 *
 * Los abiertos apuntan a libros que existen y dejan el libro con
 * `prestamoAbierto`, porque es ese enlace el que la pantalla sigue y el que las
 * reglas comprueban al devolver. Los atrasados son un subconjunto de los
 * abiertos: su vencimiento queda en el pasado respecto de `ahora`, que es la
 * hora simulada con la que la prueba abre la app.
 *
 * Los devueltos no tocan el libro: existen para probar justo lo contrario, que
 * abrir la app NO los lee (specs/03 §Carga).
 */
export async function sembrarPrestamos({
  abiertos = 0,
  devueltos = 0,
  atrasados = 0,
  libros = 0,
  lectores = 0,
  ahora = new Date(),
} = {}) {
  const { db: base, FieldValue: campos } = await baseDemo();
  const { Timestamp } = await import('firebase-admin/firestore');
  const { diaDesplazado, diaEnChile, finDelDiaEnChile, sabadoDeJornada, sabadoSiguiente, temporadaDe } = await import(
    '../../docs/js/fechas.js'
  );
  const escritor = escritorFrenado(base);
  const hoy = diaEnChile(ahora);
  const sabadoDeHoy = sabadoDeJornada(hoy);
  const sabadoProximo = sabadoSiguiente(hoy);
  const comunes = { creadoEn: campos.serverTimestamp(), creadoPor: VOLUNTARIA, origen: 'app' };

  /** Libros sin baja: un libro de baja no puede tener un préstamo abierto. */
  const disponibles = [];
  for (let i = 1; i <= libros && disponibles.length < abiertos; i += 1) {
    if (i % 97 !== 0) disponibles.push(i);
  }
  const lectorDe = (n) => `L${String(lectores === 0 ? 1 : ((n - 1) % lectores) + 1).padStart(4, '0')}`;

  let numero = 0;
  let ultimoId = null;
  let vencenHoy = 0;
  let vencenElProximo = 0;

  for (const [indice, iLibro] of disponibles.entries()) {
    numero += 1;
    const id = idDeVolumen(numero);
    const codigo = codigoDeVolumen(iLibro);
    const atrasado = indice < atrasados;
    // Los que no están atrasados se reparten: la mitad vence el sábado de esta
    // jornada —lo que Inicio cuenta como «Vuelven hoy»— y la mitad el
    // siguiente, que es la lista «Vencen el sábado» de specs/04.
    let diaVence;
    if (atrasado) {
      diaVence = diaDesplazado(hoy, -7 - (indice % 21));
    } else if (indice % 2 === 0) {
      diaVence = sabadoDeHoy;
      vencenHoy += 1;
    } else {
      diaVence = sabadoProximo;
      vencenElProximo += 1;
    }
    const salidaDia = diaDesplazado(diaVence, -14);
    void escritor.set(base.doc(rutas.prestamo(id)), {
      numero,
      libro: codigo,
      lector: lectorDe(numero),
      prestadoEn: Timestamp.fromDate(new Date(finDelDiaEnChile(salidaDia).getTime() - 9 * 3_600_000)),
      salidaDia,
      plazoSabados: 2,
      registroDiferido: false,
      motivoRegistroDiferido: null,
      venceEl: Timestamp.fromDate(finDelDiaEnChile(diaVence)),
      temporada: temporadaDe(salidaDia),
      estado: 'abierto',
      devueltoEn: null,
      devueltoATiempo: null,
      correccionATiempo: null,
      devueltoPor: null,
      anuladoEn: null,
      anuladoPor: null,
      // La mitad de los atrasados ya fue recordada: así «Para recordar» ordena
      // de verdad por «sin recordatorio primero» (specs/04).
      recordadoEn: atrasado && indice % 2 === 1 ? Timestamp.fromDate(new Date(ahora.getTime() - 3 * 86_400_000)) : null,
      recordadoPor: atrasado && indice % 2 === 1 ? VOLUNTARIA : null,
      creacionId: id,
      ...comunes,
    });
    void escritor.update(base.doc(rutas.libro(codigo)), { prestamoAbierto: id });
    ultimoId = id;
    if (numero % 2000 === 0) await escritor.flush();
  }

  for (let n = 1; n <= devueltos; n += 1) {
    numero += 1;
    const id = idDeVolumen(numero, 'd');
    const codigo = codigoDeVolumen(libros === 0 ? 1 : ((n * 7) % libros) + 1);
    const salidaDia = diaDesplazado(hoy, -14 - 7 * (n % 52));
    const diaVence = diaDesplazado(salidaDia, 14);
    void escritor.set(base.doc(rutas.prestamo(id)), {
      numero,
      libro: codigo,
      lector: lectorDe(numero),
      prestadoEn: Timestamp.fromDate(new Date(finDelDiaEnChile(salidaDia).getTime() - 9 * 3_600_000)),
      salidaDia,
      plazoSabados: 2,
      registroDiferido: false,
      motivoRegistroDiferido: null,
      venceEl: Timestamp.fromDate(finDelDiaEnChile(diaVence)),
      temporada: temporadaDe(salidaDia),
      estado: 'devuelto',
      devueltoEn: Timestamp.fromDate(new Date(finDelDiaEnChile(diaVence).getTime() - 2 * 86_400_000)),
      devueltoATiempo: null,
      correccionATiempo: null,
      devueltoPor: VOLUNTARIA,
      anuladoEn: null,
      anuladoPor: null,
      recordadoEn: null,
      recordadoPor: null,
      creacionId: id,
      ...comunes,
    });
    ultimoId = id;
    // Veinte mil documentos de una tanda agotan el plazo del emulador: se
    // vacía el escritor cada mil.
    if (numero % 1000 === 0) await escritor.flush();
  }

  await escritor.close();
  if (numero > 0) {
    await base.doc(rutas.configContadores()).update({ ultimoPrestamo: numero, ultimoPrestamoId: ultimoId });
  }
  return {
    abiertos: disponibles.length,
    atrasados: Math.min(atrasados, disponibles.length),
    vencenHoy,
    vencenElProximo,
    devueltos,
    numero,
  };
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
