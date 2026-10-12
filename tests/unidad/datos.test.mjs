// A-19, A-20, A-36, A-39 y la forma de guardar (base §6, contrato §3).
//
// La clasificación de un resultado incierto es una función pura: recibe lo que
// dijo el servidor y decide qué se le puede afirmar a la persona. Lo que NO
// puede pasar nunca es afirmar «No se guardó» sin haberlo comprobado.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAVE_INTENCION,
  MAX_INTENTOS_TRANSACCION,
  MENSAJES,
  clasificarResultado,
  crearContadores,
  crearDatos,
  esResultadoIncierto,
  intencionPendiente,
  olvidarIntencion,
  recordarIntencion,
} from '../../docs/js/datos.js';

const MIO = 'a'.repeat(32);
const AJENO = 'b'.repeat(32);

test('A-19 un alta incierta con mi creacionId sí quedó guardada', () => {
  const resuelto = clasificarResultado({
    tipo: 'alta',
    estadoLectura: 'ok',
    lectura: { existe: true, creacionId: MIO },
    operacionId: MIO,
  });
  assert.equal(resuelto.resultado, 'exito-propio');
  assert.equal(resuelto.mensaje, MENSAJES.exitoPropio);
  assert.equal(resuelto.esExito, true);
});

test('A-20 un alta incierta sin documento en el servidor no se guardó', () => {
  const resuelto = clasificarResultado({
    tipo: 'alta',
    estadoLectura: 'ok',
    lectura: { existe: false },
    operacionId: MIO,
  });
  assert.equal(resuelto.resultado, 'ausencia-comprobada');
  assert.equal(resuelto.mensaje, MENSAJES.ausenciaComprobada);
  assert.equal(resuelto.esExito, false);
});

test('A-36 un alta incierta cuyo documento creó otra operación no es éxito propio', () => {
  const resuelto = clasificarResultado({
    tipo: 'alta',
    estadoLectura: 'ok',
    lectura: { existe: true, creacionId: AJENO },
    operacionId: MIO,
  });
  assert.equal(resuelto.resultado, 'conflicto-de-otro');
  assert.equal(resuelto.esExito, false);
  assert.ok(!resuelto.mensaje.includes('quedó guardado'));
});

test('A-36 la mera existencia del documento no confirma nada', () => {
  // Documento existente, sin creacionId legible: tampoco es éxito propio.
  const resuelto = clasificarResultado({
    tipo: 'alta',
    estadoLectura: 'ok',
    lectura: { existe: true, creacionId: null },
    operacionId: MIO,
  });
  assert.equal(resuelto.esExito, false);
});

test('A-39 una lectura denegada, agotada o sin red no afirma que no se guardó', () => {
  for (const estadoLectura of ['denegada', 'agotada', 'sin-conexion']) {
    const resuelto = clasificarResultado({ tipo: 'alta', estadoLectura, lectura: null, operacionId: MIO });
    assert.equal(resuelto.resultado, 'indeterminado', estadoLectura);
    assert.equal(resuelto.esExito, false);
    assert.ok(!resuelto.mensaje.includes('No se guardó'), resuelto.mensaje);
    assert.match(resuelto.mensaje, /Revisa su estado antes de repetir/);
  }
});

test('un cambio incierto es éxito solo si lleva mi marca y el resultado es compatible', () => {
  assert.equal(
    clasificarResultado({
      tipo: 'cambio',
      estadoLectura: 'ok',
      lectura: { existe: true, ultimaOperacionId: MIO, aplicado: true },
      operacionId: MIO,
    }).resultado,
    'exito-propio',
  );
  // Lleva mi marca pero el estado no es el que pedí: no se puede atribuir.
  assert.equal(
    clasificarResultado({
      tipo: 'cambio',
      estadoLectura: 'ok',
      lectura: { existe: true, ultimaOperacionId: MIO, aplicado: false },
      operacionId: MIO,
    }).resultado,
    'no-atribuible',
  );
  // Escribió alguien después: hay que revisar, no repetir solo.
  assert.equal(
    clasificarResultado({
      tipo: 'cambio',
      estadoLectura: 'ok',
      lectura: { existe: true, ultimaOperacionId: AJENO, aplicado: true },
      operacionId: MIO,
    }).resultado,
    'no-atribuible',
  );
  // Nadie escribió y el cambio no está: se comprobó que no se guardó.
  assert.equal(
    clasificarResultado({
      tipo: 'cambio',
      estadoLectura: 'ok',
      lectura: { existe: true, ultimaOperacionId: null, aplicado: false },
      operacionId: MIO,
    }).resultado,
    'ausencia-comprobada',
  );
});

test('se distinguen los errores que dejan el resultado en duda', () => {
  for (const code of ['unavailable', 'deadline-exceeded', 'aborted', 'internal']) {
    assert.ok(esResultadoIncierto({ code }), code);
  }
  assert.ok(esResultadoIncierto({ code: 'firestore/unavailable' }));
  assert.ok(!esResultadoIncierto({ code: 'permission-denied' }));
  assert.ok(!esResultadoIncierto({ code: 'invalid-argument' }));
});

// ---------------------------------------------------------------------------
// La forma de guardar, con un SDK de mentira. Esto no prueba las reglas de
// seguridad: eso se prueba contra el emulador en tests/reglas/.
// ---------------------------------------------------------------------------

