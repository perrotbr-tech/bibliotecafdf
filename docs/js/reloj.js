// Hora verificada (contrato §2). `ahora()` devuelve un instante fiable o null.
// NUNCA devuelve la hora del teléfono como sustituto, ni avisado.
//
// Cómo funciona:
//   - La muestra se pide escribiendo `ultimaConexion` y un `sincronizacionId`
//     aleatorio en el propio voluntario, y leyendo desde el servidor. Si otro
//     dispositivo sobrescribió la muestra, el identificador no coincide: se
//     descarta y se repite un número acotado de veces.
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

  function invalidar(motivo) {
    // El motivo se guarda siempre, también cuando nunca hubo muestra: la
    // pantalla tiene que poder decir por qué no hay hora.
    ultimoMotivo = motivo;
    muestra = null;
  }

  function vencida() {
    if (!muestra) return true;
    const transcurrido = monotonico() - muestra.ancla;
    // Un reloj monotónico que retrocede no es monotónico: no se confía en él.
    return transcurrido < 0 || transcurrido > vigenciaMs;
  }

  async function unIntento() {
    const identificador = nuevoId();
    const antes = monotonico();
    const resultado = await tomarMuestra(identificador);
    const despues = monotonico();
    const idaVuelta = despues - antes;

    if (idaVuelta > maxIdaVueltaMs) {
      descartes.push({ motivo: 'ida y vuelta mayor que el máximo', idaVuelta });
      return false;
    }
    if (!resultado || resultado.sincronizacionId !== identificador) {
      // La muestra es de otro dispositivo: no se le atribuye a este.
      descartes.push({ motivo: 'identificador de otra muestra' });
      return false;
    }
    const instante = resultado.instante instanceof Date ? resultado.instante : new Date(resultado.instante);
    if (Number.isNaN(instante.getTime())) {
      descartes.push({ motivo: 'instante del servidor ilegible' });
      return false;
    }

    muestra = {
      instanteMs: instante.getTime(),
      ancla: despues,
      incertidumbreMs: idaVuelta,
      desfaseMs: relojTelefono() - instante.getTime(),
    };
    ultimoMotivo = null;
    return true;
  }

  /**
   * Pide una muestra al servidor. Devuelve true si quedó una muestra válida.
   * Siempre se puede reintentar: la sincronización no se bloquea a sí misma.
   */
  async function sincronizar() {
    if (sincronizando) return await sincronizando;
    sincronizando = (async () => {
      for (let intento = 1; intento <= maxIntentos; intento += 1) {
        try {
          if (await unIntento()) return true;
        } catch (error) {
          descartes.push({ motivo: 'error al pedir la muestra', error: String(error?.code ?? error?.message ?? error) });
        }
        if (intento < maxIntentos) await esperar(intento);
      }
      invalidar('no se pudo obtener la hora del servidor');
      return false;
    })();
    try {
      return await sincronizando;
    } finally {
      sincronizando = null;
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
