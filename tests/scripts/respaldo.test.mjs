// Respaldo y restauración contra el emulador: C-34, C-35, C-40 y C-41.
//
// Estas pruebas usan Admin SDK, que no pasa por reglas, así que lo que
// comprueban es el comportamiento de los scripts del dueño. La mitad de C-40
// que corresponde a las reglas —que el mantenimiento impide escribir desde la
// app— se prueba aquí también, con un cliente real sobre el emulador, para que
// las dos mitades queden en el mismo lugar.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertFails } from '@firebase/rules-unit-testing';

import { rutas } from '../../docs/js/config-publica.js';
import { recorrer } from '../../scripts/comun/biblioteca.mjs';
import { hashCanonico } from '../../scripts/comun/datos-exportados.mjs';
import * as mantenimiento from '../../scripts/comun/mantenimiento.mjs';
import { respaldar, verificar } from '../../scripts/respaldar.mjs';
import { restaurar } from '../../scripts/restaurar.mjs';
import {
  DUENO,
  abrirAdmin,
  baseQueCortaEnElLote,
  carpetaTemporal,
  inicializarBase,
  sembrarNegocio,
  vaciar,
} from '../ayuda/scripts.mjs';
import { abrirEntorno, comoCuenta, loteDeAlta } from '../ayuda/reglas.mjs';

let db;
let FieldValue;
let Timestamp;
let proyecto;
let carpeta;
let limpiarCarpeta;

before(async () => {
  ({ db, FieldValue, Timestamp, proyecto } = await abrirAdmin());
  ({ carpeta, limpiar: limpiarCarpeta } = await carpetaTemporal('biblioteca-respaldo-'));
});
after(async () => {
  await vaciar(db);
  await limpiarCarpeta();
});
beforeEach(async () => {
  await vaciar(db);
  await inicializarBase(db, FieldValue);
});

const archivoEn = (nombre) => join(carpeta, nombre);
const manifiestoEn = (nombre) => join(carpeta, nombre);

test('un respaldo se verifica contra la base, documento por documento', async () => {
  await sembrarNegocio(db, FieldValue);
  const salida = archivoEn('respaldo-uno.json');
  const informe = await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });

  assert.equal(informe.archivo, salida);
  assert.equal(informe.total, 7);
  assert.match(informe.hash, /^[0-9a-f]{64}$/u);

  // Verificar de nuevo, ahora desde fuera del script, tiene que pasar.
  const respaldo = await verificar(salida, { db });
  assert.equal(respaldo.proyecto, proyecto);
  assert.equal(respaldo.documentos.length, 7);
  // Y el bloqueo quedó liberado.
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
});

test('un respaldo alterado no pasa la verificación', async () => {
  await sembrarNegocio(db, FieldValue);
  const salida = archivoEn('respaldo-alterado.json');
  await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });

  // 1. Cambiar un dato sin tocar el hash: el hash no cuadra.
  const original = JSON.parse(await readFile(salida, 'utf8'));
  const tocado = structuredClone(original);
  tocado.documentos.find(({ ruta }) => ruta === rutas.libro('INF006')).datos.titulo = 'Otro título';
  await writeFile(salida, JSON.stringify(tocado), 'utf8');
  await assert.rejects(() => verificar(salida), /hash del respaldo no coincide/u);

  // 2. Cambiar el dato Y recalcular el hash: el archivo es coherente consigo
  // mismo, y la comparación contra la base lo descubre igual. Esto es lo que
  // el contrato §6 quiere decir con «contar documentos no basta».
  const { hash: _, ...cuerpo } = tocado;
  await writeFile(salida, JSON.stringify({ ...cuerpo, hash: hashCanonico(cuerpo) }), 'utf8');
  await verificar(salida);
  await assert.rejects(() => verificar(salida, { db }), /no coincide con la base/u);
});

test('un respaldo con referencias incoherentes no se da por bueno', async () => {
  await sembrarNegocio(db, FieldValue);
  // Un lector sin su documento de clave: el respaldo se genera y la
  // verificación lo rechaza.
  await db.doc(rutas.lectorClave('rafaela toledo')).delete();
  await assert.rejects(
    () => respaldar({ db, FieldValue, proyecto, por: DUENO, salida: archivoEn('incoherente.json') }),
    /sin documento en lectoresClave/u,
  );
  // Y el mantenimiento quedó puesto, porque el trabajo no terminó bien.
  const bloqueo = (await db.doc(rutas.configControl()).get()).data().bloqueo;
  assert.equal(bloqueo?.tipo, 'mantenimiento');
});

