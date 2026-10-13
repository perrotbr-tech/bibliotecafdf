// Carga inicial contra el emulador: C-28, C-31, C-32, C-33 y C-41.
//
// La validación pura se prueba en `tests/unidad/carga.test.mjs`. Lo que se
// prueba aquí es lo que solo se puede probar escribiendo: que la simulación no
// escriba, que una base con datos detenga la carga, que el reemplazo respalde
// antes de borrar, y que un corte a mitad se pueda reanudar sin duplicar.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BIB, rutas } from '../../docs/js/config-publica.js';
import { recorrer, verificarReferencias } from '../../scripts/comun/biblioteca.mjs';
import { cargar, idDeImportacion, leerArchivoDeCarga } from '../../scripts/cargar-datos.mjs';
import { verificar } from '../../scripts/respaldar.mjs';
import {
  DUENO,
  abrirAdmin,
  baseQueCortaEnElLote,
  carpetaTemporal,
  inicializarBase,
  vaciar,
} from '../ayuda/scripts.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const HOY = '2026-10-12';

let db;
let FieldValue;
let proyecto;
let archivo;
let carpeta;
let limpiarCarpeta;

before(async () => {
  ({ db, FieldValue, proyecto } = await abrirAdmin());
  ({ carpeta, limpiar: limpiarCarpeta } = await carpetaTemporal('biblioteca-carga-'));
  archivo = await leerArchivoDeCarga(join(RAIZ, 'tests/fixtures/carga-ficticia.json'));
});
after(async () => {
  await vaciar(db);
  await limpiarCarpeta();
});
beforeEach(async () => {
  await vaciar(db);
  await inicializarBase(db, FieldValue);
});

const manifiestoEn = (nombre) => join(carpeta, nombre);
const cuantos = async (coleccion) => (await db.collection(`bibliotecas/${BIB}/${coleccion}`).count().get()).data().count;

test('C-28 la simulación informa y no escribe una sola línea', async () => {
  const informe = await cargar({ db, FieldValue, proyecto, datos: archivo, modo: 'simular', hoy: HOY });

  assert.equal(informe.estado, 'simulado');
  assert.deepEqual(informe.rechazos, []);
  assert.equal(informe.escritos, 0);
  assert.equal(informe.resumen.libros, 145);

  for (const coleccion of ['libros', 'lectores', 'lectoresClave', 'prestamos']) {
    assert.equal(await cuantos(coleccion), 0, coleccion);
  }
  // Y las categorías iniciales de la Etapa 1 siguen intactas.
  const app = (await db.doc(rutas.configApp()).get()).data();
  assert.equal(app.categorias.length, 6);
});

test('C-33 después de cargar, el estante y las claves coinciden con los préstamos', async () => {
  const informe = await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-c33.json'),
  });
  assert.equal(informe.estado, 'cargado');
  assert.equal(informe.escritos, 500);

  assert.equal(await cuantos('libros'), 145);
  assert.equal(await cuantos('lectores'), 80);
  assert.equal(await cuantos('lectoresClave'), 80);
  assert.equal(await cuantos('prestamos'), 193);

  // La comprobación de coherencia del contrato §6, sobre lo que quedó escrito:
  // cada préstamo con su libro y su lector, cada lector con su clave, ningún
  // libro con dos abiertos, `vecesPrestado` cuadrado y contadores al día.
  assert.deepEqual(verificarReferencias(await recorrer(db)), []);

  // Un libro con préstamo abierto apunta a ese préstamo.
  const abiertos = await db
    .collection(rutas.prestamos())
    .where('estado', '==', 'abierto')
    .get();
  assert.equal(abiertos.size, 36);
  for (const prestamo of abiertos.docs) {
    const libro = (await db.doc(rutas.libro(prestamo.data().libro)).get()).data();
    assert.equal(libro.prestamoAbierto, prestamo.id);
  }

  // El mantenimiento quedó liberado y el manifiesto cerrado.
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
  assert.equal(JSON.parse(await readFile(informe.manifiesto, 'utf8')).estado, 'terminado');
});

test('la carga fusiona config/app y config/contadores sin pisar lo demás', async () => {
  await db.doc(rutas.configApp()).set({ nombreBiblioteca: 'Biblioteca de la iglesia' }, { merge: true });
  await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-fusion.json'),
  });

  const app = (await db.doc(rutas.configApp()).get()).data();
  assert.equal(app.nombreBiblioteca, 'Biblioteca de la iglesia', 'el nombre no se toca');
  assert.equal(app.plazoSabadosPorDefecto, 2);
  assert.equal(app.inicioJuego, '2026-5');
  assert.equal(app.categorias.length, 6);

  const contadores = (await db.doc(rutas.configContadores()).get()).data();
  assert.equal(contadores.ultimoLector, 80);
  assert.equal(contadores.ultimoPrestamo, 193);
  assert.equal(contadores.ultimoLectorId, 'L080');
  assert.equal(contadores.creadoPor, DUENO, 'los metadatos del documento original siguen ahí');

  // Y el voluntario de la Etapa 1 sigue en su lugar.
  assert.ok((await db.doc(rutas.voluntario(DUENO)).get()).exists);
});

