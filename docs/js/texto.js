// Funciones puras de texto: normalización, validación e identificadores.
// Ninguna toca el documento ni el reloj.
//
// La app nunca inserta texto escrito por una persona como HTML (base §7.10).
// Por eso aquí no hay ninguna función que produzca HTML: las vistas escriben
// con `textContent`. `escaparTexto` existe solo para los pocos lugares donde
// hace falta comparar o registrar un texto en un mensaje.

/**
 * Correo de Google en la forma que se guarda: sin espacios (tampoco internos)
 * y en minúsculas. « Ana.Rojas@Example.com » da `ana.rojas@example.com`.
 */
export function normalizarCorreo(valor) {
  return String(valor ?? '')
    .replace(/\s+/gu, '')
    .toLowerCase();
}

/** Forma mínima de un correo. No certifica que la casilla exista. */
export function esCorreoValido(valor) {
  const correo = normalizarCorreo(valor);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(correo);
}

/** Nombre de un voluntario: de 1 a 60 caracteres, sin espacios en los extremos. */
export function normalizarNombre(valor) {
  return String(valor ?? '').replace(/\s+/gu, ' ').trim();
}

export function esNombreValido(valor) {
  const nombre = normalizarNombre(valor);
  return nombre.length >= 1 && nombre.length <= 60;
}

export const ROLES = ['admin', 'voluntario'];

export function esRolValido(valor) {
  return ROLES.includes(valor);
}

/**
 * Identificador aleatorio para `operacionId`, `creacionId` y
 * `sincronizacionId`. Sin guiones para que entre sin ruido en las reglas.
 */
export function nuevoId() {
  return globalThis.crypto.randomUUID().replace(/-/gu, '');
}

/** Formato que las reglas de seguridad exigen a un identificador de operación. */
export const FORMATO_ID = /^[0-9a-f]{32}$/u;

export function esIdValido(valor) {
  return typeof valor === 'string' && FORMATO_ID.test(valor);
}

/** Texto plano, con los caracteres de control fuera. */
export function escaparTexto(valor) {
  return String(valor ?? '').replace(/[\u0000-\u001F\u007F]/gu, '');
}

/**
 * Sustituye `{marca}` por su valor en UNA pasada, de modo que un valor que
 * contenga `{otra}` no se vuelva a sustituir (base §7.10).
 */
export function sustituirUnaPasada(plantilla, valores) {
  return String(plantilla ?? '').replace(/\{(\w+)\}/gu, (completo, nombre) =>
    Object.hasOwn(valores ?? {}, nombre) ? String(valores[nombre]) : completo,
  );
}

// ---------------------------------------------------------------------------
// Etapa 2: lectores, libros y búsqueda.
// ---------------------------------------------------------------------------

/**
 * Clave de un nombre de lector: lo que garantiza que dos lectores no compartan
 * nombre (base §5).
 *
 * Minúsculas; sin tildes ni diacríticos, pero conservando la `ñ`; `ı` pasa a
 * `i`; se elimina todo lo que no sea una letra de la `a` a la `z`, `ñ`, un
 * dígito o un espacio —lo que incluye los caracteres de ancho cero y las letras
 * de otros alfabetos—; espacios repetidos unidos; extremos recortados.
 *
 * «  María  José PÉREZ » da `maria jose perez`. «Peña» da `peña`, que NO es
 * `pena`: por eso la ñ se protege antes de descomponer.
 */
export function claveDeNombre(nombre) {
  // A forma compuesta primero: una «ñ» escrita como n + tilde combinante tiene
  // que llegar entera a la protección de abajo.
  let texto = String(nombre ?? '').normalize('NFC').toLowerCase();
  texto = texto.replace(/ı/gu, 'i');
  // La ñ se aparta mientras se quitan los diacríticos, y vuelve después.
  const MARCA = '\u0001';
  texto = texto.replace(/ñ/gu, MARCA);
  texto = texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  texto = texto.replace(new RegExp(MARCA, 'gu'), 'ñ');
  texto = texto.replace(/[^a-z0-9ñ ]/gu, '');
  return texto.replace(/ {2,}/gu, ' ').trim();
}

/** Formato que las reglas de seguridad exigen a una clave. */
export const FORMATO_CLAVE = /^[a-z0-9ñ ]+$/u;

/** Cuántas letras tiene una clave. Los dígitos no cuentan. */
export function letrasDeClave(clave) {
  return (String(clave ?? '').match(/[a-zñ]/gu) ?? []).length;
}

export const MENSAJE_NOMBRE_CORTO = 'Escribe al menos 3 letras';

/**
 * Nombre de lector válido: de 3 a 60 caracteres ya recortado, y con una clave
 * de al menos 3 letras. Se acepta una sola palabra: hay lectores inscritos por
 * su apodo.
 */
