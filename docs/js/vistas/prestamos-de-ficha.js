// Los préstamos de un libro o de un lector, dentro de su ficha (specs/03).
//
// La consulta NO pide orden al servidor: `libro ==` o `lector ==` a secas se
// resuelven con el índice automático, y pedir orden obligaría a declarar otro
// índice compuesto. El documento lo dice y aquí se cumple: se ordena en el
// teléfono y se muestran los cinco más recientes.
//
// Se lee UNA vez, al abrir la ficha. No se deja una escucha: una ficha es una
// hoja que se mira y se cierra, y el historial de un libro no cambia mientras
// está abierta. Tras devolver desde aquí, se relee.

import { rutas } from '../config-publica.js';
import { diaEnChile, textoFechaVencimiento } from '../fechas.js';
import { devolverPrestamo } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { el, pintar } from '../ui/dom.js';
import { cargando, vacio } from '../ui/estados.js';

import { avisarDevuelto } from './avisos-de-prestamo.js';

/** Cuántos préstamos pasados muestra una ficha (specs/03 §Pantallas). */
export const PASADOS_EN_FICHA = 5;

const AVISO = 'devolver-ficha';

function instanteDe(valor) {
  if (valor == null) return 0;
  if (typeof valor?.toMillis === 'function') return valor.toMillis();
  if (valor?.toDate) return valor.toDate().getTime();
  return new Date(valor).getTime();
}

/**
 * Bloque de préstamos para la ficha de un libro (`modo: 'libro'`) o de un
 * lector (`modo: 'lector'`).
 */
export function prestamosDeFicha({ datos, permiso, memoria, reloj, modo, valor }) {
  const campo = modo === 'libro' ? 'libro' : 'lector';
  const raiz = el('div', { 'data-prueba': `prestamos-de-${modo}` }, [cargando('Cargando sus préstamos…')]);
  let prestamos = [];

  function textoHasta(prestamo) {
    const ahora = reloj?.ahora?.() ?? null;
    if (!ahora || !prestamo.venceEl) return '…';
    return textoFechaVencimiento(prestamo.venceEl, { anioDeReferencia: Number(diaEnChile(ahora).slice(0, 4)) });
  }

  function botonDevolver(prestamo) {
    const boton = el('button', {
      clase: 'boton boton--chico',
      type: 'button',
      texto: 'Devolver',
      'data-prueba': 'devolver-en-ficha',
      'data-prestamo': prestamo.id,
    });
    prepararBotonGuardar(
      boton,
      async () => {
        const resultado = await devolverPrestamo({
          datos,
          permiso,
          prestamoId: prestamo.id,
          operacionId: nuevoId(),
          alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
        });
        if (resultado.esExito) {
          avisarDevuelto({ datos, permiso, titulo: prestamo.titulo, prestamoId: prestamo.id, id: AVISO });
          await cargar();
        } else {
          avisar(resultado.mensaje, 'error', { id: AVISO });
        }
        return resultado;
      },
      { deshabilitadoAlTerminar: () => !datos.hayRed() },
    );
    return boton;
  }

  function fila(prestamo, { conDevolver = false } = {}) {
    const quien = modo === 'libro' ? prestamo.nombreLector : prestamo.titulo;
    const cuando =
      prestamo.estado === 'abierto'
        ? `Hasta el ${textoHasta(prestamo)}`
        : prestamo.estado === 'anulado'
          ? 'Anulado'
          : 'Devuelto';
    return el('li', { clase: 'lista__fila', 'data-prueba': 'prestamo-de-ficha', 'data-id': prestamo.id }, [
      el('div', { clase: 'lista__principal' }, [
        el('p', { clase: 'lista__nombre', texto: quien }),
        el('p', {
          clase: 'lista__detalle',
          texto: [prestamo.numero != null ? `P${prestamo.numero}` : null, cuando].filter(Boolean).join(' · '),
        }),
      ]),
      conDevolver ? botonDevolver(prestamo) : null,
    ]);
  }

  function seccion(titulo, items, { conDevolver = false, prueba } = {}) {
    return el('section', { 'data-prueba': prueba }, [
      el('p', { clase: 'titulo-seccion', texto: `${titulo} (${items.length})` }),
      items.length === 0
        ? vacio('Nada todavía')
        : el('ul', { clase: 'lista' }, items.map((p) => fila(p, { conDevolver }))),
    ]);
  }

  function pintarTodo() {
    const abiertos = prestamos.filter((p) => p.estado === 'abierto');

    if (modo === 'libro') {
      // El que está fuera va arriba, con su acción; el resto es historia.
      const pasados = prestamos.filter((p) => p.estado !== 'abierto').slice(0, PASADOS_EN_FICHA);
      pintar(
        raiz,
        abiertos.length > 0
          ? el('section', { 'data-prueba': 'prestado-ahora' }, [
              el('p', { clase: 'titulo-seccion', texto: 'Prestado ahora' }),
              el('ul', { clase: 'lista' }, abiertos.map((p) => fila(p, { conDevolver: true }))),
            ])
          : null,
        seccion('Últimos préstamos', pasados, { prueba: 'ultimos-prestamos' }),
      );
      return;
    }

    const devueltos = prestamos.filter((p) => p.estado === 'devuelto').slice(0, PASADOS_EN_FICHA);
    pintar(
      raiz,
      seccion('Préstamos abiertos', abiertos, { conDevolver: true, prueba: 'abiertos-del-lector' }),
      seccion('Últimos devueltos', devueltos, { prueba: 'devueltos-del-lector' }),
    );
  }

  async function cargar() {
    const resultado = await datos.consultar(datos.consultaDe(rutas.prestamos(), datos.where(campo, '==', valor)));
    if (resultado.estado !== 'ok') {
      pintar(raiz, vacio('No se pudieron leer los préstamos'));
      return;
    }
    prestamos = resultado.documentos
      .map(({ __snap, ...resto }) => memoria.enriquecer(resto))
      .sort((uno, otro) => instanteDe(otro.prestadoEn) - instanteDe(uno.prestadoEn));
    pintarTodo();
  }

  void cargar();
  return raiz;
}
