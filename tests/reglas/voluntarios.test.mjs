// Reglas de `voluntarios`: A-01 a A-06, A-08 a A-11, A-14, A-21, A-34, A-38, A-40.
// Contra el emulador, con las reglas reales del repositorio.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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
  sembrarBase,
  sinSesion,
} from '../ayuda/reglas.mjs';
import { BIB } from '../../docs/js/config-publica.js';

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

/** Documento de alta bien formado, como lo manda la app. */
function altaValida({ nombre = 'Nueva', rol = 'voluntario', activo = true, creacionId = ID('1') } = {}) {
  return {
    nombre,
    rol,
    activo,
    creadoEn: serverTimestamp(),
    creadoPor: ADMIN,
    creacionId,
    ultimaConexion: null,
    sincronizacionId: null,
  };
}

test('A-01 sin sesión no se lee voluntarios ni config/app', async () => {
  const db = sinSesion(entorno);
  await assertFails(getDoc(doc(db, RUTAS.voluntario(ADMIN))));
  await assertFails(getDoc(doc(db, RUTAS.app)));
  await assertFails(getDocs(collection(db, `bibliotecas/${BIB}/voluntarios`)));
});

test('A-02 una cuenta que no está en la lista no lee nada', async () => {
  const db = comoCuenta(entorno, AJENA);
  await assertFails(getDoc(doc(db, RUTAS.voluntario(ADMIN))));
  await assertFails(getDoc(doc(db, RUTAS.app)));
  await assertFails(getDoc(doc(db, RUTAS.contadores)));
  await assertFails(getDoc(doc(db, RUTAS.control)));
  // Tampoco su propio documento, porque no existe.
  await assertFails(getDoc(doc(db, RUTAS.voluntario(AJENA))));
});

test('A-03 una cuenta con activo falso queda denegada', async () => {
  const db = comoCuenta(entorno, INACTIVO);
  await assertFails(getDoc(doc(db, RUTAS.voluntario(INACTIVO))));
  await assertFails(getDoc(doc(db, RUTAS.app)));
});

test('A-04 un correo sin verificar queda denegado', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA, { verificado: false });
  await assertFails(getDoc(doc(db, RUTAS.voluntario(VOLUNTARIA))));
  await assertFails(getDoc(doc(db, RUTAS.app)));
});

test('A-05 una voluntaria activa lee voluntarios y config/app', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertSucceeds(getDocs(collection(db, `bibliotecas/${BIB}/voluntarios`)));
  await assertSucceeds(getDoc(doc(db, RUTAS.app)));
  await assertSucceeds(getDoc(doc(db, RUTAS.contadores)));
  await assertSucceeds(getDoc(doc(db, RUTAS.control)));
});

test('A-06 una voluntaria no crea voluntarios ni cambia rol o estado de nadie', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(setDoc(doc(db, RUTAS.voluntario('nueva@example.com')), altaValida()));
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(INACTIVO)), {
      activo: true,
      ultimaOperacionId: ID('2'),
      modificadoEn: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      rol: 'admin',
      ultimaOperacionId: ID('2'),
      modificadoEn: serverTimestamp(),
    }),
  );
});

test('A-08 un administrador agrega un voluntario con rol válido', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(setDoc(doc(db, RUTAS.voluntario('nueva@example.com')), altaValida()));
  await assertSucceeds(
    setDoc(doc(db, RUTAS.voluntario('otra@example.com')), altaValida({ rol: 'admin', creacionId: ID('3') })),
  );
});

test('A-09 un alta con rol inválido, sin nombre o con nombre largo queda denegada', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(setDoc(doc(db, RUTAS.voluntario('jefe@example.com')), altaValida({ rol: 'jefe' })));

  const sinNombre = altaValida();
  delete sinNombre.nombre;
  await assertFails(setDoc(doc(db, RUTAS.voluntario('sinnombre@example.com')), sinNombre));

  await assertFails(setDoc(doc(db, RUTAS.voluntario('vacio@example.com')), altaValida({ nombre: '' })));
  await assertFails(setDoc(doc(db, RUTAS.voluntario('largo@example.com')), altaValida({ nombre: 'x'.repeat(61) })));
});

