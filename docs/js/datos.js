// Lecturas, escuchas, transacciones y conteo de lecturas.
//
// Aquí vive la FORMA DE GUARDAR, una sola vez para toda la app (base §6):
// toda escritura va en `runTransaction` con `maxAttempts` 5, el éxito se avisa
// solo cuando la transacción termina bien, y un error de red se resuelve
// consultando al servidor por la identidad exacta de la operación, nunca por la
// mera existencia del documento.
//
// El SDK se inyecta en lugar de importarse arriba. Así la lógica de decisión de
// este módulo se puede probar en Node sin cargar el SDK desde la red, y la app
// sigue usando los módulos oficiales desde www.gstatic.com.

import { nuevoId } from './texto.js';

export const MAX_INTENTOS_TRANSACCION = 5;
export const MS_PARA_AVISAR_DEMORA = 5000;

/** Códigos de Firestore que significan «no se sabe si quedó guardado». */
const CODIGOS_INCIERTOS = new Set([
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'cancelled',
  'internal',
  'unknown',
  'resource-exhausted',
]);

export const MENSAJES = {
  exito: 'Listo',
  sinConexion: 'Sin conexión: no se puede guardar',
  demora: 'Confirmando… no cierres la app',
  noConfirmado: 'No se pudo confirmar el guardado',
  exitoPropio: 'Sí quedó guardado',
  ausenciaComprobada: 'No se guardó. Inténtalo de nuevo',
  conflictoDeOtro: 'Ese registro ya existe, creado por otra operación. Revisa su estado antes de repetir',
  noAtribuible: 'El registro cambió. Revisa su estado antes de repetir',
  indeterminado: 'No se pudo comprobar el estado. Revisa su estado antes de repetir',
  denegado: 'Tu cuenta no tiene permiso para esta acción',
};

/**
 * Decide qué pasó con una escritura cuyo resultado quedó incierto, a partir de
 * lo que dijo el SERVIDOR (contrato §3). Función pura.
 *
 * @param {object} entrada
 * @param {'alta'|'cambio'} entrada.tipo
 * @param {'ok'|'denegada'|'sin-conexion'|'agotada'} entrada.estadoLectura
 * @param {{existe:boolean, creacionId?:string|null, ultimaOperacionId?:string|null, aplicado?:boolean}|null} entrada.lectura
 * @param {string} entrada.operacionId
 * @returns {{resultado:string, mensaje:string, esExito:boolean}}
 */
export function clasificarResultado({ tipo, estadoLectura, lectura, operacionId }) {
  const responder = (resultado, mensaje, esExito = false) => ({ resultado, mensaje, esExito });

  // Una lectura denegada, agotada o sin conexión NO demuestra que no se guardó.
  if (estadoLectura !== 'ok') return responder('indeterminado', MENSAJES.indeterminado);

  if (tipo === 'alta') {
    if (!lectura?.existe) return responder('ausencia-comprobada', MENSAJES.ausenciaComprobada);
    if (lectura.creacionId && lectura.creacionId === operacionId) {
      return responder('exito-propio', MENSAJES.exitoPropio, true);
    }
    // La clave está ocupada por otra operación: conflicto, no éxito propio.
    return responder('conflicto-de-otro', MENSAJES.conflictoDeOtro);
  }

  if (tipo === 'cambio') {
    if (!lectura?.existe) return responder('no-atribuible', MENSAJES.noAtribuible);
    if (lectura.ultimaOperacionId === operacionId) {
      return lectura.aplicado
        ? responder('exito-propio', MENSAJES.exitoPropio, true)
        : responder('no-atribuible', MENSAJES.noAtribuible);
    }
    // El cambio no lleva nuestra marca. Si el documento sigue sin aplicar lo
    // que pedimos y nadie escribió después, se comprobó que no se guardó.
    if (lectura.aplicado === false && !lectura.ultimaOperacionId) {
      return responder('ausencia-comprobada', MENSAJES.ausenciaComprobada);
    }
    return responder('no-atribuible', MENSAJES.noAtribuible);
  }

  throw new TypeError(`Tipo de operación desconocido: ${tipo}`);
}

/**
 * Conflicto que descubre la propia transacción al leer: el correo ya está en
 * la lista, el libro ya está prestado. No es un fallo técnico: lleva un
 * mensaje concreto para la persona y no se reintenta solo.
 */
export class ErrorDeNegocio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
    this.esDeNegocio = true;
  }
}

