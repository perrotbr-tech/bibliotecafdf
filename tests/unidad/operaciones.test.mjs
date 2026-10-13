// H-02: cómo clasifica `inscribirLector` una denegación del servidor.
//
// Qué se prueba y qué NO. Que las reglas denieguen de verdad ya está probado
// contra el emulador en `tests/reglas/lectores.test.mjs`; aquí no se prueba
// ninguna regla. Lo que se prueba es la decisión del cliente DESPUÉS de recibir
// la denegación: con los mismos datos a la vista, ¿dice «ya existe»,
// «inténtalo de nuevo», «en mantenimiento», o devuelve la denegación tal cual?
// Esa decisión es del cliente, se toma leyendo tres documentos, y por eso el
// doble de `datos` es la herramienta correcta —no un sustituto de las reglas.
//
// La contraprueba de la Etapa 2 cerró H-02 pero dejó anotado que el segundo
// camino —ni leer el contador se puede— no tenía prueba dedicada. Esta es.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rutas } from '../../docs/js/config-publica.js';
import { MENSAJES_DE_OPERACION, inscribirLector } from '../../docs/js/operaciones.js';

const PERMISO = { correo: 'voluntaria@correo.cl', rol: 'voluntario' };

/**
 * Doble de `datos` con lo justo que usa un alta: `guardar`, que aquí siempre
 * deniega, y `leerDelServidor`, que responde lo que diga `lecturas`.
 *
 * `contadorPorIntento` permite que el contador cambie entre intentos, que es
 * la diferencia entre una carrera real y una denegación de permiso.
 */
function datosQueDeniegan({ lecturas = {}, contadorPorIntento = null } = {}) {
  const llamadas = { guardar: 0, lecturas: [] };
  return {
    llamadas,
    async guardar({ cuerpo, operacionId }) {
      llamadas.guardar += 1;
      llamadas.operacionId = operacionId;
      // El cuerpo corre hasta donde alcanza para que `registro` quede con el
      // contador que leyó este intento, igual que en la transacción real.
      const nunca = () => {
        throw new Error('no debería escribir');
      };
      try {
        await cuerpo(
          { set: nunca, update: nunca },
          {
            leer: async (ruta) => {
              if (ruta === rutas.configContadores()) {
                const valor = contadorPorIntento ? contadorPorIntento(llamadas.guardar) : 7;
                return { exists: () => true, data: () => ({ ultimoLector: valor }) };
              }
              return { exists: () => false, data: () => ({}) };
            },
            ref: (ruta) => ruta,
            ahoraDelServidor: () => 'marca',
            operacionId,
          },
        );
      } catch {
        // Un cuerpo que se corta no cambia lo que prueba este archivo.
      }
      return {
        estado: 'denegado',
        esExito: false,
        mensaje: MENSAJES_DE_OPERACION.sinPermiso,
      };
    },
    async leerDelServidor(ruta) {
      llamadas.lecturas.push(ruta);
      return lecturas[ruta] ?? { estado: 'ok', existe: false, datos: null };
    },
  };
}

const ALTA = {
  nombre: 'Rafaela Toledo',
  telefono: null,
  avisoDado: true,
  operacionId: 'op-estable-1',
  permiso: PERMISO,
};

test('H-02 si ni el contador se puede leer, la denegación se devuelve tal cual', async () => {
  // Una cuenta desactivada a mitad de la operación: la escritura se deniega y
  // la lectura del contador también. No hubo carrera y no hay nada que
  // reintentar; mentirle «inténtalo de nuevo» manda a la persona a repetir algo
  // que no puede funcionar.
  const datos = datosQueDeniegan({
    lecturas: { [rutas.configContadores()]: { estado: 'denegada', existe: false, datos: null } },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
  assert.equal(datos.llamadas.guardar, 1, 'una denegación sin carrera no se reintenta');
  assert.ok(
    !datos.llamadas.lecturas.includes(rutas.configControl()),
    'sin poder leer el contador no se sigue preguntando por el bloqueo',
  );
});

test('H-02 con el contador quieto y el bloqueo puesto, el mensaje es el de mantenimiento', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 7 } },
      [rutas.configControl()]: { estado: 'ok', existe: true, datos: { bloqueo: { token: 't' } } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.enMantenimiento);
  assert.equal(datos.llamadas.guardar, 1);
});

test('H-02 con el contador quieto y sin bloqueo, la denegación conserva su mensaje', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 7 } },
      [rutas.configControl()]: { estado: 'ok', existe: true, datos: { bloqueo: null } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'denegado');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.sinPermiso);
});

test('H-02 con la clave ya tomada, el servidor manda y el resultado es conflicto', async () => {
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.lectorClave('rafaela toledo')]: { estado: 'ok', existe: true, datos: { lector: 'L007' } },
      [rutas.lector('L007')]: { estado: 'ok', existe: true, datos: { nombre: 'Rafaela Toledo' } },
    },
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'conflicto');
  assert.equal(resultado.esExito, false);
  assert.match(resultado.mensaje, /Rafaela Toledo/);
  assert.equal(datos.llamadas.guardar, 1, 'una clave tomada no se reintenta');
});

test('C-39 una carrera real se reintenta con el mismo operacionId y acaba en carrera-perdida', async () => {
  // El contador se mueve en cada intento: eso SÍ es una carrera. Se reintenta
  // hasta agotar los intentos y el estado final no es «denegado», porque no
  // fue falta de permiso.
  const datos = datosQueDeniegan({
    lecturas: {
      [rutas.configContadores()]: { estado: 'ok', existe: true, datos: { ultimoLector: 99 } },
    },
    contadorPorIntento: (intento) => 7 + intento,
  });

  const resultado = await inscribirLector({ datos, ...ALTA });

  assert.equal(resultado.estado, 'carrera-perdida');
  assert.equal(resultado.mensaje, MENSAJES_DE_OPERACION.intentaloDeNuevo);
  assert.equal(datos.llamadas.guardar, 3, 'tres intentos, los de INTENTOS_DE_ALTA');
  assert.equal(datos.llamadas.operacionId, 'op-estable-1', 'el reintento conserva la identidad');
});
