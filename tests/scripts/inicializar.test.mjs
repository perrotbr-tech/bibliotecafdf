// A-28: `scripts/inicializar.mjs` sobre base vacía y sobre base ya inicializada.
//
// Esta prueba necesita el emulador de Firestore (usa Admin SDK), pero no prueba
// reglas de seguridad: por eso vive en tests/scripts/ y no en tests/reglas/.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { rutas } from '../../docs/js/config-publica.js';
import { comprobarDestino } from '../../scripts/inicializar.mjs';

const ejecutar = promisify(execFile);
const RAIZ = join(import.meta.dirname, '..', '..');
const PROYECTO = 'demo-biblioteca';
const CORREO = 'dueno@example.com';

const ENTORNO = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
  GOOGLE_CLOUD_PROJECT: PROYECTO,
};

let db;

before(async () => {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  process.env.FIRESTORE_EMULATOR_HOST = ENTORNO.FIRESTORE_EMULATOR_HOST;
  if (getApps().length === 0) initializeApp({ projectId: PROYECTO });
  db = getFirestore();
});

after(async () => {
  await borrarTodo();
});

beforeEach(async () => {
  await borrarTodo();
});

async function borrarTodo() {
  if (!db) return;
  for (const ruta of [rutas.configApp(), rutas.configContadores(), rutas.configControl()]) {
    await db.doc(ruta).delete();
  }
  const voluntarios = await db.collection(rutas.voluntarios()).get();
  await Promise.all(voluntarios.docs.map((d) => d.ref.delete()));
}

function correr(extra = []) {
  return ejecutar(
    process.execPath,
    [join(RAIZ, 'scripts', 'inicializar.mjs'), '--correo', CORREO, '--nombre', 'Dueño', ...extra],
    { env: ENTORNO, cwd: RAIZ },
  );
}

test('A-28 sobre una base vacía crea los cuatro documentos', async () => {
  const { stdout } = await correr();
  assert.match(stdout, /4 creado\(s\), 0 intacto\(s\)/);
  assert.match(stdout, /inicioJuego = \d{4}-[1-6]/);

  const app = await db.doc(rutas.configApp()).get();
  assert.equal(app.exists, true);
  assert.equal(app.data().nombreBiblioteca, 'Biblioteca');
  assert.equal(app.data().plazoSabadosPorDefecto, 2);
  assert.equal(app.data().categorias.length, 6);
  assert.deepEqual(
    app.data().categorias.map((c) => c.prefijo),
    ['INF', 'HM', 'FAM', 'VC', 'NV', 'TEO'],
  );
  assert.equal(app.data().juegoCerradoAlgunaVez, false);
  assert.match(app.data().inicioJuego, /^\d{4}-[1-6]$/u);
  assert.ok(app.data().creadoEn, 'creadoEn con hora del servidor');

  const contadores = await db.doc(rutas.configContadores()).get();
  assert.equal(contadores.data().ultimoPrestamo, 0);
  assert.equal(contadores.data().ultimoLector, 0);
  assert.equal(contadores.data().ultimoPrestamoId, null);
  assert.equal(contadores.data().ultimoLectorId, null);

  const control = await db.doc(rutas.configControl()).get();
  assert.equal(control.data().bloqueo, null);

  const admin = await db.doc(rutas.voluntario(CORREO)).get();
  assert.equal(admin.data().rol, 'admin');
  assert.equal(admin.data().activo, true);
  assert.equal(admin.data().nombre, 'Dueño');
  assert.equal(admin.data().ultimaConexion, null);
  assert.equal(admin.data().sincronizacionId, null);
});

test('A-28 la segunda vez no cambia nada y lo informa', async () => {
  await correr();
  const antes = await db.doc(rutas.configApp()).get();

  await db.doc(rutas.configApp()).update({ nombreBiblioteca: 'Biblioteca Central' });
  const { stdout } = await correr();

  assert.match(stdout, /0 creado\(s\), 4 intacto\(s\)/);
  assert.match(stdout, /ya existía/);

  const despues = await db.doc(rutas.configApp()).get();
  // No tocó el documento: conserva el nombre que alguien cambió.
  assert.equal(despues.data().nombreBiblioteca, 'Biblioteca Central');
  assert.equal(despues.data().creacionId, antes.data().creacionId);
});

test('A-28 una base a medio inicializar se completa sin tocar lo que ya estaba', async () => {
  await correr();
  await db.doc(rutas.configControl()).delete();

  const { stdout } = await correr();
  assert.match(stdout, /1 creado\(s\), 3 intacto\(s\)/);
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
});

test('A-28 el correo se guarda normalizado', async () => {
  await ejecutar(
    process.execPath,
    [join(RAIZ, 'scripts', 'inicializar.mjs'), '--correo', '  Dueno@Example.COM ', '--nombre', 'Dueño'],
    { env: ENTORNO, cwd: RAIZ },
  );
  assert.equal((await db.doc(rutas.voluntario('dueno@example.com')).get()).exists, true);
});

test('A-28 sin correo o con correo inválido falla sin escribir', async () => {
  await assert.rejects(
    () => ejecutar(process.execPath, [join(RAIZ, 'scripts', 'inicializar.mjs')], { env: ENTORNO, cwd: RAIZ }),
    /Faltan datos del primer administrador|code 2/,
  );
  await assert.rejects(
    () =>
      ejecutar(
        process.execPath,
        [join(RAIZ, 'scripts', 'inicializar.mjs'), '--correo', 'no-es-correo', '--nombre', 'X'],
        { env: ENTORNO, cwd: RAIZ },
      ),
    /forma inválida/,
  );
  assert.equal((await db.doc(rutas.configApp()).get()).exists, false);
});

test('el script no escribe en un proyecto real sin la bandera del dueño', () => {
  assert.throws(
    () => comprobarDestino({ proyecto: 'biblioteca-real', confirmaProyectoReal: false, entorno: {} }),
    /no es un proyecto de emulador/,
  );
  // Con la bandera sí, siempre que no haya variables de emulador sueltas.
  assert.deepEqual(comprobarDestino({ proyecto: 'biblioteca-real', confirmaProyectoReal: true, entorno: {} }), {
    proyecto: 'biblioteca-real',
    destino: 'real',
  });
  assert.throws(
    () =>
      comprobarDestino({
        proyecto: 'biblioteca-real',
        confirmaProyectoReal: true,
        entorno: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
      }),
    /variables de emulador/,
  );
});

test('un proyecto demo exige los dos hosts de emulador', () => {
  assert.throws(
    () => comprobarDestino({ proyecto: PROYECTO, confirmaProyectoReal: false, entorno: {} }),
    /FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST/,
  );
  assert.throws(
    () =>
      comprobarDestino({
        proyecto: PROYECTO,
        confirmaProyectoReal: false,
        entorno: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
      }),
    /FIREBASE_AUTH_EMULATOR_HOST/,
  );
  assert.deepEqual(
    comprobarDestino({
      proyecto: PROYECTO,
      confirmaProyectoReal: false,
      entorno: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    }),
    { proyecto: PROYECTO, destino: 'emulador' },
  );
});
