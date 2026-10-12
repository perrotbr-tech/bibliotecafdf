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
 */
export const CONFIGURACIONES = {
  emulador: {
    projectId: 'demo-biblioteca',
    apiKey: 'demo-biblioteca-sin-llave-real',
    authDomain: 'demo-biblioteca.firebaseapp.com',
  },
  ensayo: null,
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
};

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
