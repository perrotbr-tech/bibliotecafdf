// Carga inicial de los datos del Excel ya depurado (Etapa 2).
//
// La limpieza del Excel NO es parte de este script: el archivo llega depurado.
// Lo que este script hace es validar, y solo escribir si la validación no
// rechazó nada.
//
//   --simular    valida y entrega el informe. No escribe nada.
//   --cargar     escribe, solo si no hubo rechazos y las colecciones de
//                negocio —libros, lectores, claves y préstamos— están vacías.
//   --reemplazar escribe encima: antes respalda, verifica el respaldo, y
//                recién entonces borra las colecciones de negocio y carga.
//
// Dos cosas que conviene saber:
//
//   · Los identificadores de los préstamos son DETERMINISTAS: salen del número
//     del archivo (contrato §3). Así una carga interrumpida se reanuda
//     escribiendo los mismos documentos en vez de duplicarlos.
//   · El script escribe `prestamos`, una colección que no tiene reglas de
//     cliente hasta la Etapa 3. Admin SDK no pasa por reglas, así que la carga
//     funciona y el cliente no los puede leer, que es justo lo que esta etapa
//     quiere.
//
// Uso:
//   node scripts/cargar-datos.mjs --archivo tests/fixtures/carga-ficticia.json --simular
//   node scripts/cargar-datos.mjs --archivo … --cargar
//   node scripts/cargar-datos.mjs --archivo … --reemplazar

import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { BIB, idDeLector, rutas } from '../docs/js/config-publica.js';
import {
  diaEnChile,
  esDiaValido,
  esSabado,
  finDelDiaEnChile,
  mediodiaEnChile,
  sabadosEntre,
  temporadaDe,
} from '../docs/js/fechas.js';
import {
  claveDeNombre,
  esCodigoValido,
  esNombreDeLectorValido,
  normalizarCodigo,
  normalizarNombre,
  normalizarTelefono,
} from '../docs/js/texto.js';

import { COLECCIONES_DE_NEGOCIO, borrarColeccion, coleccionesConDatos } from './comun/biblioteca.mjs';
import { hashCanonico } from './comun/datos-exportados.mjs';
import { PROYECTO_DEMO, abrirBase } from './comun/destino.mjs';
import {
  CARPETA_DATOS,
  abrirManifiesto,
  cerrarManifiesto,
  crearManifiesto,
  guardarJson,
  leerJson,
} from './comun/manifiesto.mjs';
import * as mantenimiento from './comun/mantenimiento.mjs';
import { respaldar } from './respaldar.mjs';

export const TRABAJO = 'carga';
export const LOTE = 200;
export const PLAZO_MAXIMO_SABADOS = 4;

/** Identificador determinista de importación (contrato §3). */
export function idDeImportacion(semilla) {
  return createHash('sha256').update(`importacion:${semilla}`, 'utf8').digest('hex').slice(0, 32);
}

/** Lee el archivo de carga. Las claves que empiezan con `_` se ignoran. */
export async function leerArchivoDeCarga(ruta) {
  const crudo = await leerJson(ruta);
  const limpio = {};
  for (const [clave, valor] of Object.entries(crudo)) {
    if (!clave.startsWith('_')) limpio[clave] = valor;
  }
  return limpio;
}

const numeroDeLector = (id) => Number(String(id ?? '').slice(1));

/**
 * Valida el archivo completo. Devuelve rechazos —que impiden cargar—,
 * advertencias —que no— y un resumen por colección.
 *
 * Las advertencias se agrupan por tipo con un par de ejemplos: con 193
 * préstamos legados, la mayoría vence un día que no es sábado, y un informe de
 * doscientas líneas iguales no se lee.
 */
