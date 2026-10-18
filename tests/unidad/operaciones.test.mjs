// H-02: cómo clasifica `inscribirLector` una denegación del servidor.
//
// Qué se prueba y qué NO. Que las reglas denieguen de verdad ya está probado
// contra el emulador en `tests/reglas/lectores.test.mjs`; aquí no se prueba
// ninguna regla. Lo que se prueba es la decisión del cliente DESPUÉS de recibir
// la denegación: con los mismos datos a la vista, ¿dice «ya existe»,
// «inténtalo de nuevo», «en mantenimiento», o devuelve la denegación tal cual?
// Esa decisión es del cliente, se toma leyendo tres documentos, y por eso el
// doble de `datos` es la herramienta correcta —no un sustituto de las reglas.
//
// La contraprueba de la Etapa 2 cerró H-02 pero dejó anotado que el segundo
// camino —ni leer el contador se puede— no tenía prueba dedicada. Esta es.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rutas } from '../../docs/js/config-publica.js';
import { crearDatos } from '../../docs/js/datos.js';
import {
  INTENTOS_DE_PRESTAMO,
  MENSAJES_DE_OPERACION,
  devolverPrestamo,
  inscribirLector,
  prestarLibro,
  reabrirPrestamo,
} from '../../docs/js/operaciones.js';

const PERMISO = { correo: 'voluntaria@correo.cl', rol: 'voluntario' };

/**
 * Doble de `datos` con lo justo que usa un alta: `guardar`, que aquí siempre
 * deniega, y `leerDelServidor`, que responde lo que diga `lecturas`.
 *
 * `contadorPorIntento` permite que el contador cambie entre intentos, que es
 * la diferencia entre una carrera real y una denegación de permiso.
 */
function datosQueDeniegan({ lecturas = {}, contadorPorIntento = null } = {}) {
  const llamadas = { guardar: 0, lecturas: [] };
  return {
    llamadas,
    async guardar({ cuerpo, operacionId }) {
      llamadas.guardar += 1;
      llamadas.operacionId = operacionId;
      // El cuerpo corre hasta donde alcanza para que `registro` quede con el
      // contador que leyó este intento, igual que en la transacción real.
      const nunca = () => {
        throw new Error('no debería escribir');
      };
      try {
        await cuerpo(
          { set: nunca, update: nunca },
          {
            leer: async (ruta) => {
              if (ruta === rutas.configContadores()) {
                const valor = contadorPorIntento ? contadorPorIntento(llamadas.guardar) : 7;
                return { exists: () => true, data: () => ({ ultimoLector: valor }) };
              }
              return { exists: () => false, data: () => ({}) };
            },
            ref: (ruta) => ruta,
            ahoraDelServidor: () => 'marca',
            operacionId,
          },
        );
      } catch {
        // Un cuerpo que se corta no cambia lo que prueba este archivo.
      }
      return {
        estado: 'denegado',
        esExito: false,
        mensaje: MENSAJES_DE_OPERACION.sinPermiso,
      };
    },
    async leerDelServidor(ruta) {
      llamadas.lecturas.push(ruta);
      return lecturas[ruta] ?? { estado: 'ok', existe: false, datos: null };
    },
  };
}

const ALTA = {
  nombre: 'Rafaela Toledo',
  telefono: null,
  avisoDado: true,
  operacionId: 'op-estable-1',
  permiso: PERMISO,
};

