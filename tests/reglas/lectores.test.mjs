// Reglas de `lectores`, `lectoresClave` y `config/contadores`: C-08, C-09,
// C-11, C-16, C-17, C-18, C-21, C-23, C-24, C-37, C-38 y C-43.
//
// Aquí vive el enlace bidireccional del contrato §3: el contador exige que el
// lector enlazado sea nuevo y tenga el número correcto, y el lector exige que
// el contador lo enlace a él. Las dos mitades se prueban rompiendo una pieza
// cada vez.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

import {
  ADMIN,
  AJENA,
  ID,
  INACTIVO,
  RUTAS,
  VOLUNTARIA,
  abrirEntorno,
  bloqueoMantenimiento,
  comoCuenta,
  loteDeAlta,
  sembrarBase,
  sembrarLector,
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
});

const metadatos = () => ({ ultimaOperacionId: ID('1'), modificadoEn: serverTimestamp() });

/** Lo que quedó escrito, leído sin pasar por reglas. */
async function leer(ruta) {
  let datos = null;
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    datos = (await contexto.firestore().doc(ruta).get()).data() ?? null;
  });
  return datos;
}

// ------------------------------------------------------------------ lectura

test('los lectores y sus claves los lee cualquier voluntario activo, y nadie más', async () => {
  await sembrarLector(entorno, 'L001');
  for (const ruta of [RUTAS.lector('L001'), RUTAS.clave('rafaela toledo'), RUTAS.contadores]) {
    await assertSucceeds(getDoc(doc(comoCuenta(entorno, VOLUNTARIA), ruta)));
    await assertFails(getDoc(doc(comoCuenta(entorno, INACTIVO), ruta)));
    await assertFails(getDoc(doc(comoCuenta(entorno, AJENA), ruta)));
  }
});

// --------------------------------------------------------------------- alta

test('un alta de lector crea el lector, su clave y sube el contador a la vez', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertSucceeds(loteDeAlta(db, VOLUNTARIA).commit());

  const lector = await leer(RUTAS.lector('L001'));
  assert.equal(lector.nombre, 'Rafaela Toledo');
  assert.equal(lector.clave, 'rafaela toledo');
  assert.equal(lector.telefono, null);
  assert.equal(lector.esDestinoFusion, false);
  assert.equal(lector.fusionadoEn, null);
  assert.equal(lector.avisoDatos.por, VOLUNTARIA);
  assert.ok(lector.avisoDatos.fecha, 'el aviso lleva la hora del servidor');

  assert.deepEqual(await leer(RUTAS.clave('rafaela toledo')), {
    lector: 'L001',
    creadoEn: (await leer(RUTAS.clave('rafaela toledo'))).creadoEn,
    creadoPor: VOLUNTARIA,
    creacionId: ID('b'),
  });

  const contadores = await leer(RUTAS.contadores);
  assert.equal(contadores.ultimoLector, 1);
  assert.equal(contadores.ultimoLectorId, 'L001');
  assert.equal(contadores.ultimoPrestamo, 0);
  assert.equal(contadores.ultimoPrestamoId, null);
});

test('el correlativo pasa de tres cifras cuando corresponde', async () => {
  // Con el contador en 999, el alta siguiente es L1000, no L0999 ni L999.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.contadores).update({ ultimoLector: 999, ultimoLectorId: 'L999' });
  });
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(loteDeAlta(db, VOLUNTARIA, { numero: 1000, id: 'L0999' }).commit());
  await assertSucceeds(loteDeAlta(db, VOLUNTARIA, { numero: 1000 }).commit());
  assert.equal((await leer(RUTAS.contadores)).ultimoLectorId, 'L1000');
});

