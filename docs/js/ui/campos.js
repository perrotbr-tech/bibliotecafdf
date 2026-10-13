// Campos de formulario, una sola vez para toda la app.
//
// Cada campo trae su etiqueta asociada por `for`, su texto de ayuda y un hueco
// para su error, porque un error que aparece lejos del campo no se ve en un
// teléfono. Nada de esto escribe HTML: todo entra como texto.

import { el } from './dom.js';

/** Campo de texto con etiqueta, ayuda y error propio. */
export function campoTexto({
  id,
  etiqueta,
  tipo = 'text',
  ayuda = null,
  valor = '',
  inputmode = null,
  autocomplete = 'off',
  maxlength = null,
}) {
  const control = el('input', {
    clase: 'campo__control',
    id,
    type: tipo,
    value: valor,
    autocomplete,
    autocapitalize: tipo === 'email' ? 'none' : 'sentences',
    spellcheck: 'false',
    inputmode,
    maxlength,
    'data-prueba': id,
  });
  const error = el('p', { clase: 'campo__error', 'data-prueba': `${id}-error`, hidden: true });
  const nodo = el('label', { clase: 'campo', for: id }, [
    el('span', { clase: 'campo__etiqueta', texto: etiqueta }),
    control,
    ayuda && el('span', { clase: 'campo__ayuda', texto: ayuda }),
    error,
  ]);
  return { nodo, control, error, ...acciones(control, error) };
}

/** Lista desplegable. `opciones` es `[{valor, texto}]`. */
export function campoSelect({ id, etiqueta, opciones, valor = null, ayuda = null }) {
  const control = el(
    'select',
    { clase: 'campo__control', id, 'data-prueba': id },
    opciones.map((una) =>
      el('option', { value: una.valor, texto: una.texto, selected: una.valor === valor ? true : false }),
    ),
  );
  if (valor !== null) control.value = valor;
  const error = el('p', { clase: 'campo__error', 'data-prueba': `${id}-error`, hidden: true });
  const nodo = el('label', { clase: 'campo', for: id }, [
    el('span', { clase: 'campo__etiqueta', texto: etiqueta }),
    control,
    ayuda && el('span', { clase: 'campo__ayuda', texto: ayuda }),
    error,
  ]);
  return { nodo, control, error, ...acciones(control, error) };
}

/** Casilla obligatoria, como el aviso de datos del alta de un lector. */
export function campoCasilla({ id, etiqueta }) {
  const control = el('input', { clase: 'casilla__control', id, type: 'checkbox', 'data-prueba': id });
  const error = el('p', { clase: 'campo__error', 'data-prueba': `${id}-error`, hidden: true });
  const nodo = el('div', {}, [
    el('label', { clase: 'casilla', for: id }, [control, el('span', { texto: etiqueta })]),
    error,
  ]);
  return {
    nodo,
    control,
    error,
    get marcada() {
      return control.checked === true;
    },
    ...acciones(control, error),
  };
}

function acciones(control, error) {
  return {
    mostrarError: (texto) => {
      error.textContent = texto;
      error.hidden = false;
      control.setAttribute('aria-invalid', 'true');
    },
    limpiarError: () => {
      error.hidden = true;
      control.removeAttribute('aria-invalid');
    },
  };
}

/** Error de un formulario completo, el que no pertenece a un campo. */
export function errorDeFormulario(prueba = 'error-formulario') {
  const nodo = el('p', { clase: 'campo__error', 'data-prueba': prueba, hidden: true, role: 'alert' });
  return {
    nodo,
    mostrar: (texto) => {
      nodo.textContent = texto;
      nodo.hidden = false;
    },
    limpiar: () => {
      nodo.hidden = true;
    },
  };
}