test('H-02 si ni el contador se puede leer, la denegación se devuelve tal cual', async () => {
  // Una cuenta desactivada a mitad de la operación: la escritura se deniega y
  // la lectura del contador también. No hubo carrera y no hay nada que
  // reintentar; mentirle «inténtalo de nuevo» manda a la persona a repetir algo
  // que no puede funcionar.
  const datos = datosQueDeniegan({
    lecturas: { [rutas.configContadores()]: { estado: 'denegada', existe: false, datos: null } },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
  assert.equal(datos.llamadas.guardar, 1, 'una denegación sin carrera no se reintenta');
  assert.ok(
    !datos.llamadas.lecturas.includes(rutas.configControl()),
    'sin poder leer el contador no se sigue preguntando por el bloqueo',
  );
});

test('H-02 con el contador quieto y el bloqueo puesto, el mensaje es el de mantenimiento', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 7 } },
      [rutas.configControl()]: { estado: 'ok', existe: true, datos: { bloqueo: { token: 't' } } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.enMantenimiento);
  assert.equal(datos.llamadas.guardar, 1);
});

test('H-02 con el contador quieto y sin bloqueo, la denegación conserva su mensaje', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 7 } },
      [rutas.configControl()]: { estado: 'ok', existe: true, datos: { bloqueo: null } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
});

test('H-02 con la clave ya tomada, el servidor manda y el resultado es conflicto', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.lectorClave('rafaela toledo')]: { estado: 'ok', existe: true, datos: { lector: 'L007' } },
      [rutas.lector('L007')]: { estado: 'ok', existe: true, datos: { nombre: 'Rafaela Toledo' } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'conflicto');
  assert.equal(resultado.esExito, false);
  assert.match(resultado.mensaje, /Rafaela Toledo/);
  assert.equal(datos.llamadas.guardar, 1, 'una clave tomada no se reintenta');
});

// ------------------------------------------------- P-54 y P-57
//
// Una devolución cuya respuesta se perdió. Aquí no se prueba ninguna regla: se
// prueba qué decide el cliente DESPUÉS, y para eso la capa de datos es la de
// verdad —`crearDatos`— sobre un SDK que se cae justo al confirmar. Lo que las
// reglas deniegan está en `tests/reglas/prestamos.test.mjs`.

const PRESTAMO = 'a'.repeat(32);
const OPERACION = 'b'.repeat(32);

/**
 * SDK cuya transacción corre el cuerpo y después se cae con un código que deja
 * el resultado en duda. `enServidor` es lo que se encuentra al releer.
 */
function sdkQueSeCaeAlConfirmar({ enServidor }) {
  const lecturasDelServidor = [];
  const prestamoAbierto = {
    estado: 'abierto',
    libro: 'INF001',
    lector: 'L001',
    ultimaOperacionId: null,
  };
  return {
    lecturasDelServidor,
    doc: (_db, ruta) => ({ ruta }),
    collection: (_db, ruta) => ({ ruta }),
    serverTimestamp: () => '«hora del servidor»',
    onSnapshot: () => () => {},
    getDocFromServer: async (ref) => {
      lecturasDelServidor.push(ref.ruta);
      return { exists: () => enServidor != null, data: () => enServidor };
    },
    runTransaction: async (_db, cuerpo) => {
      await cuerpo({
        get: async (ref) => {
          const datos = ref.ruta === rutas.prestamo(PRESTAMO) ? prestamoAbierto : { titulo: 'Radical' };
          return { exists: () => true, data: () => datos };
        },
        update: () => {},
        set: () => {},
      });
      throw Object.assign(new Error('se cortó la red al confirmar'), { code: 'unavailable' });
    },
  };
}

test('P-54 que el préstamo exista no confirma una devolución que no se aplicó', async () => {
  // Al releer, el préstamo está ahí —existe— pero sigue abierto y sin marca de
  // ninguna operación: se comprobó que la devolución NO se guardó.
  const sdk = sdkQueSeCaeAlConfirmar({
    enServidor: { estado: 'abierto', ultimaOperacionId: null, libro: 'INF001' },
  });
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });

  const resultado = await devolverPrestamo({
    datos,
    permiso: PERMISO,
    prestamoId: PRESTAMO,
    operacionId: OPERACION,
  });

  assert.equal(resultado.esExito, false, 'la existencia del documento no es un éxito');
  assert.equal(resultado.estado, 'ausencia-comprobada');
});

