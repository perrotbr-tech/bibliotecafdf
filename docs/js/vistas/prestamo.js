// Ficha del préstamo: devolver, anular, reabrir, corregir a tiempo.

import {
  dentroDeDiezMinutos,
  diaEnChile,
  fueATiempo,
  textoFechaLarga,
  textoFechaVencimiento,
} from '../fechas.js';
import { anularPrestamo, corregirATiempo, devolverPrestamo, reabrirPrestamo } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { campoTexto, errorDeFormulario } from '../ui/campos.js';
import { el } from '../ui/dom.js';
import { abrirHoja, cerrarHoja, datoDeFicha } from '../ui/hoja.js';

export function abrirFichaDePrestamo({ datos, permiso, prestamo, ahora }) {
  const anio = ahora ? Number(diaEnChile(ahora).slice(0, 4)) : null;
  const esAdmin = permiso.rol === 'admin';
  const acciones = [];

  if (prestamo.estado === 'abierto') {
    acciones.push(botonAccion({
      texto: 'Devolver',
      prueba: 'ficha-devolver',
      peligro: false,
      ejecutar: () => devolverPrestamo({
        datos, permiso, prestamoId: prestamo.id, operacionId: nuevoId(),
        alTardar: (t) => avisar(t, 'atencion', { id: 'prestamo' }),
      }),
      exito: `Devuelto: ${prestamo.titulo}`,
    }));

    const puedeAnular = esAdmin || (
      prestamo.creadoPor === permiso.correo
      && dentroDeDiezMinutos(prestamo.prestadoEn, ahora)
    );
    if (puedeAnular) {
      acciones.push(el('button', {
        clase: 'boton boton--peligro',
        type: 'button',
        texto: 'Anular préstamo',
        'data-prueba': 'ficha-anular',
        al: {
          click: () => abrirHoja({
            titulo: 'Anular préstamo',
            prueba: 'hoja-anular',
            contenido: confirmacion({
              texto: '¿Anular este préstamo? El número no se reutiliza.',
              prueba: 'confirmar-anular',
              peligro: true,
              ejecutar: () => anularPrestamo({
                datos, permiso, prestamoId: prestamo.id, operacionId: nuevoId(),
              }),
              exito: 'Préstamo anulado',
            }),
          }),
        },
      }));
    } else {
      acciones.push(el('p', {
        clase: 'lista__detalle',
        texto: 'Solo el administrador puede anularlo',
        'data-prueba': 'anular-bloqueado',
      }));
    }
  }

  if (prestamo.estado === 'devuelto') {
    const puedeReabrir = esAdmin || (
      prestamo.devueltoPor === permiso.correo
      && dentroDeDiezMinutos(prestamo.devueltoEn, ahora)
    );
    if (puedeReabrir) {
      acciones.push(el('button', {
        clase: 'boton boton--secundario',
        type: 'button',
        texto: 'Reabrir',
        'data-prueba': 'ficha-reabrir',
        al: {
          click: () => abrirHoja({
            titulo: 'Reabrir devolución',
            prueba: 'hoja-reabrir',
            contenido: confirmacion({
              texto: '¿Reabrir esta devolución? El libro vuelve a quedar prestado.',
              prueba: 'confirmar-reabrir',
              ejecutar: () => reabrirPrestamo({
                datos, permiso, prestamoId: prestamo.id, operacionId: nuevoId(),
              }),
              exito: 'Devolución reabierta',
            }),
          }),
        },
      }));
    } else {
      acciones.push(el('p', {
        clase: 'lista__detalle',
        texto: 'Solo el administrador puede corregirlo',
        'data-prueba': 'reabrir-bloqueado',
      }));
    }

    if (esAdmin) {
      acciones.push(formularioCorreccion({ datos, permiso, prestamo }));
    }
  }

  const aTiempo = fueATiempo(prestamo);
  const contenido = el('div', { clase: 'ficha', 'data-prueba': 'ficha-prestamo' }, [
    el('h3', { clase: 'ficha__titulo', texto: prestamo.titulo ?? prestamo.libro }),
    datoDeFicha('Número', prestamo.numero != null ? `P${prestamo.numero}` : '—', { prueba: 'numero-prestamo' }),
    datoDeFicha('Libro', `${prestamo.libro} · ${prestamo.titulo ?? ''}`, { prueba: 'libro-prestamo' }),
    datoDeFicha('Lector', prestamo.nombreLector ?? prestamo.lector, { prueba: 'lector-prestamo' }),
    datoDeFicha('Salió el', prestamo.salidaDia ?? '—', { prueba: 'salida-prestamo' }),
    prestamo.registroDiferido
      ? datoDeFicha('Registrado el', textoDeMarca(prestamo.prestadoEn), { prueba: 'registrado-prestamo' })
      : null,
    datoDeFicha(
      'Vence el',
      prestamo.venceEl ? textoFechaVencimiento(prestamo.venceEl, { anioDeReferencia: anio }) : '—',
      { prueba: 'vence-prestamo' },
    ),
    datoDeFicha('Estado', prestamo.estado, { prueba: 'estado-prestamo' }),
    prestamo.estado === 'devuelto'
      ? datoDeFicha('A tiempo', aTiempo == null ? '—' : aTiempo ? 'Sí' : 'No', { prueba: 'a-tiempo' })
      : null,
    datoDeFicha('Registró', prestamo.creadoPor ?? '—'),
    prestamo.devueltoPor ? datoDeFicha('Recibió', prestamo.devueltoPor) : null,
    acciones.length ? el('div', { clase: 'ficha__acciones' }, acciones) : null,
  ]);

  return abrirHoja({
    titulo: prestamo.numero != null ? `P${prestamo.numero}` : 'Préstamo',
    prueba: 'hoja-prestamo',
    contenido,
  });
}

