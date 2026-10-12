// Lectores en la pantalla: C-09 a C-18, C-22, C-23, C-24 y C-37.
import { expect, test } from '@playwright/test';

import {
  ADMIN,
  VOLUNTARIA,
  leerClave,
  leerContadores,
  leerLector,
  listarLectores,
  ponerLector,
  sembrarBaseDemo,
} from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

async function abrirLectores(page, correo = VOLUNTARIA) {
  await abrir(page, '/');
  await entrar(page, correo);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-lectores').click();
  await expect(page.getByTestId('lectores')).toBeVisible();
}

async function inscribir(page, { nombre, telefono = '', marcar = true }) {
  await page.getByTestId('inscribir-lector').click();
  await expect(page.getByTestId('formulario-lector')).toBeVisible();
  await page.getByTestId('lector-nombre').fill(nombre);
  if (telefono !== '') await page.getByTestId('lector-telefono').fill(telefono);
  if (marcar) await page.getByTestId('lector-aviso').check();
  await page.getByTestId('guardar-lector').click();
}

test.beforeEach(async () => {
  await sembrarBaseDemo();
});

test('la lista de lectores está en orden alfabético y marca quién no tiene teléfono', async ({ page }) => {
  await sembrarBaseDemo({
    lectores: [
      { id: 'L001', nombre: 'Rafaela Toledo', telefono: '56900000012' },
      { id: 'L002', nombre: 'Ana Rojas' },
      { id: 'L003', nombre: 'Ñandú Pérez' },
    ],
  });
  await abrirLectores(page);
  await expect(page.getByTestId('lector-L001')).toBeVisible();

  const nombres = await page.getByTestId('lista-lectores').locator('.lista__nombre').allTextContents();
  expect(nombres).toEqual(['Ana Rojas', 'Ñandú Pérez', 'Rafaela Toledo']);
  await expect(page.getByTestId('resumen-lectores')).toHaveText('3 lectores');

  // Sin teléfono se marca; con teléfono, no.
  await expect(page.getByTestId('lector-L002').getByText('Sin teléfono')).toBeVisible();
  await expect(page.getByTestId('lector-L001').getByText('Sin teléfono')).toHaveCount(0);
});

test('buscar un lector sin tildes encuentra al que las tiene', async ({ page }) => {
  await sembrarBaseDemo({
    lectores: [
      { id: 'L001', nombre: 'María José Pérez' },
      { id: 'L002', nombre: 'Rafaela Toledo' },
    ],
  });
  await abrirLectores(page);

  await page.getByTestId('buscar-lector').fill('maria jose');
  await expect(page.getByTestId('lector-L001')).toBeVisible();
  await expect(page.getByTestId('lector-L002')).toBeHidden();

  await page.getByTestId('buscar-lector').fill('zzz');
  await expect(page.getByText('No se encontró ningún lector')).toBeVisible();
});

test('C-12 y C-17 un nombre de una sola palabra, sin teléfono, se inscribe', async ({ page }) => {
  await abrirLectores(page);
  await inscribir(page, { nombre: 'Pepita' });

  await expect(page.getByText('Pepita quedó inscrito como L001')).toBeVisible();
  const lector = await leerLector('L001');
  expect(lector.nombre).toBe('Pepita');
  expect(lector.clave).toBe('pepita');
  expect(lector.telefono).toBeNull();
  expect(lector.esDestinoFusion).toBe(false);
  expect(lector.fusionadoEn).toBeNull();
  expect(lector.avisoDatos.por).toBe(VOLUNTARIA);
  expect(lector.avisoDatos.fecha).not.toBeNull();

  // El documento de clave y el contador quedaron enlazados.
  expect((await leerClave('pepita')).lector).toBe('L001');
  const contadores = await leerContadores();
  expect(contadores.ultimoLector).toBe(1);
  expect(contadores.ultimoLectorId).toBe('L001');
});

test('C-15 las tres formas de escribir un celular se guardan igual', async ({ page }) => {
  for (const [vez, escrito] of ['900000012', '+56 9 0000 0012', '56900000012'].entries()) {
    await sembrarBaseDemo();
    await abrirLectores(page);
    await inscribir(page, { nombre: `Lector ${vez + 1}`, telefono: escrito });
    await expect(page.getByText('quedó inscrito')).toBeVisible();
    expect((await leerLector('L001')).telefono, escrito).toBe('56900000012');
  }
});

test('C-16 un teléfono que no es chileno da error visible y no se guarda', async ({ page }) => {
  await abrirLectores(page);
  await page.getByTestId('inscribir-lector').click();
  await page.getByTestId('lector-nombre').fill('Rafaela Toledo');
  await page.getByTestId('lector-aviso').check();

  for (const malo of ['12345', '800000012', 'no tiene', '5690000001234']) {
    await page.getByTestId('lector-telefono').fill(malo);
    await page.getByTestId('guardar-lector').click();
    await expect(page.getByTestId('nuevo-telefono-error').or(page.getByTestId('lector-telefono-error'))).toBeVisible();
    expect(await leerLector('L001'), malo).toBeNull();
  }
});