export function esNombreDeLectorValido(nombre) {
  const limpio = normalizarNombre(nombre);
  if (limpio.length < 3 || limpio.length > 60) return false;
  return letrasDeClave(claveDeNombre(limpio)) >= 3;
}

const DIGITOS_ANCHO_COMPLETO = /[０-９]/gu;

/**
 * Teléfono chileno. Acepta 9 dígitos que empiezan con 9, u 11 que empiezan con
 * 569; ignora espacios, guiones, paréntesis, puntos y el `+`; convierte los
 * dígitos de ancho completo. Se guarda siempre como `569XXXXXXXX`.
 *
 * Devuelve `{ ok: true, telefono }` —con `telefono` en null si venía vacío— o
 * `{ ok: false, motivo }`. Nunca se descarta un texto en silencio.
 */
export function normalizarTelefono(valor) {
  const crudo = String(valor ?? '')
    .replace(DIGITOS_ANCHO_COMPLETO, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .trim();
  if (crudo === '') return { ok: true, telefono: null };

  const digitos = crudo.replace(/[\s()+.-]/gu, '');
  if (!/^[0-9]+$/u.test(digitos)) {
    return { ok: false, motivo: 'Escribe solo números, por ejemplo 9 1234 5678' };
  }
  if (/^9[0-9]{8}$/u.test(digitos)) return { ok: true, telefono: `56${digitos}` };
  if (/^569[0-9]{8}$/u.test(digitos)) return { ok: true, telefono: digitos };
  return { ok: false, motivo: 'Un celular chileno tiene 9 dígitos y empieza con 9' };
}

export const FORMATO_TELEFONO = /^569[0-9]{8}$/u;

/** Formato del código de un libro. */
export const FORMATO_CODIGO = /^[A-Z]{2,4}[0-9]{3,4}[A-Z]?$/u;

/** Código de libro tal como se guarda: mayúsculas y sin espacios. */
export function normalizarCodigo(valor) {
  return String(valor ?? '').replace(/\s+/gu, '').toUpperCase();
}

export function esCodigoValido(valor) {
  return FORMATO_CODIGO.test(normalizarCodigo(valor));
}

/**
 * Código sugerido para una categoría: su prefijo más el mayor número que ya
 * exista en ella, más uno, con al menos tres cifras. Después de `INF027` viene
 * `INF028`; después de `INF999`, `INF1000`. Los huecos no se rellenan.
 */
export function codigoSugerido(prefijo, codigosExistentes = []) {
  const marca = String(prefijo ?? '').toUpperCase();
  if (marca === '') return '';
  let mayor = 0;
  for (const codigo of codigosExistentes) {
    const coincide = /^([A-Z]{2,4})([0-9]{3,4})([A-Z]?)$/u.exec(normalizarCodigo(codigo));
    if (!coincide || coincide[1] !== marca) continue;
    mayor = Math.max(mayor, Number(coincide[2]));
  }
  return `${marca}${String(mayor + 1).padStart(3, '0')}`;
}

/**
 * Texto listo para buscar: minúsculas, sin diacríticos y con los espacios
 * unidos. NO se quitan los signos: una búsqueda con paréntesis o barras
 * simplemente no encuentra nada, que es lo que se espera, en vez de romperse.
 * Aquí nunca se arma una expresión regular con lo que escribe una persona.
 */
export function normalizarBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Prepara un libro para buscarlo. Se hace UNA vez al recibir la colección, no
 * en cada tecla: con cinco mil libros, normalizar por pulsación no entra en los
 * 100 ms que pide la etapa.
 */
export function prepararBusquedaDeLibro(libro) {
  const codigo = normalizarCodigo(libro?.codigo ?? '');
  return {
    texto: normalizarBusqueda(`${libro?.titulo ?? ''} ${libro?.autor ?? ''} ${codigo}`),
    codigo: codigo.toLowerCase(),
  };
}

/** Prepara un lector para buscarlo por nombre. */
export function prepararBusquedaDeLector(lector) {
  return { texto: normalizarBusqueda(lector?.nombre ?? '') };
}

/**
 * ¿Lo preparado coincide con lo que se escribió? Una consulta sin espacios se
 * compara también contra el código, para que «inf 006» encuentre INF006.
 */
export function coincideBusqueda(preparado, consulta) {
  const buscado = normalizarBusqueda(consulta);
  if (buscado === '') return true;
  if (preparado?.texto?.includes(buscado)) return true;
  const sinEspacios = buscado.replace(/ /gu, '');
  return sinEspacios !== '' && Boolean(preparado?.codigo?.includes(sinEspacios));
}