function textoDeMarca(marca) {
  if (!marca) return '—';
  const t = marca.toDate?.() ?? new Date(marca);
  return textoFechaLarga(t);
}

function botonAccion({ texto, prueba, peligro, ejecutar, exito }) {
  const boton = el('button', {
    clase: peligro ? 'boton boton--peligro' : 'boton',
    type: 'button',
    texto,
    'data-prueba': prueba,
  });
  prepararBotonGuardar(boton, async () => {
    const resultado = await ejecutar();
    if (resultado.esExito) {
      avisar(exito, 'exito', { id: 'prestamo', duracionMs: 4000 });
      cerrarHoja();
    } else {
      avisar(resultado.mensaje, 'error', { id: 'prestamo' });
    }
    return resultado;
  });
  return boton;
}

function confirmacion({ texto, prueba, peligro = false, ejecutar, exito }) {
  const boton = el('button', {
    clase: peligro ? 'boton boton--peligro boton--ancho' : 'boton boton--ancho',
    type: 'button',
    texto: 'Confirmar',
    'data-prueba': prueba,
  });
  prepararBotonGuardar(boton, async () => {
    const resultado = await ejecutar();
    if (resultado.esExito) {
      avisar(exito, 'exito', { id: 'prestamo', duracionMs: 4000 });
      cerrarHoja();
      cerrarHoja();
    } else {
      avisar(resultado.mensaje, 'error', { id: 'prestamo' });
    }
    return resultado;
  });
  return el('div', { clase: 'ficha' }, [
    el('p', { texto }),
    boton,
  ]);
}

function formularioCorreccion({ datos, permiso, prestamo }) {
  const motivo = campoTexto({
    id: 'motivo-correccion',
    etiqueta: 'Motivo de la corrección',
    valor: '',
  });
  const fallo = errorDeFormulario('error-correccion');
  const boton = el('button', {
    clase: 'boton boton--secundario boton--ancho',
    type: 'button',
    texto: 'Marcar como a tiempo',
    'data-prueba': 'corregir-a-tiempo',
  });
  prepararBotonGuardar(boton, async () => {
    fallo.limpiar();
    try {
      const resultado = await corregirATiempo({
        datos,
        permiso,
        prestamoId: prestamo.id,
        valor: true,
        motivo: motivo.control.value,
        operacionId: nuevoId(),
      });
      if (resultado.esExito) {
        avisar('Corrección guardada', 'exito', { id: 'prestamo', duracionMs: 4000 });
        cerrarHoja();
      } else {
        avisar(resultado.mensaje, 'error', { id: 'prestamo' });
      }
      return resultado;
    } catch (error) {
      motivo.mostrarError(error.message);
      return null;
    }
  });
  return el('div', { 'data-prueba': 'correccion-a-tiempo' }, [
    el('p', { clase: 'lista__detalle', texto: 'Fue devuelto a tiempo' }),
    motivo.nodo,
    fallo.nodo,
    boton,
  ]);
}
