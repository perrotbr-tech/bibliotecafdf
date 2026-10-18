// Hora verificada (contrato §2). `ahora()` devuelve un instante fiable o null.
// NUNCA devuelve la hora del teléfono como sustituto, ni avisado.
//
// Cómo funciona:
//   - La muestra se pide escribiendo `ultimaConexion` y un `sincronizacionId`
//     aleatorio en el propio voluntario, y leyendo desde el servidor. Si otro
//     dispositivo sobrescribió la muestra, el identificador no coincide: se
//     descarta y se repite un número acotado de veces.
//   - Se acepta el identificador de CUALQUIERA de las escrituras que este
//     dispositivo hizo en esta sincronización, no solo el del último intento.
//     La lectura puede traer el anterior —en el proyecto real la escucha del
//     voluntario sirve esa lectura desde su vista ya sincronizada, que todavía
//     no incorporó la escritura recién confirmada—, y entonces cada intento
//     leería el identificador del intento previo: una noria que nunca cierra.
//     Esa hora sigue siendo del servidor y sigue siendo de este dispositivo,
//     así que la muestra se ancla a la ida y vuelta de SU propia escritura, no
//     a la del intento que la encontró.
//   - La muestra se ancla a un reloj monotónico, no a Date.now(). Un cambio
//     manual de la hora del teléfono no la altera.
//   - Una ida y vuelta de más de 4 segundos se descarta. La incertidumbre
//     máxima conservadora es la duración de esa ida y vuelta.
//   - La muestra caduca a los 5 minutos, al suspender y volver, y al perder y
//     recuperar la conexión.
//
// `tomarMuestra` se inyecta para que esto se pueda probar sin red: recibe el
// identificador y devuelve `{ instante, sincronizacionId }`.

import { nuevoId } from './texto.js';

export const VIGENCIA_MS = 5 * 60 * 1000;
export const MAX_IDA_VUELTA_MS = 4000;
export const MAX_INTENTOS = 3;
/** Cuántos descartes se recuerdan. Es para el informe, no un registro eterno. */
export const MAX_DESCARTES = 20;
/** Desde cuánta diferencia se avisa que el reloj del teléfono está corrido. */
export const DESFASE_AVISABLE_MS = 60 * 1000;

export function crearReloj({
  tomarMuestra,
  monotonico = () => globalThis.performance.now(),
  relojTelefono = () => Date.now(),
  vigenciaMs = VIGENCIA_MS,
  maxIdaVueltaMs = MAX_IDA_VUELTA_MS,
  maxIntentos = MAX_INTENTOS,
} = {}) {
  /** @type {{instanteMs:number, ancla:number, incertidumbreMs:number, desfaseMs:number}|null} */
  let muestra = null;
  let sincronizando = null;
  let ultimoMotivo = null;
  const descartes = [];
  // Cada invalidación abre una época nueva. Una muestra que venía en camino
  // pertenece a la época anterior y ya no sirve: sin esto, perder la conexión
  // a mitad de una sincronización se deshacía solo cuando llegaba la respuesta.
  let epoca = 0;

  function anotarDescarte(descarte) {
    descartes.push(descarte);
    if (descartes.length > MAX_DESCARTES) descartes.splice(0, descartes.length - MAX_DESCARTES);
  }

  function invalidar(motivo) {
    // El motivo se guarda siempre, también cuando nunca hubo muestra: la
    // pantalla tiene que poder decir por qué no hay hora.
    ultimoMotivo = motivo;
    muestra = null;
    epoca += 1;
  }

  function vencida() {
    if (!muestra) return true;
    const transcurrido = monotonico() - muestra.ancla;
    // Un reloj monotónico que retrocede no es monotónico: no se confía en él.
    return transcurrido < 0 || transcurrido > vigenciaMs;
  }

  /**
   * Un intento: escribe una muestra con su identificador y mira qué devolvió
   * la lectura.
   *
   * @param {Map<string, {ancla:number, idaVuelta:number}>} mios
   *   Identificadores que este dispositivo escribió en esta sincronización,
   *   cada uno con la ida y vuelta de su propia escritura.
   */
  async function unIntento(mios) {
    const miEpoca = epoca;
    const identificador = nuevoId();
    const antes = monotonico();
    const resultado = await tomarMuestra(identificador);
    const despues = monotonico();
    mios.set(identificador, { ancla: despues, idaVuelta: despues - antes });

    if (miEpoca !== epoca) {
      // Mientras esta muestra viajaba, algo la invalidó: suspensión, cambio de
      // red o cierre de sesión. No se puede dar por buena.
      anotarDescarte({ motivo: 'la muestra quedó obsoleta antes de llegar' });
      return false;
    }

    // La escritura que corresponde a lo que se leyó. Si no es de este
    // dispositivo, no se le atribuye.
    const propia = resultado ? mios.get(resultado.sincronizacionId) : null;
    if (!propia) {
      anotarDescarte({ motivo: 'identificador de otra muestra' });
      return false;
    }
    if (propia.idaVuelta > maxIdaVueltaMs) {
      anotarDescarte({ motivo: 'ida y vuelta mayor que el máximo', idaVuelta: propia.idaVuelta });
      return false;
    }
    const instante = resultado.instante instanceof Date ? resultado.instante : new Date(resultado.instante);
    if (Number.isNaN(instante.getTime())) {
      anotarDescarte({ motivo: 'instante del servidor ilegible' });
      return false;
    }

    muestra = {
      instanteMs: instante.getTime(),
      ancla: propia.ancla,
      incertidumbreMs: propia.idaVuelta,
      // El desfase se compara contra el reloj del teléfono EN EL ANCLA, no
      // ahora: si la muestra aceptada es de un intento anterior, el teléfono
      // ya avanzó desde entonces y esa diferencia no es desfase.
      desfaseMs: relojTelefono() - (monotonico() - propia.ancla) - instante.getTime(),
    };
    ultimoMotivo = null;
    return true;
  }

  /**
   * Pide una muestra al servidor. Devuelve true si quedó una muestra válida.
   * Siempre se puede reintentar: la sincronización no se bloquea a sí misma.
   */
  async function sincronizar() {
    // Si ya hay una en curso de ESTA época, se espera esa. Si la época cambió,
    // la anterior ya no sirve y se pide una nueva.
    if (sincronizando && sincronizando.epoca === epoca) return await sincronizando.promesa;
    const deEstaEpoca = epoca;
    const promesa = (async () => {
      // Las escrituras de ESTA sincronización. Se olvidan al terminar: una
      // muestra de una sincronización anterior ya no se acepta.
      const mios = new Map();
      for (let intento = 1; intento <= maxIntentos; intento += 1) {
        try {
          if (await unIntento(mios)) return true;
        } catch (error) {
          anotarDescarte({
            motivo: 'error al pedir la muestra',
            error: String(error?.code ?? error?.message ?? error),
          });
        }
        if (intento < maxIntentos) await esperar(intento);
      }
      invalidar('no se pudo obtener la hora del servidor');
      return false;
    })();
    sincronizando = { epoca: deEstaEpoca, promesa };
    try {
      return await promesa;
    } finally {
      if (sincronizando?.promesa === promesa) sincronizando = null;
    }
  }

  function esperar(intento) {
    return new Promise((listo) => setTimeout(listo, 200 * intento));
  }

  return {
    /** Instante fiable, o null si no hay muestra válida. */
    ahora() {
      if (!muestra) return null;
      if (vencida()) {
        invalidar('la muestra caducó');
        return null;
      }
      return new Date(muestra.instanteMs + (monotonico() - muestra.ancla));
    },
    hayHora() {
      return muestra !== null && !vencida();
    },
    sincronizar,
    invalidar,
    /** Milisegundos de error máximo conservador de la muestra vigente. */
    incertidumbreMs() {
      return vencida() ? null : muestra.incertidumbreMs;
    },
    /**
     * Diferencia entre el reloj del teléfono y el del servidor al momento de la
     * muestra. Sirve ÚNICAMENTE para mostrar el aviso de desfase.
     */
    desfaseMs() {
      return vencida() ? null : muestra.desfaseMs;
    },
    hayDesfaseAvisable() {
      const desfase = this.desfaseMs();
      return desfase !== null && Math.abs(desfase) >= DESFASE_AVISABLE_MS;
    },
    motivoSinHora() {
      return vencida() ? (ultimoMotivo ?? 'todavía no hay hora del servidor') : null;
    },
    /** Para el informe y las pruebas: por qué se descartó cada muestra. */
    descartes() {
      return [...descartes];
    },
  };
}

