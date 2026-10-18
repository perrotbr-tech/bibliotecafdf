// Reglas de préstamos. Los casos que cubre este archivo, con su ID:
//   P-01, P-06…P-11, P-19…P-27, P-29, P-48…P-53, P-55, P-56, P-58,
//   R-09…R-11, R-19.
// Lo que NO está aquí y por qué: P-54 y P-57 son decisión del cliente ante un
// resultado incierto (`tests/unidad/datos.test.mjs`); la mitad de interfaz de
// P-48 y los casos P-30…P-47 son de navegador y están declarados como
// pendientes en el informe de la entrega.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  ADMIN,
  ID,
  RUTAS,
  VOLUNTARIA,
  abrirEntorno,
  comoCuenta,
  sembrarBase,
  sembrarCalendario,
  sembrarLector,
  sembrarLibro,
  sembrarPrestamo,
} from '../ayuda/reglas.mjs';

let entorno;

before(async () => {
  entorno = await abrirEntorno();
});
after(async () => {
  await entorno?.cleanup();
});
beforeEach(async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno);
  await sembrarLibro(entorno, 'INF001');
  await sembrarLector(entorno, 'L001', { numero: 1 });
  await sembrarCalendario(entorno, '2026-10-10');
});

const meta = () => ({ ultimaOperacionId: ID('1'), modificadoEn: serverTimestamp() });

function datosPrestamo(correo = VOLUNTARIA, extras = {}) {
  return {
    numero: 1,
    libro: 'INF001',
    lector: 'L001',
    prestadoEn: serverTimestamp(),
    salidaDia: '2026-10-10',
    plazoSabados: 2,
    registroDiferido: false,
    motivoRegistroDiferido: null,
    venceEl: new Date('2026-10-25T02:59:59.999Z'),
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
    creadoEn: serverTimestamp(),
    creadoPor: correo,
    creacionId: ID('c'),
    origen: 'app',
    ...extras,
  };
}

/** Alta atómica: préstamo + libro + contador, como la app. */
async function prestarOk(correo = VOLUNTARIA, { id = ID('a'), numero = 1, libro = 'INF001' } = {}) {
  const db = comoCuenta(entorno, correo);
  // Leer vencimiento real del calendario sembrado.
  const cal = await getDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.calendario('2026-10-10')));
  const venceEl = cal.data().vencimientos[1];
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(correo, { numero, libro, venceEl }));
  lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: numero, ultimoPrestamoId: id });
  await assertSucceeds(lote.commit());
  return id;
}

test('P-01 prestar un libro disponible', async () => {
  const id = await prestarOk();
  const prestamo = await getDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.prestamo(id)));
  assert.equal(prestamo.data().estado, 'abierto');
  const libro = await getDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.libro('INF001')));
  assert.equal(libro.data().prestamoAbierto, id);
  assert.equal(libro.data().vecesPrestado, 1);
});

test('P-06 crear préstamo sin tocar el libro se deniega', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('p');
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo());
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: id });
  await assertFails(lote.commit());
});

test('P-07 número saltado o ya usado se deniega', async () => {
  await prestarOk();
  await sembrarLibro(entorno, 'INF002');
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('b');
  const cal = await getDoc(doc(db, RUTAS.calendario('2026-10-10')));
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, {
    numero: 3,
    libro: 'INF002',
    venceEl: cal.data().vencimientos[1],
  }));
  lote.update(doc(db, RUTAS.libro('INF002')), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 3, ultimoPrestamoId: id });
  await assertFails(lote.commit());
});

