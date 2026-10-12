// Barra superior: nombre de la biblioteca y fecha de hoy en hora de Chile.
// Sin hora verificada dice «Hora pendiente»: nunca muestra la hora del
// teléfono (contrato §2).
import { textoFechaLarga } from '../fechas.js';

export function mostrarBarraSuperior({ visible = true } = {}) {
  const barra = document.getElementById('barra-superior');
  if (barra) barra.hidden = !visible;
}

export function ponerNombreBiblioteca(nombre) {
  const nodo = document.getElementById('nombre-biblioteca');
  if (nodo) nodo.textContent = nombre || 'Biblioteca';
}

/** @param {Date|null} instante  null significa que no hay hora verificada. */
export function ponerFecha(instante) {
  const nodo = document.getElementById('fecha-hoy');
  if (!nodo) return;
  nodo.textContent = instante ? textoFechaLarga(instante) : 'Hora pendiente';
  nodo.dataset.horaPendiente = instante ? 'no' : 'si';
}

/** Franja de ambiente: EMULADOR o ENSAYO, con el proyecto configurado. */
export function ponerFranja({ franja, proyecto }) {
  const nodo = document.getElementById('franja');
  if (!nodo) return;
  if (!franja) {
    nodo.hidden = true;
    nodo.textContent = '';
    return;
  }
  nodo.hidden = false;
  nodo.textContent = proyecto ? `${franja} · ${proyecto}` : franja;
}
