// Las escrituras de la Etapa 2, en un solo lugar.
//
// Cada una usa la forma de guardar de `datos.guardar` (base §6): transacción,
// botón bloqueado por quien llama, éxito solo con respuesta del servidor y, si
// el resultado queda incierto, comprobación por IDENTIDAD de la operación.
//
// Viven aquí y no en las pantallas por dos razones: las pruebas de
// concurrencia necesitan lanzarlas sin interfaz, y la ficha de un lector y su
// alta comparten reglas que conviene no escribir dos veces.
//
// El `operacionId` lo recibe de fuera: es estable desde el primer toque y no
// cambia entre reintentos (contrato §3). Lo que sí se resuelve DENTRO de cada
// intento es el correlativo del lector, porque un intento abortado puede
// haberlo dejado tomado por otra persona.

import { idDeLector, rutas } from './config-publica.js';
import { ErrorDeNegocio, olvidarIntencion, recordarIntencion } from './datos.js';
import {
  MENSAJE_NOMBRE_CORTO,
  claveDeNombre,
  esCodigoValido,
  esNombreDeLectorValido,
  normalizarCodigo,
  normalizarNombre,
  normalizarTelefono,
} from './texto.js';

/**
 * Intentos de un alta de lector, cuando pierde la carrera del contador.
 *
 * Hace falta por algo que el contrato §3 daba por resuelto y no lo está: un
 * alta que pierde la carrera NO termina en un aborto reintentable, termina en
 * `permission-denied`. Las reglas se evalúan al confirmar, y para entonces el
 * contador que este intento leyó ya no es el que está, así que la regla del
 * contador deniega la escritura y el SDK no reintenta una denegación.
 *
 * Medido con cinco altas en paralelo (C-20): sin esto, una queda y cuatro
 * reciben «Tu cuenta no tiene permiso», que además de falso es inútil. Con
 * esto, el alta vuelve a intentarlo con el MISMO `operacionId` y un contador
 * recién leído, que es justo lo que el contrato describe: «el ID final se
 * obtiene del contador DENTRO de la transacción y puede cambiar entre
 * intentos».
 */
export const INTENTOS_DE_ALTA = 3;

export const MENSAJES_DE_OPERACION = {
  intentaloDeNuevo: 'No se pudo inscribir ahora. Inténtalo de nuevo',
  enMantenimiento: 'La biblioteca está en mantenimiento. Vuelve a intentarlo cuando termine',
  codigoRepetido: 'El código ya existe',
  codigoInvalido: 'El código va con 2 a 4 letras y 3 o 4 números, como INF028',
  tituloInvalido: 'El título va de 2 a 120 caracteres',
  autorInvalido: 'El autor no puede pasar de 80 caracteres',
  categoriaInvalida: 'Elige una categoría de la lista',
  libroPerdido: 'Ese libro ya no está en el catálogo',
  lectorPerdido: 'Ese lector ya no está en la lista',
  faltaConfiguracion: 'Falta la configuración de la biblioteca. Avísale al administrador',
  faltaAviso: 'Marca la casilla del aviso antes de guardar',
};

/** «Ya existe: Rafaela Toledo. Búscalo en la lista» (etapa 2 §Pantallas). */
export const yaExiste = (nombre) => `Ya existe: ${nombre}. Búscalo en la lista`;

/**
 * Anota la intención antes de escribir, para que una recarga a mitad de camino
 * se pueda resolver releyendo el servidor (contrato §3).
 *
 * En `sessionStorage` va SOLO el identificador de la operación, el tipo, la
 * ruta y los identificadores necesarios. Nunca nombres ni teléfonos: por eso
 * estas cuatro operaciones se anotan —sus rutas son un código de libro o un
 * `L001`, que no son datos de nadie— y el alta de un lector NO, porque lo único
 * que la localiza es su clave de nombre, y una clave es el nombre normalizado.
 * Esa asimetría es deliberada y está declarada en el informe.
 */
function anotarIntencion({ tipo, ruta, identificadores, operacionId }) {
  recordarIntencion({ operacionId, tipo, ruta, identificadores });
}

/**
 * Resuelve la intención según el resultado. Se conserva SOLO si quedó la duda:
 * un conflicto, un permiso denegado o un «sin conexión» ya están resueltos, y
 * dejarla anotada haría que la próxima apertura avisara de algo ya sabido.
 */
