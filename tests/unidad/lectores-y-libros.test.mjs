// Etapa 2, funciones puras: C-03, C-04, C-09 a C-17, C-25 y C-26.
//
// Todo esto es texto: ni base, ni reloj, ni red. Lo que las reglas de seguridad
// NO pueden garantizar —que la clave corresponda al nombre— se garantiza aquí.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FORMATO_CLAVE,
  FORMATO_CODIGO,
  FORMATO_TELEFONO,
  claveDeNombre,
  codigoSugerido,
  coincideBusqueda,
  esCodigoValido,
  esNombreDeLectorValido,
  letrasDeClave,
  normalizarBusqueda,
  normalizarCodigo,
  normalizarTelefono,
  prepararBusquedaDeLector,
  prepararBusquedaDeLibro,
} from '../../docs/js/texto.js';
import { idDeLector } from '../../docs/js/config-publica.js';

// ------------------------------------------------- el identificador del lector

test('el identificador del lector es L más el correlativo, con tres cifras mínimo', () => {
  // La misma fórmula está escrita en las reglas de seguridad. Si discreparan,
  // el enlace del contador no cerraría y el alta se denegaría, así que estas
  // igualdades son el contrato entre el cliente y el servidor.
  assert.equal(idDeLector(1), 'L001');
  assert.equal(idDeLector(99), 'L099');
  assert.equal(idDeLector(100), 'L100');
  assert.equal(idDeLector(999), 'L999');
  assert.equal(idDeLector(1000), 'L1000');
  assert.equal(idDeLector(1204), 'L1204');
});

// --------------------------------------------------------------- la clave

test('C-09 la clave ignora espacios de sobra y mayúsculas', () => {
  assert.equal(claveDeNombre('  María  José PÉREZ '), 'maria jose perez');
  assert.equal(claveDeNombre('  rafaela   TOLEDO '), 'rafaela toledo');
  assert.equal(claveDeNombre('Rafaela Toledo'), 'rafaela toledo');
  // Por eso inscribir el primero cuando existe el segundo se rechaza.
  assert.equal(claveDeNombre('  rafaela   TOLEDO '), claveDeNombre('Rafaela Toledo'));
});

test('C-14 «Peña» y «Pena» son claves distintas: la ñ no se pisa', () => {
  assert.equal(claveDeNombre('Peña'), 'peña');
  assert.equal(claveDeNombre('Pena'), 'pena');
  assert.notEqual(claveDeNombre('Peña'), claveDeNombre('Pena'));
  // Y da igual cómo esté escrita la ñ: compuesta o con tilde combinante.
  assert.equal(claveDeNombre('Peña'), 'peña');
  assert.equal(claveDeNombre('PEÑA'), 'peña');
});

test('C-10 un espacio de ancho cero o una ı no sirven para colar un nombre repetido', () => {
  assert.equal(claveDeNombre('Rafa​ela Toledo'), 'rafaela toledo');
  assert.equal(claveDeNombre('Rafae﻿la Toledo'), 'rafaela toledo');
  // La ı turca se convierte en i antes de comparar.
  assert.equal(claveDeNombre('Rafaela Toledo').replace('i', 'ı'), 'rafaela toledo'.replace('i', 'ı'));
  assert.equal(claveDeNombre('Martın'), 'martin');
  assert.equal(claveDeNombre('Martín'), 'martin');
});

test('la clave bota lo que no es letra de la a a la z, ñ, dígito o espacio', () => {
  // OJO: la especificación dice ELIMINAR lo que no sirve, no reemplazarlo por
  // un espacio. Así que un guion une las dos partes: «Ana-María» y «AnaMaría»
  // comparten clave, y «Ana María» no. Es lo que está escrito, y conviene
  // tenerlo presente porque decide cuándo dos inscripciones se consideran la
  // misma persona.
  assert.equal(claveDeNombre('Ana-María O’Brien'), 'anamaria obrien');
  assert.equal(claveDeNombre('AnaMaría O’Brien'), 'anamaria obrien');
  assert.notEqual(claveDeNombre('Ana María'), claveDeNombre('Ana-María'));
  // Letras de otros alfabetos: fuera.
  assert.equal(claveDeNombre('Анна Ana'), 'ana');
  assert.equal(claveDeNombre('李 Ana'), 'ana');
  assert.equal(claveDeNombre('Ana 3'), 'ana 3');
});

