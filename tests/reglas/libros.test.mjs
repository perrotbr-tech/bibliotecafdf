// Reglas de `libros`: C-01, C-05, C-06, C-07 y C-08, más el bloqueo de
// mantenimiento sobre la colección nueva.
//
// Lo que se prueba aquí es el SERVIDOR: que un voluntario no pueda agregar un
// libro ni con el cliente modificado, y que una edición no pueda mover los
// campos que son de los préstamos.
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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
  sembrarLibro,
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

/** Un libro como lo escribe la pantalla «Agregar libro». */
const libroNuevo = (codigo, correo = ADMIN, campos = {}) => ({
  codigo,
  titulo: 'El Dios pródigo',
  autor: 'Tim Keller',
  categoria: 'Vida Cristiana',
  baja: false,
  prestamoAbierto: null,
  vecesPrestado: 0,
  creadoEn: serverTimestamp(),
  creadoPor: correo,
  creacionId: ID('a'),
  ...campos,
});

test('los libros los lee cualquier voluntario activo, y nadie más', async () => {
  await sembrarLibro(entorno, 'INF006');
  await assertSucceeds(getDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.libro('INF006'))));
  await assertSucceeds(getDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.libro('INF006'))));
  await assertFails(getDoc(doc(comoCuenta(entorno, INACTIVO), RUTAS.libro('INF006'))));
  await assertFails(getDoc(doc(comoCuenta(entorno, AJENA), RUTAS.libro('INF006'))));
  // Con sesión iniciada pero sin el correo verificado tampoco.
  await assertFails(
    getDoc(doc(comoCuenta(entorno, VOLUNTARIA, { verificado: false }), RUTAS.libro('INF006'))),
  );
});

test('C-01 un voluntario no crea ni edita un libro', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(setDoc(doc(db, RUTAS.libro('INF028')), libroNuevo('INF028', VOLUNTARIA)));

  await sembrarLibro(entorno, 'INF006');
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { titulo: 'Otro', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { baja: true, ...metadatos() }));
});

test('un administrador agrega un libro, y el código es el identificador', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(setDoc(doc(db, RUTAS.libro('INF028')), libroNuevo('INF028')));

  // El campo `codigo` tiene que coincidir con el identificador del documento.
  await assertFails(setDoc(doc(db, RUTAS.libro('INF029')), libroNuevo('INF030')));
  // Y el identificador tiene que tener la forma de base §5.
  for (const malo of ['I028', 'INF28', '028', 'INF028AB', 'INFOS0281', 'inf028']) {
    await assertFails(setDoc(doc(db, RUTAS.libro(malo)), libroNuevo(malo)), malo);
  }
});

test('C-05 el título y el autor fuera de rango se deniegan en el servidor', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(setDoc(doc(db, RUTAS.libro('INF101')), libroNuevo('INF101', ADMIN, { titulo: 'ab' })));
  await assertSucceeds(
    setDoc(doc(db, RUTAS.libro('INF102')), libroNuevo('INF102', ADMIN, { titulo: 'x'.repeat(120) })),
  );
  // Un autor vacío sí se acepta: hay libros sin autor en el estante.
  await assertSucceeds(setDoc(doc(db, RUTAS.libro('INF103')), libroNuevo('INF103', ADMIN, { autor: '' })));

  await assertFails(setDoc(doc(db, RUTAS.libro('INF104')), libroNuevo('INF104', ADMIN, { titulo: 'x' })));
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF105')), libroNuevo('INF105', ADMIN, { titulo: 'x'.repeat(121) })),
  );
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF106')), libroNuevo('INF106', ADMIN, { autor: 'x'.repeat(81) })),
  );
  await assertFails(setDoc(doc(db, RUTAS.libro('INF107')), libroNuevo('INF107', ADMIN, { titulo: 42 })));
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF108')), libroNuevo('INF108', ADMIN, { categoria: '' })),
  );
});

