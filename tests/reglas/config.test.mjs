// Reglas de `config`: A-07, A-12 y la negación por defecto.
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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

test('juegoCerradoAlgunaVez es inmutable desde el cliente en esta etapa', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.app), { juegoCerradoAlgunaVez: true, ...metadatos() }));
});

test('ni el administrador escribe config/contadores o config/control desde la app', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(updateDoc(doc(db, RUTAS.contadores), { ultimoPrestamo: 1, ...metadatos() }));
  await assertFails(updateDoc(doc(db, RUTAS.control), { bloqueo: bloqueoMantenimiento() }));
  await assertFails(setDoc(doc(db, RUTAS.control), { bloqueo: null }));
});

test('A-12 una ruta que no figura en las reglas queda denegada', async () => {
  const db = comoCuenta(entorno, ADMIN);
  for (const ruta of [
    `bibliotecas/${BIB}/libros/INF001`,
    `bibliotecas/${BIB}/lectores/L001`,
    `bibliotecas/${BIB}/lectoresClave/ana`,
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
  for (const coleccion of [`bibliotecas/${BIB}/libros`, `bibliotecas/${BIB}/prestamos`, 'bibliotecas']) {
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
