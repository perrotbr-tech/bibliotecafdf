// Las escrituras de la app, en un solo lugar.
//
// Cada una usa la forma de guardar de `datos.guardar` (base §6): transacción,
// botón bloqueado por quien llama, éxito solo con respuesta del servidor y, si
// el resultado queda incierto, comprobación por IDENTIDAD de la operación.
//
// Viven aquí y no en las pantallas por dos razones: las pruebas de
// concurrencia necesitan lanzarlas sin interfaz, y varias pantallas comparten
// la misma operación.
//
// El `operacionId` lo recibe de fuera: es estable desde el primer toque y no
// cambia entre reintentos (contrato §3). Lo que sí se resuelve DENTRO de cada
// intento es el correlativo del lector o del préstamo, porque un intento
// abortado puede haberlo dejado tomado por otra persona.

import { idDeLector, rutas } from './config-publica.js';
import { ErrorDeNegocio, olvidarIntencion, recordarIntencion } from './datos.js';
import { diaEnChile, esSabado, temporadaDe, venceElDe } from './fechas.js';
import {
  MENSAJE_NOMBRE_CORTO,
  claveDeNombre,
  esCodigoValido,
  esNombreDeLectorValido,
  normalizarCodigo,
  normalizarNombre,
  normalizarTelefono,
  nuevoId,
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
  intentaloDeNuevoPrestamo: 'Hay mucho movimiento. Inténtalo de nuevo',
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
  libroPrestado: 'Ese libro acaba de prestarse en otro teléfono',
  libroYaSalio: 'Ese libro ya salió otra vez',
  libroDeBaja: 'Ese libro está de baja y no se puede prestar',
  lectorFusionado: 'Ese lector está unido a otro. Busca al lector vigente',
  prestamoCerrado: 'Ese préstamo ya no está abierto',
  prestamoNoDevuelto: 'Ese préstamo no está devuelto',
  faltaCalendario: 'Falta el calendario de ese sábado. Avísale al administrador',
  noEsSabado: 'Solo se presta en sábado. Usa «Registrar desde papel» si eres administrador',
  faltaMotivo: 'El motivo va de 10 a 200 caracteres',
  fechaFutura: 'La fecha de salida no puede ser futura',
  plazoInvalido: 'Elige un plazo de 1 a 4 sábados',
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

// --------------------------------------------------------------- préstamos

/** Intentos de un préstamo cuando pierde la carrera del contador o del libro. */
export const INTENTOS_DE_PRESTAMO = 5;

/**
 * Presta un libro. El `prestamoId` es estable desde el primer toque; el
 * `numero` se resuelve dentro de cada intento.
 *
 * @param {object} entrada
 * @param {boolean} [entrada.registroDiferido]
 * @param {string|null} [entrada.motivoRegistroDiferido]
 * @param {string} [entrada.salidaDia]  Solo en diferido; en normal sale del reloj.
 * @param {Date} entrada.ahora  Hora verificada del cliente (solo para salirDia).
 */
export async function prestarLibro({
  datos,
  permiso,
  libroCodigo,
  lectorId,
  plazoSabados,
  ahora,
  operacionId,
  prestamoId = null,
  registroDiferido = false,
  motivoRegistroDiferido = null,
  salidaDia = null,
  alTardar,
}) {
  const codigo = normalizarCodigo(libroCodigo);
  const plazo = Number(plazoSabados);
  if (!Number.isInteger(plazo) || plazo < 1 || plazo > 4) {
    throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.plazoInvalido);
  }
  if (!ahora) throw new ErrorDeNegocio('Hora pendiente');

  let diaSalida;
  let diferido = false;
  let motivo = null;

  if (registroDiferido) {
    if (permiso.rol !== 'admin') throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.noEsSabado);
    diferido = true;
    motivo = String(motivoRegistroDiferido ?? '').trim();
    if (motivo.length < 10 || motivo.length > 200) {
      throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaMotivo);
    }
    diaSalida = salidaDia;
    if (!esSabado(diaSalida)) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.noEsSabado);
    if (diaSalida > diaEnChile(ahora)) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.fechaFutura);
  } else {
    diaSalida = diaEnChile(ahora);
    if (!esSabado(diaSalida)) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.noEsSabado);
  }

  const id = prestamoId ?? nuevoId();
  anotarIntencion({ tipo: 'alta', ruta: rutas.prestamo(id), identificadores: [id, codigo], operacionId });

  for (let intento = 1; intento <= INTENTOS_DE_PRESTAMO; intento += 1) {
    const registro = {};
    const resultado = await unIntentoDePrestamo({
      datos,
      permiso,
      codigo,
      lectorId,
      plazo,
      diaSalida,
      diferido,
      motivo,
      operacionId,
      prestamoId: id,
      alTardar,
      registro,
    });

    if (resultado.estado !== 'denegado' && resultado.estado !== 'conflicto') {
      return resolverIntencion(resultado);
    }

    // Conflicto de negocio (libro ya prestado, etc.): no reintentar.
    if (resultado.estado === 'conflicto') return resolverIntencion(resultado);

    // Una denegación en un préstamo puede ser cuatro cosas, y se distinguen
    // mirando los datos, igual que en el alta de lector.
    //
    // 1. El libro ya salió prestado: carrera de libro, y es un conflicto. Si
    //    ni el libro se puede leer, la cuenta perdió el permiso: la denegación
    //    se devuelve tal cual, sin pasar por los otros caminos.
    const libro = await datos.leerDelServidor(rutas.libro(codigo));
    if (libro.estado === 'denegada') return resolverIntencion(resultado);
    if (libro.estado === 'ok' && libro.existe && libro.datos?.prestamoAbierto) {
      return resolverIntencion({
        ...resultado,
        estado: 'conflicto',
        esExito: false,
        mensaje: MENSAJES_DE_OPERACION.libroPrestado,
      });
    }

    // 2. Falta el calendario de ese sábado.
    const cal = await datos.leerDelServidor(rutas.diaCalendario(diaSalida));
    if (cal.estado === 'ok' && !cal.existe) {
      return resolverIntencion({
        ...resultado,
        mensaje: MENSAJES_DE_OPERACION.faltaCalendario,
      });
    }

    // 3. El contador no se puede ni leer, o no se movió: entonces no hubo
    //    carrera y el permiso está denegado de verdad —cuenta desactivada a
    //    mitad de la operación, mantenimiento puesto—. Hasta que la
    //    contraprueba de esta entrega lo encontró, cualquiera de esas dos
    //    cosas acababa en «Hay mucho movimiento», que invita a repetir algo
    //    que no puede funcionar. La denegación se devuelve tal cual.
    const contadores = await datos.leerDelServidor(rutas.configContadores());
    if (contadores.estado === 'denegada') return resolverIntencion(resultado);

    const sigueIgual =
      contadores.estado === 'ok' &&
      registro.ultimoPrestamoLeido !== undefined &&
      Number(contadores.datos?.ultimoPrestamo ?? -1) === registro.ultimoPrestamoLeido;
    if (sigueIgual) {
      const control = await datos.leerDelServidor(rutas.configControl());
      const bloqueado = control.estado === 'ok' && (control.datos?.bloqueo ?? null) !== null;
      return resolverIntencion({
        ...resultado,
        mensaje: bloqueado ? MENSAJES_DE_OPERACION.enMantenimiento : resultado.mensaje,
      });
    }

    // 4. Se movió el contador: fue una carrera. Se reintenta con el mismo
    //    `operacionId` y un contador recién leído.
    if (intento === INTENTOS_DE_PRESTAMO) {
      return resolverIntencion({
        ...resultado,
        estado: 'carrera-perdida',
        mensaje: MENSAJES_DE_OPERACION.intentaloDeNuevoPrestamo,
      });
    }
  }
  throw new Error('prestarLibro: el bucle de intentos terminó sin resultado');
}