test('no se respalda si ya hay un bloqueo de otro tipo', async () => {
  await db.doc(rutas.configControl()).set(
    {
      bloqueo: {
        tipo: 'cierre',
        token: 'a'.repeat(32),
        por: DUENO,
        iniciadoEn: FieldValue.serverTimestamp(),
        hasta: Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
        temporada: '2026-5',
      },
    },
    { merge: true },
  );
  await assert.rejects(
    () => respaldar({ db, FieldValue, proyecto, por: DUENO, salida: archivoEn('no-va.json') }),
    /bloqueo de tipo «cierre»/u,
  );
});

test('si un trabajo falla, el mantenimiento QUEDA puesto y el mensaje lo dice', async () => {
  const error = await mantenimiento
    .conMantenimiento(db, FieldValue, { por: DUENO }, async () => {
      throw new Error('algo salió mal a mitad');
    })
    .catch((capturado) => capturado);

  assert.match(error.message, /algo salió mal/u);
  assert.match(error.mensajeDeBloqueo, /QUEDA PUESTO/u);
  const bloqueo = (await db.doc(rutas.configControl()).get()).data().bloqueo;
  assert.equal(bloqueo.tipo, 'mantenimiento');
  assert.equal(bloqueo.token, error.bloqueoPuesto);
  // Y nadie más puede tomarlo mientras siga ahí.
  await assert.rejects(() => mantenimiento.tomar(db, FieldValue, { por: 'otra@example.com' }), /Ya hay un bloqueo/u);
  await mantenimiento.liberar(db, error.bloqueoPuesto);
});

test('C-40 con el mantenimiento puesto la app no escribe, y el respaldo sigue sirviendo', async () => {
  await sembrarNegocio(db, FieldValue);

  // Mientras el dueño tiene el mantenimiento, un voluntario con sesión no
  // puede inscribir: lo deniegan las reglas, no la interfaz.
  const token = await mantenimiento.tomar(db, FieldValue, { por: DUENO });
  // Sin limpiar: la base la sembró Admin SDK y es justo lo que se prueba.
  const entorno = await abrirEntorno({ limpiar: false });
  try {
    const cliente = comoCuenta(entorno, DUENO);
    await assertFails(loteDeAlta(cliente, DUENO, { numero: 2, nombre: 'María José', clave: 'maria jose' }).commit());
  } finally {
    await entorno.cleanup();
  }
  await mantenimiento.liberar(db, token);

  // Y el respaldo tomado así se repone idéntico.
  const salida = archivoEn('respaldo-c40.json');
  const informe = await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });
  await vaciar(db);
  await restaurar({
    db,
    FieldValue,
    Timestamp,
    proyecto,
    archivo: salida,
    por: DUENO,
    rutaManifiesto: manifiestoEn('manifiesto-c40.json'),
  });
  const vuelto = await recorrer(db);
  assert.equal(vuelto.length, informe.total);
});

test('C-34 respaldar, vaciar y restaurar deja la base idéntica, marcas de tiempo incluidas', async () => {
  await sembrarNegocio(db, FieldValue);
  const antes = await recorrer(db);
  const salida = archivoEn('respaldo-c34.json');
  await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });

  await vaciar(db);
  assert.equal((await recorrer(db)).length, 0);

  const informe = await restaurar({
    db,
    FieldValue,
    Timestamp,
    proyecto,
    archivo: salida,
    por: DUENO,
    rutaManifiesto: manifiestoEn('manifiesto-c34.json'),
  });
  assert.equal(informe.escritos, antes.length - 1, 'el control se escribe aparte, al final');

  const despues = await recorrer(db);
  assert.equal(despues.length, antes.length);
  // La comparación es literal: mismas rutas, mismos datos, mismos instantes.
  // Lo único que cambia es el bloqueo del control, normalizado a nulo.
  const porRuta = new Map(despues.map(({ ruta, datos }) => [ruta, datos]));
  for (const { ruta, datos } of antes) {
    const esperado = ruta === rutas.configControl() ? { ...datos, bloqueo: null } : datos;
    assert.equal(hashCanonico(porRuta.get(ruta)), hashCanonico(esperado), ruta);
  }
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
});

