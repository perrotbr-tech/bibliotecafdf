// A-30 y A-35: selección cerrada de ambiente (contrato §1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLAVE_ENSAYO, elegirAmbiente, esLoopback } from '../../docs/js/ambiente.js';

const CONFIGS = {
  emulador: { projectId: 'demo-biblioteca', apiKey: 'demo', authDomain: 'demo-biblioteca.firebaseapp.com' },
  ensayo: { projectId: 'biblioteca-ensayo', apiKey: 'e', authDomain: 'biblioteca-ensayo.firebaseapp.com' },
  produccion: { projectId: 'biblioteca-real', apiKey: 'p', authDomain: 'biblioteca-real.firebaseapp.com' },
};

function memoria(inicial = {}) {
  const caja = { ...inicial };
  return {
    getItem: (k) => caja[k] ?? null,
    setItem: (k, v) => {
      caja[k] = String(v);
    },
    caja,
  };
}

test('A-30 loopback usa el emulador y muestra su franja', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST']) {
    const elegido = elegirAmbiente({ host, configuraciones: CONFIGS });
    assert.equal(elegido.ambiente, 'emulador', host);
    assert.equal(elegido.franja, 'EMULADOR');
    assert.equal(elegido.proyecto, 'demo-biblioteca');
    assert.equal(elegido.bloqueado, false);
    assert.equal(elegido.permiteHoraDePrueba, true);
    assert.equal(elegido.permiteAccesoSimulado, true);
  }
});

test('A-30 una IP de la red local no activa el emulador por sí sola', () => {
  const elegido = elegirAmbiente({ host: '192.168.1.42', configuraciones: CONFIGS });
  assert.equal(elegido.ambiente, 'produccion');
  assert.equal(elegido.permiteHoraDePrueba, false);
  assert.ok(!esLoopback('192.168.1.42'));
});

test('A-30 ?ensayo=1 fuera de loopback usa el proyecto de ensayo y muestra su franja', () => {
  const almacen = memoria();
  const elegido = elegirAmbiente({
    host: 'ejemplo.github.io',
    parametros: new URLSearchParams('ensayo=1'),
    memoriaSesion: almacen,
    configuraciones: CONFIGS,
  });
  assert.equal(elegido.ambiente, 'ensayo');
  assert.equal(elegido.franja, 'ENSAYO');
  assert.equal(elegido.proyecto, 'biblioteca-ensayo');
  // Se recuerda bajo una clave propia de esta app y ambiente.
  assert.equal(almacen.caja[CLAVE_ENSAYO], '1');
  assert.ok(CLAVE_ENSAYO.startsWith('biblioteca.principal.'));
});

test('A-30 el recuerdo de la sesión mantiene ensayo sin repetir el parámetro', () => {
  const elegido = elegirAmbiente({
    host: 'ejemplo.github.io',
    memoriaSesion: memoria({ [CLAVE_ENSAYO]: '1' }),
    configuraciones: CONFIGS,
  });
  assert.equal(elegido.ambiente, 'ensayo');
});

test('A-30 sin parámetros ni recuerdo, fuera de loopback, usa producción y no muestra franja', () => {
  const elegido = elegirAmbiente({ host: 'ejemplo.github.io', configuraciones: CONFIGS });
  assert.equal(elegido.ambiente, 'produccion');
  assert.equal(elegido.franja, null);
  assert.equal(elegido.proyecto, 'biblioteca-real');
});

test('D-3 en loopback manda el host: ?ensayo=1 se ignora y queda anotado', () => {
  const almacen = memoria();
  const elegido = elegirAmbiente({
    host: 'localhost',
    parametros: new URLSearchParams('ensayo=1'),
    memoriaSesion: almacen,
    configuraciones: CONFIGS,
  });
  assert.equal(elegido.ambiente, 'emulador');
  assert.equal(elegido.parametroEnsayoIgnorado, true);
  // No se recuerda un parámetro que no se aplicó.
  assert.equal(almacen.caja[CLAVE_ENSAYO], undefined);
});

test('la publicación de ensayo fuerza ensayo pase lo que pase', () => {
  const elegido = elegirAmbiente({
    host: 'ejemplo.github.io',
    ambienteFijo: 'ensayo',
    configuraciones: { ...CONFIGS, produccion: null },
  });
  assert.equal(elegido.ambiente, 'ensayo');
  assert.equal(elegido.franja, 'ENSAYO');
});

test('A-35 una configuración ausente bloquea su ambiente y no abre otro', () => {
  const sinReales = { emulador: CONFIGS.emulador, ensayo: null, produccion: null };

  const produccion = elegirAmbiente({ host: 'ejemplo.github.io', configuraciones: sinReales });
  assert.equal(produccion.ambiente, 'produccion');
  assert.equal(produccion.bloqueado, true);
  assert.equal(produccion.motivoBloqueo, 'Falta configurar este ambiente');
  assert.equal(produccion.configuracion, null);

  const ensayo = elegirAmbiente({
    host: 'ejemplo.github.io',
    parametros: new URLSearchParams('ensayo=1'),
    configuraciones: sinReales,
  });
  assert.equal(ensayo.ambiente, 'ensayo');
  assert.equal(ensayo.bloqueado, true);

  // Y el emulador sigue funcionando sin credenciales reales.
  const local = elegirAmbiente({ host: '127.0.0.1', configuraciones: sinReales });
  assert.equal(local.ambiente, 'emulador');
  assert.equal(local.bloqueado, false);
});

test('A-35 un almacenamiento que lanza al leer no cambia de ambiente', () => {
  const roto = {
    getItem() {
      throw new Error('bloqueado');
    },
    setItem() {
      throw new Error('bloqueado');
    },
  };
  const elegido = elegirAmbiente({ host: 'ejemplo.github.io', memoriaSesion: roto, configuraciones: CONFIGS });
  assert.equal(elegido.ambiente, 'produccion');
});