function unIntentoDePrestamo({
  datos,
  permiso,
  codigo,
  lectorId,
  plazo,
  diaSalida,
  diferido,
  motivo,
  operacionId,
  prestamoId,
  alTardar,
  registro = {},
}) {
  return datos.guardar({
    tipo: 'alta',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const libro = await leer(rutas.libro(codigo));
      if (!libro.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPerdido);
      const datosLibro = libro.data();
      if (datosLibro.baja === true) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroDeBaja);
      if (datosLibro.prestamoAbierto) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPrestado);

      const lector = await leer(rutas.lector(lectorId));
      if (!lector.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.lectorPerdido);
      if (lector.data().fusionadoEn != null) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.lectorFusionado);

      const cal = await leer(rutas.diaCalendario(diaSalida));
      if (!cal.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaCalendario);
      const datosCal = cal.data();
      const venceEl = datosCal.vencimientos?.[plazo - 1];
      if (!venceEl) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaCalendario);
      const temporada = datosCal.temporada ?? temporadaDe(diaSalida);

      const contadores = await leer(rutas.configContadores());
      if (!contadores.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaConfiguracion);
      const leido = Number(contadores.data().ultimoPrestamo ?? 0);
      registro.ultimoPrestamoLeido = leido;
      const numero = leido + 1;
      const marca = ahoraDelServidor();

      transaccion.set(ref(rutas.prestamo(prestamoId)), {
        numero,
        libro: codigo,
        lector: lectorId,
        prestadoEn: marca,
        salidaDia: diaSalida,
        plazoSabados: plazo,
        registroDiferido: diferido,
        motivoRegistroDiferido: diferido ? motivo : null,
        venceEl,
        temporada,
        estado: 'abierto',
        devueltoEn: null,
        devueltoATiempo: null,
        correccionATiempo: null,
        devueltoPor: null,
        anuladoEn: null,
        anuladoPor: null,
        recordadoEn: null,
        recordadoPor: null,
        creadoEn: marca,
        creadoPor: permiso.correo,
        creacionId: idOperacion,
        origen: 'app',
      });
      transaccion.update(ref(rutas.libro(codigo)), {
        prestamoAbierto: prestamoId,
        vecesPrestado: Number(datosLibro.vecesPrestado ?? 0) + 1,
      });
      transaccion.update(ref(rutas.configContadores()), {
        ultimoPrestamo: numero,
        ultimoPrestamoId: prestamoId,
      });
      return {
        prestamoId,
        numero,
        codigo,
        lectorId,
        salidaDia: diaSalida,
        plazoSabados: plazo,
        venceEl: venceElDe(diaSalida, plazo),
        temporada,
      };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(rutas.prestamo(prestamoId));
      return {
        estado: leido.estado,
        lectura: { existe: leido.existe, creacionId: leido.datos?.creacionId ?? null },
      };
    },
  });
}