test('P-08 libro de baja, inexistente o ya prestado se deniega', async () => {
  // Los tres caminos del caso. El «mensaje claro» que pide P-08 es del cliente
  // y está en `tests/unidad/operaciones.test.mjs`: una regla no devuelve texto.
  const db = comoCuenta(entorno, VOLUNTARIA);
  const cal = await getDoc(doc(db, RUTAS.calendario('2026-10-10')));
  const venceEl = cal.data().vencimientos[1];

  /** Alta atómica contra `libro`, como la haría la app. */
  const intentar = async (libro, id, numero) => {
    const lote = writeBatch(db);
    lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, { libro, venceEl, numero }));
    lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: id, vecesPrestado: 1 });
    lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: numero, ultimoPrestamoId: id });
    await assertFails(lote.commit());
  };

  // De baja.
  await sembrarLibro(entorno, 'INF002', { baja: true });
  await intentar('INF002', ID('c'), 1);

  // Inexistente: el libro nunca se sembró, así que el `update` del lote no
  // tiene a qué aplicarse y la regla del enlace no se cumple.
  await intentar('INF404', ID('d'), 1);

  // Ya prestado: INF001 sale en un alta buena y el segundo intento lo pide
  // encima.
  await prestarOk(VOLUNTARIA, { id: ID('a'), numero: 1, libro: 'INF001' });
  await intentar('INF001', ID('e'), 2);
});

test('P-09 lector fusionado se deniega', async () => {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(RUTAS.lector('L001')).update({ fusionadoEn: 'L002' });
  });
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('d');
  const cal = await getDoc(doc(db, RUTAS.calendario('2026-10-10')));
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, { venceEl: cal.data().vencimientos[1] }));
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: id });
  await assertFails(lote.commit());
});

test('P-10 prestadoEn distinto de request.time se deniega', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('e');
  const cal = await getDoc(doc(db, RUTAS.calendario('2026-10-10')));
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, {
    venceEl: cal.data().vencimientos[1],
    prestadoEn: new Date('2020-01-01T00:00:00Z'),
    creadoEn: serverTimestamp(),
  }));
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: id });
  await assertFails(lote.commit());
});

test('P-29 borrar un préstamo se deniega', async () => {
  const id = await prestarOk();
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.prestamo(id))));
});

test('P-55 sin el calendario de ese sábado el préstamo se deniega, y el cliente no lo escribe', async () => {
  // Las dos mitades del caso. Primero el préstamo bloqueado: el 17-10-2026 es
  // sábado y su día NO está sembrado, así que la regla no encuentra con qué
  // comparar el vencimiento.
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('f');
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, {
    salidaDia: '2026-10-17',
    venceEl: new Date('2026-11-01T02:59:59.999Z'),
  }));
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: id });
  await assertFails(lote.commit());

  // Y la escritura del propio calendario, denegada hasta para el administrador.
  await assertFails(
    setDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.calendario('2026-10-17')), {
      inicio: new Date(),
      finExclusivo: new Date(),
      temporada: '2026-5',
      vencimientos: [],
    }),
  );
});

test('devolver deja a tiempo en nulo (P-19 inverso)', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);
  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.prestamo(id)), {
    estado: 'devuelto',
    devueltoEn: serverTimestamp(),
    devueltoPor: VOLUNTARIA,
    devueltoATiempo: null,
    correccionATiempo: null,
    ...meta(),
  });
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: null });
  await assertSucceeds(lote.commit());
});

test('P-19 voluntario no puede enviar booleano de corrección al devolver', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);
  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.prestamo(id)), {
    estado: 'devuelto',
    devueltoEn: serverTimestamp(),
    devueltoPor: VOLUNTARIA,
    devueltoATiempo: true,
    correccionATiempo: null,
    ...meta(),
  });
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: null });
  await assertFails(lote.commit());
});

test('R-09 anotar recordatorio en abierto guarda la hora del servidor y quién', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);
  const antes = Date.now();
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.prestamo(id)), {
      recordadoEn: serverTimestamp(),
      recordadoPor: VOLUNTARIA,
      ...meta(),
    }),
  );

  // Lo que el caso escribe: la marca es del servidor —no un valor que el
  // teléfono pudo elegir— y queda quién la abrió. La fila que lo cuenta está
  // en la prueba de navegador R-09.
  const guardado = (await getDoc(doc(db, RUTAS.prestamo(id)))).data();
  assert.equal(guardado.recordadoPor, VOLUNTARIA);
  assert.ok(guardado.recordadoEn, 'quedó la marca');
  const marca = guardado.recordadoEn.toDate().getTime();
  assert.ok(marca >= antes - 60_000 && marca <= Date.now() + 60_000, 'la marca es de ahora, no de un futuro elegido');
  assert.equal(guardado.estado, 'abierto', 'anotar la apertura no cierra el préstamo');
});