export function validar(archivo, { hoy = diaEnChile(new Date()) } = {}) {
  const rechazos = [];
  const advertencias = new Map();
  const advertir = (tipo, detalle) => {
    const previas = advertencias.get(tipo) ?? [];
    previas.push(detalle);
    advertencias.set(tipo, previas);
  };

  // --- categorías
  const prefijos = new Map();
  const categorias = Array.isArray(archivo.categorias) ? archivo.categorias : [];
  if (categorias.length === 0) rechazos.push('El archivo no trae categorías.');
  for (const categoria of categorias) {
    const nombre = normalizarNombre(categoria?.nombre);
    const prefijo = String(categoria?.prefijo ?? '').toUpperCase();
    if (nombre === '') rechazos.push('Hay una categoría sin nombre.');
    if (!/^[A-Z]{2,4}$/u.test(prefijo)) {
      rechazos.push(`La categoría «${nombre}» tiene el prefijo «${categoria?.prefijo}», que no sirve para un código.`);
    }
    if (prefijos.has(nombre)) rechazos.push(`La categoría «${nombre}» está repetida.`);
    prefijos.set(nombre, prefijo);
  }

  // --- libros
  const libros = new Map();
  for (const libro of Array.isArray(archivo.libros) ? archivo.libros : []) {
    const codigo = normalizarCodigo(libro?.codigo);
    if (!esCodigoValido(codigo)) {
      rechazos.push(`El libro «${libro?.titulo ?? '(sin título)'}» tiene el código «${libro?.codigo}», inválido.`);
      continue;
    }
    if (libros.has(codigo)) {
      rechazos.push(`El código ${codigo} está repetido en el archivo.`);
      continue;
    }
    const titulo = normalizarNombre(libro?.titulo);
    if (titulo.length < 2 || titulo.length > 120) {
      rechazos.push(`El libro ${codigo} tiene un título de ${titulo.length} caracteres; van de 2 a 120.`);
    }
    const autor = normalizarNombre(libro?.autor);
    if (autor.length > 80) rechazos.push(`El libro ${codigo} tiene un autor de más de 80 caracteres.`);
    const categoria = normalizarNombre(libro?.categoria);
    if (!prefijos.has(categoria)) {
      rechazos.push(`El libro ${codigo} dice la categoría «${categoria}», que no está en el archivo.`);
    } else if (!codigo.startsWith(prefijos.get(categoria))) {
      advertir(
        'codigo-sin-prefijo-de-categoria',
        `${codigo} es de «${categoria}», cuyo prefijo es ${prefijos.get(categoria)}.`,
      );
    }
    if (typeof libro?.baja !== 'boolean') rechazos.push(`El libro ${codigo} no dice si está de baja.`);
    libros.set(codigo, { codigo, titulo, autor, categoria, baja: libro?.baja === true });
  }

  // --- lectores
  const lectores = new Map();
  const claves = new Map();
  for (const lector of Array.isArray(archivo.lectores) ? archivo.lectores : []) {
    const id = String(lector?.id ?? '');
    if (!/^L[0-9]{3,}$/u.test(id) || idDeLector(numeroDeLector(id)) !== id) {
      rechazos.push(`El lector «${lector?.nombre ?? '(sin nombre)'}» tiene el identificador «${id}», inválido.`);
      continue;
    }
    if (lectores.has(id)) {
      rechazos.push(`El identificador ${id} está repetido en el archivo.`);
      continue;
    }
    const nombre = normalizarNombre(lector?.nombre);
    if (!esNombreDeLectorValido(nombre)) {
      rechazos.push(`El lector ${id} tiene el nombre «${nombre}», que no es válido.`);
      continue;
    }
    const clave = claveDeNombre(nombre);
    if (claves.has(clave)) {
      rechazos.push(`Los lectores ${claves.get(clave)} y ${id} comparten la clave «${clave}».`);
      continue;
    }
    const telefono = normalizarTelefono(lector?.telefono);
    if (!telefono.ok) {
      rechazos.push(`El lector ${id} tiene el teléfono «${lector?.telefono}»: ${telefono.motivo}`);
      continue;
    }
    claves.set(clave, id);
    lectores.set(id, { id, nombre, clave, telefono: telefono.telefono });
  }

  // --- préstamos
  const prestamos = new Map();
  const abiertosPorLibro = new Map();
  const salidasPorLibro = new Map();
  for (const prestamo of Array.isArray(archivo.prestamos) ? archivo.prestamos : []) {
    const numero = prestamo?.numero;
    if (!Number.isInteger(numero) || numero <= 0) {
      rechazos.push(`Hay un préstamo con el número «${numero}», que no es un correlativo.`);
      continue;
    }
    if (prestamos.has(numero)) {
      rechazos.push(`El préstamo ${numero} está repetido en el archivo.`);
      continue;
    }
    const libro = normalizarCodigo(prestamo?.libro);
    const lector = String(prestamo?.lector ?? '');
    if (!libros.has(libro)) {
      rechazos.push(`El préstamo ${numero} apunta al libro ${libro || '(vacío)'}, que no está en el archivo.`);
      continue;
    }
    if (!lectores.has(lector)) {
      rechazos.push(`El préstamo ${numero} apunta al lector ${lector || '(vacío)'}, que no está en el archivo.`);
      continue;
    }
    const salio = String(prestamo?.salio ?? '');
    const vence = String(prestamo?.vence ?? '');
    if (!esDiaValido(salio)) {
      rechazos.push(`El préstamo ${numero} salió el «${salio}», que no existe en el calendario.`);
      continue;
    }
    if (!esDiaValido(vence)) {
      rechazos.push(`El préstamo ${numero} vence el «${vence}», que no existe en el calendario.`);
      continue;
    }
    if (vence < salio) {
      rechazos.push(`El préstamo ${numero} vence el ${vence}, antes de salir el ${salio}.`);
      continue;
    }
    // `devuelto` tiene que ser un booleano, como `baja` en los libros: un
    // «si» de texto convertido en falso dejaría un préstamo devuelto marcado
    // como abierto, y el libro aparecería prestado para siempre.
    if (typeof prestamo?.devuelto !== 'boolean') {
      rechazos.push(`El préstamo ${numero} no dice si está devuelto: trae «${prestamo?.devuelto}».`);
      continue;
    }
    const devuelto = prestamo.devuelto;
    const devolvio = prestamo?.devolvio ?? null;
    if (devolvio !== null) {
      if (!esDiaValido(String(devolvio))) {
        rechazos.push(`El préstamo ${numero} se devolvió el «${devolvio}», que no existe en el calendario.`);
        continue;
      }
      if (!devuelto) {
        rechazos.push(`El préstamo ${numero} figura abierto y trae fecha de devolución ${devolvio}.`);
        continue;
      }
      if (String(devolvio) < salio) {
        rechazos.push(`El préstamo ${numero} se devolvió el ${devolvio}, antes de salir el ${salio}.`);
        continue;
      }
      if (String(devolvio) > hoy) {
        rechazos.push(`El préstamo ${numero} se devolvió el ${devolvio}, después de hoy (${hoy}).`);
        continue;
      }
    }

    if (!devuelto) {
      const previo = abiertosPorLibro.get(libro);
      if (previo !== undefined) {
        rechazos.push(`El libro ${libro} tiene dos préstamos abiertos: ${previo} y ${numero}.`);
        continue;
      }
      abiertosPorLibro.set(libro, numero);
    }

    if (!esSabado(vence)) advertir('vence-no-sabado', `El préstamo ${numero} vence el ${vence}, que no es sábado.`);
    // El tope es uno más que el máximo: con eso basta para saber que se pasó,
    // y no se camina un calendario entero por una fecha mal tecleada.
    const sabados = sabadosEntre(salio, vence, PLAZO_MAXIMO_SABADOS + 1);
    if (sabados > PLAZO_MAXIMO_SABADOS) {
      advertir('plazo-largo', `El préstamo ${numero} abarca ${sabados} sábados o más.`);
    }

    salidasPorLibro.set(libro, [...(salidasPorLibro.get(libro) ?? []), { numero, salio }]);
    prestamos.set(numero, { numero, libro, lector, salio, vence, devuelto, devolvio });
  }

  // Un préstamo abierto de un libro que tiene otro posterior: no impide
  // cargar, pero avisa de que el estado del estante quedará raro.
  for (const [libro, numero] of abiertosPorLibro) {
    const abierto = prestamos.get(numero);
    for (const otro of salidasPorLibro.get(libro) ?? []) {
      if (otro.numero !== numero && otro.salio > abierto.salio) {
        advertir(
          'abierto-con-prestamo-posterior',
          `El préstamo ${numero} del libro ${libro} sigue abierto y el ${otro.numero} salió después.`,
        );
      }
    }
  }

  // --- contadores
  const contadores = archivo.contadores ?? {};
  const mayorLector = Math.max(0, ...[...lectores.keys()].map(numeroDeLector));
  const mayorPrestamo = Math.max(0, ...prestamos.keys());
  for (const [campo, mayor] of [
    ['ultimoLector', mayorLector],
    ['ultimoPrestamo', mayorPrestamo],
  ]) {
    const valor = contadores[campo];
    if (!Number.isInteger(valor) || valor < 0) {
      rechazos.push(`contadores.${campo} es «${valor}» y tiene que ser un entero.`);
    } else if (valor < mayor) {
      rechazos.push(`contadores.${campo} es ${valor} y el archivo llega hasta ${mayor}.`);
    }
  }

  return {
    rechazos,
    advertencias: [...advertencias.entries()].map(([tipo, detalles]) => ({
      tipo,
      cuantos: detalles.length,
      detalles,
    })),
    resumen: {
      categorias: categorias.length,
      libros: libros.size,
      lectores: lectores.size,
      prestamos: prestamos.size,
      abiertos: abiertosPorLibro.size,
    },
    limpio: {
      categorias: categorias.map((una) => ({
        nombre: normalizarNombre(una?.nombre),
        prefijo: String(una?.prefijo ?? '').toUpperCase(),
      })),
      libros,
      lectores,
      prestamos,
      contadores,
    },
  };
}

