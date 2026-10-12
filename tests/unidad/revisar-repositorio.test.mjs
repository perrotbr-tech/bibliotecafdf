// A-29: el escáner del repositorio.
//
// El número no ficticio se arma por partes a propósito: la fila A-29 exige que
// «el archivo con el número no ficticio nunca se versiona», y este archivo de
// prueba sí está versionado. Escrito por partes no forma once dígitos seguidos
// en el código fuente, así que el escáner no se delata a sí mismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { revisarRepositorio } from '../../scripts/revisar-repositorio.mjs';

const NO_FICTICIO = '569' + '1' + '2345678'; // once dígitos, no empieza con 5690000
const FICTICIO = '569' + '00000012'; // once dígitos, prefijo de los datos de prueba

// Por el mismo motivo que el teléfono: estas dos formas se arman por partes
// para que este archivo versionado no dispare el escáner que está probando.
const CABECERA_LLAVE = '-----BEGIN ' + 'PRIVATE KEY-----';
const CREDENCIAL = '{ "type": ' + '"service_account" }';

async function carpetaTemporal() {
  return await mkdtemp(join(tmpdir(), 'revisar-repo-'));
}

test('A-29 un archivo con un teléfono chileno no ficticio hace fallar al escáner', async (t) => {
  const raiz = await carpetaTemporal();
  t.after(() => rm(raiz, { recursive: true, force: true }));

  await writeFile(join(raiz, 'lectores.txt'), `Contacto: ${NO_FICTICIO}\n`, 'utf8');

  const hallazgos = await revisarRepositorio(raiz);
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].archivo, 'lectores.txt');
  assert.equal(hallazgos[0].linea, 1);
  assert.match(hallazgos[0].motivo, /teléfono chileno que no es ficticio/);
  // El hallazgo describe el problema sin reproducir el número completo.
  assert.ok(!hallazgos[0].motivo.includes(NO_FICTICIO));
});

test('A-29 un archivo con un teléfono ficticio pasa', async (t) => {
  const raiz = await carpetaTemporal();
  t.after(() => rm(raiz, { recursive: true, force: true }));

  await writeFile(join(raiz, 'fixture.json'), `{ "telefono": "${FICTICIO}" }\n`, 'utf8');

  assert.deepEqual(await revisarRepositorio(raiz), []);
});

test('A-29 un número de más o menos dígitos no es un teléfono', async (t) => {
  const raiz = await carpetaTemporal();
  t.after(() => rm(raiz, { recursive: true, force: true }));

  await writeFile(
    join(raiz, 'ruido.txt'),
    [
      `pegado antes: 1${NO_FICTICIO}`,
      `pegado después: ${NO_FICTICIO}1`,
      'diez dígitos: 5691234567',
      'sin el prefijo: 56012345678',
    ].join('\n'),
    'utf8',
  );

  assert.deepEqual(await revisarRepositorio(raiz), []);
});

test('A-29 un archivo de datos/ versionado hace fallar al escáner', async (t) => {
  const raiz = await carpetaTemporal();
  t.after(() => rm(raiz, { recursive: true, force: true }));

  await mkdir(join(raiz, 'datos'));
  await writeFile(join(raiz, 'datos', 'carga.json'), '{}\n', 'utf8');

  const hallazgos = await revisarRepositorio(raiz);
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].motivo, 'archivo de datos/ versionado');
});

test('A-29 una llave de servicio hace fallar al escáner, por nombre y por contenido', async (t) => {
  const raiz = await carpetaTemporal();
  t.after(() => rm(raiz, { recursive: true, force: true }));

  await writeFile(join(raiz, 'biblioteca.serviceAccount.json'), '{}\n', 'utf8');
  await writeFile(join(raiz, 'credencial.json'), `${CREDENCIAL}\n`, 'utf8');
  await writeFile(join(raiz, 'llave.pem'), `${CABECERA_LLAVE}\nAAAA\n`, 'utf8');

  const hallazgos = await revisarRepositorio(raiz);
  const motivos = hallazgos.map((h) => h.motivo).sort();
  assert.deepEqual(motivos, [
    'credencial de cuenta de servicio',
    'llave privada en el contenido',
    'nombre con forma de llave de servicio',
  ]);
});

test('A-29 el propio repositorio pasa el escáner', async () => {
  const raiz = join(import.meta.dirname, '..', '..');
  assert.deepEqual(await revisarRepositorio(raiz), []);
});