test('C-21 un lector sin su clave, sin su contador o con el contador saltado queda denegado', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);

  // Sin el documento de clave.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { conClave: false }).commit());
  // Sin subir el contador.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { conContador: false }).commit());
  // Saltándose un número: el contador está en 0 y se pretende el L002.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { numero: 2 }).commit());
  // El identificador no corresponde al número del contador.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { id: 'L002', idEnContador: 'L002', numeroEnContador: 1 }).commit());
  // El contador sube pero enlaza a otro documento.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { idEnContador: 'L002' }).commit());
  // La clave existe pero apunta a otro lector.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { lectorEnClave: 'L002' }).commit());
  // El documento de clave no es el de la clave del lector.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { documentoDeClave: 'otra persona' }).commit());
  // El identificador no tiene la forma de base §5.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { id: 'L1', idEnContador: 'L1' }).commit());

  // Y nada de eso dejó nada a medias.
  assert.equal(await leer(RUTAS.lector('L001')), null);
  assert.equal((await leer(RUTAS.contadores)).ultimoLector, 0);
});

test('C-38 subir el contador sin crear un lector, o crear dos con un incremento, queda denegado', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);

  // El contador solo, sin lector nuevo: `getAfter` no encuentra el documento.
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoLector: 1, ultimoLectorId: 'L001' }));

  // Enlazado a un lector que YA existía: no es nuevo.
  await sembrarLector(entorno, 'L001');
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoLector: 1, ultimoLectorId: 'L001' }));

  // Dos lectores con un solo incremento: el segundo exige que el contador lo
  // enlace a él, y el contador solo puede enlazar a uno.
  await entorno.clearFirestore();
  await sembrarBase(entorno);
  const dos = writeBatch(db);
  for (const [id, clave] of [
    ['L001', 'rafaela toledo'],
    ['L002', 'maria jose perez'],
  ]) {
    dos.set(doc(db, RUTAS.lector(id)), {
      nombre: clave === 'rafaela toledo' ? 'Rafaela Toledo' : 'María José Pérez',
      clave,
      telefono: null,
      avisoDatos: { fecha: serverTimestamp(), por: VOLUNTARIA },
      fusionadoEn: null,
      esDestinoFusion: false,
      creadoEn: serverTimestamp(),
      creadoPor: VOLUNTARIA,
      creacionId: ID('a'),
    });
    dos.set(doc(db, RUTAS.clave(clave)), {
      lector: id,
      creadoEn: serverTimestamp(),
      creadoPor: VOLUNTARIA,
      creacionId: ID('b'),
    });
  }
  dos.update(doc(db, RUTAS.contadores), { ultimoLector: 1, ultimoLectorId: 'L001' });
  await assertFails(dos.commit());
  assert.equal(await leer(RUTAS.lector('L001')), null);
});

test('el contador de lectores no toca el de préstamos, ni baja, ni salta', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  // Dos de golpe.
  await assertFails(loteDeAlta(db, VOLUNTARIA, { numeroEnContador: 2 }).commit());
  // Hacia atrás.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.contadores).update({ ultimoLector: 5, ultimoLectorId: 'L005' });
  });
  await assertFails(loteDeAlta(db, VOLUNTARIA, { numero: 5, numeroEnContador: 4, idEnContador: 'L004' }).commit());
  // Arrastrando el contador de préstamos.
  const conPrestamo = loteDeAlta(db, VOLUNTARIA, { numero: 6 });
  conPrestamo.update(doc(db, RUTAS.contadores), { ultimoPrestamo: 1 });
  await assertFails(conPrestamo.commit());
});

test('C-09 una clave ya ocupada no se puede volver a crear', async () => {
  // «  rafaela   TOLEDO » da la misma clave que «Rafaela Toledo», así que el
  // alta choca con un documento que ya existe y `create` no se aplica.
  await sembrarLector(entorno, 'L001', { numero: 1 });
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(loteDeAlta(db, VOLUNTARIA, { numero: 2, nombre: '  rafaela   TOLEDO ' }).commit());
  assert.equal(await leer(RUTAS.lector('L002')), null);
});