test('R-10 no se puede cambiar venceEl junto con recordadoEn', async () => {
  const id = await prestarOk();
  await assertFails(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.prestamo(id)), {
      recordadoEn: serverTimestamp(),
      recordadoPor: VOLUNTARIA,
      venceEl: new Date('2030-01-01T00:00:00Z'),
      ...meta(),
    }),
  );
});

test('R-11 recordar un préstamo devuelto se deniega', async () => {
  const id = ID('b');
  await sembrarPrestamo(entorno, id, { estado: 'devuelto', devueltoEn: new Date(), devueltoPor: VOLUNTARIA });
  await assertFails(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.prestamo(id)), {
      recordadoEn: serverTimestamp(),
      recordadoPor: VOLUNTARIA,
      ...meta(),
    }),
  );
});

test('P-27 admin corrige a tiempo; voluntario no', async () => {
  const id = ID('c');
  await sembrarPrestamo(entorno, id, {
    estado: 'devuelto',
    devueltoEn: new Date(),
    devueltoPor: VOLUNTARIA,
  });
  await assertFails(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.prestamo(id)), {
      devueltoATiempo: true,
      correccionATiempo: { por: VOLUNTARIA, en: serverTimestamp(), motivo: 'Se anotó tarde el sábado' },
      ...meta(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.prestamo(id)), {
      devueltoATiempo: true,
      correccionATiempo: { por: ADMIN, en: serverTimestamp(), motivo: 'Se anotó tarde el sábado' },
      ...meta(),
    }),
  );
});

test('R-18 una plantilla de 9 o de 401 caracteres se rechaza', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.app), { mensajeAtraso: 'a'.repeat(9), ...meta() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { mensajeAtraso: 'a'.repeat(401), ...meta() }));
  // El borde de arriba sí entra: cuatrocientos.
  await assertSucceeds(updateDoc(doc(db, RUTAS.app), { mensajeAtraso: 'a'.repeat(400), ...meta() }));
});

test('R-19 voluntario no cambia plantillas', async () => {
  await assertFails(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.app), {
      mensajeAtraso: 'Hola {nombre}, trae el libro «{titulo}» que venció el {fecha}. Gracias!!!!',
      ...meta(),
    }),
  );
});

// ---------------------------------------------------- anular y reabrir
//
// Los tres lotes son los que escribe la app: el préstamo y el libro en una
// sola petición, porque las reglas de cada documento exigen ver el otro ya
// escrito (`getAfter`). Pasar solo una mitad se deniega, y eso es el punto.

/** El lote de una anulación: préstamo a `anulado` y libro libre con una vez menos. */
function loteDeAnular(db, id, { correo = VOLUNTARIA, libro = 'INF001', vecesAntes = 1 } = {}) {
  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.prestamo(id)), {
    estado: 'anulado',
    anuladoEn: serverTimestamp(),
    anuladoPor: correo,
    ...meta(),
  });
  lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: null, vecesPrestado: vecesAntes - 1 });
  return lote;
}

/** El lote de una devolución: préstamo a `devuelto` y libro libre. */
function loteDeDevolver(db, id, { correo = VOLUNTARIA, libro = 'INF001', devueltoEn = null } = {}) {
  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.prestamo(id)), {
    estado: 'devuelto',
    devueltoEn: devueltoEn ?? serverTimestamp(),
    devueltoATiempo: null,
    correccionATiempo: null,
    devueltoPor: correo,
    ...meta(),
  });
  lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: null });
  return lote;
}