test('C-11 un nombre sin tres letras se rechaza con «Escribe al menos 3 letras»', async ({ page }) => {
  await abrirLectores(page);
  await page.getByTestId('inscribir-lector').click();
  await page.getByTestId('lector-aviso').check();

  for (const malo of ['...', 'a b', '   ', '12 34']) {
    await page.getByTestId('lector-nombre').fill(malo);
    await page.getByTestId('guardar-lector').click();
    await expect(page.getByTestId('lector-nombre-error')).toHaveText('Escribe al menos 3 letras');
    expect(await leerLector('L001'), malo).toBeNull();
  }
});

test('C-13 un nombre de 60 caracteres se acepta', async ({ page }) => {
  await abrirLectores(page);
  await inscribir(page, { nombre: 'x'.repeat(60) });
  await expect(page.getByText('quedó inscrito')).toBeVisible();
  expect((await leerLector('L001')).nombre).toBe('x'.repeat(60));
});

test('C-13 un nombre de 61 caracteres se rechaza', async ({ page }) => {
  // El campo no deja escribir más de 60, así que el intento se hace por la
  // misma operación que usa el formulario, para probar la validación y no el
  // atributo del navegador.
  await abrirLectores(page);
  const resultado = await page.evaluate(
    (nombre) => globalThis.__biblioteca.inscribirLector({ nombre }),
    'x'.repeat(61),
  );
  expect(resultado.esExito).toBe(false);
  expect(resultado.mensaje).toBe('Escribe al menos 3 letras');
  expect(await leerLector('L001')).toBeNull();
});

test('C-18 sin marcar la casilla del aviso no se puede guardar', async ({ page }) => {
  await abrirLectores(page);
  await inscribir(page, { nombre: 'Rafaela Toledo', marcar: false });

  await expect(page.getByTestId('lector-aviso-error')).toHaveText('Marca la casilla: el lector tiene que saberlo');
  expect(await leerLector('L001')).toBeNull();
  // Marcándola, sí.
  await page.getByTestId('lector-aviso').check();
  await page.getByTestId('guardar-lector').click();
  await expect(page.getByText('quedó inscrito')).toBeVisible();
});

test('C-09 y C-10 un nombre repetido se rechaza, aunque se escriba distinto', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo' }] });
  await abrirLectores(page);

  for (const disfraz of ['  rafaela   TOLEDO ', 'Rafa​ela Toledo', 'Rafaela Tolédo']) {
    await inscribir(page, { nombre: disfraz });
    await expect(page.getByTestId('error-lector')).toHaveText('Ya existe: Rafaela Toledo. Búscalo en la lista');
    await page.getByTestId('hoja-inscribir-cerrar').click();
  }
  expect((await listarLectores()).length).toBe(1);
});

test('C-10 una ı turca tampoco cuela un nombre repetido', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Martín Lagos' }] });
  await abrirLectores(page);
  await inscribir(page, { nombre: 'Martın Lagos' });
  await expect(page.getByTestId('error-lector')).toContainText('Ya existe: Martín Lagos');
  expect((await listarLectores()).length).toBe(1);
});

test('C-14 «Peña» se acepta aunque exista «Pena»: son claves distintas', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Pena Rojas' }] });
  await abrirLectores(page);
  await inscribir(page, { nombre: 'Peña Rojas' });

  await expect(page.getByText('quedó inscrito como L002')).toBeVisible();
  expect((await leerLector('L002')).clave).toBe('peña rojas');
  expect((await leerClave('peña rojas')).lector).toBe('L002');
  expect((await leerClave('pena rojas')).lector).toBe('L001');
});

test('C-22 un doble toque en «Inscribir» crea un solo lector', async ({ page }) => {
  await abrirLectores(page);
  await page.getByTestId('inscribir-lector').click();
  await page.getByTestId('lector-nombre').fill('Rafaela Toledo');
  await page.getByTestId('lector-aviso').check();
  await page.getByTestId('guardar-lector').dblclick();

  await expect(page.getByText('quedó inscrito')).toBeVisible();
  expect((await listarLectores()).length).toBe(1);
  expect((await leerContadores()).ultimoLector).toBe(1);
});

test('C-23 una voluntaria cambia el teléfono y no ve «Cambiar nombre»', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo' }] });
  await abrirLectores(page, VOLUNTARIA);
  await page.getByTestId('lector-L001').click();

  await expect(page.getByTestId('telefono-lector')).toHaveText('Sin teléfono');
  await expect(page.getByTestId('cambiar-nombre')).toHaveCount(0);

  await page.getByTestId('cambiar-telefono').click();
  await page.getByTestId('nuevo-telefono').fill('9 0000 0012');
  await page.getByTestId('guardar-telefono').click();

  await expect(page.getByText('Teléfono guardado')).toBeVisible();
  const lector = await leerLector('L001');
  expect(lector.telefono).toBe('56900000012');
  expect(lector.nombre).toBe('Rafaela Toledo');
});