/** ¿El error de una transacción deja el resultado en duda? */
export function esResultadoIncierto(error) {
  const codigo = error?.code ?? '';
  if (CODIGOS_INCIERTOS.has(codigo)) return true;
  if (codigo.startsWith('firestore/')) return CODIGOS_INCIERTOS.has(codigo.slice('firestore/'.length));
  // Un fallo de red del navegador llega sin código de Firestore.
  return codigo === '' && /network|fetch|conexión|connection/iu.test(String(error?.message ?? ''));
}

/**
 * Telemetría del cliente. NO es una factura (contrato §8): cada cosa se cuenta
 * por separado y una escucha no vuelve a sumar todos sus documentos en cada
 * evento.
 */
export function crearContadores() {
  const c = {
    documentosDelServidor: 0,
    eventosDeCache: 0,
    cambiosDeMetadatos: 0,
    documentosModificadosPorEscucha: 0,
    lecturasDeTransaccion: 0,
    reintentosDeTransaccion: 0,
    consultasVacias: 0,
    reconexiones: 0,
    lecturasDeReglasEstimadas: 0,
  };
  return {
    valores: () => ({ ...c }),
    reiniciar: () => {
      for (const clave of Object.keys(c)) c[clave] = 0;
    },
    sumar: (clave, cuanto = 1) => {
      c[clave] += cuanto;
    },
  };
}

/**
 * Crea la capa de datos sobre un SDK ya inicializado.
 *
 * @param {object} entrada
 * @param {object} entrada.db  Firestore ya inicializado
 * @param {object} entrada.sdk  { runTransaction, doc, getDoc, getDocFromServer, collection, onSnapshot, serverTimestamp, deleteField }
 * @param {{onLine:boolean}} [entrada.red]  `navigator`, solo como señal adicional
 */
