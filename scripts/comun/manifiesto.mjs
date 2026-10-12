// Manifiesto de progreso de un trabajo administrativo reanudable
// (contrato §6).
//
// Importar, reemplazar y restaurar no caben en una transacción: se hacen en
// lotes acotados, y un fallo a mitad de camino deja la base incompleta. El
// manifiesto es lo que permite reanudar sin repetir ni saltarse nada, y lo que
// el dueño mira antes de reabrir.
//
// Vive en `datos/`, que no se versiona (AGENTS.md): puede nombrar documentos de
// la biblioteca.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const CARPETA_DATOS = join(import.meta.dirname, '..', '..', 'datos');

/** Nombre de archivo con la marca de tiempo local: `respaldo-20261012-0530`. */
export function marcaDeArchivo(instante = new Date()) {
  const doble = (n) => String(n).padStart(2, '0');
  return (
    `${instante.getFullYear()}${doble(instante.getMonth() + 1)}${doble(instante.getDate())}` +
    `-${doble(instante.getHours())}${doble(instante.getMinutes())}`
  );
}

export async function guardarJson(ruta, valor) {
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, `${JSON.stringify(valor, null, 2)}\n`, 'utf8');
  return ruta;
}

export async function leerJson(ruta) {
  return JSON.parse(await readFile(ruta, 'utf8'));
}

/**
 * Manifiesto de un trabajo. `hechos` es la lista de rutas ya escritas, que es
 * lo que permite reanudar; `estado` dice si terminó.
 */
export function crearManifiesto({ trabajo, token, proyecto, origen = null, huella = null, total = 0 }) {
  return {
    trabajo,
    token,
    proyecto,
    origen,
    // Huella del contenido que se está escribiendo. Reanudar con OTRO
    // contenido mezclaría dos trabajos, así que se compara antes de seguir.
    huella,
    estado: 'en-curso',
    iniciadoEn: new Date().toISOString(),
    terminadoEn: null,
    total,
    hechos: [],
    motivo: null,
  };
}

export async function abrirManifiesto(ruta, nuevo) {
  try {
    const previo = await leerJson(ruta);
    if (previo.trabajo !== nuevo.trabajo || previo.proyecto !== nuevo.proyecto) {
      throw new Error(
        `El manifiesto ${ruta} es de otro trabajo (${previo.trabajo} en ${previo.proyecto}). ` +
          'Revísalo y muévelo antes de seguir.',
      );
    }
    if (previo.estado === 'terminado') return { ...nuevo, ...previo, estado: 'en-curso' };
    return previo;
  } catch (error) {
    if (error.code === 'ENOENT') return nuevo;
    throw error;
  }
}

export async function anotarHecho(ruta, manifiesto, hecho) {
  manifiesto.hechos.push(hecho);
  await guardarJson(ruta, manifiesto);
  return manifiesto;
}

export async function cerrarManifiesto(ruta, manifiesto, { estado = 'terminado', motivo = null } = {}) {
  manifiesto.estado = estado;
  manifiesto.motivo = motivo;
  manifiesto.terminadoEn = new Date().toISOString();
  await guardarJson(ruta, manifiesto);
  return manifiesto;
}