test('C-11 un nombre o una clave sin tres letras se deniega también en el servidor', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  for (const clave of ['a b', 'ab', '123', 'a 1 b']) {
    await assertFails(loteDeAlta(db, VOLUNTARIA, { nombre: 'Nombre cualquiera', clave }).commit(), clave);
  }
  // Y la forma de la clave: sin mayúsculas, sin tildes, sin espacios dobles
  // ni en los extremos.
  for (const clave of ['Rafaela', 'rafaéla', 'rafaela  toledo', ' rafaela', 'rafaela ', 'rafaela-toledo']) {
    await assertFails(loteDeAlta(db, VOLUNTARIA, { clave }).commit(), clave);
  }
  // La ñ sí es parte del alfabeto de una clave.
  await assertSucceeds(loteDeAlta(db, VOLUNTARIA, { nombre: 'Peña', clave: 'peña' }).commit());
  // Un nombre de 61 caracteres, no.
  await assertFails(
    loteDeAlta(db, VOLUNTARIA, { numero: 2, nombre: 'x'.repeat(61), clave: 'xxx' }).commit(),
  );
});

test('C-16 y C-17 el teléfono: nulo sí, un texto cualquiera no', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertSucceeds(loteDeAlta(db, VOLUNTARIA, { telefono: '56900000012' }).commit());
  for (const malo of ['900000012', '12345', 'no tiene', '5690000001234', 56900000012]) {
    await assertFails(
      loteDeAlta(db, VOLUNTARIA, { numero: 2, nombre: 'María José', clave: 'maria jose', telefono: malo }).commit(),
      String(malo),
    );
  }
});

test('C-18 el alta exige el aviso de datos con la hora del servidor y el correo', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  // La casilla obligatoria no se salta ocultando el botón: el servidor exige
  // el aviso completo.
  for (const aviso of [
    null,
    { por: VOLUNTARIA },
    { fecha: new Date(), por: VOLUNTARIA },
    { fecha: serverTimestamp(), por: ADMIN },
    { fecha: serverTimestamp(), por: VOLUNTARIA, extra: 1 },
  ]) {
    await assertFails(loteDeAlta(db, VOLUNTARIA, { avisoDatos: aviso }).commit(), JSON.stringify(aviso));
  }
});

test('un alta nace sin unión y con los metadatos de creación correctos', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  for (const lector of [
    { esDestinoFusion: true },
    { fusionadoEn: 'L002' },
    { creadoEn: new Date() },
    { creadoPor: ADMIN },
    { creacionId: 'no-es-un-id' },
    { ranking: 1 },
  ]) {
    await assertFails(loteDeAlta(db, VOLUNTARIA, { lector }).commit(), JSON.stringify(lector));
  }
});

// ------------------------------------------------------------------ cambios

test('C-23 un voluntario cambia el teléfono de un lector; el nombre no', async () => {
  await sembrarLector(entorno, 'L001', { numero: 1 });
  const db = comoCuenta(entorno, VOLUNTARIA);

  await assertSucceeds(updateDoc(doc(db, RUTAS.lector('L001')), { telefono: '56900000012', ...metadatos() }));
  await assertSucceeds(updateDoc(doc(db, RUTAS.lector('L001')), { telefono: null, ...metadatos() }));

  await assertFails(updateDoc(doc(db, RUTAS.lector('L001')), { telefono: '12345', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'Otra Persona', ...metadatos() }));
  await assertFails(
    updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'Otra', clave: 'otra', ...metadatos() }),
  );
  await assertFails(updateDoc(doc(db, RUTAS.lector('L001')), { telefono: '56900000012' }));
  await assertFails(updateDoc(doc(db, RUTAS.lector('L001')), { esDestinoFusion: true, ...metadatos() }));
});

test('C-24 el administrador cambia el nombre; la clave antigua sigue reservada', async () => {
  await sembrarLector(entorno, 'L001', { numero: 1 });
  const db = comoCuenta(entorno, ADMIN);

  const lote = writeBatch(db);
  lote.update(doc(db, RUTAS.lector('L001')), {
    nombre: 'Rafaela Toledo Soto',
    clave: 'rafaela toledo soto',
    ...metadatos(),
  });
  lote.set(doc(db, RUTAS.clave('rafaela toledo soto')), {
    lector: 'L001',
    creadoEn: serverTimestamp(),
    creadoPor: ADMIN,
    creacionId: ID('c'),
  });
  await assertSucceeds(lote.commit());

  assert.equal((await leer(RUTAS.lector('L001'))).clave, 'rafaela toledo soto');
  // La clave antigua no se libera: el nombre anterior queda reservado.
  assert.equal((await leer(RUTAS.clave('rafaela toledo'))).lector, 'L001');

  // Cambiar el nombre sin crear la clave nueva queda denegado.
  await assertFails(
    updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'Rafaela T.', clave: 'rafaela t', ...metadatos() }),
  );
});

