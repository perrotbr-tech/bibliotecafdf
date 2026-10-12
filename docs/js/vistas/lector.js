// Ficha de un lector, en una hoja: nombre, teléfono y lo que se puede
// cambiar. El teléfono lo cambia cualquier voluntario; el nombre, solo el
// administrador.
//
// Los préstamos del lector llegan en la Etapa 3: aquí no se adelantan.

import { ErrorDeNegocio } from '../datos.js';
import { cambiarNombre, cambiarTelefono } from '../operaciones.js';
import { MENSAJE_NOMBRE_CORTO, normalizarTelefono, nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { campoTexto, errorDeFormulario } from '../ui/campos.js';
import { el } from '../ui/dom.js';
import { abrirHoja, cerrarHoja, datoDeFicha } from '../ui/hoja.js';

const AVISO = 'lector';

export function abrirFichaDeLector({ datos, permiso, lector }) {
  const tieneTelefono = (lector.telefono ?? null) !== null;

  const acciones = [
    el('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: tieneTelefono ? 'Cambiar teléfono' : 'Agregar teléfono',
      'data-prueba': 'cambiar-telefono',
      al: {
        click: () =>
          abrirHoja({
            titulo: tieneTelefono ? 'Cambiar teléfono' : 'Agregar teléfono',
            prueba: 'hoja-telefono',
            // Guardar cierra la hoja abierta —la del formulario— y devuelve a
            // la lista: en un teléfono, volver a la ficha anterior obligaría a
            // cerrar dos veces.
            contenido: formularioDeTelefono({ datos, lector, alGuardar: () => cerrarHoja() }),
          }),
      },
    }),
  ];

  if (permiso.rol === 'admin') {
    acciones.push(
      el('button', {
        clase: 'boton boton--secundario',
        type: 'button',
        texto: 'Cambiar nombre',
        'data-prueba': 'cambiar-nombre',
        al: {
          click: () =>
            abrirHoja({
              titulo: 'Cambiar nombre',
              prueba: 'hoja-nombre',
              contenido: formularioDeNombre({ datos, permiso, lector, alGuardar: () => cerrarHoja() }),
            }),
        },
      }),
    );
  }

  const contenido = el('div', { clase: 'ficha' }, [
    el('h3', { clase: 'ficha__titulo', texto: lector.nombre ?? '', 'data-prueba': 'nombre-lector' }),
    datoDeFicha('Identificador', lector.id ?? '', { prueba: 'id-lector' }),
    datoDeFicha('Teléfono', tieneTelefono ? formatearTelefono(lector.telefono) : 'Sin teléfono', {
      prueba: 'telefono-lector',
    }),
    el('div', { clase: 'ficha__acciones' }, acciones),
  ]);

  return abrirHoja({ titulo: lector.nombre ?? 'Lector', prueba: 'hoja-lector', contenido });
}

/** `56912345678` se muestra como `+56 9 1234 5678`. */
export function formatearTelefono(telefono) {
  const digitos = String(telefono ?? '');
  if (!/^569[0-9]{8}$/u.test(digitos)) return digitos;
  return `+56 9 ${digitos.slice(3, 7)} ${digitos.slice(7)}`;
}

function formularioDeTelefono({ datos, lector, alGuardar }) {
  const telefono = campoTexto({
    id: 'nuevo-telefono',
    etiqueta: 'Teléfono',
    tipo: 'tel',
    inputmode: 'tel',
    valor: lector.telefono ?? '',
    ayuda: 'Un celular chileno: 9 1234 5678. Déjalo vacío para quitarlo.',
  });
  const fallo = errorDeFormulario('error-telefono');
  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'submit',
    texto: 'Guardar teléfono',
    'data-prueba': 'guardar-telefono',
  });

  let operacionId = null;
  telefono.control.addEventListener('input', () => {
    operacionId = null;
    fallo.limpiar();
    telefono.limpiarError();
  });

  prepararBotonGuardar(
    boton,
    async () => {
      fallo.limpiar();
      const revisado = normalizarTelefono(telefono.control.value);
      if (!revisado.ok) {
        telefono.mostrarError(revisado.motivo);
        return null;
      }
      operacionId ??= nuevoId();
      try {
        const resultado = await cambiarTelefono({
          datos,
          lector,
          telefono: telefono.control.value,
          operacionId,
          alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
        });
        if (resultado.esExito) {
          operacionId = null;
          avisar('Teléfono guardado', 'exito', { id: AVISO, duracionMs: 4000 });
          alGuardar?.(resultado);
        } else {
          fallo.mostrar(resultado.mensaje);
        }
        return resultado;
      } catch (error) {
        if (error instanceof ErrorDeNegocio) {
          operacionId = null;
          telefono.mostrarError(error.message);
          return null;
        }
        throw error;
      }
    },
    { deshabilitadoAlTerminar: () => !datos.hayRed() },
  );

  const nodo = el('form', { clase: 'formulario', 'data-prueba': 'formulario-telefono', novalidate: true }, [
    telefono.nodo,
    fallo.nodo,
    boton,
  ]);
  nodo.addEventListener('submit', (evento) => evento.preventDefault());
  if (!datos.hayRed()) boton.disabled = true;
  return nodo;
}

function formularioDeNombre({ datos, permiso, lector, alGuardar }) {
  const nombre = campoTexto({
    id: 'nuevo-nombre-lector',
    etiqueta: 'Nombre',
    valor: lector.nombre ?? '',
    maxlength: 60,
    ayuda: 'El nombre anterior queda reservado: nadie más puede usarlo.',
  });
  const fallo = errorDeFormulario('error-nombre');
  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'submit',
    texto: 'Guardar nombre',
    'data-prueba': 'guardar-nombre',
  });

  let operacionId = null;
  nombre.control.addEventListener('input', () => {
    operacionId = null;
    fallo.limpiar();
    nombre.limpiarError();
  });

  prepararBotonGuardar(
    boton,
    async () => {
      fallo.limpiar();
      operacionId ??= nuevoId();
      try {
        const resultado = await cambiarNombre({
          datos,
          permiso,
          lector,
          nombre: nombre.control.value,
          operacionId,
          alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
        });
        if (resultado.esExito) {
          operacionId = null;
          avisar('Nombre guardado', 'exito', { id: AVISO, duracionMs: 4000 });
          alGuardar?.(resultado);
        } else {
          fallo.mostrar(resultado.mensaje);
        }
        return resultado;
      } catch (error) {
        if (error instanceof ErrorDeNegocio) {
          operacionId = null;
          if (error.message === MENSAJE_NOMBRE_CORTO) nombre.mostrarError(error.message);
          else fallo.mostrar(error.message);
          return null;
        }
        throw error;
      }
    },
    { deshabilitadoAlTerminar: () => !datos.hayRed() },
  );

  const nodo = el('form', { clase: 'formulario', 'data-prueba': 'formulario-nombre', novalidate: true }, [
    nombre.nodo,
    fallo.nodo,
    boton,
  ]);
  nodo.addEventListener('submit', (evento) => evento.preventDefault());
  if (!datos.hayRed()) boton.disabled = true;
  return nodo;
}
