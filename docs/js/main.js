// Arranque y navegación.
//
// Orden del arranque:
//   1. Elegir ambiente (contrato §1). Si falta su configuración, la app lo
//      dice y NO abre ninguna conexión.
//   2. Cargar el SDK y conectar, al emulador si corresponde.
//   3. Pantalla de entrada, que no lee la base.
//   4. Con sesión: comprobar el permiso contra `voluntarios` y, recién ahí,
//      sincronizar la hora y dibujar la cáscara.

import { elegirAmbiente } from './ambiente.js';
import { NOMBRE_ENTRADA, rutas } from './config-publica.js';
import { clasificarResultado, crearDatos, intencionPendiente, olvidarIntencion } from './datos.js';
import { arrancar } from './firebase.js';
import { crearReloj, crearRelojDePrueba, instanteDeParametro, vigilarReloj } from './reloj.js';
import { entrarConGoogle, permisoDe, salir, vigilarPermiso } from './acceso.js';
import { normalizarCorreo } from './texto.js';

import { avisar, limpiarAvisos } from './ui/avisos.js';
import { dibujarBarraInferior, ocultarBarraInferior } from './ui/barra-inferior.js';
import { mostrarBarraSuperior, ponerFecha, ponerFranja, ponerNombreBiblioteca } from './ui/barra-superior.js';
import { cerrarHoja, conectarHoja, hojaAbierta } from './ui/hoja.js';
import { el, pintar } from './ui/dom.js';
import { cargando, error as estadoError } from './ui/estados.js';

import { pantallaEntrada } from './vistas/entrada.js';
import { pantallaSinAcceso } from './vistas/sin-acceso.js';
import { pantallaInicio } from './vistas/inicio.js';
import { pantallaPrestar } from './vistas/prestar.js';
import { pantallaPrestamos } from './vistas/prestamos.js';
import { pantallaCatalogo } from './vistas/catalogo.js';
import { pantallaMas } from './vistas/mas.js';
import { pantallaVoluntarios } from './vistas/voluntarios.js';

const VISTA_INICIAL = 'inicio';

const app = {
  eleccion: null,
  firebase: null,
  datos: null,
  reloj: null,
  sesion: null,
  permiso: { estado: 'sin-sesion', correo: null, rol: null, nombre: null },
  vista: VISTA_INICIAL,
  vistaActual: null,
  desmontarVista: () => {},
  soltarPermiso: () => {},
  soltarConfig: () => {},
  soltarReloj: () => {},
  avisoDesfaseMostrado: false,
};

function pantalla() {
  return document.getElementById('pantalla');
}

// ------------------------------------------------------------------ arranque

async function principal() {
  const parametros = new URLSearchParams(location.search);
  app.eleccion = elegirAmbiente({
    host: location.hostname,
    parametros,
    memoriaSesion: globalThis.sessionStorage,
  });

  ponerFranja({
    ...app.eleccion,
    nota: app.eleccion.parametroEnsayoIgnorado ? 'se ignoró «ensayo=1»' : null,
  });
  ponerNombreBiblioteca(NOMBRE_ENTRADA);

  if (app.eleccion.bloqueado) {
    // Configuración ausente: no se inicia ninguna conexión.
    mostrarBarraSuperior({ visible: false });
    pintar(
      pantalla(),
      el('div', { clase: 'entrada', 'data-prueba': 'ambiente-bloqueado' }, [
        el('h2', { clase: 'entrada__nombre', texto: 'Falta configurar este ambiente' }),
        el('p', {
          clase: 'entrada__nota',
          texto: `Este sitio apunta al ambiente «${app.eleccion.ambiente}» y todavía no tiene su configuración.`,
        }),
      ]),
    );
    return;
  }

  try {
    app.firebase = await arrancar(app.eleccion);
  } catch (fallo) {
    pintar(pantalla(), estadoError('No se pudo cargar Firebase. Revisa tu conexión y vuelve a abrir la app.'));
    console.error('No se pudo cargar el SDK', fallo);
    return;
  }

  app.datos = crearDatos({ db: app.firebase.db, sdk: app.firebase.piezas });
  prepararReloj(parametros);
  conectarHoja({ alPedirCierre: () => (history.state?.hoja ? history.back() : cerrarHoja()) });

  // Una pérdida o vuelta de red cambia qué botones se pueden tocar, pero NO
  // vuelve a dibujar la pantalla: un redibujado borraría lo que la persona está
  // escribiendo, y eso es justo lo que la forma de guardar promete no hacer.
  for (const evento of ['online', 'offline']) {
    globalThis.addEventListener(evento, () => app.vistaActual?.alCambiarRed?.());
  }

  globalThis.addEventListener('popstate', (evento) => {
    if (hojaAbierta()) cerrarHoja();
    app.vista = evento.state?.vista ?? VISTA_INICIAL;
    dibujar();
  });

  if (app.eleccion.permiteAccesoSimulado) exponerAyudasDePrueba();

  app.firebase.sdkAuth.onAuthStateChanged(app.firebase.auth, (usuario) => {
    void alCambiarSesion(usuario);
  });
}