test('toda clave que sale de aquí cumple el formato que exigen las reglas', () => {
  for (const nombre of ['  María  José PÉREZ ', 'Peña', 'Ana-María O’Brien', 'Pepita', 'Ana 3']) {
    assert.match(claveDeNombre(nombre), FORMATO_CLAVE, nombre);
  }
});

// --------------------------------------------------- el nombre del lector

test('C-11 nombres sin tres letras se rechazan', () => {
  for (const malo of ['...', 'a b', '   ', '', '12 34', '-- --']) {
    assert.equal(esNombreDeLectorValido(malo), false, JSON.stringify(malo));
  }
  assert.equal(letrasDeClave(claveDeNombre('a b')), 2);
});

test('C-12 un nombre de una sola palabra se acepta', () => {
  assert.equal(esNombreDeLectorValido('Pepita'), true);
  assert.equal(esNombreDeLectorValido('Ana'), true);
});

test('C-13 60 caracteres se aceptan; 61 no', () => {
  assert.equal(esNombreDeLectorValido('x'.repeat(60)), true);
  assert.equal(esNombreDeLectorValido('x'.repeat(61)), false);
  // Y los espacios de los extremos no cuentan para el largo.
  assert.equal(esNombreDeLectorValido(`  ${'x'.repeat(60)}  `), true);
});

// ------------------------------------------------------------- el teléfono

test('C-15 las tres formas de escribir un celular dan el mismo número', () => {
  for (const entrada of ['900000012', '+56 9 0000 0012', '56900000012', '9 0000 0012', '(+56) 9-0000-0012']) {
    const resultado = normalizarTelefono(entrada);
    assert.equal(resultado.ok, true, entrada);
    assert.equal(resultado.telefono, '56900000012', entrada);
    assert.match(resultado.telefono, FORMATO_TELEFONO);
  }
});

test('C-15 los dígitos de ancho completo se convierten antes de validar', () => {
  const anchoCompleto = '９００００００１２';
  const resultado = normalizarTelefono(anchoCompleto);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.telefono, '56900000012');
});

test('C-16 lo que no es un celular chileno da error visible, no silencio', () => {
  for (const malo of ['12345', '800000012', 'no tiene', '5690000001234', '56800000012', '0000000000']) {
    const resultado = normalizarTelefono(malo);
    assert.equal(resultado.ok, false, malo);
    assert.ok(resultado.motivo.length > 0, malo);
    assert.equal(resultado.telefono, undefined);
  }
});

test('C-17 un teléfono vacío deja el campo en nulo, sin error', () => {
  for (const vacio of ['', '   ', null, undefined]) {
    const resultado = normalizarTelefono(vacio);
    assert.equal(resultado.ok, true, JSON.stringify(vacio));
    assert.equal(resultado.telefono, null);
  }
});

// ---------------------------------------------------------------- el código

test('C-03 un código con espacios y minúsculas se guarda en mayúsculas y junto', () => {
  assert.equal(normalizarCodigo('inf 028'), 'INF028');
  assert.equal(normalizarCodigo('  inf028 '), 'INF028');
  assert.equal(normalizarCodigo('teo 1200a'), 'TEO1200A');
  assert.ok(esCodigoValido('inf 028'));
  assert.match(normalizarCodigo('inf 028'), FORMATO_CODIGO);
});

test('un código con forma inválida se reconoce como tal', () => {
  for (const malo of ['I028', 'INF28', '028', 'INF028AB', 'INFOS0281', '12345']) {
    assert.equal(esCodigoValido(malo), false, malo);
  }
  // Y lo que sí cabe en el formato de base §5: hasta 4 letras, 3 o 4 dígitos y
  // una letra final opcional.
  for (const bueno of ['INF001', 'TEO1200A', 'HM400', 'INFO0281X']) {
    assert.equal(esCodigoValido(bueno), true, bueno);
  }
});