/** Devuelve un préstamo abierto. */
export function devolverPrestamo({ datos, permiso, prestamoId, operacionId, alTardar }) {
  const ruta = rutas.prestamo(prestamoId);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [prestamoId], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const prestamo = await leer(ruta);
      if (!prestamo.exists()) throw new ErrorDeNegocio('Ese préstamo ya no está');
      const datosP = prestamo.data();
      if (datosP.estado !== 'abierto') throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.prestamoCerrado);

      const libro = await leer(rutas.libro(datosP.libro));
      if (!libro.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPerdido);

      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        estado: 'devuelto',
        devueltoEn: marca,
        devueltoATiempo: null,
        correccionATiempo: null,
        devueltoPor: permiso.correo,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      if (libro.data().prestamoAbierto === prestamoId) {
        transaccion.update(ref(rutas.libro(datosP.libro)), { prestamoAbierto: null });
      }
      return { prestamoId, libro: datosP.libro, titulo: libro.data().titulo };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.estado === 'devuelto',
        },
      };
    },
  }));
}

/** Anula un préstamo abierto. */
export function anularPrestamo({ datos, permiso, prestamoId, operacionId, alTardar }) {
  const ruta = rutas.prestamo(prestamoId);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [prestamoId], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const prestamo = await leer(ruta);
      if (!prestamo.exists()) throw new ErrorDeNegocio('Ese préstamo ya no está');
      const datosP = prestamo.data();
      if (datosP.estado !== 'abierto') throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.prestamoCerrado);

      const libro = await leer(rutas.libro(datosP.libro));
      if (!libro.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPerdido);
      const veces = Number(libro.data().vecesPrestado ?? 0);

      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        estado: 'anulado',
        anuladoEn: marca,
        anuladoPor: permiso.correo,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      transaccion.update(ref(rutas.libro(datosP.libro)), {
        prestamoAbierto: null,
        vecesPrestado: Math.max(0, veces - 1),
      });
      return { prestamoId, libro: datosP.libro };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.estado === 'anulado',
        },
      };
    },
  }));
}