test('C-31 cargar sobre colecciones con datos se detiene sin escribir', async () => {
  await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-c31a.json'),
  });
  const antes = await cuantos('libros');

  await assert.rejects(
    () =>
      cargar({
        db,
        FieldValue,
        proyecto,
        datos: archivo,
        modo: 'cargar',
        por: DUENO,
        hoy: HOY,
        rutaManifiesto: manifiestoEn('manifiesto-c31b.json'),
      }),
    /ya tienen datos/u,
  );
  assert.equal(await cuantos('libros'), antes);
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null, 'no se tomó el mantenimiento');
});

test('C-32 el reemplazo respalda y verifica antes de borrar nada', async () => {
  await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-c32a.json'),
  });
  // Un libro que no está en el archivo: el reemplazo lo tiene que borrar.
  await db.doc(rutas.libro('INF900')).set({
    codigo: 'INF900',
    titulo: 'Agregado a mano',
    autor: '',
    categoria: 'Infantil',
    baja: false,
    prestamoAbierto: null,
    vecesPrestado: 0,
    creadoEn: FieldValue.serverTimestamp(),
    creadoPor: DUENO,
  });

  const informe = await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'reemplazar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-c32b.json'),
  });

  assert.equal(informe.estado, 'cargado');
  assert.ok(informe.respaldoPrevio, 'el reemplazo respalda antes');
  // El respaldo previo se puede verificar y contiene el libro agregado a mano,
  // que es justo lo que se pierde al reemplazar.
  const respaldo = await verificar(informe.respaldoPrevio.archivo);
  assert.ok(respaldo.documentos.some(({ ruta }) => ruta === rutas.libro('INF900')));

  assert.equal((await db.doc(rutas.libro('INF900')).get()).exists, false);
  assert.equal(await cuantos('libros'), 145);
  assert.deepEqual(verificarReferencias(await recorrer(db)), []);
});

test('una recarga de negocio no pasa por encima de una temporada cerrada', async () => {
  await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-temporada-a.json'),
  });
  await db.doc(`${rutas.temporadas()}/2026-5`).set({
    inicio: '2026-09-01',
    fin: '2026-10-31',
    cerradaEn: FieldValue.serverTimestamp(),
    cerradaPor: DUENO,
    totalPrestamos: 10,
  });

  await assert.rejects(
    () =>
      cargar({
        db,
        FieldValue,
        proyecto,
        datos: archivo,
        modo: 'reemplazar',
        por: DUENO,
        hoy: HOY,
        rutaManifiesto: manifiestoEn('manifiesto-temporada-b.json'),
      }),
    /temporadas cerradas/u,
  );
  assert.equal(await cuantos('libros'), 145);
});

test('C-41 un corte a mitad de la carga se reanuda sin duplicar nada', async () => {
  const rutaManifiesto = manifiestoEn('manifiesto-c41-carga.json');
  const cortada = baseQueCortaEnElLote(db, 2);

  const error = await cargar({
    db: cortada,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    lote: 50,
    rutaManifiesto,
  }).catch((capturado) => capturado);

  assert.match(error.message, /corte simulado/u);
  assert.match(error.mensajeDeBloqueo, /QUEDA PUESTO/u);

  const aMedias = JSON.parse(await readFile(rutaManifiesto, 'utf8'));
  assert.equal(aMedias.estado, 'interrumpido');
  assert.equal(aMedias.hechos.length, 50);
  assert.equal(aMedias.total, 500);

  // La base quedó cerrada con el token del manifiesto.
  const bloqueo = (await db.doc(rutas.configControl()).get()).data().bloqueo;
  assert.equal(bloqueo.tipo, 'mantenimiento');
  assert.equal(bloqueo.token, aMedias.token);

  // Se reanuda. Los identificadores son deterministas, así que lo que se
  // vuelva a escribir sería el mismo documento: nada se duplica.
  const informe = await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    lote: 50,
    reanudar: true,
    rutaManifiesto,
  });

  assert.equal(informe.estado, 'cargado');
  assert.equal(informe.escritos, 500);
  assert.equal(await cuantos('libros'), 145);
  assert.equal(await cuantos('prestamos'), 193);
  assert.deepEqual(verificarReferencias(await recorrer(db)), []);
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
});

test('los identificadores de la carga son los mismos en dos corridas', async () => {
  // Es lo que hace reanudable una importación: el documento del préstamo 7 es
  // siempre el mismo, venga de la corrida que venga.
  await cargar({
    db,
    FieldValue,
    proyecto,
    datos: archivo,
    modo: 'cargar',
    por: DUENO,
    hoy: HOY,
    rutaManifiesto: manifiestoEn('manifiesto-ids.json'),
  });
  const esperado = idDeImportacion('prestamo:7');
  const prestamo = await db.doc(rutas.prestamo(esperado)).get();
  assert.ok(prestamo.exists);
  assert.equal(prestamo.data().numero, 7);
  assert.equal(prestamo.data().creacionId, esperado);
  assert.equal(prestamo.data().origen, 'excel');
  assert.equal(prestamo.data().creadoPor, 'carga-inicial');
});