test('C-04 el código sugerido es el mayor de la categoría más uno', () => {
  assert.equal(codigoSugerido('INF', ['INF001', 'INF027', 'HM400']), 'INF028');
  assert.equal(codigoSugerido('INF', ['INF999']), 'INF1000');
  // Con huecos: no se rellenan, se sigue del mayor.
  assert.equal(codigoSugerido('INF', ['INF001', 'INF002', 'INF010']), 'INF011');
  // Categoría sin libros todavía.
  assert.equal(codigoSugerido('TEO', ['INF027']), 'TEO001');
  assert.equal(codigoSugerido('TEO', []), 'TEO001');
  // Un código con letra final no confunde la cuenta.
  assert.equal(codigoSugerido('INF', ['INF027A']), 'INF028');
  // Solo cuenta la categoría pedida.
  assert.equal(codigoSugerido('HM', ['INF999', 'HM004']), 'HM005');
});

// --------------------------------------------------------------- la búsqueda

test('C-25 buscar sin tildes encuentra lo que las tiene', () => {
  const libro = prepararBusquedaDeLibro({ codigo: 'INF006', titulo: 'El Dios pródigo', autor: 'Tim Keller' });
  assert.ok(coincideBusqueda(libro, 'dios prodigo'));
  assert.ok(coincideBusqueda(libro, 'PRÓDIGO'));
  assert.ok(coincideBusqueda(libro, 'keller'));
  assert.ok(!coincideBusqueda(libro, 'calvino'));
});

test('C-25 el código se encuentra con espacios o sin ellos', () => {
  const libro = prepararBusquedaDeLibro({ codigo: 'INF006', titulo: 'El Dios pródigo', autor: 'Tim Keller' });
  assert.ok(coincideBusqueda(libro, 'inf 006'));
  assert.ok(coincideBusqueda(libro, 'INF006'));
  assert.ok(coincideBusqueda(libro, 'inf'));
  assert.ok(!coincideBusqueda(libro, 'inf 007'));
});

test('C-26 una búsqueda con signos raros devuelve vacío, no un error', () => {
  const libro = prepararBusquedaDeLibro({ codigo: 'INF006', titulo: 'El Dios pródigo', autor: 'Tim Keller' });
  for (const rara of ['(.*[\\', '[[[', '\\', '*', '?!', '(((']) {
    // Lo que importa es que no lance: aquí nunca se arma una expresión regular.
    assert.doesNotThrow(() => coincideBusqueda(libro, rara), rara);
    assert.equal(coincideBusqueda(libro, rara), false, rara);
  }
});

test('una búsqueda vacía no filtra nada', () => {
  const libro = prepararBusquedaDeLibro({ codigo: 'INF006', titulo: 'El Dios pródigo', autor: 'Tim Keller' });
  assert.ok(coincideBusqueda(libro, ''));
  assert.ok(coincideBusqueda(libro, '   '));
});

test('los lectores se buscan por nombre, sin tildes', () => {
  const lector = prepararBusquedaDeLector({ nombre: 'María José Pérez' });
  assert.ok(coincideBusqueda(lector, 'maria'));
  assert.ok(coincideBusqueda(lector, 'jose perez'));
  assert.ok(coincideBusqueda(lector, 'PÉREZ'));
  assert.ok(!coincideBusqueda(lector, 'pereira'));
});

test('normalizarBusqueda conserva los signos: no hace falta quitarlos', () => {
  assert.equal(normalizarBusqueda('  El Dios  PRÓDIGO '), 'el dios prodigo');
  assert.equal(normalizarBusqueda('(.*[\\'), '(.*[\\');
});

test('un carácter de control no se convierte en ñ: la marca interna no se cuela', () => {
  // La clave protege la ñ con un carácter de control, así que un nombre que
  // trajera uno terminaba convertido en «ñ» y dos personas distintas
  // colapsaban en una clave. Los controles salen primero.
  const marca = String.fromCharCode(1);
  assert.equal(claveDeNombre(`a${marca}b`), 'ab');
  assert.notEqual(claveDeNombre(`a${marca}b`), claveDeNombre('añb'));
  assert.equal(claveDeNombre(`Ana${marca}`), 'ana');
  assert.equal(claveDeNombre(`Rafaela${marca}Toledo`), 'rafaelatoledo');
  // Y la ñ de verdad sigue intacta.
  assert.equal(claveDeNombre('Peña'), 'peña');
});