test('A-09 un alta sin creacionId, con creacionId mal formado o con hora del teléfono queda denegada', async () => {
  const db = comoCuenta(entorno, ADMIN);

  const sinId = altaValida();
  delete sinId.creacionId;
  await assertFails(setDoc(doc(db, RUTAS.voluntario('a@example.com')), sinId));

  await assertFails(setDoc(doc(db, RUTAS.voluntario('b@example.com')), altaValida({ creacionId: 'ABC' })));

  await assertFails(
    setDoc(doc(db, RUTAS.voluntario('c@example.com')), { ...altaValida(), creadoEn: new Date('2020-01-01T00:00:00Z') }),
  );
});

test('A-08 el identificador tiene que venir en minúsculas', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(setDoc(doc(db, RUTAS.voluntario('Ana.Rojas@Example.com')), altaValida()));
  await assertSucceeds(setDoc(doc(db, RUTAS.voluntario('ana.rojas@example.com')), altaValida()));
});

test('A-10 un administrador no se desactiva ni se quita el rol a sí mismo', async () => {
  const db = comoCuenta(entorno, ADMIN);
  const metadatos = { ultimaOperacionId: ID('4'), modificadoEn: serverTimestamp() };

  await assertFails(updateDoc(doc(db, RUTAS.voluntario(ADMIN)), { activo: false, ...metadatos }));
  await assertFails(updateDoc(doc(db, RUTAS.voluntario(ADMIN)), { rol: 'voluntario', ...metadatos }));
  // Cambiarse el nombre sí puede.
  await assertSucceeds(updateDoc(doc(db, RUTAS.voluntario(ADMIN)), { nombre: 'Eduardo P.', ...metadatos }));
});

test('A-10 un administrador sí desactiva y reactiva a otra persona', async () => {
  const db = comoCuenta(entorno, ADMIN);
  const metadatos = { ultimaOperacionId: ID('5'), modificadoEn: serverTimestamp() };
  await assertSucceeds(updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { activo: false, ...metadatos }));
  await assertSucceeds(updateDoc(doc(db, RUTAS.voluntario(INACTIVO)), { activo: true, ...metadatos }));
});

test('A-11 nadie borra un documento de voluntarios', async () => {
  for (const correo of [ADMIN, VOLUNTARIA]) {
    const db = comoCuenta(entorno, correo);
    await assertFails(deleteDoc(doc(db, RUTAS.voluntario(INACTIVO))));
  }
  await assertFails(deleteDoc(doc(sinSesion(entorno), RUTAS.voluntario(INACTIVO))));
});

test('A-14 un alta sobre un correo que ya está en la lista queda denegada', async () => {
  const db = comoCuenta(entorno, ADMIN);
  // `create` sobre un documento existente no pasa: la clave está ocupada.
  await assertFails(setDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), altaValida({ nombre: 'Otra Ana' })));

  // Y el documento existente no cambió.
  const existente = await getDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.voluntario(VOLUNTARIA)));
  assert.equal(existente.data().nombre, 'Ana');
});

test('A-21 la muestra de hora: con hora del servidor sí, con otra hora no, con rol no', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  const mio = doc(db, RUTAS.voluntario(VOLUNTARIA));

  await assertSucceeds(updateDoc(mio, { ultimaConexion: serverTimestamp(), sincronizacionId: ID('6') }));
  await assertFails(
    updateDoc(mio, { ultimaConexion: new Date('2026-10-10T18:00:00Z'), sincronizacionId: ID('6') }),
  );
  await assertFails(
    updateDoc(mio, { ultimaConexion: serverTimestamp(), sincronizacionId: ID('6'), rol: 'admin' }),
  );
  await assertFails(
    updateDoc(mio, { ultimaConexion: serverTimestamp(), sincronizacionId: ID('6'), activo: false }),
  );
  // Un identificador mal formado tampoco pasa.
  await assertFails(updateDoc(mio, { ultimaConexion: serverTimestamp(), sincronizacionId: 'x' }));
  // Y solo en su propio documento.
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(ADMIN)), { ultimaConexion: serverTimestamp(), sincronizacionId: ID('6') }),
  );
});

