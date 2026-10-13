// El servidor estático de desarrollo. No es parte de la app publicada, pero sí
// es lo que sostiene `npm start` y las pruebas de extremo a extremo: si se cae,
// se cae toda la corrida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { rutaDeArchivo } from '../../scripts/servir.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');

test('una dirección normal apunta a su archivo dentro de docs/', () => {
  assert.match(rutaDeArchivo('/'), /docs[/\\]index\.html$/u);
  assert.match(rutaDeArchivo('/css/app.css'), /docs[/\\]css[/\\]app\.css$/u);
  assert.match(rutaDeArchivo('/index.html?ensayo=1'), /docs[/\\]index\.html$/u);
  assert.match(rutaDeArchivo('/index.html#inicio'), /docs[/\\]index\.html$/u);
});

test('una dirección con escape mal formado no revienta: devuelve null', () => {
  // `decodeURIComponent('%')` lanza. Antes eso mataba el proceso entero.
  for (const rara of ['/%', '/%zz', '/a/%E0%A4%A', '/%%%']) {
    assert.equal(rutaDeArchivo(rara), null, rara);
  }
});

test('no se puede salir de docs/', async () => {
  const docs = join(RAIZ, 'docs');
  // Los intentos de subir de carpeta quedan contenidos: la ruta resultante
  // sigue dentro de docs/, así que a lo más se responde 404. Lo que no puede
  // pasar nunca es que apunte fuera.
  for (const intento of [
    '/../package.json',
    '/../../etc/passwd',
    '/%2e%2e/%2e%2e/package.json',
    '/..%2f..%2fpackage.json',
    '/css/../../firestore.rules',
  ]) {
    const destino = rutaDeArchivo(intento);
    assert.ok(destino === null || destino.startsWith(docs), `${intento} -> ${destino}`);
  }

  // Y de hecho no existe nada servible ahí: `package.json` está fuera de docs/.
  const { access } = await import('node:fs/promises');
  await assert.rejects(() => access(rutaDeArchivo('/../package.json')));
});

test('el servidor sigue en pie después de una petición mal formada', async (t) => {
  const puerto = 5311;
  const proceso = spawn(process.execPath, [join(RAIZ, 'scripts', 'servir.mjs')], {
    env: { ...process.env, PUERTO_SITIO: String(puerto) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => proceso.kill('SIGTERM'));

  await new Promise((listo, fallo) => {
    proceso.stdout.once('data', listo);
    proceso.once('exit', (codigo) => fallo(new Error(`el servidor no arrancó (código ${codigo})`)));
    setTimeout(() => fallo(new Error('el servidor no arrancó a tiempo')), 10_000).unref?.();
  });

  const pedir = async (ruta) => (await fetch(`http://127.0.0.1:${puerto}${ruta}`)).status;

  assert.equal(await pedir('/'), 200);
  assert.equal(await pedir('/%'), 404, 'una dirección rara responde 404');
  assert.equal(await pedir('/no-existe.txt'), 404);
  // Y lo que de verdad importa: sigue atendiendo.
  assert.equal(await pedir('/'), 200, 'el servidor sobrevivió');
  assert.equal(await pedir('/css/app.css'), 200);
});