test('un teléfono se puede quitar dejando el campo vacío', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo', telefono: '56900000012' }] });
  await abrirLectores(page);
  await page.getByTestId('lector-L001').click();
  await expect(page.getByTestId('telefono-lector')).toHaveText('+56 9 0000 0012');

  await page.getByTestId('cambiar-telefono').click();
  await page.getByTestId('nuevo-telefono').fill('');
  await page.getByTestId('guardar-telefono').click();

  await expect(page.getByText('Teléfono guardado')).toBeVisible();
  expect((await leerLector('L001')).telefono).toBeNull();
});

test('C-24 el administrador cambia el nombre; la clave antigua queda reservada', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo' }] });
  await abrirLectores(page, ADMIN);
  await page.getByTestId('lector-L001').click();
  await page.getByTestId('cambiar-nombre').click();
  await page.getByTestId('nuevo-nombre-lector').fill('Rafaela Toledo Soto');
  await page.getByTestId('guardar-nombre').click();

  await expect(page.getByText('Nombre guardado')).toBeVisible();
  const lector = await leerLector('L001');
  expect(lector.nombre).toBe('Rafaela Toledo Soto');
  expect(lector.clave).toBe('rafaela toledo soto');
  // La clave nueva se creó y la antigua sigue apuntando al mismo lector.
  expect((await leerClave('rafaela toledo soto')).lector).toBe('L001');
  expect((await leerClave('rafaela toledo')).lector).toBe('L001');

  // Inscribir el nombre antiguo responde con el nombre NUEVO del lector.
  await inscribir(page, { nombre: 'Rafaela Toledo' });
  await expect(page.getByTestId('error-lector')).toHaveText(
    'Ya existe: Rafaela Toledo Soto. Búscalo en la lista',
  );
});

test('C-37 corregir una tilde y volver atrás no crea ni rompe ningún documento de clave', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Maria Lagos' }] });
  await abrirLectores(page, ADMIN);

  for (const nombre of ['María Lagos', 'Maria Lagos']) {
    await page.getByTestId('lector-L001').click();
    await page.getByTestId('cambiar-nombre').click();
    await page.getByTestId('nuevo-nombre-lector').fill(nombre);
    await page.getByTestId('guardar-nombre').click();
    // Se espera por el dato guardado y no por el aviso: el aviso del cambio
    // anterior todavía puede estar en pantalla y daría un falso verde.
    await expect.poll(async () => (await leerLector('L001')).nombre).toBe(nombre);
    // La clave no cambia al corregir una tilde o una mayúscula.
    expect((await leerLector('L001')).clave).toBe('maria lagos');
  }
  expect((await leerClave('maria lagos')).lector).toBe('L001');
});

test('C-43 un administrador no puede redirigir una clave a otro lector', async ({ page }) => {
  // Desde la app no hay ninguna pantalla que lo ofrezca; esto comprueba que
  // tampoco se puede por el camino que sí existe, cambiar el nombre hacia una
  // clave ajena. Las reglas lo deniegan además (tests/reglas/lectores).
  await sembrarBaseDemo({
    lectores: [
      { id: 'L001', nombre: 'Rafaela Toledo' },
      { id: 'L002', nombre: 'María José Pérez' },
    ],
  });
  await abrirLectores(page, ADMIN);
  await page.getByTestId('lector-L001').click();
  await page.getByTestId('cambiar-nombre').click();
  await page.getByTestId('nuevo-nombre-lector').fill('María José Pérez');
  await page.getByTestId('guardar-nombre').click();

  await expect(page.getByTestId('error-nombre')).toHaveText('Ya existe: María José Pérez. Búscalo en la lista');
  expect((await leerLector('L001')).nombre).toBe('Rafaela Toledo');
  expect((await leerClave('maria jose perez')).lector).toBe('L002');
});

test('la ficha del lector se cierra con Atrás y no se sale de Lectores', async ({ page }) => {
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo' }] });
  await abrirLectores(page);
  await page.getByTestId('lector-L001').click();
  await expect(page.getByTestId('hoja-lector')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('hoja-lector')).toBeHidden();
  await expect(page.getByTestId('lectores')).toBeVisible();
});

test('abrir una hoja desde otra la REEMPLAZA, y un Atrás vuelve a la lista', async ({ page }) => {
  // El nombre importa: la hoja no se apila, se reemplaza, y por eso un solo
  // Atrás devuelve a la lista y no a la ficha. Es una decisión, no un
  // descuido, y la contraprueba de la Etapa 2 hizo notar que el nombre
  // anterior —«se cierra de a una»— describía mal lo que pasa.
  await sembrarBaseDemo({ lectores: [{ id: 'L001', nombre: 'Rafaela Toledo' }] });
  await abrirLectores(page);
  await page.getByTestId('lector-L001').click();
  await page.getByTestId('cambiar-telefono').click();
  await expect(page.getByTestId('hoja-telefono')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('hoja-telefono')).toBeHidden();
  await expect(page.getByTestId('lectores')).toBeVisible();
});
