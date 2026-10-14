// Botones «Recordar por WhatsApp» y «Copiar mensaje» (specs/04).

import { diaEnChile, textoFechaLarga, textoFechaVencimiento } from '../fechas.js';
import { armarRecordatorio, recordadoReciente } from '../mensajes.js';
import { anotarRecordatorio } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { el } from '../ui/dom.js';
import { abrirHoja } from '../ui/hoja.js';

/**
 * @param {'atraso'|'previo'} tipo
 */
export function botonesDeRecordatorio({
  datos,
  permiso,
  prestamo,
  plantillas,
  ahora,
  tipo = 'atraso',
  alActualizar,
}) {
  const plantilla = tipo === 'previo' ? plantillas?.mensajePrevio : plantillas?.mensajeAtraso;
  const anio = ahora ? Number(diaEnChile(ahora).slice(0, 4)) : null;
  const fecha = textoFechaVencimiento(prestamo.venceEl, { anioDeReferencia: anio });
  const armado = armarRecordatorio({
    plantilla,
    nombre: prestamo.nombreLector,
    titulo: prestamo.titulo,
    fecha,
    telefono: prestamo.telefonoLector,
  });

  if (!armado.ok) {
    return el('p', {
      clase: 'lista__detalle',
      texto: armado.motivo,
      'data-prueba': 'error-mensaje',
    });
  }

  const reciente = recordadoReciente(prestamo.recordadoEn, ahora);
  const fila = [];

  if (armado.sinTelefono) {
    fila.push(el('span', { clase: 'lista__detalle', texto: 'Sin teléfono', 'data-prueba': 'sin-telefono' }));
  } else {
    const enlace = el('a', {
      clase: reciente ? 'boton boton--secundario boton--chico' : 'boton boton--chico boton--wa',
      href: armado.enlace,
      target: '_blank',
      rel: 'noopener noreferrer',
      texto: 'Recordar por WhatsApp',
      'data-prueba': 'recordar-whatsapp',
      al: {
        click: () => {
          // El enlace navega en el mismo gesto. El guardado es independiente.
          void anotarRecordatorio({
            datos,
            permiso,
            prestamoId: prestamo.id,
            operacionId: nuevoId(),
          }).then((resultado) => {
            if (!resultado.esExito) {
              alActualizar?.({ errorApertura: true, prestamoId: prestamo.id });
            } else {
              alActualizar?.({ ok: true, prestamoId: prestamo.id });
            }
          });
        },
      },
    });
    fila.push(enlace);
  }

  fila.push(
    el('button', {
      clase: 'boton boton--secundario boton--chico',
      type: 'button',
      texto: 'Copiar mensaje',
      'data-prueba': 'copiar-mensaje',
      al: {
        click: async () => {
          try {
            await navigator.clipboard.writeText(armado.mensaje);
          } catch {
            abrirHoja({
              titulo: 'Mensaje',
              prueba: 'hoja-copiar-mensaje',
              contenido: el('textarea', {
                clase: 'campo__control',
                rows: '6',
                texto: armado.mensaje,
                readonly: 'readonly',
                'data-prueba': 'texto-copiar',
              }),
            });
          }
        },
      },
    }),
  );

  if (prestamo.recordadoEn) {
    const cuando = prestamo.recordadoEn?.toDate?.() ?? new Date(prestamo.recordadoEn);
    const hoy = ahora && diaEnChile(cuando) === diaEnChile(ahora);
    const quien = (prestamo.recordadoPor ?? '').split('@')[0] || 'alguien';
    fila.push(
      el('p', {
        clase: 'lista__detalle',
        texto: hoy
          ? `WhatsApp abierto hoy por ${quien}`
          : `WhatsApp abierto el ${textoFechaLarga(cuando)} por ${quien}`,
        'data-prueba': 'ultimo-recordatorio',
      }),
    );
  }

  return el('div', { clase: 'fila-btn', 'data-prueba': 'botones-recordatorio' }, fila);
}
