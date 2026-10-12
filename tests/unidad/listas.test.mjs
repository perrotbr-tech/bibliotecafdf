// Preparar, filtrar y mostrar por tandas: la lógica de las listas largas.
//
// Aquí se prueba lo que el navegador haría mal en silencio: el orden de los
// códigos, qué cuenta como disponible y cuántas filas se muestran.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS_DE_LIBRO,
  FILAS_POR_TANDA,
  claseDeTejuelo,
  codigosDeCategoria,
  compararCodigos,
  estadoDeLibro,
  filtrarLectores,
  filtrarLibros,
  porTandas,
  prepararLectores,
  prepararLibros,
} from '../../docs/js/listas.js';

const CATEGORIAS = [
  { nombre: 'Infantil', prefijo: 'INF' },
  { nombre: 'Hombres y mujeres', prefijo: 'HM' },
  { nombre: 'Teología', prefijo: 'TEO' },
];

const libro = (codigo, campos = {}) => ({
  id: codigo,
  codigo,
  titulo: `Libro ${codigo}`,
  autor: 'Alguien',
  categoria: 'Infantil',
  baja: false,
  prestamoAbierto: null,
  vecesPrestado: 0,
  ...campos,
});

// ------------------------------------------------------------------ orden

test('el orden de los códigos es el que lee una persona, no el alfabético', () => {
  // Lo alfabético pondría INF1000 antes de INF999. El número se compara como
  // número.
  const ordenados = prepararLibros(
    [libro('INF1000'), libro('INF999'), libro('INF002'), libro('HM400'), libro('INF027A'), libro('INF027')],
    { categorias: CATEGORIAS },
  ).map(({ codigo }) => codigo);
  assert.deepEqual(ordenados, ['HM400', 'INF002', 'INF027', 'INF027A', 'INF999', 'INF1000']);
});

test('comparar códigos es estable y simétrico', () => {
  assert.ok(compararCodigos('INF002', 'INF010') < 0);
  assert.ok(compararCodigos('INF010', 'INF002') > 0);
  assert.equal(compararCodigos('INF010', 'INF010'), 0);
  assert.ok(compararCodigos('HM400', 'INF002') < 0);
  assert.ok(compararCodigos('INF027', 'INF027A') < 0);
  // Y acepta un código escrito con espacios o en minúsculas.
  assert.equal(compararCodigos('inf 010', 'INF010'), 0);
});

// ----------------------------------------------------------------- estado

test('el estado de un libro distingue de baja, prestado y disponible', () => {
  assert.equal(estadoDeLibro(libro('INF001')), 'disponible');
  assert.equal(estadoDeLibro(libro('INF002', { prestamoAbierto: 'p1' })), 'prestado');
  assert.equal(estadoDeLibro(libro('INF003', { baja: true })), 'de-baja');
  // Un libro de baja que arrastra un préstamo abierto se muestra de baja: es
  // lo que decide si se puede prestar.
  assert.equal(estadoDeLibro(libro('INF004', { baja: true, prestamoAbierto: 'p1' })), 'de-baja');
});

test('un libro de baja no cuenta como disponible, pero sigue apareciendo en Todos', () => {
  const libros = prepararLibros(
    [libro('INF001'), libro('INF002', { prestamoAbierto: 'p1' }), libro('INF003', { baja: true })],
    { categorias: CATEGORIAS },
  );
  assert.equal(filtrarLibros(libros, { estado: 'todos' }).length, 3);
  assert.deepEqual(
    filtrarLibros(libros, { estado: 'disponibles' }).map(({ codigo }) => codigo),
    ['INF001'],
  );
  assert.deepEqual(
    filtrarLibros(libros, { estado: 'prestados' }).map(({ codigo }) => codigo),
    ['INF002'],
  );
});

test('los tres estados de la pantalla son los que la etapa pide', () => {
  assert.deepEqual(
    ESTADOS_DE_LIBRO.map(({ id }) => id),
    ['todos', 'disponibles', 'prestados'],
  );
});

// ----------------------------------------------------------------- filtros