/** El lote de una reapertura: préstamo a `abierto` y libro apuntando a él. */
function loteDeReabrir(db, id, { libro = 'INF001' } = {}) {
  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.prestamo(id)), {
    estado: 'abierto',
    devueltoEn: null,
    devueltoATiempo: null,
    correccionATiempo: null,
    devueltoPor: null,
    ...meta(),
  });
  lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: id });
  return lote;
}

/** Una segunda voluntaria activa: la necesitan los casos de «préstamo ajeno». */
const OTRA = 'otra@example.com';
async function sembrarOtraVoluntaria() {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.voluntario(OTRA)).set({
      nombre: 'Marta',
      rol: 'voluntario',
      activo: true,
      creadoEn: new Date('2026-10-10T18:00:00Z'),
      creadoPor: 'carga-inicial',
      creacionId: ID('e'),
      ultimaConexion: null,
      sincronizacionId: null,
    });
  });
}

test('P-20 devolver un préstamo ya devuelto o anulado se deniega', async () => {
  const devuelto = ID('d');
  await sembrarPrestamo(entorno, devuelto, {
    estado: 'devuelto',
    devueltoEn: new Date(),
    devueltoPor: VOLUNTARIA,
  });
  await assertFails(loteDeDevolver(comoCuenta(entorno, VOLUNTARIA), devuelto).commit());

  const anulado = ID('n');
  await sembrarPrestamo(entorno, anulado, {
    numero: 2,
    estado: 'anulado',
    anuladoEn: new Date(),
    anuladoPor: VOLUNTARIA,
  });
  await assertFails(loteDeDevolver(comoCuenta(entorno, VOLUNTARIA), anulado).commit());
});

test('P-21 anular dentro de diez minutos por quien lo creó deja el libro libre y no reutiliza el número', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertSucceeds(loteDeAnular(db, id).commit());

  const prestamo = await getDoc(doc(db, RUTAS.prestamo(id)));
  assert.equal(prestamo.data().estado, 'anulado');
  const libro = await getDoc(doc(db, RUTAS.libro('INF001')));
  assert.equal(libro.data().prestamoAbierto, null);
  assert.equal(libro.data().vecesPrestado, 0);
  // El número queda gastado: el contador no retrocede, así que el siguiente
  // préstamo pide el 2 (que el 1 no se pueda repetir lo prueba P-07).
  const contadores = await getDoc(doc(db, RUTAS.contadores));
  assert.equal(contadores.data().ultimoPrestamo, 1);
  assert.equal(contadores.data().ultimoPrestamoId, id);
});

test('P-22 anular un préstamo ajeno, o propio pasados diez minutos, se deniega', async () => {
  await sembrarOtraVoluntaria();

  const ajeno = ID('a');
  await sembrarPrestamo(entorno, ajeno, { creadoPor: OTRA, prestadoEn: new Date() });
  await sembrarLibro(entorno, 'INF001', { prestamoAbierto: ajeno, vecesPrestado: 1 });
  await assertFails(loteDeAnular(comoCuenta(entorno, VOLUNTARIA), ajeno).commit());

  const viejo = ID('b');
  await sembrarPrestamo(entorno, viejo, {
    numero: 2,
    libro: 'INF002',
    creadoPor: VOLUNTARIA,
    prestadoEn: new Date(Date.now() - 20 * 60 * 1000),
  });
  await sembrarLibro(entorno, 'INF002', { prestamoAbierto: viejo, vecesPrestado: 1 });
  await assertFails(loteDeAnular(comoCuenta(entorno, VOLUNTARIA), viejo, { libro: 'INF002' }).commit());
});

test('P-23 el administrador anula un préstamo abierto de hace un mes', async () => {
  const id = ID('m');
  await sembrarPrestamo(entorno, id, {
    creadoPor: VOLUNTARIA,
    prestadoEn: new Date(Date.now() - 30 * 86_400_000),
  });
  await sembrarLibro(entorno, 'INF001', { prestamoAbierto: id, vecesPrestado: 1 });
  await assertSucceeds(loteDeAnular(comoCuenta(entorno, ADMIN), id, { correo: ADMIN }).commit());
});

