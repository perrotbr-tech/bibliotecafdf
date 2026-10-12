// Escáner del repositorio. Corre en la integración continua y antes de cada
// commit. Falla si encuentra versionado algo que no debe estar en un
// repositorio público: archivos de datos/, llaves de servicio o teléfonos
// chilenos que no sean los ficticios de las pruebas.
//
// Lo que este escáner NO hace (contrato §8): no prueba que no haya nombres
// reales. Para eso hay que revisar la procedencia de los fixtures y el diff
// de publicación a mano.
//
// Uso:
//   node scripts/revisar-repositorio.mjs            revisa el repositorio
//   node scripts/revisar-repositorio.mjs <carpeta>  revisa una carpeta
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

/** Carpetas que nunca se revisan: no están versionadas. */
const CARPETAS_IGNORADAS = new Set(['.git', 'node_modules', 'playwright-report', 'test-results', '.firebase']);

/** Extensiones que no se leen como texto. */
const EXTENSIONES_BINARIAS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.jar', '.woff', '.woff2', '.ttf']);

/**
 * Teléfono chileno: exactamente once dígitos seguidos, sin más dígitos pegados
 * antes ni después, que empiecen con 569. Los que empiezan con 5690000 son la
 * convención de los datos de prueba de este proyecto y están permitidos.
 */
const TELEFONO = /(?<![0-9])569[0-9]{8}(?![0-9])/g;
const PREFIJO_FICTICIO = '5690000';

/** Nombres de archivo con forma de llave de servicio. */
const NOMBRES_DE_LLAVE = [
  /\.serviceAccount\.json$/i,
  /-firebase-adminsdk-[^/]*\.json$/i,
  /^service[-_]?account.*\.json$/i,
  /(^|\/)\.env(\..+)?$/i,
];

/** Contenidos con forma de llave privada o de credencial de servicio. */
const CONTENIDOS_DE_LLAVE = [
  { patron: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: 'llave privada en el contenido' },
  { patron: /"type"\s*:\s*"service_account"/, motivo: 'credencial de cuenta de servicio' },
  { patron: /"private_key"\s*:\s*"/, motivo: 'campo private_key' },
];

/** Devuelve la lista de archivos a revisar, relativos a la raíz. */
export async function listarArchivos(raiz) {
  try {
    const { stdout } = await ejecutar('git', ['-C', raiz, 'ls-files', '-z'], { maxBuffer: 64 * 1024 * 1024 });
    const versionados = stdout.split('\0').filter(Boolean);
    if (versionados.length > 0) return versionados;
  } catch {
    // No es un repositorio git (por ejemplo, la carpeta temporal de la prueba
    // A-29): se recorre el árbol completo.
  }
  return await recorrer(raiz, raiz);
}

async function recorrer(raiz, carpeta) {
  const encontrados = [];
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    if (CARPETAS_IGNORADAS.has(entrada.name)) continue;
    const completa = join(carpeta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...(await recorrer(raiz, completa)));
    else if (entrada.isFile()) encontrados.push(relative(raiz, completa));
  }
  return encontrados;
}

function esBinario(ruta) {
  const punto = ruta.lastIndexOf('.');
  return punto !== -1 && EXTENSIONES_BINARIAS.has(ruta.slice(punto).toLowerCase());
}

/**
 * Revisa una raíz y devuelve la lista de hallazgos. Cada hallazgo trae
 * `archivo`, `linea` (o null) y `motivo`. Lista vacía significa que pasa.
 */
export async function revisarRepositorio(raizPedida = process.cwd()) {
  const raiz = resolve(raizPedida);
  const archivos = await listarArchivos(raiz);
  const hallazgos = [];

  for (const archivo of archivos) {
    const enBarras = archivo.split(sep).join('/');

    if (enBarras === 'datos' || enBarras.startsWith('datos/')) {
      hallazgos.push({ archivo: enBarras, linea: null, motivo: 'archivo de datos/ versionado' });
      continue;
    }
    if (NOMBRES_DE_LLAVE.some((patron) => patron.test(enBarras))) {
      hallazgos.push({ archivo: enBarras, linea: null, motivo: 'nombre con forma de llave de servicio' });
      continue;
    }
    if (esBinario(enBarras)) continue;

    const completa = join(raiz, archivo);
    let info;
    try {
      info = await stat(completa);
    } catch {
      continue; // Versionado pero ausente del disco: no hay nada que leer.
    }
    if (!info.isFile()) continue;

    const contenido = await readFile(completa, 'utf8');
    if (contenido.includes('\u0000')) continue; // Binario sin extensión conocida.

    for (const { patron, motivo } of CONTENIDOS_DE_LLAVE) {
      if (patron.test(contenido)) hallazgos.push({ archivo: enBarras, linea: null, motivo });
    }

    const lineas = contenido.split('\n');
    for (let i = 0; i < lineas.length; i += 1) {
      for (const numero of lineas[i].match(TELEFONO) ?? []) {
        if (numero.startsWith(PREFIJO_FICTICIO)) continue;
        hallazgos.push({
          archivo: enBarras,
          linea: i + 1,
          motivo: `teléfono chileno que no es ficticio (empieza con ${numero.slice(0, 4)}…)`,
        });
      }
    }
  }
  return hallazgos;
}

const invocadoDirectamente =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invocadoDirectamente) {
  const raiz = process.argv[2] ?? resolve(import.meta.dirname, '..');
  const hallazgos = await revisarRepositorio(raiz);
  if (hallazgos.length === 0) {
    process.stdout.write('revisar-repositorio: sin hallazgos\n');
    process.exit(0);
  }
  process.stderr.write(`revisar-repositorio: ${hallazgos.length} hallazgo(s)\n`);
  for (const h of hallazgos) {
    process.stderr.write(`  ${h.archivo}${h.linea ? `:${h.linea}` : ''} — ${h.motivo}\n`);
  }
  // El número no se imprime nunca: el objetivo es que no circule.
  process.exit(1);
}