/**
 * Convierte lo validado en la lista de escrituras. Función pura: recibe la
 * marca del servidor como argumento en vez de pedirla, para poder probarla sin
 * base.
 *
 * `modo` dice cómo se escribe cada documento: `poner` lo reemplaza completo;
 * `fusionar` cambia solo los campos indicados, que es lo que corresponde en
 * `config/app` y `config/contadores`, documentos que ya existen y que la carga
 * no debe pisar entero.
 */
export function construir({ limpio, marcaDeServidor, por = 'carga-inicial' }) {
  const comunes = { creadoEn: marcaDeServidor, creadoPor: por };
  const escrituras = [];

  escrituras.push({
    ruta: rutas.configApp(),
    modo: 'fusionar',
    datos: { categorias: limpio.categorias },
  });

  // --- préstamos: primero se resuelven, porque de ellos salen el estado y la
  // cuenta de cada libro.
  //
  // El identificador del documento y su `creacionId` son el mismo valor
  // determinista, sacado del número del archivo: la identidad de importación de
  // un préstamo ES su número de origen, y así una carga reanudada vuelve a
  // escribir el mismo documento en vez de crear otro.
  const idDePrestamo = (numero) => idDeImportacion(`prestamo:${numero}`);
  const abiertoPorLibro = new Map();
  const vecesPorLibro = new Map();
  for (const prestamo of limpio.prestamos.values()) {
    if (!prestamo.devuelto) abiertoPorLibro.set(prestamo.libro, idDePrestamo(prestamo.numero));
    vecesPorLibro.set(prestamo.libro, (vecesPorLibro.get(prestamo.libro) ?? 0) + 1);
  }

  for (const libro of limpio.libros.values()) {
    escrituras.push({
      ruta: rutas.libro(libro.codigo),
      modo: 'poner',
      datos: {
        codigo: libro.codigo,
        titulo: libro.titulo,
        autor: libro.autor,
        categoria: libro.categoria,
        baja: libro.baja,
        prestamoAbierto: abiertoPorLibro.get(libro.codigo) ?? null,
        vecesPrestado: vecesPorLibro.get(libro.codigo) ?? 0,
        ...comunes,
        creacionId: idDeImportacion(`libro:${libro.codigo}`),
      },
    });
  }

  for (const lector of limpio.lectores.values()) {
    escrituras.push({
      ruta: rutas.lector(lector.id),
      modo: 'poner',
      datos: {
        nombre: lector.nombre,
        clave: lector.clave,
        telefono: lector.telefono,
        // Los lectores de la carga inicial no tienen aviso de datos: nadie se
        // lo dio todavía (base §5). La pantalla lo pedirá cuando se les toque.
        avisoDatos: null,
        fusionadoEn: null,
        esDestinoFusion: false,
        ...comunes,
        creacionId: idDeImportacion(`lector:${lector.id}`),
      },
    });
    escrituras.push({
      ruta: rutas.lectorClave(lector.clave),
      modo: 'poner',
      datos: { lector: lector.id, ...comunes, creacionId: idDeImportacion(`clave:${lector.clave}`) },
    });
  }

  for (const prestamo of limpio.prestamos.values()) {
    const devueltoATiempo = prestamo.devuelto
      ? // Devuelto sin fecha: el Excel no la anotó y se da por a tiempo
        // (base §5). Con fecha: se compara con el vencimiento.
        (prestamo.devolvio === null ? true : String(prestamo.devolvio) <= prestamo.vence)
      : null;
    escrituras.push({
      ruta: `${rutas.prestamos()}/${idDePrestamo(prestamo.numero)}`,
      modo: 'poner',
      datos: {
        numero: prestamo.numero,
        libro: prestamo.libro,
        lector: prestamo.lector,
        prestadoEn: mediodiaEnChile(prestamo.salio),
        salidaDia: prestamo.salio,
        plazoSabados: null,
        registroDiferido: false,
        motivoRegistroDiferido: null,
        venceEl: finDelDiaEnChile(prestamo.vence),
        temporada: temporadaDe(prestamo.salio),
        estado: prestamo.devuelto ? 'devuelto' : 'abierto',
        devueltoEn: prestamo.devolvio === null ? null : mediodiaEnChile(String(prestamo.devolvio)),
        devueltoATiempo,
        correccionATiempo: null,
        devueltoPor: null,
        anuladoEn: null,
        anuladoPor: null,
        recordadoEn: null,
        recordadoPor: null,
        origen: 'excel',
        ...comunes,
        creacionId: idDeImportacion(`prestamo:${prestamo.numero}`),
      },
    });
  }

  // Los contadores van al final, con el enlace apuntando al documento de ese
  // número si existe. Un contador que va por delante del archivo deja el
  // enlace en nulo, que es la verdad: ese documento no está.
  const mayorLector = Math.max(0, ...[...limpio.lectores.keys()].map(numeroDeLector));
  const mayorPrestamo = Math.max(0, ...limpio.prestamos.keys());
  escrituras.push({
    ruta: rutas.configContadores(),
    modo: 'fusionar',
    datos: {
      ultimoLector: limpio.contadores.ultimoLector,
      ultimoPrestamo: limpio.contadores.ultimoPrestamo,
      ultimoLectorId:
        limpio.contadores.ultimoLector === mayorLector && mayorLector > 0 ? idDeLector(mayorLector) : null,
      ultimoPrestamoId:
        limpio.contadores.ultimoPrestamo === mayorPrestamo && mayorPrestamo > 0
          ? idDePrestamo(mayorPrestamo)
          : null,
    },
  });

  return escrituras;
}