function sdkDeMentira({ fallarCon = null, intentos = 1 } = {}) {
  let vueltas = 0;
  return {
    doc: (_db, ruta) => ({ ruta }),
    collection: (_db, ruta) => ({ ruta }),
    serverTimestamp: () => '«hora del servidor»',
    getDocFromServer: async () => ({ exists: () => false, data: () => null }),
    onSnapshot: () => () => {},
    runTransaction: async (_db, cuerpo, opciones) => {
      assert.equal(opciones.maxAttempts, MAX_INTENTOS_TRANSACCION);
      let ultimo;
      for (let i = 0; i < intentos; i += 1) {
        vueltas += 1;
        ultimo = await cuerpo({ get: async () => ({ exists: () => false, data: () => null }), set: () => {} });
      }
      if (fallarCon) throw fallarCon;
      return ultimo;
    },
    vueltas: () => vueltas,
  };
}

test('toda escritura pasa por una transacción con maxAttempts en 5', async () => {
  const sdk = sdkDeMentira();
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });
  const resultado = await datos.guardar({ tipo: 'alta', cuerpo: async () => 'hecho' });
  assert.equal(resultado.estado, 'exito');
  assert.equal(resultado.esExito, true);
  assert.equal(resultado.valor, 'hecho');
  assert.ok(resultado.operacionId.length === 32);
});

test('A-17 sin conexión no se escribe ni se encola', async () => {
  const sdk = sdkDeMentira();
  const datos = crearDatos({ db: {}, sdk, red: { onLine: false } });
  const resultado = await datos.guardar({ tipo: 'alta', cuerpo: async () => 'hecho' });
  assert.equal(resultado.estado, 'sin-conexion');
  assert.equal(resultado.mensaje, MENSAJES.sinConexion);
  assert.equal(resultado.esExito, false);
  assert.equal(sdk.vueltas(), 0, 'no se intentó ninguna transacción');
});

test('A-18 un error de red lleva a comprobar contra el servidor, no a afirmar', async () => {
  const sdk = sdkDeMentira({ fallarCon: Object.assign(new Error('caída'), { code: 'unavailable' }) });
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });

  let comprobaciones = 0;
  const resultado = await datos.guardar({
    tipo: 'alta',
    operacionId: MIO,
    cuerpo: async () => {},
    comprobar: async () => {
      comprobaciones += 1;
      return { estado: 'ok', lectura: { existe: true, creacionId: MIO } };
    },
  });

  assert.equal(comprobaciones, 1);
  assert.equal(resultado.estado, 'exito-propio');
  assert.equal(resultado.esExito, true);
});

test('un permiso denegado no se confunde con un resultado incierto', async () => {
  const sdk = sdkDeMentira({ fallarCon: Object.assign(new Error('no'), { code: 'permission-denied' }) });
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });
  let comprobaciones = 0;
  const resultado = await datos.guardar({
    tipo: 'alta',
    cuerpo: async () => {},
    comprobar: async () => {
      comprobaciones += 1;
      return { estado: 'ok', lectura: null };
    },
  });
  assert.equal(resultado.estado, 'denegado');
  assert.equal(comprobaciones, 0);
});

test('A-37 cancelar escuchas las suelta todas', () => {
  let vivas = 0;
  const sdk = {
    ...sdkDeMentira(),
    onSnapshot: () => {
      vivas += 1;
      return () => {
        vivas -= 1;
      };
    },
  };
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true } });
  datos.escucharDocumento('a', () => {});
  datos.escucharColeccion('b', () => {});
  assert.equal(vivas, 2);
  datos.cancelarEscuchas();
  assert.equal(vivas, 0);
});

test('los contadores separan cada tipo de evento y no se suman de nuevo', () => {
  const contadores = crearContadores();
  const escuchas = [];
  const sdk = {
    ...sdkDeMentira(),
    onSnapshot: (_ref, _opciones, alCambiar) => {
      escuchas.push(alCambiar);
      return () => {};
    },
  };
  const datos = crearDatos({ db: {}, sdk, red: { onLine: true }, contadores });
  datos.escucharColeccion('voluntarios', () => {});

  const instantanea = (cambios, fromCache = false) => ({
    metadata: { fromCache, hasPendingWrites: false },
    docChanges: () => Array.from({ length: cambios }, () => ({})),
    docs: Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, data: () => ({}) })),
    empty: false,
  });

  escuchas[0](instantanea(20)); // carga inicial: 20 documentos
  escuchas[0](instantanea(1)); // un cambio: 1 documento, no 20 otra vez
  escuchas[0](instantanea(0, true)); // evento de caché

  const valores = contadores.valores();
  assert.equal(valores.documentosModificadosPorEscucha, 21);
  assert.equal(valores.eventosDeCache, 1);
});

test('la intención que sobrevive a una recarga no lleva datos personales', () => {
  const caja = {};
  const memoria = {
    getItem: (k) => caja[k] ?? null,
    setItem: (k, v) => {
      caja[k] = v;
    },
    removeItem: (k) => {
      delete caja[k];
    },
  };

  recordarIntencion(
    {
      operacionId: MIO,
      tipo: 'alta',
      ruta: 'bibliotecas/principal/voluntarios/ana@example.com',
      identificadores: ['ana@example.com'],
      nombre: 'Ana Rojas',
      telefono: '56900000001',
      token: 'no-va',
    },
    memoria,
  );

  const guardada = JSON.parse(caja[CLAVE_INTENCION]);
  assert.deepEqual(Object.keys(guardada).sort(), ['identificadores', 'operacionId', 'ruta', 'tipo']);
  assert.equal(guardada.nombre, undefined);
  assert.equal(guardada.telefono, undefined);
  assert.equal(guardada.token, undefined);

  assert.equal(intencionPendiente(memoria).operacionId, MIO);
  olvidarIntencion(memoria);
  assert.equal(intencionPendiente(memoria), null);
});