test('P-57 tras perder la respuesta se relee el servidor y no se reejecuta la intención', async () => {
  // Con la marca de otra operación encima, no es atribuible: hay que revisar,
  // no repetir solo. Y la comprobación va al servidor, no a la caché.
  const sdk = sdkQueSeCaeAlConfirmar({
    enServidor: { estado: 'devuelto', ultimaOperacionId: 'c'.repeat(32), libro: 'INF001' },
  });
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });

  const resultado = await devolverPrestamo({
    datos,
    permiso: PERMISO,
    prestamoId: PRESTAMO,
    operacionId: OPERACION,
  });

  assert.equal(resultado.esExito, false);
  assert.equal(resultado.estado, 'no-atribuible');
  assert.deepEqual(
    sdk.lecturasDelServidor,
    [rutas.prestamo(PRESTAMO)],
    'se releyó el préstamo contra el servidor, una sola vez',
  );
});

test('C-39 una carrera real se reintenta con el mismo operacionId y acaba en carrera-perdida', async () => {
  // El contador se mueve en cada intento: eso SÍ es una carrera. Se reintenta
  // hasta agotar los intentos y el estado final no es «denegado», porque no
  // fue falta de permiso.
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 99 } },
    },
    contadorPorIntento: (intento) => 7 + intento,
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'carrera-perdida');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.intentaloDeNuevo);
  assert.equal(datos.llamadas.guardar, 3, 'tres intentos, los de INTENTOS_DE_ALTA');
  assert.equal(datos.llamadas.operacionId, 'op-estable-1', 'el reintento conserva la identidad');
});

// ------------------------------------------------- P-08 y P-25: los mensajes
//
// Las reglas deniegan estas tres altas y esta reapertura, y eso está probado
// contra el emulador en `tests/reglas/prestamos.test.mjs`. Lo que los casos
// piden además es el texto que lee la persona —P-08 «mensaje claro», P-25
// «Ese libro ya salió otra vez»— y ese lo decide el cliente antes de escribir.
// La capa de datos es la de verdad: `crearDatos` sobre un SDK cuya transacción
// corre el cuerpo y deja pasar lo que el cuerpo lance.

/**
 * SDK cuya transacción corre el cuerpo contra `documentos` —un mapa de ruta a
 * datos, o a `null` si el documento no existe— y confirma sin escribir nada.
 */
function sdkConDocumentos(documentos) {
  return {
    doc: (_db, ruta) => ({ ruta }),
    collection: (_db, ruta) => ({ ruta }),
    serverTimestamp: () => '«hora del servidor»',
    onSnapshot: () => () => {},
    getDocFromServer: async (ref) => ({
      exists: () => documentos[ref.ruta] != null,
      data: () => documentos[ref.ruta],
    }),
    runTransaction: async (_db, cuerpo) =>
      cuerpo({
        get: async (ref) => ({
          exists: () => documentos[ref.ruta] != null,
          data: () => documentos[ref.ruta],
        }),
        update: () => {},
        set: () => {},
      }),
  };
}

const CALENDARIO_DEL_SABADO = {
  vencimientos: ['2026-04-11T03:59:59.999Z'],
  temporada: '2026',
};

/** Lo común de las tres altas de P-08: cambia solo el estado del libro. */
async function mensajeAlPrestar(libro) {
  const datos = crearDatos({
    db: {},
    sdk: sdkConDocumentos({
      [rutas.libro('INF001')]: libro,
      [rutas.lector('L001')]: { fusionadoEn: null },
      [rutas.diaCalendario('2026-04-04')]: CALENDARIO_DEL_SABADO,
      [rutas.configContadores()]: { ultimoPrestamo: 12 },
    }),
    red: { onLine: true },
  });
  const resultado = await prestarLibro({
    datos,
    permiso: PERMISO,
    libroCodigo: 'INF001',
    lectorId: 'L001',
    plazoSabados: 1,
    ahora: new Date('2026-04-04T15:00:00.000Z'),
    operacionId: OPERACION,
    prestamoId: PRESTAMO,
  });
  assert.equal(resultado.esExito, false);
  assert.equal(resultado.estado, 'conflicto');
  return resultado.mensaje;
}