test('A-34 la muestra de hora de otra cuenta no se puede escribir en su documento', async () => {
  // Dos teléfonos de la MISMA cuenta pueden escribir; lo que nadie puede es
  // escribir la muestra de otra cuenta. Que la muestra ajena no se acepte lo
  // resuelve el reloj comparando el identificador (ver tests/unidad/reloj).
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(INACTIVO)), { ultimaConexion: serverTimestamp(), sincronizacionId: ID('7') }),
  );
});

test('A-38 con mantenimiento vigente se deniegan las escrituras y se conservan lectura y sincronización', async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno, { bloqueo: bloqueoMantenimiento() });

  const admin = comoCuenta(entorno, ADMIN);
  const voluntaria = comoCuenta(entorno, VOLUNTARIA);

  // Mutaciones denegadas.
  await assertFails(setDoc(doc(admin, RUTAS.voluntario('nueva@example.com')), altaValida()));
  await assertFails(
    updateDoc(doc(admin, RUTAS.voluntario(VOLUNTARIA)), {
      activo: false,
      ultimaOperacionId: ID('8'),
      modificadoEn: serverTimestamp(),
    }),
  );

  // Lectura y sincronización de hora siguen disponibles.
  await assertSucceeds(getDocs(collection(voluntaria, `bibliotecas/${BIB}/voluntarios`)));
  await assertSucceeds(getDoc(doc(voluntaria, RUTAS.app)));
  await assertSucceeds(
    updateDoc(doc(voluntaria, RUTAS.voluntario(VOLUNTARIA)), {
      ultimaConexion: serverTimestamp(),
      sincronizacionId: ID('9'),
    }),
  );
});

test('A-38 sin documento de control no se escribe', async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno);
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.control).delete();
  });

  const admin = comoCuenta(entorno, ADMIN);
  await assertFails(setDoc(doc(admin, RUTAS.voluntario('nueva@example.com')), altaValida()));
  // La lectura sigue permitida.
  await assertSucceeds(getDoc(doc(admin, RUTAS.app)));
});

test('A-40 un campo fuera de la lista permitida se deniega aunque lleve un operacionId válido', async () => {
  const db = comoCuenta(entorno, ADMIN);
  const metadatos = { ultimaOperacionId: ID('a'), modificadoEn: serverTimestamp() };

  // Campo inventado.
  await assertFails(updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { telefono: '56900000001', ...metadatos }));
  // Metadatos de creación, que son inmutables.
  await assertFails(updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { creacionId: ID('b'), ...metadatos }));
  await assertFails(updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { creadoPor: ADMIN, ...metadatos }));
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { creadoEn: serverTimestamp(), ...metadatos }),
  );
  // La muestra de hora de otra persona no se cuela por la puerta del admin.
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { ultimaConexion: serverTimestamp(), ...metadatos }),
  );
  // Un alta con un campo de más tampoco.
  await assertFails(
    setDoc(doc(db, RUTAS.voluntario('extra@example.com')), { ...altaValida(), telefono: '56900000001' }),
  );
});

test('A-40 un cambio sin metadatos de operación queda denegado', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { nombre: 'Ana María' }));
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), { nombre: 'Ana María', ultimaOperacionId: ID('c') }),
  );
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      nombre: 'Ana María',
      ultimaOperacionId: 'no-es-un-id',
      modificadoEn: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      nombre: 'Ana María',
      ultimaOperacionId: ID('c'),
      modificadoEn: new Date('2026-10-10T18:00:00Z'),
    }),
  );
});
