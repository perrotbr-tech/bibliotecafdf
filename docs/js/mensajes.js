// Plantillas de recordatorio y enlace de WhatsApp (specs/04).
// Funciones puras: reciben nombre, título y fecha ya resueltos.

/**
 * Sustitución en UNA sola pasada. Si el nombre o el título contienen
 * `{titulo}`, `{nombre}`, `$&` o `$1`, salen tal cual (R-04…R-06).
 */
export function sustituirPlantilla(plantilla, { nombre, titulo, fecha }) {
  const valores = { nombre, titulo, fecha };
  return String(plantilla ?? '').replace(/\{(nombre|titulo|fecha)\}/gu, (_m, clave) => valores[clave] ?? '');
}

/** Primera palabra del nombre del lector. */
export function primerNombre(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return '';
  return limpio.split(/\s+/u)[0];
}

/**
 * Arma el mensaje y el enlace. Si no se puede codificar, `ok` es falso.
 * @returns {{ok:true, mensaje:string, enlace:string|null, sinTelefono:boolean}|{ok:false, motivo:string}}
 */
export function armarRecordatorio({ plantilla, nombre, titulo, fecha, telefono }) {
  try {
    const mensaje = sustituirPlantilla(plantilla, {
      nombre: primerNombre(nombre),
      titulo: String(titulo ?? ''),
      fecha: String(fecha ?? ''),
    });
    if (/\{(nombre|titulo|fecha)\}/u.test(mensaje)) {
      return { ok: false, motivo: 'No se pudo armar el mensaje' };
    }
    const sinTelefono = telefono == null || telefono === '';
    if (sinTelefono) {
      return { ok: true, mensaje, enlace: null, sinTelefono: true };
    }
    if (!/^569[0-9]{8}$/u.test(String(telefono))) {
      return { ok: false, motivo: 'No se pudo armar el mensaje' };
    }
    const enlace = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    // encodeURIComponent no debe dejar el mensaje irreconocible; si falla la
    // ida y vuelta de caracteres raros, se avisa (R-16).
    if (!enlace.startsWith('https://wa.me/')) {
      return { ok: false, motivo: 'No se pudo armar el mensaje' };
    }
    return { ok: true, mensaje, enlace, sinTelefono: false };
  } catch {
    return { ok: false, motivo: 'No se pudo armar el mensaje' };
  }
}

/** ¿El último recordatorio fue en los últimos 6 días? */
export function recordadoReciente(recordadoEn, ahora, dias = 6) {
  if (recordadoEn == null || ahora == null) return false;
  const a = recordadoEn instanceof Date ? recordadoEn : recordadoEn?.toDate?.() ?? new Date(recordadoEn);
  const b = ahora instanceof Date ? ahora : new Date(ahora);
  return b.getTime() - a.getTime() <= dias * 86_400_000 && b.getTime() >= a.getTime();
}
