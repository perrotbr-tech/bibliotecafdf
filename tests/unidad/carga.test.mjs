// Validación y armado de la carga inicial: C-28, C-29, C-30, C-33 y C-42.
//
// Todo esto es puro: recibe el archivo ya leído y devuelve rechazos,
// advertencias y la lista de escrituras. Lo que toca la base se prueba en
// `tests/scripts/`, contra el emulador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { construir, idDeImportacion, validar } from '../../scripts/cargar-datos.mjs';
import { rutas } from '../../docs/js/config-publica.js';

const RAIZ = join(import.meta.dirname, '..', '..');
const HOY = '2026-10-12';

const ficticio = async () => JSON.parse(await readFile(join(RAIZ, 'tests/fixtures/carga-ficticia.json'), 'utf8'));

/** Un archivo mínimo y válido, para romperlo campo por campo. */
function archivoBase() {
  return {
    categorias: [{ nombre: 'Infantil', prefijo: 'INF' }],
    libros: [{ codigo: 'INF003', titulo: 'Un libro', autor: 'Alguien', categoria: 'Infantil', baja: false }],
    lectores: [{ id: 'L001', nombre: 'Emilio Espejo', telefono: '56900000001' }],
    prestamos: [
      { numero: 1, libro: 'INF003', lector: 'L001', salio: '2026-10-03', vence: '2026-10-17', devuelto: false, devolvio: null },
    ],
    contadores: { ultimoPrestamo: 1, ultimoLector: 1 },
  };
}

const soloRechazos = (archivo, opciones = { hoy: HOY }) => validar(archivo, opciones).rechazos;

test('C-28 el archivo ficticio completo se valida sin un solo rechazo', async () => {
  const informe = validar(await ficticio(), { hoy: HOY });
  assert.deepEqual(informe.rechazos, []);
  assert.deepEqual(informe.resumen, {
    categorias: 6,
    libros: 145,
    lectores: 80,
    prestamos: 193,
    abiertos: 36,
  });
});

test('C-30 el ficticio trae justo las dos advertencias que la etapa describe', async () => {
  // Un `vence` que no es sábado y un plazo de 15 sábados. Ninguna impide
  // cargar, y el `vence` que se escribe es el del archivo.
  const informe = validar(await ficticio(), { hoy: HOY });
  const porTipo = new Map(informe.advertencias.map(({ tipo, cuantos }) => [tipo, cuantos]));
  assert.equal(porTipo.get('vence-no-sabado'), 1);
  assert.equal(porTipo.get('plazo-largo'), 1);
  assert.equal(informe.rechazos.length, 0);

  const escrituras = construir({ limpio: informe.limpio, marcaDeServidor: '(servidor)' });
  const prestamo = escrituras.find(({ datos }) => datos.numero === 1);
  assert.equal(prestamo.datos.salidaDia, '2025-11-01');
  // El vencimiento es el del archivo, no uno corregido a sábado.
  assert.equal(prestamo.datos.venceEl.toISOString(), '2025-11-19T02:59:59.999Z');
});

test('C-29 un libro con dos préstamos abiertos se rechaza nombrando los dos', () => {
  const archivo = archivoBase();
  archivo.prestamos.push({
    numero: 2,
    libro: 'INF003',
    lector: 'L001',
    salio: '2026-10-10',
    vence: '2026-10-24',
    devuelto: false,
    devolvio: null,
  });
  archivo.contadores.ultimoPrestamo = 2;
  const rechazos = soloRechazos(archivo);
  assert.equal(rechazos.length, 1);
  assert.match(rechazos[0], /INF003.*1 y 2/u);
});

test('C-29 contadores por debajo del archivo se rechazan', () => {
  const archivo = archivoBase();
  archivo.contadores = { ultimoPrestamo: 0, ultimoLector: 0 };
  const rechazos = soloRechazos(archivo);
  assert.equal(rechazos.length, 2);
  assert.ok(rechazos.some((uno) => uno.includes('ultimoLector es 0')));
  assert.ok(rechazos.some((uno) => uno.includes('ultimoPrestamo es 0')));

  // Por delante sí se acepta: el contador puede ir adelantado.
  const adelantado = archivoBase();
  adelantado.contadores = { ultimoPrestamo: 500, ultimoLector: 300 };
  assert.deepEqual(soloRechazos(adelantado), []);
});