function prepararReloj(parametros) {
  // `?ahora=` mueve SOLO el reloj de la interfaz, y solo contra el emulador.
  const fijo = app.eleccion.permiteHoraDePrueba ? instanteDeParametro(parametros.get('ahora')) : null;
  if (fijo) {
    app.reloj = crearRelojDePrueba(fijo);
    return;
  }

  app.reloj = crearReloj({
    tomarMuestra: async (identificador) => {
      if (!app.permiso?.correo) throw new Error('todavía no hay sesión');
      const ruta = rutas.voluntario(app.permiso.correo);

      // La muestra va en transacción, como toda escritura, y con su propio
      // identificador. No pasa por el bloqueo de mantenimiento.
      const guardado = await app.datos.guardar({
        tipo: 'cambio',
        cuerpo: async (transaccion, { leer, ref, ahoraDelServidor }) => {
          await leer(ruta); // lecturas antes de escrituras
          transaccion.update(ref(ruta), {
            ultimaConexion: ahoraDelServidor(),
            sincronizacionId: identificador,
          });
        },
      });
      if (!guardado.esExito) throw Object.assign(new Error(guardado.mensaje), { code: 'unavailable' });

      const leido = await app.datos.leerDelServidor(ruta);
      if (leido.estado !== 'ok') throw Object.assign(new Error('no se pudo leer la muestra'), { code: 'unavailable' });
      return {
        instante: leido.datos?.ultimaConexion?.toDate?.() ?? null,
        sincronizacionId: leido.datos?.sincronizacionId ?? null,
      };
    },
  });
}

// -------------------------------------------------------------------- sesión

async function alCambiarSesion(usuario) {
  app.soltarPermiso();
  app.soltarPermiso = () => {};
  app.sesion = usuario;
  limpiarAvisos();

  if (!usuario) {
    olvidarTodo();
    app.permiso = permisoDe({ sesion: null, documento: null });
    dibujar();
    return;
  }

  // Con sesión pero sin saber todavía si está en la lista.
  app.permiso = { estado: 'comprobando', correo: normalizarCorreo(usuario.email), rol: null, nombre: null };
  dibujar();

  app.soltarPermiso = vigilarPermiso({
    datos: app.datos,
    sesion: usuario,
    alCambiar: (permiso) => {
      const entraAhora = permiso.estado === 'adentro' && app.permiso.estado !== 'adentro';
      const perdioAcceso = permiso.estado !== 'adentro' && app.permiso.estado === 'adentro';
      app.permiso = permiso;

      if (perdioAcceso) {
        // Se cancelan escuchas y se vacían datos de la sesión anterior.
        olvidarTodo({ conservarPermiso: true });
      }
      if (entraAhora) alEntrar();
      dibujar();
    },
    alFallar: (fallo) => {
      // Un problema de red no cierra la sesión de nadie.
      avisar('No se pudo comprobar tu acceso ahora. Revisa tu conexión.', 'error', { id: 'permiso' });
      console.warn('La escucha del permiso falló', fallo?.code ?? fallo);
    },
  });
}

