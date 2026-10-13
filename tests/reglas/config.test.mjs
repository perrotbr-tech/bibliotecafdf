// Reglas de `config`: A-07, A-12 y la negación por defecto.
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import {
  ADMIN,
  ID,
  RUTAS,
  VOLUNTARIA,
  abrirEntorno,
  bloqueoMantenimiento,
  comoCuenta,
  sembrarBase,
} from '../ayuda/reglas.mjs';
import { BIB } from '../../docs/js/config-publica.js';

let entorno;

before(async () => {
  entorno = await abrirEntorno();
});
after(async () => {
  await entorno?.cleanup();
});
beforeEach(async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno);
});

const metadatos = () => ({ ultimaOperacionId: ID('1'), modificadoEn: serverTimestamp() });

test('A-07 una voluntaria no modifica config/app ni config/contadores', async () => {
  const db = comoCuenta(entorno, VOLUNTARIA);
  await assertFails(updateDoc(doc(db, RUTAS.app), { nombreBiblioteca: 'Otra', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.control), { bloqueo: null, ...metadatos() }));
});

test('A-07 un administrador sí modifica config/app respetando tipos y largos', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(updateDoc(doc(db, RUTAS.app), { nombreBiblioteca: 'Biblioteca Central', ...metadatos() }));
  await assertSucceeds(updateDoc(doc(db, RUTAS.app), { plazoSabadosPorDefecto: 4, ...metadatos() }));

  // Fuera de rango o con el tipo equivocado, no.
  await assertFails(updateDoc(doc(db, RUTAS.app), { plazoSabadosPorDefecto: 5, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { plazoSabadosPorDefecto: 0, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { plazoSabadosPorDefecto: '2', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { nombreBiblioteca: '', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { nombreBiblioteca: 'x'.repeat(41), ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { mensajeAtraso: 'corto', ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.app), { mensajePrevio: 'x'.repeat(401), ...metadatos() }));
});

test('inicioJuego exige el formato AAAA-B', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(updateDoc(doc(db, RUTAS.app), { inicioJuego: '2027-1', ...metadatos() }));
  for (const malo of ['basura', '2026-7', '2026-0', '26-5', '2026-05', '', '2026']) {
    await assertFails(updateDoc(doc(db, RUTAS.app), { inicioJuego: malo, ...metadatos() }), malo);
  }
});

test('una vez cerrada una temporada, inicioJuego ya no se mueve desde la app', async () => {
  // El contrato §8: cambiarlo después escondería una fotografía ya cerrada.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.app).update({ juegoCerradoAlgunaVez: true });
  });
  const db = comoCuenta(entorno, ADMIN);

  await assertFails(updateDoc(doc(db, RUTAS.app), { inicioJuego: '2027-1', ...metadatos() }));
  // Lo demás sí se puede seguir cambiando.
  await assertSucceeds(updateDoc(doc(db, RUTAS.app), { nombreBiblioteca: 'Otro nombre', ...metadatos() }));
});

test('juegoCerradoAlgunaVez es inmutable desde el cliente en esta etapa', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.app), { juegoCerradoAlgunaVez: true, ...metadatos() }));
});

// La Etapa 2 abrió una rendija en `config/contadores` —`ultimoLector` de N a
// N+1 dentro del alta de un lector, probado en `lectores.test.mjs`—. Lo que
// esta prueba sostiene es que ahí no cabe nada más: el contador de préstamos
// sigue cerrado hasta la Etapa 3, y el control no se escribe nunca desde la app.
test('de config/contadores la app solo puede subir ultimoLector; el control, nada', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamo: 1 }));
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamoId: 'p1' }));
  // Subir el contador de lectores sin crear el lector tampoco: el enlace del
  // contrato §3 no cierra.
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoLector: 1, ultimoLectorId: 'L001' }));
  await assertFails(deleteDoc(doc(db, RUTAS.contadores)));

  await assertFails(updateDoc(doc(db, RUTAS.control), { bloqueo: bloqueoMantenimiento() }));
  await assertFails(setDoc(doc(db, RUTAS.control), { bloqueo: null }));
});

test('A-12 una ruta que no figura en las reglas queda denegada', async () => {
  const db = comoCuenta(entorno, ADMIN);
  // `libros`, `lectores` y `lectoresClave` salieron de esta lista en la
  // Etapa 2: ahora tienen reglas propias y sus pruebas al lado.
  for (const ruta of [
    `bibliotecas/${BIB}/prestamos/p1`,
    `bibliotecas/${BIB}/temporadas/2026-5`,
    `bibliotecas/${BIB}/calendario/2026-10-10`,
    `bibliotecas/${BIB}/config/otra-cosa`,
    `bibliotecas/${BIB}`,
    'otraColeccion/x',
  ]) {
    await assertFails(getDoc(doc(db, ruta)));
    await assertFails(setDoc(doc(db, ruta), { algo: 1 }));
  }
  for (const coleccion of [`bibliotecas/${BIB}/prestamos`, 'bibliotecas']) {
    await assertFails(getDocs(collection(db, coleccion)));
  }
});

test('A-12 la configuración se crea y se borra solo con el script del dueño', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.app).delete();
  });
  await assertFails(setDoc(doc(db, RUTAS.app), { nombreBiblioteca: 'Mía' }));
});