test('C-37 corregir una tilde o volver al nombre anterior no toca ningún documento de clave', async () => {
  await sembrarLector(entorno, 'L001', { nombre: 'Maria Lagos', clave: 'maria lagos', numero: 1 });
  const db = comoCuenta(entorno, ADMIN);

  // «Maria Lagos» → «María Lagos»: la clave no cambia, así que es una sola
  // escritura y no hace falta mirar ningún otro documento.
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'María Lagos', clave: 'maria lagos', ...metadatos() }),
  );
  // Y de vuelta.
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'Maria Lagos', clave: 'maria lagos', ...metadatos() }),
  );
  assert.equal((await leer(RUTAS.clave('maria lagos'))).lector, 'L001');

  // Un nombre antiguo que ya tiene su clave apuntando a este lector se puede
  // recuperar sin crear nada.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const sinReglas = contexto.firestore();
    await sinReglas.doc(RUTAS.lector('L001')).update({ nombre: 'María Lagos Soto', clave: 'maria lagos soto' });
    await sinReglas
      .doc(RUTAS.clave('maria lagos soto'))
      .set({ lector: 'L001', creadoEn: new Date(), creadoPor: ADMIN });
  });
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.lector('L001')), { nombre: 'María Lagos', clave: 'maria lagos', ...metadatos() }),
  );
});

test('C-43 una clave existente no se redirige a otro lector, ni por el administrador', async () => {
  await sembrarLector(entorno, 'L001', { numero: 1 });
  await sembrarLector(entorno, 'L002', { nombre: 'María José Pérez', clave: 'maria jose perez', numero: 2 });

  for (const correo of [ADMIN, VOLUNTARIA]) {
    const db = comoCuenta(entorno, correo);
    await assertFails(updateDoc(doc(db, RUTAS.clave('rafaela toledo')), { lector: 'L002' }));
    await assertFails(setDoc(doc(db, RUTAS.clave('rafaela toledo')), { lector: 'L002' }));
    // Tampoco cambiando el nombre del lector hacia una clave ajena: es el
    // «Ya existe» comprobado por el servidor.
    await assertFails(
      updateDoc(doc(db, RUTAS.lector('L001')), {
        nombre: 'María José Pérez',
        clave: 'maria jose perez',
        ...metadatos(),
      }),
    );
  }
  assert.equal((await leer(RUTAS.clave('rafaela toledo'))).lector, 'L001');
});

test('C-08 nadie borra un lector ni una clave', async () => {
  await sembrarLector(entorno, 'L001', { numero: 1 });
  for (const correo of [ADMIN, VOLUNTARIA]) {
    const db = comoCuenta(entorno, correo);
    await assertFails(deleteDoc(doc(db, RUTAS.lector('L001'))));
    await assertFails(deleteDoc(doc(db, RUTAS.clave('rafaela toledo'))));
  }
});

test('en mantenimiento no se inscribe ni se cambia un lector, pero se lee', async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno, { bloqueo: bloqueoMantenimiento() });
  await sembrarLector(entorno, 'L001', { numero: 1 });
  const db = comoCuenta(entorno, ADMIN);

  await assertSucceeds(getDoc(doc(db, RUTAS.lector('L001'))));
  await assertFails(loteDeAlta(db, ADMIN, { numero: 2, nombre: 'María José', clave: 'maria jose' }).commit());
  await assertFails(updateDoc(doc(db, RUTAS.lector('L001')), { telefono: '56900000012', ...metadatos() }));
});

test('sin documento de control no se escribe nada', async () => {
  // Contrato §6: la ausencia del control no es permiso, es denegación.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.control).delete();
  });
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(loteDeAlta(db, VOLUNTARIA).commit());
});