/** Reabre una devolución si el libro sigue libre. */
export function reabrirPrestamo({ datos, permiso, prestamoId, operacionId, alTardar }) {
  const ruta = rutas.prestamo(prestamoId);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [prestamoId], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const prestamo = await leer(ruta);
      if (!prestamo.exists()) throw new ErrorDeNegocio('Ese préstamo ya no está');
      const datosP = prestamo.data();
      if (datosP.estado !== 'devuelto') throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.prestamoNoDevuelto);

      const libro = await leer(rutas.libro(datosP.libro));
      if (!libro.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroPerdido);
      if (libro.data().prestamoAbierto) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.libroYaSalio);

      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        estado: 'abierto',
        devueltoEn: null,
        devueltoATiempo: null,
        correccionATiempo: null,
        devueltoPor: null,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      transaccion.update(ref(rutas.libro(datosP.libro)), { prestamoAbierto: prestamoId });
      return { prestamoId, libro: datosP.libro };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.estado === 'abierto',
        },
      };
    },
  }));
}

/** Administrador corrige «Fue devuelto a tiempo». */
export function corregirATiempo({ datos, permiso, prestamoId, valor, motivo, operacionId, alTardar }) {
  const motivoLimpio = String(motivo ?? '').trim();
  if (motivoLimpio.length < 10 || motivoLimpio.length > 200) {
    throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaMotivo);
  }
  const ruta = rutas.prestamo(prestamoId);
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: [prestamoId], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const prestamo = await leer(ruta);
      if (!prestamo.exists()) throw new ErrorDeNegocio('Ese préstamo ya no está');
      if (prestamo.data().estado !== 'devuelto') {
        throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.prestamoNoDevuelto);
      }
      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        devueltoATiempo: valor === true,
        correccionATiempo: { por: permiso.correo, en: marca, motivo: motivoLimpio },
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      return { prestamoId, valor: valor === true };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.devueltoATiempo === (valor === true),
        },
      };
    },
  }));
}

/**
 * Anota que se abrió WhatsApp. No se bloquea sin conexión en la UI; si falla,
 * el enlace ya se abrió y la fila lo dice.
 */
export function anotarRecordatorio({ datos, permiso, prestamoId, operacionId, alTardar }) {
  const ruta = rutas.prestamo(prestamoId);
  return datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const prestamo = await leer(ruta);
      if (!prestamo.exists()) throw new ErrorDeNegocio('Ese préstamo ya no está');
      if (prestamo.data().estado !== 'abierto') {
        throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.prestamoCerrado);
      }
      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        recordadoEn: marca,
        recordadoPor: permiso.correo,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      return { prestamoId };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.recordadoPor === permiso.correo,
        },
      };
    },
  });
}

/** Guarda las plantillas de mensaje (solo administrador). */
export function guardarPlantillas({ datos, mensajeAtraso, mensajePrevio, operacionId, alTardar }) {
  const atraso = String(mensajeAtraso ?? '');
  const previo = String(mensajePrevio ?? '');
  if (atraso.length < 10 || atraso.length > 400 || previo.length < 10 || previo.length > 400) {
    throw new ErrorDeNegocio('Cada mensaje va de 10 a 400 caracteres');
  }
  const ruta = rutas.configApp();
  anotarIntencion({ tipo: 'cambio', ruta, identificadores: ['config/app'], operacionId });

  return resolverIntencionDe(datos.guardar({
    tipo: 'cambio',
    operacionId,
    alTardar,
    cuerpo: async (transaccion, { leer, ref, ahoraDelServidor, operacionId: idOperacion }) => {
      const actual = await leer(ruta);
      if (!actual.exists()) throw new ErrorDeNegocio(MENSAJES_DE_OPERACION.faltaConfiguracion);
      const marca = ahoraDelServidor();
      transaccion.update(ref(ruta), {
        mensajeAtraso: atraso,
        mensajePrevio: previo,
        ultimaOperacionId: idOperacion,
        modificadoEn: marca,
      });
      return { mensajeAtraso: atraso, mensajePrevio: previo };
    },
    comprobar: async () => {
      const leido = await datos.leerDelServidor(ruta);
      return {
        estado: leido.estado,
        lectura: {
          existe: leido.existe,
          ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
          aplicado: leido.datos?.mensajeAtraso === atraso && leido.datos?.mensajePrevio === previo,
        },
      };
    },
  }));
}
