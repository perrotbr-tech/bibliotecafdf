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