function resolverIntencion(resultado) {
  if (resultado?.estado !== 'indeterminado') olvidarIntencion();
  return resultado;
}

/** Envuelve una escritura para resolver su intención cuando termine. */
const resolverIntencionDe = (promesa) => promesa.then(resolverIntencion);

// ---------------------------------------------------------------- lectores

/**
 * Inscribe un lector: crea el lector, su documento de clave y sube el contador
 * en una sola transacción. Las reglas exigen las tres cosas juntas.
 */
export async function inscribirLector({ datos, permiso, nombre, telefono = null, avisoDado, operacionId, alTardar }) {
  const nombreLimpio = normalizarNombre(nombre);
  if (!esNombreDeLectorValido(nombreLimpio)) throw new ErrorDeNegocio(MENSAJE_NOMBRE_CORTO);
  if (avisoDado !== true) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaAviso);
  const telefonoLimpio = normalizarTelefono(telefono);
  if (!telefonoLimpio.ok) throw new ErrorDeNegocio(telefonoLimpio.motivo);
  const clave = claveDeNombre(nombreLimpio);

  for (let intento = 1; intento <= INTENTOS_DE_ALTA; intento += 1) {
    // `registro` recoge qué contador leyó el intento. Si la escritura se
    // deniega, ese número es lo que permite saber si de verdad hubo carrera.
    const registro = {};
    const resultado = await unIntentoDeAlta({
      datos,
      permiso,
      nombreLimpio,
      clave,
      telefono: telefonoLimpio.telefono,
      operacionId,
      alTardar,
      registro,
    });
    if (resultado.estado !== 'denegado') return resultado;

    // Una denegación en un alta puede ser tres cosas, y se distinguen mirando
    // los datos, no adivinando.
    //
    // 1. La clave YA está tomada: otra persona se quedó con el nombre, y eso
    //    es el «Ya existe» del servidor.
    const leida = await datos.leerDelServidor(rutas.lectorClave(clave));
    if (leida.estado === 'ok' && leida.existe) {
      const vigente = await datos.leerDelServidor(rutas.lector(leida.datos.lector));
      return {
        ...resultado,
        estado: 'conflicto',
        esExito: false,
        mensaje: yaExiste(vigente.datos?.nombre ?? leida.datos.lector),
      };
    }

    // 2. El contador NO se movió: entonces no hubo carrera, y reintentar es
    //    pedirle a la persona que repita algo que no puede funcionar. Pasa con
    //    el mantenimiento puesto o con una cuenta recién desactivada, y hasta
    //    que la revisión del diff lo encontró se le decía «Inténtalo de nuevo».
    const contadores = await datos.leerDelServidor(rutas.configContadores());

    // Si ni leer el contador se puede, esto no es una carrera: es una cuenta
    // que perdió el permiso —desactivada a mitad de la operación— y se
    // devuelve la denegación tal cual, sin reetiquetarla. Lo pidió así la
    // contraprueba de la Etapa 2 (H-02).
    if (contadores.estado === 'denegada') return resultado;

    const sigueIgual =
      contadores.estado === 'ok' &&
      registro.ultimoLectorLeido !== undefined &&
      Number(contadores.datos?.ultimoLector ?? -1) === registro.ultimoLectorLeido;
    if (sigueIgual) {
      const control = await datos.leerDelServidor(rutas.configControl());
      const bloqueado = control.estado === 'ok' && (control.datos?.bloqueo ?? null) !== null;
      return {
        ...resultado,
        mensaje: bloqueado ? MENSAJES_DE_OPERACION.enMantenimiento : resultado.mensaje,
      };
    }

    // 3. Se movió el contador: fue una carrera. Se reintenta con el mismo
    //    `operacionId` y un contador recién leído.
    if (intento === INTENTOS_DE_ALTA) {
      // Se acabaron los intentos. El estado NO se deja en «denegado»: no fue
      // una falta de permiso, fue una carrera perdida, y conviene que el
      // informe y las etapas siguientes puedan distinguirlas.
      return { ...resultado, estado: 'carrera-perdida', mensaje: MENSAJES_DE_OPERACION.intentaloDeNuevo };
    }
  }
  // Inalcanzable: el bucle devuelve en todos sus caminos.
  throw new Error('inscribirLector: el bucle de intentos terminó sin resultado');
}

