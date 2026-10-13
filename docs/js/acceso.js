// Inicio de sesión con Google y control de acceso.
//
// Solo entra quien tiene un documento activo en `voluntarios` con el correo de
// su cuenta de Google verificada (base §7.1). Iniciar sesión con Google no
// basta: la app pregunta siempre a la base, y las reglas lo exigen aparte.

import { rutas } from './config-publica.js';
import { normalizarCorreo } from './texto.js';

export const MENSAJES_ACCESO = {
  ventanaBloqueada:
    'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a tocar Entrar.',
  cancelado: 'Se cerró la ventana de Google antes de entrar.',
  sinRed: 'Sin conexión: no se pudo entrar.',
  error: 'No se pudo entrar. Inténtalo de nuevo.',
};

/** Traduce un error de Firebase Auth a un mensaje para la persona. */
export function mensajeDeErrorDeEntrada(error) {
  const codigo = String(error?.code ?? '');
  if (codigo.includes('popup-blocked')) return MENSAJES_ACCESO.ventanaBloqueada;
  if (codigo.includes('popup-closed-by-user') || codigo.includes('cancelled-popup-request')) {
    return MENSAJES_ACCESO.cancelado;
  }
  if (codigo.includes('network-request-failed')) return MENSAJES_ACCESO.sinRed;
  return MENSAJES_ACCESO.error;
}

/** Abre la ventana de Google. Devuelve `{ok}` o `{ok:false, mensaje}`. */
export async function entrarConGoogle({ auth, sdkAuth }) {
  const proveedor = new sdkAuth.GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await sdkAuth.signInWithPopup(auth, proveedor);
    return { ok: true };
  } catch (error) {
    return { ok: false, mensaje: mensajeDeErrorDeEntrada(error), error };
  }
}

export async function salir({ auth, sdkAuth }) {
  await sdkAuth.signOut(auth);
}

/**
 * Decide qué puede hacer una cuenta. Función pura: recibe la sesión y el
 * documento del voluntario tal como vino de la base.
 */
export function permisoDe({ sesion, documento }) {
  if (!sesion) return { estado: 'sin-sesion', correo: null, rol: null, nombre: null };
  const correo = normalizarCorreo(sesion.email);
  if (!sesion.emailVerified) return { estado: 'sin-acceso', correo, rol: null, nombre: null, motivo: 'correo-sin-verificar' };
  if (!documento) return { estado: 'sin-acceso', correo, rol: null, nombre: null, motivo: 'no-esta-en-la-lista' };
  if (documento.activo !== true) return { estado: 'sin-acceso', correo, rol: null, nombre: null, motivo: 'inactivo' };
  return {
    estado: 'adentro',
    correo,
    rol: documento.rol === 'admin' ? 'admin' : 'voluntario',
    nombre: documento.nombre ?? correo,
  };
}

export function esAdministrador(permiso) {
  return permiso?.estado === 'adentro' && permiso.rol === 'admin';
}

/** Un error de la escucha que significa de verdad «ya no tienes acceso». */
export function esPerdidaDeAcceso(error) {
  return String(error?.code ?? '').includes('permission-denied');
}

/**
 * Escucha el documento del voluntario y avisa cada vez que cambia el permiso.
 * Si a alguien lo desactivan con la app abierta, la siguiente lectura llega
 * denegada y la app pasa a «Sin acceso» sin un error sin tratar (A-15).
 *
 * Un corte de red NO es una pérdida de acceso: eso se avisa aparte y la sesión
 * se conserva. Si no, bastaría quedarse sin señal para que la app echara a
 * alguien de su propia cuenta.
 *
 * Devuelve la función que suelta la escucha.
 */
export function vigilarPermiso({ datos, sesion, alCambiar, alFallar = null }) {
  const correo = normalizarCorreo(sesion.email);
  return datos.escucharDocumento(
    rutas.voluntario(correo),
    (documento) => alCambiar(permisoDe({ sesion, documento })),
    (error) => {
      if (esPerdidaDeAcceso(error)) alCambiar(permisoDe({ sesion, documento: null }));
      else alFallar?.(error);
    },
  );
}
