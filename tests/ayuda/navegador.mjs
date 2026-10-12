// Abrir la app en una prueba de navegador, y el respaldo del SDK.
//
// La app carga el SDK de Firebase desde `www.gstatic.com` con versión fija
// (contrato §8). En una red que bloquea ese host —la del contenedor donde se
// construyó esta etapa— ninguna prueba de navegador podría correr, y quedarse
// sin pruebas de pantalla no es una opción.
//
// Así que se comprueba UNA vez si el host responde. Si responde, el navegador
// baja el SDK de ahí, como en producción. Si no responde, se sirven los MISMOS
// archivos de la MISMA versión desde `node_modules/firebase`, que es el
// paquete npm del mismo proveedor y trae los mismos paquetes de navegador.
//
// Esto no cambia la app: cambia de dónde los baja el navegador de prueba. Lo
// que NO queda probado cuando el respaldo entra en acción es la descarga real
// desde gstatic; el informe lo dice, y la prueba de humo del dueño en un
// teléfono real es la que cubre eso.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { VERSION_SDK } from '../../docs/js/config-publica.js';

const RAIZ = join(import.meta.dirname, '..', '..');
const BASE_SDK = `https://www.gstatic.com/firebasejs/${VERSION_SDK}`;

let respondeGstatic = null;

/** ¿Responde `www.gstatic.com`? Se pregunta una vez por corrida. */
export async function gstaticResponde() {
  if (respondeGstatic !== null) return respondeGstatic;
  try {
    const respuesta = await fetch(`${BASE_SDK}/firebase-app.js`, {
      signal: AbortSignal.timeout(8000),
      headers: { Range: 'bytes=0-64' },
    });
    respondeGstatic = respuesta.ok || respuesta.status === 206;
  } catch {
    respondeGstatic = false;
  }
  process.stdout.write(
    respondeGstatic
      ? `[e2e] el SDK se baja de www.gstatic.com, como en producción.\n`
      : `[e2e] www.gstatic.com no responde en esta red: el SDK ${VERSION_SDK} se sirve desde ` +
          'node_modules/firebase, que es el mismo paquete del mismo proveedor.\n',
  );
  return respondeGstatic;
}

/** Deja el SDK disponible para esta página. Devuelve de dónde saldrá. */
export async function prepararSdk(page) {
  if (await gstaticResponde()) return 'gstatic';
  await page.route(`${BASE_SDK}/*.js`, async (ruta) => {
    const nombre = new URL(ruta.request().url()).pathname.split('/').pop();
    const cuerpo = await readFile(join(RAIZ, 'node_modules', 'firebase', nombre));
    await ruta.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: cuerpo });
  });
  return 'node_modules';
}

/** Abre la app y espera a que el módulo principal quede listo. */
export async function abrir(page, direccion = '/') {
  await prepararSdk(page);
  await page.goto(direccion);
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
}

/** Entra con una credencial simulada del emulador de Authentication. */
export async function entrar(page, correo, opciones = {}) {
  await page.evaluate(([unCorreo, unasOpciones]) => globalThis.__biblioteca.entrarSimulado(unCorreo, unasOpciones), [
    correo,
    opciones,
  ]);
}

export async function abrirYEntrar(page, correo, direccion = '/') {
  await abrir(page, direccion);
  await entrar(page, correo);
}
