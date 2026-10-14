// Flujo Prestar: libro → lector → plazo (specs/03).

import { diaDeVencimiento, diaEnChile, esSabado, textoFechaVencimiento } from '../fechas.js';
import { filtrarLectores, filtrarLibros, prestamosAtrasados } from '../listas.js';
import { devolverPrestamo, prestarLibro } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { el, pintar } from '../ui/dom.js';
import { vacio } from '../ui/estados.js';

export function pantallaPrestar({
  datos,
  permiso,
  reloj,
  memoria,
  plazoPorDefecto = 2,
  lectorInicial = null,
  alInscribirLector,
  alVolverInicio,
}) {
  const ahora = () => reloj.ahora();
  let libro = null;
  let lector = lectorInicial;
  let plazo = plazoPorDefecto;
  let qLibro = '';
  let qLector = '';
  let prestamoId = nuevoId();
  let operacionId = nuevoId();

  const raiz = el('div', { 'data-prueba': 'prestar' });
  const soltar = memoria.alCambiar(() => dibujar());

  function dibujar() {
    const instante = ahora();
    const dia = instante ? diaEnChile(instante) : null;
    if (!instante) {
      pintar(raiz, el('p', { clase: 'lista__detalle', texto: 'Hora pendiente', 'data-prueba': 'hora-pendiente' }));
      return;
    }
    if (!esSabado(dia) && permiso.rol !== 'admin') {
      pintar(raiz, el('div', {}, [
        el('p', { clase: 'titulo-seccion', texto: 'Prestar un libro' }),
        el('p', {
          clase: 'lista__detalle',
          texto: 'Solo se presta en sábado. Vuelve el próximo sábado o pide al administrador registrar desde papel.',
          'data-prueba': 'bloqueado-no-sabado',
        }),
      ]));
      return;
    }

    pintar(raiz,
      pasoLibro(),
      pasoLector(),
      pasoPlazo(dia),
      botonFinal(dia),
    );
  }

  function pasoLibro() {
    const cuerpo = [];
    cuerpo.push(el('p', { clase: 'paso-prestamo__marca', texto: '1 · Libro' }));
    if (libro) {
      cuerpo.push(el('p', { clase: 'lista__nombre', texto: libro.titulo, 'data-prueba': 'libro-elegido' }));
      cuerpo.push(el('p', { clase: 'lista__detalle', texto: `${libro.codigo} · ${libro.autor || 'Sin autor'}` }));
      cuerpo.push(el('button', {
        clase: 'boton boton--secundario boton--chico',
        type: 'button',
        texto: 'Cambiar libro',
        'data-prueba': 'cambiar-libro',
        al: { click: () => { libro = null; qLibro = ''; dibujar(); } },
      }));
    } else {
      const input = el('input', {
        clase: 'campo__control',
        type: 'search',
        placeholder: 'Título, autor o código',
        'data-prueba': 'buscar-libro-prestar',
        value: qLibro,
      });
      input.addEventListener('input', () => {
        qLibro = input.value;
        pintarListaLibros();
      });
      cuerpo.push(el('div', { clase: 'campo' }, [
        el('label', { clase: 'campo__etiqueta', texto: 'Busca el libro', for: 'buscar-libro-prestar' }),
        input,
      ]));
      const lista = el('div', { 'data-prueba': 'lista-libros-prestar' });
      cuerpo.push(lista);
      queueMicrotask(() => pintarListaLibros(lista));
    }
    return el('div', { clase: 'paso-prestamo', 'data-prueba': 'paso-libro' }, cuerpo);
  }

  function pintarListaLibros(contenedor = raiz.querySelector('[data-prueba="lista-libros-prestar"]')) {
    if (!contenedor) return;
    const disponibles = filtrarLibros(memoria.estado.libros, { consulta: qLibro, estado: 'disponibles' }).slice(0, 20);
    const prestados = filtrarLibros(memoria.estado.libros, { consulta: qLibro, estado: 'prestados' }).slice(0, 5);
    const filas = [];

    for (const l of disponibles) {
      filas.push(el('button', {
        clase: 'lista__fila boton--ancho',
        type: 'button',
        style: 'display:block;text-align:left;background:var(--surface);border:1px solid var(--line);color:inherit;font:inherit;padding:12px;margin-bottom:6px;border-radius:10px',
        'data-prueba': 'elegir-libro',
        'data-codigo': l.codigo,
        al: { click: () => { libro = l; dibujar(); } },
      }, [
        el('p', { clase: 'lista__nombre', texto: l.titulo }),
        el('p', { clase: 'lista__detalle', texto: `${l.codigo} · ${l.autor || 'Sin autor'}` }),
      ]));
    }

    for (const l of prestados) {
      const prestamoIdAbierto = l.prestamoAbierto;
      const prestamo = memoria.estado.prestamosAbiertos.find((p) => p.id === prestamoIdAbierto);
      const hasta = prestamo?.venceEl
        ? textoFechaVencimiento(prestamo.venceEl, { anioDeReferencia: Number(diaEnChile(ahora()).slice(0, 4)) })
        : '…';
      const nombre = prestamo?.nombreLector ?? 'otro lector';
      filas.push(el('div', { clase: 'lista__fila', 'data-prueba': 'libro-prestado' }, [
        el('p', { clase: 'lista__nombre', texto: l.titulo }),
        el('p', {
          clase: 'lista__detalle',
          texto: `Está prestado a ${nombre} hasta el ${hasta}`,
        }),
        el('button', {
          clase: 'boton boton--chico',
          type: 'button',
          texto: 'Registrar su devolución',
          'data-prueba': 'devolver-y-elegir',
          al: {
            click: async () => {
              if (!prestamoIdAbierto) return;
              const resultado = await devolverPrestamo({
                datos,
                permiso,
                prestamoId: prestamoIdAbierto,
                operacionId: nuevoId(),
              });
              if (resultado.esExito) {
                libro = { ...l, prestamoAbierto: null, estado: 'disponible' };
                avisar(`Devuelto: ${l.titulo}`, 'exito', { id: 'prestar', duracionMs: 4000 });
                dibujar();
              } else {
                avisar(resultado.mensaje, 'error', { id: 'prestar' });
              }
            },
          },
        }),
      ]));
    }

    if (filas.length === 0) pintar(contenedor, vacio('No hay libros con esa búsqueda'));
    else pintar(contenedor, ...filas);
  }

  function pasoLector() {
    const cuerpo = [];
    cuerpo.push(el('p', { clase: 'paso-prestamo__marca', texto: '2 · Lector' }));
    if (lector) {
      cuerpo.push(el('p', { clase: 'lista__nombre', texto: lector.nombre, 'data-prueba': 'lector-elegido' }));
      const atrasos = prestamosAtrasados(
        memoria.estado.prestamosAbiertos.filter((p) => p.lector === lector.id),
        ahora(),
      );
      if (atrasos.length > 0) {
        cuerpo.push(el('p', {
          clase: 'lista__detalle',
          texto: `Tiene ${atrasos.length} libro(s) atrasado(s). Se puede prestar igual.`,
          'data-prueba': 'aviso-atrasos',
        }));
      }
      cuerpo.push(el('button', {
        clase: 'boton boton--secundario boton--chico',
        type: 'button',
        texto: 'Cambiar lector',
        'data-prueba': 'cambiar-lector',
        al: { click: () => { lector = null; qLector = ''; dibujar(); } },
      }));
    } else {
      const input = el('input', {
        clase: 'campo__control',
        type: 'search',
        placeholder: 'Nombre',
        'data-prueba': 'buscar-lector-prestar',
        value: qLector,
      });
      input.addEventListener('input', () => {
        qLector = input.value;
        pintarListaLectores();
      });
      cuerpo.push(el('div', { clase: 'campo' }, [input]));
      const lista = el('div', { 'data-prueba': 'lista-lectores-prestar' });
      cuerpo.push(lista);
      cuerpo.push(el('button', {
        clase: 'boton boton--secundario boton--chico',
        type: 'button',
        texto: 'Inscribir un lector nuevo',
        'data-prueba': 'inscribir-desde-prestar',
        al: {
          click: () => alInscribirLector?.({
            alInscribir: (resultado) => {
              const v = resultado?.valor ?? resultado;
              lector = { id: v.id, nombre: v.nombre, telefono: null };
              dibujar();
            },
          }),
        },
      }));
      queueMicrotask(() => pintarListaLectores(lista));
    }
    return el('div', { clase: 'paso-prestamo', 'data-prueba': 'paso-lector' }, cuerpo);
  }

  function pintarListaLectores(contenedor = raiz.querySelector('[data-prueba="lista-lectores-prestar"]')) {
    if (!contenedor) return;
    const lista = filtrarLectores(memoria.estado.lectores, { consulta: qLector }).slice(0, 20);
    if (lista.length === 0) {
      pintar(contenedor, vacio('No hay lectores con esa búsqueda'));
      return;
    }
    pintar(contenedor, ...lista.map((l) => el('button', {
      clase: 'lista__fila',
      type: 'button',
      style: 'display:block;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);color:inherit;font:inherit;padding:12px;margin-bottom:6px;border-radius:10px',
      'data-prueba': 'elegir-lector',
      'data-id': l.id,
      al: { click: () => { lector = l; dibujar(); } },
    }, [
      el('p', { clase: 'lista__nombre', texto: l.nombre }),
      el('p', { clase: 'lista__detalle', texto: l.id }),
    ])));
  }

  function pasoPlazo(dia) {
    const opciones = [1, 2, 3, 4].map((k) => {
      const vence = diaDeVencimiento(dia, k);
      const etiqueta = `${k} sábado${k > 1 ? 's' : ''} · ${textoCortoMes(vence)}`;
      return el('label', {
        clase: 'ficha-filtro' + (plazo === k ? ' ficha-filtro--puesta' : ''),
        style: 'display:inline-flex;margin:4px;padding:8px 12px;cursor:pointer',
      }, [
        el('input', {
          type: 'radio',
          name: 'plazo',
          value: String(k),
          checked: plazo === k,
          'data-prueba': `plazo-${k}`,
          al: { change: () => { plazo = k; dibujar(); } },
        }),
        el('span', { texto: ` ${etiqueta}` }),
      ]);
    });
    return el('div', { clase: 'paso-prestamo', 'data-prueba': 'paso-plazo' }, [
      el('p', { clase: 'paso-prestamo__marca', texto: '3 · Plazo' }),
      el('div', { clase: 'fichas' }, opciones),
    ]);
  }

  function botonFinal(dia) {
    const listo = libro && lector;
    const nombre = lector?.nombre?.split(/\s+/u)[0] ?? '';
    const boton = el('button', {
      clase: 'boton boton--ancho',
      type: 'button',
      texto: listo ? `Prestar a ${nombre}` : 'Elige libro y lector',
      disabled: !listo || !datos.hayRed(),
      'data-prueba': 'confirmar-prestamo',
    });
    if (listo) {
      prepararBotonGuardar(boton, async () => {
        try {
          const resultado = await prestarLibro({
            datos,
            permiso,
            libroCodigo: libro.codigo,
            lectorId: lector.id,
            plazoSabados: plazo,
            ahora: ahora(),
            operacionId,
            prestamoId,
            alTardar: (t) => avisar(t, 'atencion', { id: 'prestar' }),
          });
          if (resultado.esExito) {
            const vence = textoFechaVencimiento(diaDeVencimiento(dia, plazo), {
              anioDeReferencia: Number(dia.slice(0, 4)),
            });
            avisar(`Prestado a ${nombre} hasta el ${vence}`, 'exito', { id: 'prestar', duracionMs: 10_000 });
            operacionId = nuevoId();
            prestamoId = nuevoId();
            const lectorParaOtro = lector;
            libro = null;
            lector = null;
            alVolverInicio?.({
              deshacer: resultado.valor?.prestamoId,
              prestarOtro: lectorParaOtro,
            });
          } else {
            avisar(resultado.mensaje, 'error', { id: 'prestar' });
            if (resultado.estado === 'conflicto') {
              libro = null;
              dibujar();
            }
          }
          return resultado;
        } catch (error) {
          avisar(error.message, 'error', { id: 'prestar' });
          return null;
        }
      }, { deshabilitadoAlTerminar: () => !datos.hayRed() });
    }
    return boton;
  }

  dibujar();

  return {
    nodo: raiz,
    desmontar: () => soltar(),
    alCambiarRed: () => dibujar(),
    // Al salir del flujo se limpia (P-37): el desmontaje basta porque el estado
    // vive en el cierre de esta función.
  };
}

function textoCortoMes(dia) {
  const [, m, d] = dia.split('-');
  const meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m)]}`;
}
