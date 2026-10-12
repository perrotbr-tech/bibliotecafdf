// Servidor estático de docs/ para desarrollo y para las pruebas de extremo a
// extremo. Sin dependencias: la app se publica tal cual en GitHub Pages, así
// que este servidor solo tiene que entregar los archivos como los entregaría
// Pages. Escucha en 127.0.0.1 porque el contrato §1 exige que el emulador se
// seleccione únicamente desde loopback.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(import.meta.dirname, '..', 'docs');
const PUERTO = Number(process.env.PUERTO_SITIO ?? 5173);
const HOST = process.env.HOST_SITIO ?? '127.0.0.1';

const TIPOS = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

/**
 * Traduce una ruta de petición a un archivo dentro de docs/, sin salirse.
 * Devuelve null si la dirección no se entiende o apunta fuera de docs/.
 *
 * `decodeURIComponent` lanza con un porcentaje suelto —`/%`, que manda
 * cualquier escáner o un dedo en el teclado—, así que se atrapa aquí: una
 * petición rara responde 404, no tumba el servidor.
 */
export function rutaDeArchivo(rutaPedida) {
  let limpia;
  try {
    limpia = decodeURIComponent(String(rutaPedida ?? '').split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  const relativa = normalize(limpia).replace(/^(\.\.(\/|\\|$))+/, '');
  const destino = join(RAIZ, relativa === sep ? 'index.html' : relativa);
  if (!destino.startsWith(RAIZ)) return null;
  return destino;
}

const servidor = createServer(async (peticion, respuesta) => {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    // Nada que llegue por la red puede tumbar el servidor.
    process.stderr.write(`servir: ${peticion.method} ${peticion.url} falló: ${error?.message ?? error}\n`);
    if (!respuesta.headersSent) respuesta.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    respuesta.end('Error del servidor');
  }
});

async function atender(peticion, respuesta) {
  const destinoInicial = rutaDeArchivo(peticion.url ?? '/');
  if (!destinoInicial) {
    respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    respuesta.end('No existe');
    return;
  }
  let destino = destinoInicial;
  try {
    const info = await stat(destino);
    if (info.isDirectory()) destino = join(destino, 'index.html');
    const cuerpo = await readFile(destino);
    respuesta.writeHead(200, {
      'content-type': TIPOS.get(extname(destino)) ?? 'application/octet-stream',
      // Sin caché: en desarrollo y en pruebas siempre se quiere el archivo del disco.
      'cache-control': 'no-store',
    });
    respuesta.end(cuerpo);
  } catch {
    respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    respuesta.end('No existe');
  }
}

// Solo escucha cuando se le invoca directamente: así las pruebas pueden
// importar `rutaDeArchivo` sin levantar un servidor de paso.
const invocadoDirectamente =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invocadoDirectamente) {
  servidor.listen(PUERTO, HOST, () => {
    process.stdout.write(`docs/ servido en http://${HOST}:${PUERTO}\n`);
  });

  for (const senal of ['SIGINT', 'SIGTERM']) {
    process.on(senal, () => servidor.close(() => process.exit(0)));
  }
}

export { servidor };