/**
 * Valida y, según el modo, escribe. Devuelve el informe: rechazos,
 * advertencias, resumen y qué se escribió.
 */
export async function cargar({
  db,
  FieldValue,
  proyecto,
  datos,
  modo = 'simular',
  por = 'dueno',
  hoy,
  lote = LOTE,
  reanudar = false,
  origen = null,
  rutaManifiesto = join(CARPETA_DATOS, `manifiesto-${TRABAJO}.json`),
}) {
  const informe = validar(datos, hoy === undefined ? {} : { hoy });
  if (informe.rechazos.length > 0) return { ...informe, estado: 'rechazado', escritos: 0 };
  if (modo === 'simular') return { ...informe, estado: 'simulado', escritos: 0 };

  const conDatos = await coleccionesConDatos(db);
  // Al reanudar, la base tiene datos a propósito: son los de esta misma carga,
  // que quedó a medias con el mantenimiento puesto.
  if (conDatos.length > 0 && modo !== 'reemplazar' && !reanudar) {
    throw new Error(
      `Las colecciones de negocio ya tienen datos (${conDatos.join(', ')}). ` +
        'Para cargar encima usa --reemplazar, que respalda y verifica antes de borrar nada.',
    );
  }

  if (modo === 'reemplazar' && !reanudar) {
    // Contrato §6: una recarga de negocio no pasa por encima de temporadas ya
    // cerradas, porque esas fotografías resumen préstamos que cambiarían.
    const temporadas = await db.collection(`bibliotecas/${BIB}/temporadas`).limit(1).get();
    if (!temporadas.empty) {
      throw new Error(
        'Hay temporadas cerradas: una recarga de libros, lectores y préstamos dejaría esas fotografías ' +
          'describiendo datos que ya no existen. Este script no lo hace.',
      );
    }
  }

  const escrituras = construir({ limpio: informe.limpio, marcaDeServidor: FieldValue.serverTimestamp() });
  const token = mantenimiento.nuevoToken();
  const nuevo = crearManifiesto({
    trabajo: TRABAJO,
    token,
    proyecto,
    origen,
    huella: hashCanonico(datos),
    total: escrituras.length,
  });
  const manifiesto = reanudar ? await abrirManifiesto(rutaManifiesto, nuevo) : nuevo;
  if (reanudar && manifiesto.huella !== nuevo.huella) {
    throw new Error(
      `El manifiesto ${rutaManifiesto} es de otra carga: su contenido no es el de este archivo. ` +
        'Revísalo antes de reanudar.',
    );
  }
  // Al reanudar se reusa el bloqueo que quedó puesto, no se toma otro.
  const puesto = await mantenimiento.tomarOReusar(db, FieldValue, { por, token: reanudar ? manifiesto.token : token });
  manifiesto.token = puesto;
  await guardarJson(rutaManifiesto, manifiesto);
  let respaldoPrevio = null;
  try {
    // El respaldo previo va DENTRO de nuestro bloqueo y con nuestro token: si
    // lo tomara y lo soltara por su cuenta, entre el respaldo verificado y el
    // borrado quedaría un hueco en que la app puede escribir.
    if (modo === 'reemplazar' && !reanudar) {
      respaldoPrevio = await respaldar({ db, FieldValue, proyecto, por, token: puesto });
    }
    if (modo === 'reemplazar' && manifiesto.hechos.length === 0) {
      for (const coleccion of COLECCIONES_DE_NEGOCIO) await borrarColeccion(db, coleccion);
    }

    const yaHechos = new Set(manifiesto.hechos);
    const pendientes = escrituras.filter(({ ruta }) => !yaHechos.has(ruta));
    for (let desde = 0; desde < pendientes.length; desde += lote) {
      await mantenimiento.comprobar(db, puesto);
      const tanda = pendientes.slice(desde, desde + lote);
      const escritura = db.batch();
      for (const { ruta, datos: cuerpo, modo: comoSeEscribe } of tanda) {
        if (comoSeEscribe === 'fusionar') escritura.set(db.doc(ruta), cuerpo, { merge: true });
        else escritura.set(db.doc(ruta), cuerpo);
      }
      await escritura.commit();
      manifiesto.hechos.push(...tanda.map(({ ruta }) => ruta));
      await guardarJson(rutaManifiesto, manifiesto);
    }

    await cerrarManifiesto(rutaManifiesto, manifiesto);
    await mantenimiento.liberar(db, puesto);
    return {
      ...informe,
      estado: 'cargado',
      escritos: manifiesto.hechos.length,
      respaldoPrevio,
      manifiesto: rutaManifiesto,
    };
  } catch (error) {
    await cerrarManifiesto(rutaManifiesto, manifiesto, { estado: 'interrumpido', motivo: error.message });
    error.mensajeDeBloqueo =
      `La carga se interrumpió y el mantenimiento QUEDA PUESTO (token ${puesto}). ` +
      `El manifiesto ${rutaManifiesto} dice qué se escribió: reanuda con --reanudar o repón un respaldo. ` +
      'Los identificadores de la carga son deterministas, así que reanudar no duplica nada.';
    throw error;
  }
}

