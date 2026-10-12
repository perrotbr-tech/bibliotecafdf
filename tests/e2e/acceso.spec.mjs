// A-02, A-03, A-25, A-26, A-27, A-30, A-35 y A-37: entrada, cáscara y acceso.
//
// Se entra con `signInWithCredential` y una credencial de Google simulada del
// emulador de Authentication. Ese camino solo existe cuando la app corre
// contra el emulador.
import { expect, test } from '@playwright/test';

import { ADMIN, AJENA, VOLUNTARIA, cambiarActivo, sembrarBaseDemo } from '../ayuda/siembra.mjs';

/** Abre la app y espera a que el módulo principal quede listo. */
async function abrir(page, direccion = '/') {
  await page.goto(direccion);
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
}

async function entrar(page, correo, opciones = {}) {
  await page.evaluate(
    ([c, o]) => globalThis.__biblioteca.entrarSimulado(c, o),
    [correo, opciones],
  );
}

test.beforeEach(async () => {
  await sembrarBaseDemo();
});

test('la pantalla de entrada no lee la base', async ({ page }) => {
  const pedidos = [];
  page.on('request', (peticion) => pedidos.push(peticion.url()));
  await abrir(page);

  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  await expect(page.getByText('Solo entran los voluntarios autorizados')).toBeVisible();
  expect(pedidos.filter((url) => url.includes(':8080')), 'no se habla con Firestore antes de entrar').toHaveLength(0);
});

test('A-02 una cuenta que no está en la lista ve «Tu cuenta no tiene acceso»', async ({ page }) => {
  await abrir(page);
  await entrar(page, AJENA);

  await expect(page.getByTestId('sin-acceso')).toBeVisible();
  await expect(page.getByText('Tu cuenta no tiene acceso')).toBeVisible();
  await expect(page.getByText(AJENA)).toBeVisible();
  await expect(page.getByTestId('usar-otra-cuenta')).toBeVisible();
  // Y no se ve nada de la app.
  await expect(page.locator('#barra-inferior')).toBeHidden();
});

test('A-03 una cuenta inactiva ve «Sin acceso»', async ({ page }) => {
  await sembrarBaseDemo({ voluntarios: [{ correo: 'luis@example.com', nombre: 'Luis', activo: false }] });
  await abrir(page);
  await entrar(page, 'luis@example.com');

  await expect(page.getByTestId('sin-acceso')).toBeVisible();
});

test('A-04 un correo sin verificar no entra', async ({ page }) => {
  // Con un correo propio de esta prueba: el emulador de Auth guarda la cuenta
  // tal como se creó, y dejar a Ana sin verificar ensuciaría a las demás.
  const sinVerificar = 'sinverificar@example.com';
  await sembrarBaseDemo({ voluntarios: [{ correo: sinVerificar, nombre: 'Sin Verificar' }] });

  await abrir(page);
  await entrar(page, sinVerificar, { verificado: false });

  await expect(page.getByTestId('sin-acceso')).toBeVisible();
});

test('una cuenta autorizada ve la cáscara con sus cinco destinos', async ({ page }) => {
  await abrir(page);
  await entrar(page, VOLUNTARIA);

  await expect(page.locator('#barra-inferior')).toBeVisible();
  for (const nombre of ['Inicio', 'Prestar', 'Préstamos', 'Catálogo', 'Más']) {
    await expect(page.getByRole('button', { name: nombre })).toBeVisible();
  }
  await expect(page.getByTestId('inicio')).toBeVisible();
  await expect(page.getByText('Disponible pronto')).toBeVisible();
});

test('A-25 el botón Atrás desde Voluntarios vuelve a Más y no sale de la app', async ({ page }) => {
  await abrir(page);
  await entrar(page, ADMIN);

  await page.getByRole('button', { name: 'Más' }).click();
  await expect(page.getByTestId('mas')).toBeVisible();

  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('voluntarios')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('mas')).toBeVisible();
  await expect(page.locator('#barra-inferior')).toBeVisible();
});

