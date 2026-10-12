// Inicialización de Firebase.
//
// El SDK se carga desde www.gstatic.com con versión fija, en módulos ES: los
// módulos oficiales se importan entre sí desde esa dirección, así que copiarlos
// al repositorio obligaría a reescribirlos (base §3).
//
// La importación es dinámica, dentro de `arrancar()`, no arriba del archivo.
// Así el resto de los módulos se puede cargar en Node para las pruebas de
// unidad sin pedir nada por la red, y la app sigue sin paso de compilación.

import { VERSION_SDK } from './config-publica.js';

export const EMULADOR = { puertoFirestore: 8080, puertoAuth: 9099 };

let cargado = null;

/** Carga los tres módulos del SDK. Se hace una sola vez por sesión. */
async function cargarSdk() {
  if (cargado) return cargado;
  const base = `https://www.gstatic.com/firebasejs/${VERSION_SDK}`;
  const [app, auth, firestore] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  cargado = { app, auth, firestore };
  return cargado;
}

/**
 * Arranca Firebase para el ambiente elegido. Si el ambiente está bloqueado por
 * falta de configuración, no se llama a esta función: la app muestra el aviso
 * y no inicia ninguna conexión (contrato §1).
 *
 * @param {object} eleccion  resultado de `elegirAmbiente`
 * @param {string} host      `location.hostname`, para hablarle al emulador
 */
export async function arrancar(eleccion, { host = globalThis.location?.hostname ?? '127.0.0.1' } = {}) {
  if (eleccion.bloqueado) throw new Error(eleccion.motivoBloqueo);

  const sdk = await cargarSdk();
  const app = sdk.app.initializeApp(eleccion.configuracion);

  const auth = sdk.auth.initializeAuth(app, {
    persistence: sdk.auth.browserLocalPersistence,
    popupRedirectResolver: sdk.auth.browserPopupRedirectResolver,
  });

  // Sin persistencia en disco: los datos de lectores y préstamos no quedan
  // guardados en el teléfono (contrato §8).
  const db = sdk.firestore.initializeFirestore(app, {
    localCache: sdk.firestore.memoryLocalCache(),
  });

  if (eleccion.ambiente === 'emulador') {
    sdk.auth.connectAuthEmulator(auth, `http://${host}:${EMULADOR.puertoAuth}`, { disableWarnings: true });
    sdk.firestore.connectFirestoreEmulator(db, host, EMULADOR.puertoFirestore);
  }

  return {
    app,
    auth,
    db,
    // Las piezas que usa `datos.js`. Van en un objeto para que esa capa se
    // pueda probar sin el SDK real.
    piezas: {
      doc: sdk.firestore.doc,
      collection: sdk.firestore.collection,
      getDoc: sdk.firestore.getDoc,
      getDocFromServer: sdk.firestore.getDocFromServer,
      onSnapshot: sdk.firestore.onSnapshot,
      runTransaction: sdk.firestore.runTransaction,
      serverTimestamp: sdk.firestore.serverTimestamp,
    },
    sdkAuth: sdk.auth,
  };
}