test('P-24 anular un préstamo devuelto se deniega', async () => {
  const id = ID('d');
  await sembrarPrestamo(entorno, id, {
    estado: 'devuelto',
    devueltoEn: new Date(),
    devueltoPor: VOLUNTARIA,
  });
  await assertFails(loteDeAnular(comoCuenta(entorno, ADMIN), id, { correo: ADMIN, vecesAntes: 1 }).commit());
});

test('P-25 reabrir una devolución cuando el libro ya salió otra vez se deniega', async () => {
  const devuelto = ID('d');
  const nuevo = ID('n');
  await sembrarPrestamo(entorno, devuelto, {
    estado: 'devuelto',
    devueltoEn: new Date(),
    devueltoPor: VOLUNTARIA,
  });
  await sembrarPrestamo(entorno, nuevo, { numero: 2 });
  await sembrarLibro(entorno, 'INF001', { prestamoAbierto: nuevo, vecesPrestado: 2 });
  await assertFails(loteDeReabrir(comoCuenta(entorno, VOLUNTARIA), devuelto).commit());
});

test('P-26 reabrir dentro de diez minutos por quien devolvió vuelve a abierto', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertSucceeds(loteDeDevolver(db, id).commit());
  await assertSucceeds(loteDeReabrir(db, id).commit());

  const prestamo = await getDoc(doc(db, RUTAS.prestamo(id)));
  assert.equal(prestamo.data().estado, 'abierto');
  assert.equal(prestamo.data().devueltoEn, null);
  assert.equal(prestamo.data().devueltoATiempo, null);
  assert.equal(prestamo.data().devueltoPor, null);
  const libro = await getDoc(doc(db, RUTAS.libro('INF001')));
  assert.equal(libro.data().prestamoAbierto, id);
  assert.equal(libro.data().vecesPrestado, 1);
});

// ------------------------------------------- casos de la revisión 1.1
//
// P-54 y P-57 no están aquí: no son reglas. Son la decisión del cliente ante
// una escritura cuyo resultado quedó incierto, y se prueban con el doble de
// `datos` en `tests/unidad/datos.test.mjs`.

/** Lote de alta igual al de la app, con lo que haga falta roto. */
function loteDeAlta(db, correo, { id, venceEl, libro = 'INF001', numero = 1, vecesAntes = 0, extras = {} } = {}) {
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(correo, { numero, libro, venceEl, ...extras }));
  lote.update(doc(db, RUTAS.libro(libro)), { prestamoAbierto: id, vecesPrestado: vecesAntes + 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: numero, ultimoPrestamoId: id });
  return lote;
}

const MOTIVO = 'Anotado en papel el sábado sin señal';

/** Vencimientos y temporada del calendario sembrado para ese día. */
async function delCalendario(db, dia) {
  const cal = await getDoc(doc(db, RUTAS.calendario(dia)));
  return { vencimientos: cal.data().vencimientos, temporada: cal.data().temporada };
}

test('P-49 el administrador registra el lunes un préstamo anotado el sábado', async () => {
  // Ventana del sábado ya cerrada: es lunes.
  await sembrarCalendario(entorno, '2026-10-10', {
    inicio: new Date(Date.now() - 3 * 86_400_000),
    finExclusivo: new Date(Date.now() - 2 * 86_400_000),
  });
  const db = comoCuenta(entorno, ADMIN);
  const { vencimientos, temporada } = await delCalendario(db, '2026-10-10');

  // Con la ventana cerrada, el registro normal ya no entra.
  await assertFails(loteDeAlta(db, ADMIN, { id: ID('1'), venceEl: vencimientos[1] }).commit());

  // Diferido con motivo: entra, y conserva lo del sábado.
  const id = ID('2');
  await assertSucceeds(
    loteDeAlta(db, ADMIN, {
      id,
      venceEl: vencimientos[1],
      extras: { registroDiferido: true, motivoRegistroDiferido: MOTIVO, temporada },
    }).commit(),
  );
  const guardado = await getDoc(doc(db, RUTAS.prestamo(id)));
  assert.equal(guardado.data().salidaDia, '2026-10-10');
  assert.equal(guardado.data().plazoSabados, 2);
  assert.equal(guardado.data().venceEl.toMillis(), vencimientos[1].toMillis());
  assert.equal(guardado.data().temporada, temporada);
  // El registro lleva la hora de ahora, no la del sábado.
  assert.ok(guardado.data().prestadoEn.toMillis() > Date.now() - 60_000);
});

