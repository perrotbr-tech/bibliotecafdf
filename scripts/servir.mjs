// Servidor estático de docs/ para desarrollo y para las pruebas de extremo a
// extremo. Sin dependencias: la app se publica tal cual en GitHub Pages, así
// que este servidor solo tiene que entregar los archivos como los entregaría
// Pages. Escucha en 127.0.0.1 porque el contrato §1 exige que el emulador se
// seleccione únicamente desde loopback.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

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

/** Traduce una ruta de petición a un archivo dentro de docs/, sin salirse. */
export function rutaDeArchivo(rutaPedida) {
  const limpia = decodeURIComponent(rutaPedida.split('?')[0].split('#')[0]);
  const relativa = normalize(limpia).replace(/^(\.\.(\/|\\|$))+/, '');
  const destino = join(RAIZ, relativa === sep ? 'index.html' : relativa);
  if (!destino.startsWith(RAIZ)) return null;
  return destino;
}

const servidor = createServer(async (peticion, respuesta) => {
  const destinoInicial = rutaDeArchivo(peticion.url ?? '/');
  if (!destinoInicial) {
    respuesta.writeHead(403).end('Fuera de docs/');
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
});

servidor.listen(PUERTO, HOST, () => {
  process.stdout.write(`docs/ servido en http://${HOST}:${PUERTO}\n`);
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
