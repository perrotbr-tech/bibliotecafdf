// Registrar desde papel: solo administrador, fuera del sábado (contrato §4).

import { diaDeVencimiento, diaEnChile, esSabado, textoFechaVencimiento } from '../fechas.js';
import { filtrarLectores, filtrarLibros } from '../listas.js';
import { prestarLibro } from '../operaciones.js';
import { nuevoId } from '../texto.js';
import { avisar } from '../ui/avisos.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';
import { campoTexto, errorDeFormulario } from '../ui/campos.js';
import { el, pintar } from '../ui/dom.js';

export function pantallaPapel({ datos, permiso, reloj, memoria, plazoPorDefecto = 2, alVolver }) {
  let libro = null;
  let lector = null;
  let plazo = plazoPorDefecto;
  const salida = campoTexto({
    id: 'salida-papel',
    etiqueta: 'Fecha de salida (sábado)',
    valor: '',
    ayuda: 'AAAA-MM-DD, un sábado ya pasado o de hoy',
  });
  const motivo = campoTexto({
    id: 'motivo-papel',
    etiqueta: 'Motivo',
    valor: '',
    ayuda: 'De 10 a 200 caracteres',
  });
  const fallo = errorDeFormulario('error-papel');
  const raiz = el('div', { 'data-prueba': 'papel' });

  function dibujar() {
    const boton = el('button', {
      clase: 'boton boton--ancho',
      type: 'button',
      texto: 'Registrar préstamo',
      'data-prueba': 'guardar-papel',
      disabled: !libro || !lector,
    });
    prepararBotonGuardar(boton, async () => {
      fallo.limpiar();
      try {
        const resultado = await prestarLibro({
          datos,
          permiso,
          libroCodigo: libro.codigo,
          lectorId: lector.id,
          plazoSabados: plazo,
          ahora: reloj.ahora(),
          registroDiferido: true,
          motivoRegistroDiferido: motivo.control.value,
          salidaDia: salida.control.value.trim(),
          operacionId: nuevoId(),
          prestamoId: nuevoId(),
          alTardar: (t) => avisar(t, 'atencion', { id: 'papel' }),
        });
        if (resultado.esExito) {
          avisar('Préstamo registrado desde papel', 'exito', { id: 'papel', duracionMs: 5000 });
          alVolver?.();
        } else {
          avisar(resultado.mensaje, 'error', { id: 'papel' });
        }
        return resultado;
      } catch (error) {
        fallo.mostrar?.(error.message);
        if (typeof fallo.mostrar !== 'function') {
          avisar(error.message, 'error', { id: 'papel' });
        }
        return null;
      }
    });

    pintar(raiz,
      el('p', { clase: 'titulo-seccion', texto: 'Registrar desde papel' }),
      salida.nodo,
      motivo.nodo,
      el('p', {
        clase: 'lista__detalle',
        texto: libro ? `Libro: ${libro.titulo}` : 'Elige un libro abajo',
        'data-prueba': 'papel-libro',
      }),
      listaLibros(),
      el('p', {
        clase: 'lista__detalle',
        texto: lector ? `Lector: ${lector.nombre}` : 'Elige un lector abajo',
        'data-prueba': 'papel-lector',
      }),
      listaLectores(),
      el('div', { clase: 'fichas' }, [1, 2, 3, 4].map((k) => el('button', {
        clase: 'ficha-filtro' + (plazo === k ? ' ficha-filtro--puesta' : ''),
        type: 'button',
        texto: `${k} sáb.`,
        'data-prueba': `papel-plazo-${k}`,
        al: { click: () => { plazo = k; dibujar(); } },
      }))),
      fallo.nodo,
      boton,
    );
  }

  function listaLibros() {
    return el('div', { 'data-prueba': 'papel-lista-libros' },
      filtrarLibros(memoria.estado.libros, { estado: 'disponibles' }).slice(0, 15).map((l) =>
        el('button', {
          type: 'button',
          clase: 'boton boton--secundario boton--chico',
          texto: l.codigo,
          al: { click: () => { libro = l; dibujar(); } },
        }),
      ));
  }

  function listaLectores() {
    return el('div', { 'data-prueba': 'papel-lista-lectores' },
      memoria.estado.lectores.slice(0, 15).map((l) =>
        el('button', {
          type: 'button',
          clase: 'boton boton--secundario boton--chico',
          texto: l.nombre,
          al: { click: () => { lector = l; dibujar(); } },
        }),
      ));
  }

  const soltar = memoria.alCambiar(() => dibujar());
  dibujar();
  return { nodo: raiz, desmontar: () => soltar() };
}

void diaDeVencimiento;
void diaEnChile;
void esSabado;
void textoFechaVencimiento;
void filtrarLectores;