function unIntentoDeAlta({ datos, permiso, nombreLimpio, clave, telefono, operacionId, alTardar, registro = {} }) {
  return datos.guardar({
    tipo: 'alta',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      // Lecturas antes de escrituras, siempre.
      const claveTomada = await leer(rutas.lectorClave(clave));
      if (claveTomada.exists()) {
        const idVigente = claveTomada.data().lector;
        const vigente = await leer(rutas.lector(idVigente));
        throw new ErrorDeNegocio(yaExiste(vigente.exists() ? vigente.data().nombre : idVigente));
      }
      const contadores = await leer(rutas.configContadores());
      if (!contadores.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaConfiguracion);

      // El correlativo se resuelve DENTRO del intento: si este se aborta, el
      // siguiente vuelve a leer el contador y puede salir otro número.
      const leido = Number(contadores.data().ultimoLector ?? 0);
      registro.ultimoLectorLeido = leido;
      const numero = leido + 1;
      const id = idDeLector(numero);
      const marca = ahoraDelServidor();

      transaccion.set(ref(rutas.lector(id)), {
        nombre: nombreLimpio,
        clave,
        telefono,
        avisoDatos: { fecha: marca, por: permiso.correo },
        fusionadoEn: null,
        esDestinoFusion: false,
        creadoEn: marca,
        creadoPor: permiso.correo,
        creacionId: idOperacion,
      });
      transaccion.set(ref(rutas.lectorClave(clave)), {
        lector: id,
        creadoEn: marca,
        creadoPor: permiso.correo,
        creacionId: idOperacion,
      });
      transaccion.update(ref(rutas.configContadores()), { ultimoLector: numero, ultimoLectorId: id });
      return { id, clave, nombre: nombreLimpio };
    },
    // Contrato §3: un resultado incierto se localiza por la CLAVE del nombre y
    // se confirma con el `creacionId` del lector. Una clave ocupada por otra
    // operación es conflicto, no éxito propio.
    comprobar: async () => {
      const leidaClave = await datos.leerDelServidor(rutas.lectorClave(clave));
      if (leidaClave.estado !== 'ok') return { estado: leidaClave.estado, lectura: null };
      if (!leidaClave.existe) return { estado: 'ok', lectura: { existe: false } };
      const leidoLector = await datos.leerDelServidor(rutas.lector(leidaClave.datos.lector));
      return {
        estado: leidoLector.estado,
        lectura: { existe: leidoLector.existe, creacionId: leidoLector.datos?.creacionId ?? null },
      };
    },
  });
}

/** Cambia el teléfono de un lector. Lo puede hacer cualquier voluntario. */
export function cambiarTelefono({ datos, lector, telefono, operacionId, alTardar }) {
  const limpio = normalizarTelefono(telefono);
  if (!limpio.ok) throw new ErrorDeNegocio(limpio.motivo);
  const ruta = rutas.lector(lector.id);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [lector.id], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const actual = await leer(ruta);
      if (!actual.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.lectorPerdido);
      transaccion.update(ref(ruta), {
        telefono: limpio.telefono,
        ultimaOperacionId: idOperacion,
        modificadoEn: ahoraDelServidor(),
      });
      return { telefono: limpio.telefono };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: (leido.datos?.telefono ?? null) === limpio.telefono,
        },
      };
    },
  }));
}

/**
 * Cambia el nombre de un lector, y con él su clave. Solo el administrador.
 *
 * Si la clave nueva no tiene documento, se crea; si ya existe y apunta a este
 * mismo lector —un nombre antiguo que se recupera—, se deja como está; si
 * apunta a otro, falla con «Ya existe». La clave anterior NO se libera: el
 * nombre antiguo queda reservado (contrato §7).
 */
