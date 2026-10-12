// Control de acceso: quién entra, quién no, y qué pasa cuando la escucha
// falla. Funciones puras y una capa de datos de mentira; las reglas de verdad
// se prueban contra el emulador en tests/reglas/.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esAdministrador, esPerdidaDeAcceso, mensajeDeErrorDeEntrada, permisoDe, vigilarPermiso } from '../../docs/js/acceso.js';
import { MENSAJES_ACCESO } from '../../docs/js/acceso.js';

const SESION = { email: 'Ana@Example.com', emailVerified: true };

test('sin sesión no hay permiso', () => {
  assert.equal(permisoDe({ sesion: null, documento: null }).estado, 'sin-sesion');
});

test('A-02 una cuenta que no está en la lista queda sin acceso', () => {
  const permiso = permisoDe({ sesion: SESION, documento: null });
  assert.equal(permiso.estado, 'sin-acceso');
  assert.equal(permiso.motivo, 'no-esta-en-la-lista');
  // El correo se muestra normalizado.
  assert.equal(permiso.correo, 'ana@example.com');
});

test('A-03 una cuenta inactiva queda sin acceso', () => {
  const permiso = permisoDe({ sesion: SESION, documento: { nombre: 'Ana', rol: 'voluntario', activo: false } });
  assert.equal(permiso.estado, 'sin-acceso');
  assert.equal(permiso.motivo, 'inactivo');
});

test('A-04 un correo sin verificar queda sin acceso aunque esté en la lista', () => {
  const permiso = permisoDe({
    sesion: { ...SESION, emailVerified: false },
    documento: { nombre: 'Ana', rol: 'admin', activo: true },
  });
  assert.equal(permiso.estado, 'sin-acceso');
  assert.equal(permiso.motivo, 'correo-sin-verificar');
  assert.equal(esAdministrador(permiso), false);
});

test('una cuenta activa entra, y el rol se reconoce', () => {
  const voluntaria = permisoDe({ sesion: SESION, documento: { nombre: 'Ana', rol: 'voluntario', activo: true } });
  assert.equal(voluntaria.estado, 'adentro');
  assert.equal(voluntaria.rol, 'voluntario');
  assert.equal(esAdministrador(voluntaria), false);

  const admin = permisoDe({ sesion: SESION, documento: { nombre: 'Ana', rol: 'admin', activo: true } });
  assert.equal(esAdministrador(admin), true);

  // Un rol inesperado no asciende a nadie.
  const raro = permisoDe({ sesion: SESION, documento: { nombre: 'Ana', rol: 'jefe', activo: true } });
  assert.equal(raro.rol, 'voluntario');
});

test('A-15 un permiso denegado en la escucha sí es pérdida de acceso', () => {
  assert.equal(esPerdidaDeAcceso({ code: 'permission-denied' }), true);
  assert.equal(esPerdidaDeAcceso({ code: 'firestore/permission-denied' }), true);
});

test('un corte de red NO echa a nadie de su cuenta', () => {
  for (const code of ['unavailable', 'deadline-exceeded', 'cancelled', 'internal']) {
    assert.equal(esPerdidaDeAcceso({ code }), false, code);
  }

  const avisados = [];
  const fallos = [];
  const datos = {
    escucharDocumento: (_ruta, _alCambiar, alFallar) => {
      // La escucha falla por red.
      alFallar({ code: 'unavailable' });
      return () => {};
    },
  };
  vigilarPermiso({
    datos,
    sesion: SESION,
    alCambiar: (permiso) => avisados.push(permiso),
    alFallar: (error) => fallos.push(error),
  });

  assert.deepEqual(avisados, [], 'el permiso no cambió');
  assert.equal(fallos.length, 1);
});

test('A-15 cuando la escucha dice denegado, el permiso pasa a sin acceso', () => {
  const avisados = [];
  const datos = {
    escucharDocumento: (_ruta, _alCambiar, alFallar) => {
      alFallar({ code: 'permission-denied' });
      return () => {};
    },
  };
  vigilarPermiso({ datos, sesion: SESION, alCambiar: (permiso) => avisados.push(permiso) });

  assert.equal(avisados.length, 1);
  assert.equal(avisados[0].estado, 'sin-acceso');
});

test('los errores de la ventana de Google tienen su mensaje', () => {
  assert.equal(mensajeDeErrorDeEntrada({ code: 'auth/popup-blocked' }), MENSAJES_ACCESO.ventanaBloqueada);
  assert.match(mensajeDeErrorDeEntrada({ code: 'auth/popup-blocked' }), /ventanas emergentes/);
  assert.equal(mensajeDeErrorDeEntrada({ code: 'auth/popup-closed-by-user' }), MENSAJES_ACCESO.cancelado);
  assert.equal(mensajeDeErrorDeEntrada({ code: 'auth/network-request-failed' }), MENSAJES_ACCESO.sinRed);
  assert.equal(mensajeDeErrorDeEntrada({ code: 'auth/otra-cosa' }), MENSAJES_ACCESO.error);
});