test('P-08 el libro de baja, el inexistente y el ya prestado dicen cada uno su motivo', async () => {
  assert.equal(
    await mensajeAlPrestar({ baja: true, prestamoAbierto: null, vecesPrestado: 0 }),
    MENSAJES_DE_OPERACION.libroDeBaja,
  );
  assert.equal(await mensajeAlPrestar(null), MENSAJES_DE_OPERACION.libroPerdido);
  assert.equal(
    await mensajeAlPrestar({ baja: false, prestamoAbierto: 'z'.repeat(32), vecesPrestado: 1 }),
    MENSAJES_DE_OPERACION.libroPrestado,
  );
});

test('P-25 reabrir cuando el libro ya salió otra vez dice «Ese libro ya salió otra vez»', async () => {
  const datos = crearDatos({
    db: {},
    sdk: sdkConDocumentos({
      [rutas.prestamo(PRESTAMO)]: { estado: 'devuelto', libro: 'INF001', devueltoPor: PERMISO.correo },
      // El libro ya está apuntando a OTRO préstamo: salió de nuevo.
      [rutas.libro('INF001')]: { prestamoAbierto: 'z'.repeat(32) },
    }),
    red: { onLine: true },
  });

  const resultado = await reabrirPrestamo({
    datos,
    permiso: PERMISO,
    prestamoId: PRESTAMO,
    operacionId: OPERACION,
  });

  assert.equal(resultado.esExito, false);
  assert.equal(resultado.estado, 'conflicto');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.libroYaSalio);
});

// ------------------------------------------------- H-05 (contraprueba Préstamos)
//
// Lo mismo que H-02 probó en el alta de lector, ahora en el préstamo: una
// denegación de verdad —cuenta desactivada a mitad, mantenimiento puesto— no es
// una carrera, y decirle «Hay mucho movimiento. Inténtalo de nuevo» manda a la
// persona a repetir cinco veces algo que no puede funcionar. Aquí no se prueba
// ninguna regla: eso está en `tests/reglas/prestamos.test.mjs`. Se prueba qué
// decide el cliente con los mismos tres documentos a la vista.

const SABADO = new Date('2026-04-04T15:00:00.000Z');
const DIA_SABADO = '2026-04-04';
const LIBRO = 'INF001';
const LECTOR = 'L001';

/**
 * Doble de `datos` para un préstamo: `guardar` corre el cuerpo hasta donde
 * alcanza —para que `registro` quede con el contador que leyó el intento— y
 * después deniega. `leerDelServidor` responde lo que diga `lecturas`.
 */
function datosQueDenieganElPrestamo({ lecturas = {}, contadorPorIntento = null } = {}) {
  const llamadas = { guardar: 0, lecturas: [] };
  return {
    llamadas,
    async guardar({ cuerpo, operacionId }) {
      llamadas.guardar += 1;
      llamadas.operacionId = operacionId;
      await cuerpo(
        { set: () => {}, update: () => {} },
        {
          leer: async (ruta) => {
            if (ruta === rutas.libro(LIBRO)) {
              return { exists: () => true, data: () => ({ baja: false, prestamoAbierto: null, vecesPrestado: 3 }) };
            }
            if (ruta === rutas.lector(LECTOR)) {
              return { exists: () => true, data: () => ({ fusionadoEn: null }) };
            }
            if (ruta === rutas.diaCalendario(DIA_SABADO)) {
              return {
                exists: () => true,
                data: () => ({ vencimientos: ['2026-04-11T03:59:59.999Z'], temporada: '2026' }),
              };
            }
            if (ruta === rutas.configContadores()) {
              const valor = contadorPorIntento ? contadorPorIntento(llamadas.guardar) : 12;
              return { exists: () => true, data: () => ({ ultimoPrestamo: valor }) };
            }
            return { exists: () => false, data: () => ({}) };
          },
          ref: (ruta) => ruta,
          ahoraDelServidor: () => 'marca',
          operacionId,
        },
      );
      return { estado: 'denegado', esExito: false, mensaje: MENSAJES_DE_OPERACION.sinPermiso };
    },
    async leerDelServidor(ruta) {
      llamadas.lecturas.push(ruta);
      return lecturas[ruta] ?? { estado: 'ok', existe: false, datos: null };
    },
  };
}

