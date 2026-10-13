// Configuración pública de la app. Todo lo de este archivo es público por
// diseño: el bloque web de Firebase no es un secreto. Aquí NUNCA va una llave
// de servicio ni una credencial administrativa.
//
// Mientras un ambiente esté en null, la app no intenta conectarse a él: muestra
// «Falta configurar este ambiente» (contrato §1). Eso permite trabajar en local
// contra el emulador sin cuentas reales.

/** Biblioteca de esta instalación. Ninguna ruta se escribe fija en el código. */
export const BIB = 'principal';

/** Versión fija del SDK de Firebase que carga la app desde www.gstatic.com. */
export const VERSION_SDK = '12.19.0';

/** Nombre que muestra la pantalla de entrada antes de leer la base. */
export const NOMBRE_ENTRADA = 'Biblioteca';

/**
 * Configuración por ambiente.
 *
 * - `emulador`: proyecto demo. No requiere credenciales reales y solo se
 *   selecciona desde loopback.
 * - `ensayo` y `produccion`: los entrega el dueño cuando crea los proyectos.
 *   Hasta entonces quedan en null a propósito.
 *
 * De cada bloque web solo se copian los tres campos que esta app usa:
 * `apiKey` y `authDomain` los necesita Authentication, y `projectId` Firestore.
 * Los demás campos del bloque que muestra la consola (`storageBucket`,
 * `messagingSenderId`, `appId`, `measurementId`) corresponden a servicios que
 * esta app no carga —Storage, Cloud Messaging, Analytics— y no se versionan.
 */
export const CONFIGURACIONES = {
  emulador: {
    projectId: 'demo-biblioteca',
    apiKey: 'demo-biblioteca-sin-llave-real',
    authDomain: 'demo-biblioteca.firebaseapp.com',
  },
  ensayo: {
    projectId: 'biblioteca-fdf-ensayo',
    apiKey: 'AIzaSyAIvCRLf77m7YEnEi7iLA33NdkoRis2GCc',
    authDomain: 'biblioteca-fdf-ensayo.firebaseapp.com',
  },
  produccion: null,
};

/**
 * Ambiente fijo de esta copia publicada. La publicación de ensayo que el dueño
 * prepara antes de fusionar pone aquí 'ensayo' y deja `produccion` en null
 * (contrato §1). En el repositorio principal se queda en null: el ambiente se
 * decide por host y parámetro.
 */
export const AMBIENTE_FIJO = null;

/** Rutas de la base. Salen de una constante, nunca escritas a mano. */
export const rutas = {
  biblioteca: () => `bibliotecas/${BIB}`,
  configApp: () => `bibliotecas/${BIB}/config/app`,
  configContadores: () => `bibliotecas/${BIB}/config/contadores`,
  configControl: () => `bibliotecas/${BIB}/config/control`,
  voluntarios: () => `bibliotecas/${BIB}/voluntarios`,
  voluntario: (correo) => `bibliotecas/${BIB}/voluntarios/${correo}`,
  libros: () => `bibliotecas/${BIB}/libros`,
  libro: (codigo) => `bibliotecas/${BIB}/libros/${codigo}`,
  lectores: () => `bibliotecas/${BIB}/lectores`,
  lector: (id) => `bibliotecas/${BIB}/lectores/${id}`,
  lectoresClave: () => `bibliotecas/${BIB}/lectoresClave`,
  lectorClave: (clave) => `bibliotecas/${BIB}/lectoresClave/${clave}`,
  // Los préstamos no tienen pantallas ni reglas de cliente hasta la Etapa 3.
  // La ruta existe desde la Etapa 2 porque la carga inicial los escribe con
  // Admin SDK, que no pasa por reglas.
  prestamos: () => `bibliotecas/${BIB}/prestamos`,
  prestamo: (id) => `bibliotecas/${BIB}/prestamos/${id}`,
  temporadas: () => `bibliotecas/${BIB}/temporadas`,
};

/**
 * Identificador de un lector: `L` más el correlativo con al menos tres cifras.
 * Lo construyen igual el cliente, las reglas y los scripts; si discrepan, el
 * enlace del contador no cierra y la transacción se deniega.
 */
export function idDeLector(numero) {
  return `L${String(numero).padStart(3, '0')}`;
}

/** Valores iniciales de `config/app`, según la Etapa 1. */
export const CONFIG_APP_INICIAL = {
  nombreBiblioteca: 'Biblioteca',
  plazoSabadosPorDefecto: 2,
  categorias: [
    { nombre: 'Infantil', prefijo: 'INF' },
    { nombre: 'Hombres y mujeres', prefijo: 'HM' },
    { nombre: 'Familia', prefijo: 'FAM' },
    { nombre: 'Vida Cristiana', prefijo: 'VC' },
    { nombre: 'Novelas', prefijo: 'NV' },
    { nombre: 'Teología', prefijo: 'TEO' },
  ],
  mensajeAtraso:
    'Hola {nombre}, te escribimos de la biblioteca. El libro «{titulo}» venció el {fecha}. ¿Puedes traerlo este sábado? ¡Gracias!',
  mensajePrevio:
    'Hola {nombre}, te recordamos que el libro «{titulo}» de la biblioteca vence este {fecha}. ¡Te esperamos!',
  juegoCerradoAlgunaVez: false,
};