/** Lo que pasa una sola vez cuando una cuenta autorizada entra. */
function alEntrar() {
  app.soltarConfig();
  app.soltarConfig = app.datos.escucharDocumento(rutas.configApp(), (configuracion) => {
    ponerNombreBiblioteca(configuracion?.nombreBiblioteca ?? NOMBRE_ENTRADA);
  });

  app.soltarReloj();
  app.soltarReloj = app.reloj.esDePrueba ? () => {} : vigilarReloj(app.reloj);
  void sincronizarYMostrarHora();
  void revisarIntencionPendiente();
}

/**
 * Una recarga no borra la duda: si quedó una intención sin resolver, se relee
 * el servidor ANTES de ofrecer repetir, y nunca se ejecuta sola (contrato §3).
 */
async function revisarIntencionPendiente() {
  const intencion = intencionPendiente();
  if (!intencion?.ruta || !intencion?.operacionId) return;

  const leido = await app.datos.leerDelServidor(intencion.ruta);
  const marcaPropia = leido.datos?.ultimaOperacionId === intencion.operacionId;
  const clasificado = clasificarResultado({
    tipo: intencion.tipo === 'alta' ? 'alta' : 'cambio',
    estadoLectura: leido.estado,
    lectura: {
      existe: leido.existe,
      creacionId: leido.datos?.creacionId ?? null,
      ultimaOperacionId: leido.datos?.ultimaOperacionId ?? null,
      // Tras recargar no se guarda qué valor se pedía: la marca de la
      // operación es la única prueba de que el cambio fue el nuestro.
      aplicado: marcaPropia,
    },
    operacionId: intencion.operacionId,
  });

  avisar(clasificado.mensaje, clasificado.esExito ? 'exito' : 'error', { id: 'recuperacion' });
  // Mientras no se pueda comprobar, la intención se conserva.
  if (clasificado.resultado !== 'indeterminado') olvidarIntencion();
}

async function sincronizarYMostrarHora() {
  if (!app.reloj.esDePrueba) await app.reloj.sincronizar();
  ponerFecha(app.reloj.ahora());

  if (app.reloj.hayDesfaseAvisable() && !app.avisoDesfaseMostrado) {
    app.avisoDesfaseMostrado = true;
    avisar('La hora de tu teléfono está corrida. La app usa la hora del servidor.', 'atencion', {
      id: 'desfase',
    });
  }
  if (!app.reloj.hayHora()) {
    avisar('Hora pendiente: no se pudo confirmar la hora del servidor.', 'atencion', { id: 'hora' });
  }
}

/** Cancela escuchas y borra lo que quedaba en memoria (A-37). */
function olvidarTodo({ conservarPermiso = false } = {}) {
  app.desmontarVista();
  app.desmontarVista = () => {};
  app.soltarConfig();
  app.soltarConfig = () => {};
  app.soltarReloj();
  app.soltarReloj = () => {};
  app.datos?.cancelarEscuchas();
  app.reloj?.invalidar?.('se cerró la sesión');
  app.avisoDesfaseMostrado = false;
  if (!conservarPermiso) app.permiso = { estado: 'sin-sesion', correo: null, rol: null, nombre: null };
  ponerNombreBiblioteca(NOMBRE_ENTRADA);
  ponerFecha(null);
  app.vista = VISTA_INICIAL;
  limpiarAvisos();
}

// ---------------------------------------------------------------- navegación

function ir(vista, { reemplazar = false } = {}) {
  app.vista = vista;
  const estado = { vista };
  if (reemplazar) history.replaceState(estado, '', `#${vista}`);
  else history.pushState(estado, '', `#${vista}`);
  dibujar();
}

// ------------------------------------------------------------------- dibujo