const PRESTAR = {
  permiso: PERMISO,
  libroCodigo: LIBRO,
  lectorId: LECTOR,
  plazoSabados: 1,
  ahora: SABADO,
  operacionId: OPERACION,
  prestamoId: PRESTAMO,
};

/** El calendario del sábado existe: así la denegación no se explica por él. */
const CALENDARIO_PRESENTE = {
  [rutas.diaCalendario(DIA_SABADO)]: { estado: 'ok', existe: true, datos: { vencimientos: ['x'] } },
};

test('H-05 si ni el contador se puede leer, el préstamo devuelve la denegación tal cual', async () => {
  const datos = datosQueDenieganElPrestamo({
    lecturas: {
      ...CALENDARIO_PRESENTE,
      [rutas.libro(LIBRO)]: { estado: 'ok', existe: true, datos: { prestamoAbierto: null } },
      [rutas.configContadores()]: { estado: 'denegada', existe: false, datos: null },
    },
  });

  const resultado = await prestarLibro({ datos, ...PRESTAR });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
  assert.equal(datos.llamadas.guardar, 1, 'una denegación sin carrera no se reintenta');
  assert.ok(
    !datos.llamadas.lecturas.includes(rutas.configControl()),
    'sin poder leer el contador no se sigue preguntando por el bloqueo',
  );
});

test('H-05 si ni el libro se puede leer, el préstamo devuelve la denegación tal cual', async () => {
  const datos = datosQueDenieganElPrestamo({
    lecturas: { [rutas.libro(LIBRO)]: { estado: 'denegada', existe: false, datos: null } },
  });

  const resultado = await prestarLibro({ datos, ...PRESTAR });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
  assert.equal(datos.llamadas.guardar, 1);
  assert.deepEqual(
    datos.llamadas.lecturas,
    [rutas.libro(LIBRO)],
    'con el libro denegado no se pregunta por el calendario ni por el contador',
  );
});

test('H-05 con el contador quieto y el bloqueo puesto, el préstamo dice mantenimiento', async () => {
  const datos = datosQueDenieganElPrestamo({
    lecturas: {
      ...CALENDARIO_PRESENTE,
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoPrestamo: 12 } },
      [rutas.configControl()]: { estado: 'ok', existe: true, datos: { bloqueo: { token: 't' } } },
    },
  });

  const resultado = await prestarLibro({ datos, ...PRESTAR });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.enMantenimiento);
  assert.equal(datos.llamadas.guardar, 1);
});

test('H-05 el contador que se mueve en cada intento sigue siendo carrera perdida', async () => {
  // La corrección no se come el camino que sí era una carrera.
  const datos = datosQueDenieganElPrestamo({
    lecturas: {
      ...CALENDARIO_PRESENTE,
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoPrestamo: 99 } },
    },
    contadorPorIntento: (intento) => 12 + intento,
  });

  const resultado = await prestarLibro({ datos, ...PRESTAR });

  assert.equal(resultado.estado, 'carrera-perdida');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.intentaloDeNuevoPrestamo);
  assert.equal(datos.llamadas.guardar, INTENTOS_DE_PRESTAMO);
  assert.equal(datos.llamadas.operacionId, OPERACION, 'el reintento conserva la identidad');
});
