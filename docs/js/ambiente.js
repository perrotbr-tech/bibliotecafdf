// Selección cerrada de ambiente (contrato §1). Función pura: recibe el host,
// los parámetros de la dirección, la memoria de sesión y las configuraciones;
// devuelve a qué base apunta la app y qué puede hacer.
//
// Reglas, en este orden:
//   1. Loopback (localhost, 127.0.0.1, ::1) usa SIEMPRE el emulador. Una IP de
//      la red local no activa el emulador. `?ensayo=1` en loopback se ignora.
//   2. Una copia publicada que declara ambiente fijo usa ese ambiente.
//   3. `?ensayo=1`, o el recuerdo de esa sesión, usa ensayo.
//   4. En cualquier otro caso, producción.
// Una configuración ausente bloquea su ambiente y no inicia conexiones.

import { AMBIENTE_FIJO, BIB, CONFIGURACIONES } from './config-publica.js';

const HOSTS_LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Clave de sessionStorage, propia de esta app y de este ambiente. */
export const CLAVE_ENSAYO = `biblioteca.${BIB}.ambiente.ensayo`;

export const FRANJAS = { emulador: 'EMULADOR', ensayo: 'ENSAYO', produccion: null };

/** Un host es de loopback si es exactamente uno de los tres permitidos. */
export function esLoopback(host) {
  return HOSTS_LOOPBACK.has(String(host ?? '').toLowerCase());
}

/**
 * @param {object} entrada
 * @param {string} entrada.host             `location.hostname`
 * @param {URLSearchParams|object} [entrada.parametros]
 * @param {{getItem:Function,setItem:Function}|null} [entrada.memoriaSesion]
 * @param {object} [entrada.configuraciones]
 * @param {string|null} [entrada.ambienteFijo]
 */
export function elegirAmbiente({
  host,
  parametros = new URLSearchParams(),
  memoriaSesion = null,
  configuraciones = CONFIGURACIONES,
  ambienteFijo = AMBIENTE_FIJO,
} = {}) {
  const buscar = (nombre) =>
    typeof parametros.get === 'function' ? parametros.get(nombre) : (parametros?.[nombre] ?? null);

  const pideEnsayo = buscar('ensayo') === '1';
  let recordado = false;
  try {
    recordado = memoriaSesion?.getItem(CLAVE_ENSAYO) === '1';
  } catch {
    recordado = false; // Un navegador que bloquea el almacenamiento no cambia de ambiente.
  }

  let ambiente;
  let parametroIgnorado = false;

  if (esLoopback(host)) {
    ambiente = 'emulador';
    parametroIgnorado = pideEnsayo;
  } else if (ambienteFijo) {
    ambiente = ambienteFijo;
    parametroIgnorado = pideEnsayo && ambienteFijo !== 'ensayo';
  } else if (pideEnsayo || recordado) {
    ambiente = 'ensayo';
  } else {
    ambiente = 'produccion';
  }

  // El recuerdo se guarda solo cuando el parámetro sirvió de algo.
  if (pideEnsayo && ambiente === 'ensayo') {
    try {
      memoriaSesion?.setItem(CLAVE_ENSAYO, '1');
    } catch {
      // Sin almacenamiento la app sigue funcionando; solo no recuerda.
    }
  }

  const configuracion = configuraciones[ambiente] ?? null;
  const bloqueado = configuracion === null;

  return {
    ambiente,
    configuracion,
    bloqueado,
    motivoBloqueo: bloqueado ? 'Falta configurar este ambiente' : null,
    franja: FRANJAS[ambiente] ?? null,
    proyecto: configuracion?.projectId ?? null,
    // `?ahora=` y el acceso simulado existen solo contra el emulador.
    permiteHoraDePrueba: ambiente === 'emulador',
    permiteAccesoSimulado: ambiente === 'emulador',
    parametroEnsayoIgnorado: parametroIgnorado,
  };
}