test('A-26 a 320 px, con un nombre de 40 caracteres sin espacios, no hay desplazamiento horizontal', async ({
  page,
}) => {
  const nombreLargo = 'B'.repeat(40);
  await sembrarBaseDemo({ voluntarios: [{ correo: 'larga@example.com', nombre: 'P'.repeat(60) }] });
  await page.setViewportSize({ width: 320, height: 640 });
  await abrir(page);
  await entrar(page, ADMIN);

  await page.evaluate((nombre) => {
    document.getElementById('nombre-biblioteca').textContent = nombre;
  }, nombreLargo);

  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('lista-voluntarios')).toBeVisible();

  const desborde = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cuerpo: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(desborde.documento).toBeLessThanOrEqual(0);
  expect(desborde.cuerpo).toBeLessThanOrEqual(0);
});

test('A-26 todos los controles tocables miden al menos 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await abrir(page);
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('formulario-voluntario')).toBeVisible();

  for (const control of await page.locator('button:visible, input:visible, select:visible').all()) {
    const caja = await control.boundingBox();
    if (!caja) continue;
    expect(Math.round(caja.height), await control.textContent()).toBeGreaterThanOrEqual(44);
  }
});

test('A-27 al abrir la app solo se piden recursos del origen propio, de Google y del emulador', async ({ page }) => {
  const hosts = new Set();
  page.on('request', (peticion) => hosts.add(new URL(peticion.url()).host));

  await abrir(page);
  await entrar(page, VOLUNTARIA);
  await expect(page.locator('#barra-inferior')).toBeVisible();

  const permitidos = (host) =>
    host.startsWith('127.0.0.1') ||
    host.startsWith('localhost') ||
    host === 'www.gstatic.com' ||
    host.endsWith('.googleapis.com') ||
    host === 'apis.google.com' ||
    host === 'accounts.google.com' ||
    host.endsWith('.firebaseapp.com');

  const inesperados = [...hosts].filter((host) => !permitidos(host));
  expect(inesperados, `hosts observados: ${[...hosts].join(', ')}`).toEqual([]);
});

test('A-30 en localhost se usa el emulador y se ve su franja', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('#franja')).toBeVisible();
  await expect(page.locator('#franja')).toContainText('EMULADOR');
  await expect(page.locator('#franja')).toContainText('demo-biblioteca');
});

test('A-30 en loopback el parámetro ensayo=1 se ignora y se dice', async ({ page }) => {
  await abrir(page, '/?ensayo=1');
  // Va en la franja, que no se borra al cambiar de sesión.
  await expect(page.locator('#franja')).toContainText('EMULADOR');
  await expect(page.locator('#franja')).toContainText('se ignoró «ensayo=1»');
});

test('A-15 y A-37 al perder el acceso con la app abierta se pasa a «Sin acceso» sin error sin tratar', async ({
  page,
}) => {
  const fallos = [];
  page.on('pageerror', (error) => fallos.push(String(error)));

  await abrir(page);
  await entrar(page, VOLUNTARIA);
  await expect(page.locator('#barra-inferior')).toBeVisible();

  await cambiarActivo(VOLUNTARIA, false);

  await expect(page.getByTestId('sin-acceso')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#barra-inferior')).toBeHidden();
  expect(fallos, 'no hay errores sin tratar').toEqual([]);
});

test('A-37 cerrar sesión cancela las escuchas y borra los datos de la sesión', async ({ page }) => {
  await abrir(page);
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('lista-voluntarios')).toBeVisible();

  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('cerrar-sesion').click();

  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  // La lista anterior ya no está en la pantalla ni en memoria.
  await expect(page.getByTestId('lista-voluntarios')).toHaveCount(0);
  await expect(page.locator('#nombre-biblioteca')).toHaveText('Biblioteca');
  await expect(page.locator('#fecha-hoy')).toHaveText('Hora pendiente');

  // Y otra cuenta que entra después no recibe datos residuales.
  await entrar(page, AJENA);
  await expect(page.getByTestId('sin-acceso')).toBeVisible();
  await expect(page.getByTestId('lista-voluntarios')).toHaveCount(0);
});