function dibujar() {
  app.desmontarVista();
  app.desmontarVista = () => {};
  app.vistaActual = null;

  const destino = pantalla();

  if (app.permiso.estado === 'sin-sesion') {
    mostrarBarraSuperior({ visible: false });
    ocultarBarraInferior();
    pintar(destino, pantallaEntrada({ alEntrar: iniciarSesion }));
    return;
  }

  if (app.permiso.estado === 'comprobando') {
    mostrarBarraSuperior({ visible: false });
    ocultarBarraInferior();
    pintar(destino, cargando('Comprobando tu acceso…'));
    return;
  }

  if (app.permiso.estado === 'sin-acceso') {
    mostrarBarraSuperior({ visible: false });
    ocultarBarraInferior();
    pintar(
      destino,
      pantallaSinAcceso({
        correo: app.permiso.correo,
        alUsarOtraCuenta: async () => {
          await salir(app.firebase);
          await iniciarSesion();
        },
      }),
    );
    return;
  }

  mostrarBarraSuperior({ visible: true });
  ponerFecha(app.reloj.ahora());
  dibujarBarraInferior({ actual: app.vista === 'voluntarios' ? 'mas' : app.vista, alIr: (id) => ir(id) });

  const vista = construirVista();
  if (vista?.nodo) {
    pintar(destino, vista.nodo);
    app.vistaActual = vista;
    app.desmontarVista = vista.desmontar ?? (() => {});
  } else {
    pintar(destino, vista);
  }
  // Tras cada cambio de pantalla el foco queda en el contenido, nunca al
  // principio del documento.
  destino.focus({ preventScroll: true });
}

function construirVista() {
  switch (app.vista) {
    case 'prestar':
      return pantallaPrestar();
    case 'prestamos':
      return pantallaPrestamos();
    case 'catalogo':
      return pantallaCatalogo();
    case 'mas':
      return pantallaMas({
        permiso: app.permiso,
        alIrAVoluntarios: () => ir('voluntarios'),
        alSalir: async () => {
          await salir(app.firebase);
        },
      });
    case 'voluntarios':
      return pantallaVoluntarios({ datos: app.datos, permiso: app.permiso });
    case 'inicio':
    default:
      return pantallaInicio();
  }
}

async function iniciarSesion(boton = null) {
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Abriendo Google…';
  }
  const resultado = await entrarConGoogle(app.firebase);
  if (boton) {
    boton.disabled = false;
    boton.textContent = 'Entrar con Google';
  }
  if (!resultado.ok) avisar(resultado.mensaje, 'error', { id: 'entrada' });
}

// ------------------------------------------------- ayudas solo del emulador

function exponerAyudasDePrueba() {
  // Este camino existe únicamente contra el emulador: fuera de él,
  // `permiteAccesoSimulado` es falso y nada de esto se define.
  globalThis.__biblioteca = {
    async entrarSimulado(correo, { verificado = true } = {}) {
      const { GoogleAuthProvider, signInWithCredential } = app.firebase.sdkAuth;
      const credencial = GoogleAuthProvider.credential(
        JSON.stringify({ sub: correo, email: correo, email_verified: verificado }),
      );
      await signInWithCredential(app.firebase.auth, credencial);
    },
    async salir() {
      await salir(app.firebase);
    },
    contadores: () => app.datos.contadores.valores(),
    reiniciarContadores: () => app.datos.contadores.reiniciar(),
    reloj: () => ({
      hayHora: app.reloj.hayHora(),
      ahora: app.reloj.ahora()?.toISOString() ?? null,
      incertidumbreMs: app.reloj.incertidumbreMs(),
      motivo: app.reloj.motivoSinHora(),
      descartes: app.reloj.descartes(),
    }),
    invalidarReloj: (motivo = 'prueba') => {
      app.reloj.invalidar(motivo);
      ponerFecha(app.reloj.ahora());
    },
    sincronizarReloj: () => sincronizarYMostrarHora(),
    vista: () => app.vista,
    permiso: () => ({ ...app.permiso }),
  };
}

history.replaceState({ vista: VISTA_INICIAL }, '', location.hash || '#inicio');
await principal();