test('C-25 el filtro encuentra por título, autor y código, sin tildes', () => {
  const libros = prepararLibros(
    [
      libro('INF006', { titulo: 'El Dios pródigo', autor: 'Tim Keller', categoria: 'Teología' }),
      libro('HM012', { titulo: 'Cómo ser esposa', autor: 'Martha Peace', categoria: 'Hombres y mujeres' }),
    ],
    { categorias: CATEGORIAS },
  );

  const codigos = (consulta) => filtrarLibros(libros, { consulta }).map(({ codigo }) => codigo);
  assert.deepEqual(codigos('dios prodigo'), ['INF006']);
  assert.deepEqual(codigos('PRÓDIGO'), ['INF006']);
  assert.deepEqual(codigos('keller'), ['INF006']);
  assert.deepEqual(codigos('inf 006'), ['INF006']);
  assert.deepEqual(codigos('peace'), ['HM012']);
  assert.deepEqual(codigos('calvino'), []);
});

test('C-26 una búsqueda con signos raros devuelve vacío y no lanza', () => {
  const libros = prepararLibros([libro('INF006')], { categorias: CATEGORIAS });
  for (const rara of ['(.*[\\', '[[[', '\\', '*', '?!']) {
    assert.doesNotThrow(() => filtrarLibros(libros, { consulta: rara }), rara);
    assert.deepEqual(filtrarLibros(libros, { consulta: rara }), [], rara);
  }
});

test('el filtro de categoría y el de texto se combinan', () => {
  const libros = prepararLibros(
    [
      libro('INF001', { titulo: 'Arca de Noé' }),
      libro('TEO001', { titulo: 'Arca de la alianza', categoria: 'Teología' }),
    ],
    { categorias: CATEGORIAS },
  );
  assert.equal(filtrarLibros(libros, { consulta: 'arca' }).length, 2);
  assert.deepEqual(
    filtrarLibros(libros, { consulta: 'arca', categoria: 'Teología' }).map(({ codigo }) => codigo),
    ['TEO001'],
  );
  assert.deepEqual(filtrarLibros(libros, { consulta: 'arca', categoria: 'Novelas' }), []);
});

// ---------------------------------------------------------------- lectores

test('los lectores se ordenan alfabéticamente en español, sin distinguir tildes', () => {
  const lectores = prepararLectores([
    { id: 'L003', nombre: 'Ñandú Pérez', telefono: null },
    { id: 'L001', nombre: 'ana rojas', telefono: '56900000001' },
    { id: 'L002', nombre: 'Álvaro Soto', telefono: null },
    { id: 'L004', nombre: 'Zacarías', telefono: null },
  ]);
  assert.deepEqual(
    lectores.map(({ nombre }) => nombre),
    ['Álvaro Soto', 'ana rojas', 'Ñandú Pérez', 'Zacarías'],
  );
  // «Sin teléfono» se calcula una vez, al preparar.
  assert.deepEqual(
    lectores.map(({ sinTelefono }) => sinTelefono),
    [true, false, true, true],
  );
});

test('los lectores se buscan por nombre sin tildes', () => {
  const lectores = prepararLectores([
    { id: 'L001', nombre: 'María José Pérez' },
    { id: 'L002', nombre: 'Rafaela Toledo' },
  ]);
  const nombres = (consulta) => filtrarLectores(lectores, { consulta }).map(({ id }) => id);
  assert.deepEqual(nombres('maria'), ['L001']);
  assert.deepEqual(nombres('PÉREZ'), ['L001']);
  assert.deepEqual(nombres('toledo'), ['L002']);
  assert.deepEqual(nombres(''), ['L001', 'L002']);
  assert.deepEqual(nombres('pereira'), []);
});

// ----------------------------------------------------------------- tandas

test('se muestran 40 filas y el resto queda detrás de «Mostrar más»', () => {
  assert.equal(FILAS_POR_TANDA, 40);
  const muchos = Array.from({ length: 95 }, (_, i) => libro(`INF${String(i + 1).padStart(3, '0')}`));
  const libros = prepararLibros(muchos, { categorias: CATEGORIAS });

  const primera = porTandas(libros, FILAS_POR_TANDA);
  assert.equal(primera.visibles.length, 40);
  assert.equal(primera.faltan, 55);
  assert.equal(primera.total, 95);
  assert.equal(primera.visibles[0].codigo, 'INF001');

  const segunda = porTandas(libros, FILAS_POR_TANDA * 2);
  assert.equal(segunda.visibles.length, 80);
  assert.equal(segunda.faltan, 15);

  const tercera = porTandas(libros, FILAS_POR_TANDA * 3);
  assert.equal(tercera.visibles.length, 95);
  assert.equal(tercera.faltan, 0);
});