export function crearDatos({ db, sdk, red = globalThis.navigator, contadores = crearContadores() }) {
  const escuchas = new Set();

  function hayRed() {
    // `navigator.onLine` es una señal adicional, no prueba de conexión.
    return red?.onLine !== false;
  }

  /** Lectura puntual contra el SERVIDOR, nunca contra la caché. */
  async function leerDelServidor(ruta) {
    try {
      const instantanea = await sdk.getDocFromServer(sdk.doc(db, ruta));
      contadores.sumar('documentosDelServidor');
      contadores.sumar('lecturasDeReglasEstimadas');
      return { estado: 'ok', existe: instantanea.exists(), datos: instantanea.data() ?? null };
    } catch (error) {
      const codigo = error?.code ?? '';
      if (codigo.includes('permission-denied')) return { estado: 'denegada', existe: false, datos: null };
      if (codigo.includes('deadline-exceeded')) return { estado: 'agotada', existe: false, datos: null };
      return { estado: 'sin-conexion', existe: false, datos: null };
    }
  }

  /**
   * Escucha un documento. Cuenta por separado los eventos de caché, los cambios
   * de metadatos y los documentos entregados por el servidor.
   */
  function escucharDocumento(ruta, alCambiar, alFallar) {
    const soltar = sdk.onSnapshot(
      sdk.doc(db, ruta),
      { includeMetadataChanges: true },
      (instantanea) => {
        if (instantanea.metadata.fromCache) {
          contadores.sumar('eventosDeCache');
        } else if (instantanea.metadata.hasPendingWrites) {
          contadores.sumar('cambiosDeMetadatos');
        } else {
          contadores.sumar('documentosDelServidor');
        }
        alCambiar(instantanea.exists() ? instantanea.data() : null, instantanea.metadata);
      },
      (error) => alFallar?.(error),
    );
    escuchas.add(soltar);
    return () => {
      escuchas.delete(soltar);
      soltar();
    };
  }

  /** Escucha una colección. Solo suma los documentos que CAMBIARON. */
  function escucharColeccion(ruta, alCambiar, alFallar) {
    const soltar = sdk.onSnapshot(
      sdk.collection(db, ruta),
      { includeMetadataChanges: true },
      (instantanea) => {
        if (instantanea.metadata.fromCache) contadores.sumar('eventosDeCache');
        const cambios = instantanea.docChanges();
        if (!instantanea.metadata.fromCache) {
          contadores.sumar('documentosModificadosPorEscucha', cambios.length);
          if (cambios.length === 0) contadores.sumar('cambiosDeMetadatos');
        }
        if (instantanea.empty) contadores.sumar('consultasVacias');
        alCambiar(instantanea.docs.map((d) => ({ id: d.id, ...d.data() })), instantanea.metadata);
      },
      (error) => alFallar?.(error),
    );
    escuchas.add(soltar);
    return () => {
      escuchas.delete(soltar);
      soltar();
    };
  }

  /** Cancela TODAS las escuchas. Se usa al cerrar sesión o al perder el acceso. */
  function cancelarEscuchas() {
    for (const soltar of escuchas) soltar();
    escuchas.clear();
  }

  /**
   * Ejecuta una escritura con la forma de guardar completa.
   *
   * @param {object} entrada
   * @param {'alta'|'cambio'} entrada.tipo
   * @param {string} [entrada.operacionId]  Estable desde el primer toque.
   * @param {(transaccion:object, ayudas:object)=>Promise<any>} entrada.cuerpo
   *   Callback de la transacción. No toca la interfaz ni emite mensajes: puede
   *   repetirse. Todas sus lecturas van antes de sus escrituras.
   * @param {()=>Promise<{estado:string, lectura:object|null}>} [entrada.comprobar]
   *   Comprobación contra el servidor para un resultado incierto.
   * @param {(mensaje:string)=>void} [entrada.alTardar]
   */
  async function guardar({ tipo, operacionId = nuevoId(), cuerpo, comprobar, alTardar }) {
    if (!hayRed()) {
      return { estado: 'sin-conexion', mensaje: MENSAJES.sinConexion, operacionId, esExito: false };
    }

    let avisoDemora = null;
    if (alTardar) avisoDemora = setTimeout(() => alTardar(MENSAJES.demora), MS_PARA_AVISAR_DEMORA);

    try {
      const valor = await sdk.runTransaction(
        db,
        async (transaccion) => {
          contadores.sumar('reintentosDeTransaccion');
          return await cuerpo(transaccion, {
            leer: async (ruta) => {
              const instantanea = await transaccion.get(sdk.doc(db, ruta));
              contadores.sumar('lecturasDeTransaccion');
              return instantanea;
            },
            ref: (ruta) => sdk.doc(db, ruta),
            ahoraDelServidor: () => sdk.serverTimestamp(),
            operacionId,
          });
        },
        { maxAttempts: MAX_INTENTOS_TRANSACCION },
      );
      // El primer intento no es un reintento.
      contadores.sumar('reintentosDeTransaccion', -1);
      return { estado: 'exito', mensaje: MENSAJES.exito, operacionId, valor, esExito: true };
    } catch (error) {
      // Un conflicto que vio la propia transacción: mensaje concreto, sin
      // éxito y sin reintento automático (base §6.6).
      if (error?.esDeNegocio) {
        return { estado: 'conflicto', mensaje: error.message, operacionId, esExito: false, error };
      }
      if (error?.code?.includes('permission-denied')) {
        return { estado: 'denegado', mensaje: MENSAJES.denegado, operacionId, esExito: false, error };
      }
      if (!esResultadoIncierto(error)) {
        return { estado: 'error', mensaje: MENSAJES.noConfirmado, operacionId, esExito: false, error };
      }
      if (!comprobar) {
        return { estado: 'indeterminado', mensaje: MENSAJES.indeterminado, operacionId, esExito: false, error };
      }
      const { estado: estadoLectura, lectura } = await comprobar();
      const clasificado = clasificarResultado({ tipo, estadoLectura, lectura, operacionId });
      return { estado: clasificado.resultado, mensaje: clasificado.mensaje, esExito: clasificado.esExito, operacionId, error };
    } finally {
      if (avisoDemora) clearTimeout(avisoDemora);
    }
  }

  return {
    contadores,
    leerDelServidor,
    escucharDocumento,
    escucharColeccion,
    cancelarEscuchas,
    guardar,
    hayRed,
  };
}

// ---------------------------------------------------------------------------
// Memoria de la intención, para sobrevivir a una recarga (contrato §3).
// Se guarda SOLO el identificador de operación, el tipo, la ruta y los
// identificadores necesarios. Nunca nombres, teléfonos, tokens ni una cola de
// escrituras.
// ---------------------------------------------------------------------------

export const CLAVE_INTENCION = 'biblioteca.intencion';

export function recordarIntencion(intencion, memoria = globalThis.sessionStorage) {
  const permitidas = ['operacionId', 'tipo', 'ruta', 'identificadores'];
  const limpia = {};
  for (const clave of permitidas) if (intencion[clave] !== undefined) limpia[clave] = intencion[clave];
  try {
    memoria?.setItem(CLAVE_INTENCION, JSON.stringify(limpia));
  } catch {
    // Sin almacenamiento, la recuperación tras recargar no está disponible.
  }
}

export function intencionPendiente(memoria = globalThis.sessionStorage) {
  try {
    const guardada = memoria?.getItem(CLAVE_INTENCION);
    return guardada ? JSON.parse(guardada) : null;
  } catch {
    return null;
  }
}

export function olvidarIntencion(memoria = globalThis.sessionStorage) {
  try {
    memoria?.removeItem(CLAVE_INTENCION);
  } catch {
    // Nada que olvidar.
  }
}