function escribirInforme(informe) {
  const { resumen } = informe;
  process.stdout.write(
    `  categorías ${resumen.categorias} · libros ${resumen.libros} · lectores ${resumen.lectores} · ` +
      `préstamos ${resumen.prestamos} (${resumen.abiertos} abiertos)\n`,
  );
  for (const { tipo, cuantos, detalles } of informe.advertencias) {
    process.stdout.write(`  advertencia ${tipo}: ${cuantos}\n`);
    for (const uno of detalles.slice(0, 3)) process.stdout.write(`      ${uno}\n`);
    if (detalles.length > 3) process.stdout.write(`      … y ${detalles.length - 3} más\n`);
  }
  for (const uno of informe.rechazos) process.stdout.write(`  RECHAZO ${uno}\n`);
}

async function principal() {
  const { values } = parseArgs({
    options: {
      archivo: { type: 'string' },
      proyecto: { type: 'string', default: PROYECTO_DEMO },
      por: { type: 'string', default: 'dueno' },
      simular: { type: 'boolean', default: false },
      cargar: { type: 'boolean', default: false },
      reemplazar: { type: 'boolean', default: false },
      reanudar: { type: 'boolean', default: false },
      'confirmo-proyecto-real': { type: 'boolean', default: false },
    },
  });

  if (!values.archivo) {
    process.stderr.write('Falta --archivo con los datos a cargar.\n');
    process.exit(2);
  }
  const elegidos = ['simular', 'cargar', 'reemplazar'].filter((uno) => values[uno]);
  if (elegidos.length !== 1) {
    process.stderr.write('Elige exactamente un modo: --simular, --cargar o --reemplazar.\n');
    process.exit(2);
  }
  const modo = elegidos[0];

  const datos = await leerArchivoDeCarga(values.archivo);
  const { db, FieldValue, proyecto, destino } = await abrirBase({
    proyecto: values.proyecto,
    confirmaProyectoReal: values['confirmo-proyecto-real'],
  });
  process.stdout.write(`cargar-datos: ${values.archivo} → proyecto ${proyecto} (${destino}), modo ${modo}\n`);

  try {
    const informe = await cargar({
      db,
      FieldValue,
      proyecto,
      datos,
      modo,
      por: values.por,
      reanudar: values.reanudar,
      origen: values.archivo,
    });
    escribirInforme(informe);
    if (informe.estado === 'rechazado') {
      process.stdout.write(`cargar-datos: ${informe.rechazos.length} rechazo(s). No se escribió nada.\n`);
      process.exit(1);
    }
    if (informe.respaldoPrevio) {
      process.stdout.write(`cargar-datos: respaldo previo verificado en ${informe.respaldoPrevio.archivo}\n`);
    }
    process.stdout.write(
      informe.estado === 'simulado'
        ? 'cargar-datos: simulación sin rechazos. No se escribió nada.\n'
        : `cargar-datos: ${informe.escritos} documentos escritos y mantenimiento liberado.\n`,
    );
  } catch (error) {
    process.stderr.write(`cargar-datos: ${error.message}\n`);
    if (error.mensajeDeBloqueo) process.stderr.write(`cargar-datos: ${error.mensajeDeBloqueo}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await principal();
}