export function cambiarNombre({ datos, permiso, lector, nombre, operacionId, alTardar }) {
  const nombreLimpio = normalizarNombre(nombre);
  if (!esNombreDeLectorValido(nombreLimpio)) throw new ErrorDeNegocio(MENSAJE_NOMBRE_CORTO);
  const claveNueva = claveDeNombre(nombreLimpio);
  const ruta = rutas.lector(lector.id);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [lector.id], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const actual = await leer(ruta);
      if (!actual.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.lectorPerdido);
      const claveTomada = await leer(rutas.lectorClave(claveNueva));
      if (claveTomada.exists() && claveTomada.data().lector !== lector.id) {
        const idVigente = claveTomada.data().lector;
        const vigente = await leer(rutas.lector(idVigente));
        throw new ErrorDeNegocio(yaExiste(vigente.exists() ? vigente.data().nombre : idVigente));
      }
      const marca = ahoraDelServidor();
      if (!claveTomada.exists()) {
        transaccion.set(ref(rutas.lectorClave(claveNueva)), {
          lector: lector.id,
          creadoEn: marca,
          creadoPor: permiso.correo,
          creacionId: idOperacion,
        });
      }
      transaccion.update(ref(ruta), {
        nombre: nombreLimpio,
        clave: claveNueva,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      return { nombre: nombreLimpio, clave: claveNueva };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.nombre === nombreLimpio,
        },
      };
    },
  }));
}

// ------------------------------------------------------------------- libros

function revisarLibro({ titulo, autor, categoria, categorias }) {
  const tituloLimpio = normalizarNombre(titulo);
  const autorLimpio = normalizarNombre(autor);
  if (tituloLimpio.length < 2 || tituloLimpio.length > 120) {
    throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.tituloInvalido);
  }
  if (autorLimpio.length > 80) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.autorInvalido);
  // Las reglas no pueden recorrer la lista de categorías de `config/app`, así
  // que esta comprobación es del cliente y está declarada como tal.
  if (!(categorias ?? []).some((una) => una?.nombre === categoria)) {
    throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.categoriaInvalida);
  }
  return { titulo: tituloLimpio, autor: autorLimpio };
}

/** Agrega un libro. Solo el administrador. */
export function agregarLibro({ datos, permiso, codigo, titulo, autor, categoria, categorias, operacionId, alTardar }) {
  const codigoLimpio = normalizarCodigo(codigo);
  if (!esCodigoValido(codigoLimpio)) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.codigoInvalido);
  const limpio = revisarLibro({ titulo, autor, categoria, categorias });
  const ruta = rutas.libro(codigoLimpio);
  anotarIntencion({ tipo: 'alta', ruta, identificadores: [codigoLimpio], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'alta',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const existente = await leer(ruta);
      if (existente.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.codigoRepetido);
      transaccion.set(ref(ruta), {
        codigo: codigoLimpio,
        titulo: limpio.titulo,
        autor: limpio.autor,
        categoria,
        baja: false,
        prestamoAbierto: null,
        vecesPrestado: 0,
        creadoEn: ahoraDelServidor(),
        creadoPor: permiso.correo,
        creacionId: idOperacion,
      });
      return { codigo: codigoLimpio };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: { existe: leido.existe, creacionId: leido.datos?.creacionId ?? null },
      };
    },
  }));
}

/**
 * Edita un libro: título, autor, categoría y baja. Nada más; `prestamoAbierto`
 * y `vecesPrestado` los mueven los préstamos, y las reglas lo impiden (C-07).
 */
export function editarLibro({ datos, libro, titulo, autor, categoria, baja, categorias, operacionId, alTardar }) {
  const limpio = revisarLibro({ titulo, autor, categoria, categorias });
  const bajaFinal = baja === true;
  const ruta = rutas.libro(libro.codigo);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [libro.codigo], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const actual = await leer(ruta);
      if (!actual.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPerdido);
      transaccion.update(ref(ruta), {
        titulo: limpio.titulo,
        autor: limpio.autor,
        categoria,
        baja: bajaFinal,
        ultimaOperacionId: idOperacion,
        modificadoEn: ahoraDelServidor(),
      });
      return { codigo: libro.codigo };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado:
            leido.datos?.titulo === limpio.titulo &&
            leido.datos?.categoria === categoria &&
            leido.datos?.baja === bajaFinal,
        },
      };
    },
  }));
}

/** Da de baja un libro. Es una edición con `baja` en verdadero. */
export function darDeBajaLibro({ datos, libro, categorias, operacionId, alTardar }) {
  return editarLibro({
    datos,
    libro,
    titulo: libro.titulo,
    autor: libro.autor,
    categoria: libro.categoria,
    baja: true,
    categorias,
    operacionId,
    alTardar,
  });
}