test('P-50 el diferido se deniega al voluntario, sin motivo suficiente y fuera del calendario', async () => {
  await sembrarCalendario(entorno, '2026-10-10', {
    inicio: new Date(Date.now() - 3 * 86_400_000),
    finExclusivo: new Date(Date.now() - 2 * 86_400_000),
  });
  const comoAdmin = comoCuenta(entorno, ADMIN);
  const { vencimientos, temporada } = await delCalendario(comoAdmin, '2026-10-10');
  const diferido = { registroDiferido: true, motivoRegistroDiferido: MOTIVO, temporada };

  // Un voluntario no registra diferido, aunque traiga el motivo.
  await assertFails(
    loteDeAlta(comoCuenta(entorno, VOLUNTARIA), VOLUNTARIA, {
      id: ID('1'),
      venceEl: vencimientos[1],
      extras: diferido,
    }).commit(),
  );

  // El administrador tampoco, si el motivo no llega a diez caracteres.
  await assertFails(
    loteDeAlta(comoAdmin, ADMIN, {
      id: ID('2'),
      venceEl: vencimientos[1],
      extras: { ...diferido, motivoRegistroDiferido: 'corto' },
    }).commit(),
  );

  // Un día que no es sábado no tiene documento de calendario: nada que copiar.
  await assertFails(
    loteDeAlta(comoAdmin, ADMIN, {
      id: ID('3'),
      venceEl: vencimientos[1],
      extras: { ...diferido, salidaDia: '2026-10-13' },
    }).commit(),
  );

  // Un sábado futuro: su ventana todavía no empieza.
  await sembrarCalendario(entorno, '2026-10-17', {
    inicio: new Date(Date.now() + 5 * 86_400_000),
    finExclusivo: new Date(Date.now() + 6 * 86_400_000),
  });
  const futuro = await delCalendario(comoAdmin, '2026-10-17');
  await assertFails(
    loteDeAlta(comoAdmin, ADMIN, {
      id: ID('4'),
      venceEl: futuro.vencimientos[1],
      extras: { ...diferido, salidaDia: '2026-10-17', temporada: futuro.temporada },
    }).commit(),
  );
});

test('P-11 una temporada o un vencimiento que no son los del calendario se deniegan', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  const { vencimientos, temporada } = await delCalendario(db, '2026-10-10');
  assert.equal(temporada, '2026-5');

  // Temporada que no es la del calendario.
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, {
      id: ID('1'),
      venceEl: vencimientos[1],
      extras: { temporada: '2026-6' },
    }).commit(),
  );

  // Vencimiento de otro plazo que el declarado: dice dos sábados y trae el de tres.
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, { id: ID('2'), venceEl: vencimientos[2] }).commit(),
  );
});

test('P-48 un préstamo normal un martes se deniega en reglas', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  const { vencimientos } = await delCalendario(db, '2026-10-10');
  // Un martes no tiene documento de calendario: no hay de dónde copiar.
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, {
      id: ID('1'),
      venceEl: vencimientos[1],
      extras: { salidaDia: '2026-10-13' },
    }).commit(),
  );
});

test('P-51 dos préstamos no pueden compartir un único incremento del contador', async () => {
  await sembrarLibro(entorno, 'INF002');
  const db = comoCuenta(entorno, VOLUNTARIA);
  const { vencimientos } = await delCalendario(db, '2026-10-10');
  const uno = ID('a');
  const otro = ID('b');

  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(uno)), datosPrestamo(VOLUNTARIA, { numero: 1, venceEl: vencimientos[1] }));
  lote.set(
    doc(db, RUTAS.prestamo(otro)),
    datosPrestamo(VOLUNTARIA, { numero: 1, libro: 'INF002', venceEl: vencimientos[1] }),
  );
  lote.update(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: uno, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.libro('INF002')), { prestamoAbierto: otro, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: uno });
  await assertFails(lote.commit());
});