test('C-42 nombre inválido, categoría inexistente o fecha imposible se rechazan', () => {
  const conNombre = archivoBase();
  conNombre.lectores[0].nombre = 'a b';
  assert.match(soloRechazos(conNombre).join(' '), /nombre «a b»/u);

  const conCategoria = archivoBase();
  conCategoria.libros[0].categoria = 'Cocina';
  assert.match(soloRechazos(conCategoria).join(' '), /categoría «Cocina»/u);

  for (const [campo, valor] of [
    ['salio', '2025-02-30'],
    ['vence', '2026-13-01'],
    ['devolvio', '2026-04-31'],
  ]) {
    const archivo = archivoBase();
    archivo.prestamos[0].devuelto = campo === 'devolvio';
    archivo.prestamos[0][campo] = valor;
    assert.match(soloRechazos(archivo).join(' '), /no existe en el calendario/u, `${campo}=${valor}`);
  }
});

test('los rechazos de fechas incoherentes nombran el préstamo', () => {
  const casos = [
    [{ vence: '2026-10-01' }, /vence el 2026-10-01, antes de salir/u],
    [{ devuelto: true, devolvio: '2026-10-01' }, /se devolvió el 2026-10-01, antes de salir/u],
    [{ devuelto: true, devolvio: '2026-12-25' }, /después de hoy/u],
    [{ devuelto: false, devolvio: '2026-10-10' }, /figura abierto y trae fecha de devolución/u],
  ];
  for (const [cambios, esperado] of casos) {
    const archivo = archivoBase();
    Object.assign(archivo.prestamos[0], cambios);
    assert.match(soloRechazos(archivo).join(' '), esperado, JSON.stringify(cambios));
  }
});

test('un código, un identificador o un número repetido se rechazan', () => {
  const conCodigo = archivoBase();
  conCodigo.libros.push({ ...conCodigo.libros[0], titulo: 'Otro' });
  assert.match(soloRechazos(conCodigo).join(' '), /INF003 está repetido/u);

  const conLector = archivoBase();
  conLector.lectores.push({ id: 'L001', nombre: 'Otra Persona', telefono: null });
  assert.match(soloRechazos(conLector).join(' '), /L001 está repetido/u);

  const conNumero = archivoBase();
  conNumero.prestamos.push({ ...conNumero.prestamos[0] });
  assert.match(soloRechazos(conNumero).join(' '), /préstamo 1 está repetido/u);
});

test('dos lectores con la misma clave se rechazan aunque el nombre se escriba distinto', () => {
  const archivo = archivoBase();
  archivo.lectores.push({ id: 'L002', nombre: '  emilio   ESPEJO ', telefono: null });
  archivo.contadores.ultimoLector = 2;
  assert.match(soloRechazos(archivo).join(' '), /comparten la clave «emilio espejo»/u);
});

test('un teléfono o un código con formato inválido se rechazan', () => {
  const conTelefono = archivoBase();
  conTelefono.lectores[0].telefono = '12345';
  assert.match(soloRechazos(conTelefono).join(' '), /teléfono «12345»/u);

  const conCodigo = archivoBase();
  conCodigo.libros[0].codigo = 'I3';
  assert.match(soloRechazos(conCodigo).join(' '), /código «I3», inválido/u);

  // Un código con espacios y minúsculas sí se acepta: se normaliza.
  const normalizable = archivoBase();
  normalizable.libros[0].codigo = 'inf 003';
  assert.deepEqual(soloRechazos(normalizable), []);
  const escrituras = construir({
    limpio: validar(normalizable, { hoy: HOY }).limpio,
    marcaDeServidor: '(servidor)',
  });
  assert.ok(escrituras.some(({ ruta }) => ruta === rutas.libro('INF003')));
});

test('una referencia a un libro o a un lector que no está en el archivo se rechaza', () => {
  const sinLibro = archivoBase();
  sinLibro.prestamos[0].libro = 'INF999';
  assert.match(soloRechazos(sinLibro).join(' '), /libro INF999, que no está/u);

  const sinLector = archivoBase();
  sinLector.prestamos[0].lector = 'L999';
  assert.match(soloRechazos(sinLector).join(' '), /lector L999, que no está/u);
});

test('un identificador de lector que no es L más tres cifras se rechaza', () => {
  for (const id of ['L1', 'L0001', '1', 'X001', 'l001']) {
    const archivo = archivoBase();
    archivo.lectores[0].id = id;
    assert.match(soloRechazos(archivo).join(' '), /identificador «.*», inválido/u, id);
  }
});

