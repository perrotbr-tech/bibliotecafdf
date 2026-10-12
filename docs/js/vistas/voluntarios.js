// Pantalla Voluntarios, solo para el administrador.
//
// Aquí se ve la forma de guardar completa: intención estable desde el primer
// toque, botón bloqueado, éxito solo con respuesta del servidor y, si la red se
// corta a mitad, comprobación por identidad de la operación.

import { rutas } from '../config-publica.js';
import { ErrorDeNegocio, MENSAJES, olvidarIntencion, recordarIntencion } from '../datos.js';
import { esCorreoValido, esNombreValido, normalizarCorreo, normalizarNombre, nuevoId } from '../texto.js';
import { avisar, quitarAviso } from '../ui/avisos.js';
import { el, pintar } from '../ui/dom.js';
import { cargando, error as estadoError, sinPermiso, vacio } from '../ui/estados.js';
import { prepararBotonGuardar } from '../ui/boton-guardar.js';

const AVISO = 'voluntarios';

export function pantallaVoluntarios({ datos, permiso }) {
  if (permiso.rol !== 'admin') {
    return { nodo: el('div', { 'data-prueba': 'voluntarios' }, [sinPermiso()]), desmontar: () => {} };
  }

  const lista = el('div', { 'data-prueba': 'lista-voluntarios' }, [cargando('Cargando voluntarios…')]);
  const formulario = construirFormulario({ datos, permiso });
  const nodo = el('div', { 'data-prueba': 'voluntarios' }, [
    el('p', { clase: 'titulo-seccion', texto: 'Agregar voluntario' }),
    formulario.nodo,
    el('p', { clase: 'titulo-seccion', texto: 'Quién puede entrar' }),
    lista,
  ]);

  // Los botones de escritura de cada fila, para poder habilitarlos o
  // deshabilitarlos cuando cambia la red SIN volver a dibujar la pantalla: un
  // redibujado borraría lo que la persona está escribiendo.
  const botonesDeFila = [];

  let voluntarios = [];
  const soltar = datos.escucharColeccion(
    rutas.voluntarios(),
    (documentos) => {
      voluntarios = documentos;
      pintarLista();
    },
    (fallo) => {
      pintar(lista, estadoError(`No se pudo leer la lista de voluntarios (${fallo?.code ?? 'sin código'}).`));
    },
  );

  function pintarLista() {
    botonesDeFila.length = 0;
    if (voluntarios.length === 0) {
      pintar(lista, vacio('Todavía no hay voluntarios.'));
      return;
    }
    const ordenados = [...voluntarios].sort((a, b) =>
      String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'),
    );
    pintar(
      lista,
      el(
        'ul',
        { clase: 'lista' },
        ordenados.map((voluntario) => filaVoluntario({ datos, permiso, voluntario, botonesDeFila })),
      ),
    );
  }

  return {
    nodo,
    desmontar: () => {
      soltar();
      quitarAviso(AVISO);
    },
    /** Cambió la conexión: solo se ajustan los botones, no se redibuja nada. */
    alCambiarRed: () => {
      formulario.reflejarRed();
      const hay = datos.hayRed();
      for (const { boton, esYo } of botonesDeFila) boton.disabled = esYo || !hay;
    },
  };
}

// --------------------------------------------------------------------- fila

function filaVoluntario({ datos, permiso, voluntario, botonesDeFila = [] }) {
  const esYo = voluntario.id === permiso.correo;
  const activo = voluntario.activo === true;

  const boton = el('button', {
    clase: `boton ${activo ? 'boton--peligro' : 'boton--secundario'}`,
    type: 'button',
    texto: activo ? 'Desactivar' : 'Reactivar',
    'data-prueba': `cambiar-estado-${voluntario.id}`,
    // Un administrador no puede desactivarse a sí mismo (A-10).
    disabled: esYo || !datos.hayRed(),
    title: esYo ? 'No puedes desactivar tu propia cuenta' : '',
  });
  botonesDeFila.push({ boton, esYo });

  // La intención es estable desde el primer toque de ESTA fila.
  let operacionId = null;
  prepararBotonGuardar(boton, async () => {
    operacionId ??= nuevoId();
    const ruta = rutas.voluntario(voluntario.id);
    const deseado = !activo;
    recordarIntencion({ operacionId, tipo: 'cambio', ruta, identificadores: [voluntario.id] });

    const resultado = await datos.guardar({
      tipo: 'cambio',
      operacionId,
      alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
      cuerpo: async (transaccion, { leer, ref, ahoraDelServidor }) => {
        const actual = await leer(ruta);
        if (!actual.exists()) throw new ErrorDeNegocio('Ese voluntario ya no está en la lista.');
        if (actual.data().activo === deseado) {
          throw new ErrorDeNegocio('Alguien ya cambió ese estado. Revisa la lista.');
        }
        transaccion.update(ref(ruta), {
          activo: deseado,
          ultimaOperacionId: operacionId,
          modificadoEn: ahoraDelServidor(),
        });
      },
      comprobar: async () => {
        const leido = await datos.leerDelServidor(ruta);
        return {
          estado: leido.estado,
          lectura: {
            existe: leido.existe,
            ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
            aplicado: leido.datos?.activo === deseado,
          },
        };
      },
    });

    if (resultado.esExito) {
      operacionId = null;
      olvidarIntencion();
      avisar(deseado ? 'Voluntario reactivado' : 'Voluntario desactivado', 'exito', { id: AVISO, duracionMs: 4000 });
    } else {
      avisar(resultado.mensaje, 'error', { id: AVISO });
    }
  });

  return el('li', { clase: 'lista__fila' }, [
    el('div', { clase: 'lista__principal' }, [
      el('p', { clase: 'lista__nombre', texto: voluntario.nombre ?? '(sin nombre)' }),
      el('p', { clase: 'lista__detalle', texto: voluntario.id }),
    ]),
    el('span', {
      clase: `etiqueta ${voluntario.rol === 'admin' ? 'etiqueta--admin' : ''}`,
      texto: voluntario.rol === 'admin' ? 'Administrador' : 'Voluntario',
    }),
    el('span', {
      clase: `etiqueta ${activo ? '' : 'etiqueta--inactivo'}`,
      texto: activo ? 'Activo' : 'Inactivo',
    }),
    boton,
  ]);
}