test('P-52 el contador aislado, vecesPrestado arbitrario y el libro sin transición válida se deniegan', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: ID('z') }));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF001')), { vecesPrestado: 5 }));
  await assertFails(
    updateDoc(doc(db, RUTAS.libro('INF001')), { prestamoAbierto: ID('q'), vecesPrestado: 1 }),
  );
});

test('P-53 la devolución se guarda con la hora del servidor, no con la que trajo el cliente', async () => {
  const id = await prestarOk();
  const db = comoCuenta(entorno, VOLUNTARIA);

  // La hora de cuando se tocó el botón, cinco minutos antes de confirmar.
  await assertFails(
    loteDeDevolver(db, id, { devueltoEn: new Date(Date.now() - 5 * 60 * 1000) }).commit(),
  );

  await assertSucceeds(loteDeDevolver(db, id).commit());
  const guardado = await getDoc(doc(db, RUTAS.prestamo(id)));
  // «A tiempo» queda nulo: se calcula con la hora definitiva, no se adelanta.
  assert.equal(guardado.data().devueltoATiempo, null);
  assert.ok(guardado.data().devueltoEn.toMillis() > Date.now() - 60_000);
});

test('P-56 el vencimiento sale del calendario y request.time decide la aceptación', async () => {
  // Sábado del cambio de hora en Chile (el mismo de P-12).
  await sembrarCalendario(entorno, '2026-04-04');
  const db = comoCuenta(entorno, VOLUNTARIA);
  const { vencimientos, temporada } = await delCalendario(db, '2026-04-04');
  const cuatroSabados = { salidaDia: '2026-04-04', plazoSabados: 4, temporada };

  // Un milisegundo después del límite del calendario: denegado.
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, {
      id: ID('1'),
      venceEl: new Date(vencimientos[3].toMillis() + 1),
      extras: cuatroSabados,
    }).commit(),
  );

  // El límite exacto del calendario: aceptado.
  await assertSucceeds(
    loteDeAlta(db, VOLUNTARIA, { id: ID('2'), venceEl: vencimientos[3], extras: cuatroSabados }).commit(),
  );

  // Mismo documento, misma forma, ventana cerrada: decide request.time.
  await sembrarLibro(entorno, 'INF002');
  await sembrarCalendario(entorno, '2026-04-04', {
    inicio: new Date(Date.now() - 3 * 86_400_000),
    finExclusivo: new Date(Date.now() - 2 * 86_400_000),
  });
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, {
      id: ID('3'),
      numero: 2,
      libro: 'INF002',
      venceEl: vencimientos[3],
      extras: cuatroSabados,
    }).commit(),
  );
});

test('P-58 registrar desde papel un libro ya prestado se deniega y conserva el préstamo existente', async () => {
  const existente = await prestarOk();
  await sembrarCalendario(entorno, '2026-10-10', {
    inicio: new Date(Date.now() - 3 * 86_400_000),
    finExclusivo: new Date(Date.now() - 2 * 86_400_000),
  });
  const db = comoCuenta(entorno, ADMIN);
  const { vencimientos, temporada } = await delCalendario(db, '2026-10-10');

  await assertFails(
    loteDeAlta(db, ADMIN, {
      id: ID('2'),
      numero: 2,
      vecesAntes: 1,
      venceEl: vencimientos[1],
      extras: { registroDiferido: true, motivoRegistroDiferido: MOTIVO, temporada },
    }).commit(),
  );

  const libro = await getDoc(doc(db, RUTAS.libro('INF001')));
  assert.equal(libro.data().prestamoAbierto, existente);
  assert.equal(libro.data().vecesPrestado, 1);
});