// ------------------------------------------------------------ qué se escribe

test('C-33 el estado y la cuenta de cada libro salen de sus préstamos', () => {
  const archivo = archivoBase();
  archivo.libros.push({ codigo: 'INF004', titulo: 'Dos', autor: '', categoria: 'Infantil', baja: false });
  archivo.prestamos.push({
    numero: 2,
    libro: 'INF004',
    lector: 'L001',
    salio: '2026-09-05',
    vence: '2026-09-19',
    devuelto: true,
    devolvio: '2026-09-12',
  });
  archivo.prestamos.push({
    numero: 3,
    libro: 'INF004',
    lector: 'L001',
    salio: '2026-09-26',
    vence: '2026-10-10',
    devuelto: true,
    devolvio: '2026-10-11',
  });
  archivo.contadores.ultimoPrestamo = 3;

  const escrituras = construir({ limpio: validar(archivo, { hoy: HOY }).limpio, marcaDeServidor: '(servidor)' });
  const porRuta = new Map(escrituras.map(({ ruta, datos }) => [ruta, datos]));

  const abierto = porRuta.get(rutas.libro('INF003'));
  assert.equal(abierto.prestamoAbierto, idDeImportacion('prestamo:1'));
  assert.equal(abierto.vecesPrestado, 1);

  const cerrado = porRuta.get(rutas.libro('INF004'));
  assert.equal(cerrado.prestamoAbierto, null);
  assert.equal(cerrado.vecesPrestado, 2);

  // Cada lector con su documento de clave.
  assert.equal(porRuta.get(rutas.lectorClave('emilio espejo')).lector, 'L001');
  assert.equal(porRuta.get(rutas.lector('L001')).clave, 'emilio espejo');
  assert.equal(porRuta.get(rutas.lector('L001')).avisoDatos, null);
  assert.equal(porRuta.get(rutas.lector('L001')).esDestinoFusion, false);
});

test('un devuelto a tiempo, uno con atraso y uno sin fecha se distinguen', () => {
  const archivo = archivoBase();
  archivo.prestamos = [
    { numero: 1, libro: 'INF003', lector: 'L001', salio: '2026-09-05', vence: '2026-09-19', devuelto: true, devolvio: '2026-09-19' },
    { numero: 2, libro: 'INF003', lector: 'L001', salio: '2026-09-26', vence: '2026-10-03', devuelto: true, devolvio: '2026-10-04' },
    { numero: 3, libro: 'INF003', lector: 'L001', salio: '2026-10-05', vence: '2026-10-10', devuelto: true, devolvio: null },
  ];
  archivo.contadores.ultimoPrestamo = 3;

  const escrituras = construir({ limpio: validar(archivo, { hoy: HOY }).limpio, marcaDeServidor: '(servidor)' });
  const prestamos = new Map(
    escrituras.filter(({ datos }) => datos.origen === 'excel').map(({ datos }) => [datos.numero, datos]),
  );

  assert.equal(prestamos.get(1).devueltoATiempo, true);
  assert.equal(prestamos.get(1).devueltoEn.toISOString(), '2026-09-19T15:00:00.000Z');
  assert.equal(prestamos.get(2).devueltoATiempo, false);
  // Devuelto sin fecha: base §5 manda `devueltoEn` nulo y a tiempo verdadero.
  assert.equal(prestamos.get(3).devueltoATiempo, true);
  assert.equal(prestamos.get(3).devueltoEn, null);
  for (const prestamo of prestamos.values()) {
    assert.equal(prestamo.estado, 'devuelto');
    assert.equal(prestamo.origen, 'excel');
    assert.equal(prestamo.plazoSabados, null);
    assert.equal(prestamo.registroDiferido, false);
    assert.equal(prestamo.creadoPor, 'carga-inicial');
  }
});

test('la temporada de un préstamo es el bimestre de su salida, no el de hoy', () => {
  const archivo = archivoBase();
  archivo.prestamos[0].salio = '2025-11-01';
  archivo.prestamos[0].vence = '2025-11-15';
  const escrituras = construir({ limpio: validar(archivo, { hoy: HOY }).limpio, marcaDeServidor: '(servidor)' });
  const prestamo = escrituras.find(({ datos }) => datos.numero === 1);
  assert.equal(prestamo.datos.temporada, '2025-6');
  assert.equal(prestamo.datos.prestadoEn.toISOString(), '2025-11-01T15:00:00.000Z');
});