// --------------------------------------------------------------- formulario

function construirFormulario({ datos, permiso }) {
  const correo = campo({ id: 'nuevo-correo', etiqueta: 'Correo de Google', tipo: 'email', ayuda: 'Se guarda en minúsculas.' });
  const nombre = campo({ id: 'nuevo-nombre', etiqueta: 'Nombre', tipo: 'text' });

  const rol = el('select', { clase: 'campo__control', id: 'nuevo-rol', 'data-prueba': 'nuevo-rol' }, [
    el('option', { value: 'voluntario', texto: 'Voluntario' }),
    el('option', { value: 'admin', texto: 'Administrador' }),
  ]);

  const errorForma = el('p', { clase: 'campo__error', 'data-prueba': 'error-formulario', hidden: true });

  const boton = el('button', {
    clase: 'boton boton--ancho',
    type: 'submit',
    texto: 'Agregar voluntario',
    'data-prueba': 'agregar-voluntario',
  });

  const nodo = el('form', { clase: 'tarjeta', 'data-prueba': 'formulario-voluntario', novalidate: true }, [
    correo.nodo,
    nombre.nodo,
    el('label', { clase: 'campo' }, [el('span', { clase: 'campo__etiqueta', texto: 'Rol' }), rol]),
    errorForma,
    boton,
  ]);

  // La intención vive mientras el formulario no cambie: así un reintento con
  // los mismos datos conserva su identidad y uno nuevo estrena la suya.
  let operacionId = null;
  for (const entrada of [correo.control, nombre.control, rol]) {
    entrada.addEventListener('input', () => {
      operacionId = null;
      errorForma.hidden = true;
    });
  }

  nodo.addEventListener('submit', (evento) => evento.preventDefault());

  prepararBotonGuardar(boton, async () => {
    const correoLimpio = normalizarCorreo(correo.control.value);
    const nombreLimpio = normalizarNombre(nombre.control.value);

    if (!esCorreoValido(correoLimpio)) return mostrarError('Escribe un correo de Google válido.');
    if (!esNombreValido(nombreLimpio)) return mostrarError('El nombre debe tener de 1 a 60 caracteres.');

    operacionId ??= nuevoId();
    const ruta = rutas.voluntario(correoLimpio);
    recordarIntencion({ operacionId, tipo: 'alta', ruta, identificadores: [correoLimpio] });

    const resultado = await datos.guardar({
      tipo: 'alta',
      operacionId,
      alTardar: (texto) => avisar(texto, 'atencion', { id: AVISO }),
      cuerpo: async (transaccion, { leer, ref, ahoraDelServidor }) => {
        const actual = await leer(ruta);
        if (actual.exists()) throw new ErrorDeNegocio('Ese correo ya está en la lista');
        transaccion.set(ref(ruta), {
          nombre: nombreLimpio,
          rol: rol.value,
          activo: true,
          creadoEn: ahoraDelServidor(),
          creadoPor: permiso.correo,
          creacionId: operacionId,
          ultimaConexion: null,
          sincronizacionId: null,
        });
      },
      comprobar: async () => {
        const leido = await datos.leerDelServidor(ruta);
        return {
          estado: leido.estado,
          lectura: { existe: leido.existe, creacionId: leido.datos?.creacionId ?? null },
        };
      },
    });

    if (resultado.esExito) {
      operacionId = null;
      olvidarIntencion();
      // El formulario se limpia solo cuando el servidor confirmó.
      correo.control.value = '';
      nombre.control.value = '';
      rol.value = 'voluntario';
      errorForma.hidden = true;
      avisar(`${nombreLimpio} quedó agregado`, 'exito', { id: AVISO, duracionMs: 4000 });
      correo.control.focus();
    } else {
      // Lo escrito se conserva: nadie tiene que volver a tipearlo.
      mostrarError(resultado.mensaje);
      avisar(resultado.mensaje, 'error', { id: AVISO });
    }
    return resultado;
  });

  function mostrarError(texto) {
    errorForma.textContent = texto;
    errorForma.hidden = false;
    return null;
  }

  function reflejarRed() {
    const hay = datos.hayRed();
    boton.disabled = !hay;
    if (hay) {
      quitarAviso('sin-conexion');
    } else {
      avisar(MENSAJES.sinConexion, 'atencion', { id: 'sin-conexion' });
    }
  }
  reflejarRed();

  return { nodo, reflejarRed };
}

function campo({ id, etiqueta, tipo, ayuda = null }) {
  const control = el('input', {
    clase: 'campo__control',
    id,
    type: tipo,
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    'data-prueba': id,
  });
  const nodo = el('label', { clase: 'campo', for: id }, [
    el('span', { clase: 'campo__etiqueta', texto: etiqueta }),
    control,
    ayuda && el('span', { clase: 'campo__ayuda', texto: ayuda }),
  ]);
  return { nodo, control };
}
