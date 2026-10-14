// Reglas de préstamos: P-01, P-06…P-11, P-19…P-27, P-29, P-48…P-56, R-09…R-11, R-19.
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

test('P-08 libro de baja o ya prestado se deniega', async () => {
  await sembrarLibro(entorno, 'INF002', { baja: true });
  const db = comoCuenta(entorno, VOLUNTARIA);
  const id = ID('c');
  const cal = await getDoc(doc(db, RUTAS.calendario('2026-10-10')));
  const lote = writeBatch(db);
  lote.set(doc(db, RUTAS.prestamo(id)), datosPrestamo(VOLUNTARIA, {
    libro: 'INF002',
    venceEl: cal.data().vencimientos[1],
  }));
  lote.update(doc(db, RUTAS.libro('INF002')), { prestamoAbierto: id, vecesPrestado: 1 });
  lote.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ultimoPrestamoId: id });
  await assertFails(lote.commit());
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

test('P-55 el cliente no escribe el calendario', async () => {
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

test('R-09 anotar recordatorio en abierto', async () => {
  const id = await prestarOk();
  await assertSucceeds(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.prestamo(id)), {
      recordadoEn: serverTimestamp(),
      recordadoPor: VOLUNTARIA,
      ...meta(),
    }),
  );
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

test('R-19 voluntario no cambia plantillas', async () => {
  await assertFails(
    updateDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.app), {
      mensajeAtraso: 'Hola {nombre}, trae el libro «{titulo}» que venció el {fecha}. Gracias!!!!',
      ...meta(),
    }),
  );
});