test('los identificadores de importación son deterministas y tienen la forma de un id', () => {
  assert.equal(idDeImportacion('prestamo:1'), idDeImportacion('prestamo:1'));
  assert.notEqual(idDeImportacion('prestamo:1'), idDeImportacion('prestamo:2'));
  assert.match(idDeImportacion('prestamo:1'), /^[0-9a-f]{32}$/u);
  assert.match(idDeImportacion('clave:maría josé'), /^[0-9a-f]{32}$/u);
});

test('config/app y config/contadores se fusionan; el resto se pone completo', () => {
  const escrituras = construir({ limpio: validar(archivoBase(), { hoy: HOY }).limpio, marcaDeServidor: '(servidor)' });
  const modos = new Map(escrituras.map(({ ruta, modo }) => [ruta, modo]));
  assert.equal(modos.get(rutas.configApp()), 'fusionar');
  assert.equal(modos.get(rutas.configContadores()), 'fusionar');
  assert.equal(modos.get(rutas.libro('INF003')), 'poner');
  assert.equal(modos.get(rutas.lector('L001')), 'poner');

  // La fusión de config/app toca solo las categorías: lo demás es de la app.
  const app = escrituras.find(({ ruta }) => ruta === rutas.configApp());
  assert.deepEqual(Object.keys(app.datos), ['categorias']);
});

test('el enlace de los contadores apunta al documento del número, o a nulo', () => {
  const alDia = construir({ limpio: validar(archivoBase(), { hoy: HOY }).limpio, marcaDeServidor: '(s)' });
  const contadores = alDia.find(({ ruta }) => ruta === rutas.configContadores()).datos;
  assert.equal(contadores.ultimoLectorId, 'L001');
  assert.equal(contadores.ultimoPrestamoId, idDeImportacion('prestamo:1'));

  // Un contador adelantado no puede enlazar un documento que no existe.
  const adelantado = archivoBase();
  adelantado.contadores = { ultimoPrestamo: 9, ultimoLector: 9 };
  const conHueco = construir({ limpio: validar(adelantado, { hoy: HOY }).limpio, marcaDeServidor: '(s)' });
  const otros = conHueco.find(({ ruta }) => ruta === rutas.configContadores()).datos;
  assert.equal(otros.ultimoLectorId, null);
  assert.equal(otros.ultimoPrestamoId, null);
});

test('un «devuelto» que no es booleano se rechaza, como la baja de un libro', () => {
  // Un «si» de texto se convertía en falso sin decir nada, y ese préstamo
  // devuelto quedaba abierto: el libro aparecía prestado para siempre.
  for (const valor of ['si', 'no', 1, 0, null, undefined]) {
    const archivo = archivoBase();
    archivo.prestamos[0].devuelto = valor;
    assert.match(soloRechazos(archivo).join(' '), /no dice si está devuelto/u, JSON.stringify(valor));
  }
  // Los dos booleanos sí pasan.
  for (const valor of [true, false]) {
    const archivo = archivoBase();
    archivo.prestamos[0].devuelto = valor;
    archivo.prestamos[0].devolvio = valor ? '2026-10-10' : null;
    assert.deepEqual(soloRechazos(archivo), [], String(valor));
  }
});

test('el nombre de un respaldo lleva segundos y no pisa un archivo que exista', async () => {
  const { marcaDeArchivo, guardarJsonSinPisar } = await import('../../scripts/comun/manifiesto.mjs');
  const { mkdtemp, rm, readdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  // Con precisión de minutos, dos respaldos del mismo minuto caían en el mismo
  // archivo: el segundo pisaba al primero, que podía ser la única copia de los
  // datos que el reemplazo acababa de borrar.
  assert.match(marcaDeArchivo(new Date(2026, 9, 12, 5, 30, 12)), /^20261012-053012$/u);

  const carpeta = await mkdtemp(join(tmpdir(), 'respaldo-sin-pisar-'));
  try {
    const ruta = join(carpeta, 'respaldo.json');
    assert.equal(await guardarJsonSinPisar(ruta, { uno: 1 }), ruta);
    assert.equal(await guardarJsonSinPisar(ruta, { dos: 2 }), join(carpeta, 'respaldo-2.json'));
    assert.equal(await guardarJsonSinPisar(ruta, { tres: 3 }), join(carpeta, 'respaldo-3.json'));
    assert.deepEqual((await readdir(carpeta)).sort(), ['respaldo-2.json', 'respaldo-3.json', 'respaldo.json']);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});