test('C-35 restaurar sobre una base con datos se detiene; con --reemplazar respalda y repone', async () => {
  await sembrarNegocio(db, FieldValue);
  const salida = archivoEn('respaldo-c35.json');
  await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });

  // La base no está vacía: se detiene sin escribir.
  await db.doc(rutas.libro('INF007')).set({
    codigo: 'INF007',
    titulo: 'Agregado después',
    autor: '',
    categoria: 'Infantil',
    baja: false,
    prestamoAbierto: null,
    vecesPrestado: 0,
    creadoEn: FieldValue.serverTimestamp(),
    creadoPor: DUENO,
  });
  await assert.rejects(
    () =>
      restaurar({
        db,
        FieldValue,
        Timestamp,
        proyecto,
        archivo: salida,
        por: DUENO,
        rutaManifiesto: manifiestoEn('manifiesto-c35.json'),
      }),
    /no está vacía/u,
  );
  assert.ok((await db.doc(rutas.libro('INF007')).get()).exists, 'no se tocó nada');

  // Con --reemplazar: respalda, verifica, borra lo que no está en el archivo y
  // repone. El libro agregado después desaparece, porque no estaba.
  const informe = await restaurar({
    db,
    FieldValue,
    Timestamp,
    proyecto,
    archivo: salida,
    por: DUENO,
    reemplazar: true,
    rutaManifiesto: manifiestoEn('manifiesto-c35.json'),
  });
  assert.ok(informe.respaldoPrevio, 'el reemplazo respalda antes de tocar nada');
  await verificar(informe.respaldoPrevio.archivo);
  assert.equal((await db.doc(rutas.libro('INF007')).get()).exists, false);
  assert.ok((await db.doc(rutas.libro('INF006')).get()).exists);
});

test('C-41 un corte a mitad de la restauración deja la base cerrada y el manifiesto reanudable', async () => {
  await sembrarNegocio(db, FieldValue);
  const salida = archivoEn('respaldo-c41.json');
  await respaldar({ db, FieldValue, proyecto, por: DUENO, salida });
  // Se repone sobre una base vacía: así el único lote de escritura es el de la
  // restauración, y el corte cae donde se quiere.
  await vaciar(db);

  const rutaManifiesto = manifiestoEn('manifiesto-c41.json');
  // Lotes de dos documentos y corte en el segundo: el primero queda escrito.
  const cortada = baseQueCortaEnElLote(db, 2);
  const error = await restaurar({
    db: cortada,
    FieldValue,
    Timestamp,
    proyecto,
    archivo: salida,
    por: DUENO,
    lote: 2,
    rutaManifiesto,
  }).catch((capturado) => capturado);

  assert.match(error.message, /corte simulado/u);
  assert.match(error.mensajeDeBloqueo, /QUEDA PUESTO/u);

  const manifiesto = JSON.parse(await readFile(rutaManifiesto, 'utf8'));
  assert.equal(manifiesto.estado, 'interrumpido');
  assert.equal(manifiesto.hechos.length, 2);
  assert.ok(manifiesto.total > manifiesto.hechos.length);

  // La base quedó cerrada: nadie la usa a medias.
  const bloqueo = (await db.doc(rutas.configControl()).get()).data().bloqueo;
  assert.equal(bloqueo.tipo, 'mantenimiento');
  assert.equal(bloqueo.token, manifiesto.token);

  // Y se reanuda: reusa el bloqueo que quedó puesto y escribe lo que falta.
  const informe = await restaurar({
    db,
    FieldValue,
    Timestamp,
    proyecto,
    archivo: salida,
    por: DUENO,
    reanudar: true,
    lote: 2,
    rutaManifiesto,
  });
  assert.equal(informe.escritos, informe.total - 1);
  assert.equal(JSON.parse(await readFile(rutaManifiesto, 'utf8')).estado, 'terminado');
  assert.equal((await db.doc(rutas.configControl()).get()).data().bloqueo, null);
  assert.ok((await db.doc(rutas.libro('INF006')).get()).exists);
});