test('C-06 un título con etiquetas se guarda tal cual: es texto, no código', async () => {
  // Las reglas no censuran el texto; lo que importa es que la pantalla lo
  // escriba con `textContent`, y eso lo prueba la E2E. Aquí se deja constancia
  // de que el servidor lo acepta y lo devuelve igual.
  const db = comoCuenta(entorno, ADMIN);
  const titulo = '<img src=x onerror=alert(1)>';
  await assertSucceeds(setDoc(doc(db, RUTAS.libro('INF109')), libroNuevo('INF109', ADMIN, { titulo })));
});

test('un libro nace en el estante: sin préstamo, sin cuenta y sin baja', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF110')), libroNuevo('INF110', ADMIN, { prestamoAbierto: 'p1' })),
  );
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF111')), libroNuevo('INF111', ADMIN, { vecesPrestado: 1 })),
  );
  await assertFails(setDoc(doc(db, RUTAS.libro('INF112')), libroNuevo('INF112', ADMIN, { baja: true })));
  // Y con la hora del teléfono o el correo de otra persona, tampoco.
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF113')), libroNuevo('INF113', ADMIN, { creadoEn: new Date() })),
  );
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF114')), libroNuevo('INF114', ADMIN, { creadoPor: VOLUNTARIA })),
  );
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF115')), libroNuevo('INF115', ADMIN, { creacionId: 'no-es-un-id' })),
  );
  // Un campo de más queda fuera de la lista permitida.
  await assertFails(
    setDoc(doc(db, RUTAS.libro('INF116')), libroNuevo('INF116', ADMIN, { prestado: true })),
  );
});

test('C-07 al editar un libro no se mueven prestamoAbierto ni vecesPrestado', async () => {
  await sembrarLibro(entorno, 'INF006', { vecesPrestado: 3 });
  const db = comoCuenta(entorno, ADMIN);

  await assertSucceeds(
    updateDoc(doc(db, RUTAS.libro('INF006')), {
      titulo: 'El Dios pródigo (2.ª edición)',
      autor: 'Timothy Keller',
      categoria: 'Teología',
      baja: true,
      ...metadatos(),
    }),
  );

  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { prestamoAbierto: 'p1', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { vecesPrestado: 4, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { codigo: 'INF007', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { creadoPor: ADMIN, ...metadatos() }));
});

test('editar un libro exige los metadatos de la operación', async () => {
  await sembrarLibro(entorno, 'INF006');
  const db = comoCuenta(entorno, ADMIN);

  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { titulo: 'Sin metadatos' }));
  await assertFails(
    updateDoc(doc(db, RUTAS.libro('INF006')), {
      titulo: 'Con hora del teléfono',
      ultimaOperacionId: ID('1'),
      modificadoEn: new Date(),
    }),
  );
  await assertFails(
    updateDoc(doc(db, RUTAS.libro('INF006')), {
      titulo: 'Con un identificador cualquiera',
      ultimaOperacionId: 'x',
      modificadoEn: serverTimestamp(),
    }),
  );
});

test('C-08 nadie borra un libro, ni el administrador', async () => {
  await sembrarLibro(entorno, 'INF006');
  await assertFails(deleteDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.libro('INF006'))));
  await assertFails(deleteDoc(doc(comoCuenta(entorno, VOLUNTARIA), RUTAS.libro('INF006'))));
});

test('en mantenimiento los libros se leen pero no se tocan', async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno, { bloqueo: bloqueoMantenimiento() });
  await sembrarLibro(entorno, 'INF006');
  const db = comoCuenta(entorno, ADMIN);

  await assertSucceeds(getDoc(doc(db, RUTAS.libro('INF006'))));
  await assertFails(setDoc(doc(db, RUTAS.libro('INF028')), libroNuevo('INF028')));
  await assertFails(updateDoc(doc(db, RUTAS.libro('INF006')), { titulo: 'Otro', ...metadatos() }));
});