test('una lista corta no muestra «Mostrar más»', () => {
  const { visibles, faltan } = porTandas([libro('INF001')], FILAS_POR_TANDA);
  assert.equal(visibles.length, 1);
  assert.equal(faltan, 0);
});

// ------------------------------------------------------------ código y color

test('C-04 los códigos de una categoría salen del prefijo, para proponer el siguiente', () => {
  const libros = [libro('INF001'), libro('INF027'), libro('HM400'), libro('INFO0281X')];
  assert.deepEqual(codigosDeCategoria(libros, 'INF'), ['INF001', 'INF027', 'INFO0281X']);
  assert.deepEqual(codigosDeCategoria(libros, 'HM'), ['HM400']);
  assert.deepEqual(codigosDeCategoria(libros, 'TEO'), []);
});

test('el color del tejuelo sale del orden de las categorías y no se mueve', () => {
  assert.equal(claseDeTejuelo('Infantil', CATEGORIAS), 'tejuelo tejuelo--1');
  assert.equal(claseDeTejuelo('Hombres y mujeres', CATEGORIAS), 'tejuelo tejuelo--2');
  assert.equal(claseDeTejuelo('Teología', CATEGORIAS), 'tejuelo tejuelo--3');
  // Una categoría que no está configurada no revienta: cae en el neutro.
  assert.equal(claseDeTejuelo('Cocina', CATEGORIAS), 'tejuelo tejuelo--0');
  // Agregar una categoría al final no cambia el color de las de antes.
  const conUnaMas = [...CATEGORIAS, { nombre: 'Novelas', prefijo: 'NV' }];
  assert.equal(claseDeTejuelo('Infantil', conUnaMas), 'tejuelo tejuelo--1');
});

test('el prefijo de un libro sale de su categoría, y si no está, de su código', () => {
  const [conCategoria, sinCategoria] = prepararLibros(
    [libro('INF001'), libro('XYZ002', { categoria: 'Cocina' })],
    { categorias: CATEGORIAS },
  );
  assert.equal(conCategoria.prefijo, 'INF');
  assert.equal(sinCategoria.prefijo, 'XYZ');
});

// --------------------------------------------------- costo de las puras

test('preparar cinco mil libros se mide en decenas de milisegundos, y filtrar en unidades', () => {
  // Esta es la decisión D-4 del plan, medida: normalizar al RECIBIR la
  // colección y no en cada tecla. Si alguien moviera la normalización al
  // filtro, el filtro pasaría de milisegundos a casi un segundo y esta prueba
  // lo diría. Los límites son holgados a propósito: aquí no se mide la máquina,
  // se vigila el orden de magnitud.
  const muchos = Array.from({ length: 5000 }, (_, i) => {
    const categoria = CATEGORIAS[i % CATEGORIAS.length];
    const codigo = `${categoria.prefijo}${String(i + 1).padStart(4, '0')}`;
    return libro(codigo, { titulo: `Título número ${i + 1} de la biblioteca`, categoria: categoria.nombre });
  });

  const antesDePreparar = performance.now();
  const preparados = prepararLibros(muchos, { categorias: CATEGORIAS });
  const preparar = performance.now() - antesDePreparar;

  const antesDeFiltrar = performance.now();
  const encontrados = filtrarLibros(preparados, { consulta: 'numero 4321' });
  const filtrar = performance.now() - antesDeFiltrar;

  assert.equal(preparados.length, 5000);
  assert.equal(encontrados.length, 1);
  assert.ok(preparar < 500, `preparar 5.000 libros tardó ${preparar.toFixed(0)} ms`);
  assert.ok(filtrar < 60, `filtrar 5.000 libros tardó ${filtrar.toFixed(0)} ms`);
});