/**
 * Lee el parámetro `?ahora=` de la dirección. Devuelve el instante o null si
 * falta o no se entiende.
 *
 * Este parámetro mueve ÚNICAMENTE el reloj de la interfaz y solo existe contra
 * el emulador. No mueve `request.time` del servidor: las escrituras protegidas
 * por tiempo se prueban con el reloj real del emulador (contrato §2).
 */
export function instanteDeParametro(valor) {
  if (!valor) return null;
  const instante = new Date(String(valor));
  return Number.isNaN(instante.getTime()) ? null : instante;
}

/**
 * Reloj de pruebas de pantalla: fijo en el instante dado. Avanza con el reloj
 * monotónico para que la interfaz no se congele.
 */
export function crearRelojDePrueba(instante, { monotonico = () => globalThis.performance.now() } = {}) {
  const base = instante instanceof Date ? instante.getTime() : Number(instante);
  const ancla = monotonico();
  return {
    ahora: () => new Date(base + (monotonico() - ancla)),
    hayHora: () => true,
    sincronizar: async () => true,
    invalidar: () => {},
    incertidumbreMs: () => 0,
    desfaseMs: () => 0,
    hayDesfaseAvisable: () => false,
    motivoSinHora: () => null,
    descartes: () => [],
    esDePrueba: true,
  };
}

/**
 * Conecta un reloj a los eventos que obligan a resincronizar (contrato §2):
 * volver a primer plano, y perder o recuperar la conexión.
 * Devuelve la función que suelta las escuchas.
 */
export function vigilarReloj(reloj, { ventana = globalThis, documento = globalThis.document } = {}) {
  const alVolver = () => {
    if (documento?.visibilityState === 'visible') {
      reloj.invalidar('la app volvió a primer plano');
      void reloj.sincronizar();
    }
  };
  const alCambiarRed = (motivo) => () => {
    reloj.invalidar(motivo);
    if (ventana.navigator?.onLine) void reloj.sincronizar();
  };
  const alConectar = alCambiarRed('se recuperó la conexión');
  const alDesconectar = alCambiarRed('se perdió la conexión');

  documento?.addEventListener?.('visibilitychange', alVolver);
  ventana.addEventListener?.('online', alConectar);
  ventana.addEventListener?.('offline', alDesconectar);

  return () => {
    documento?.removeEventListener?.('visibilitychange', alVolver);
    ventana.removeEventListener?.('online', alConectar);
    ventana.removeEventListener?.('offline', alDesconectar);
  };
}
