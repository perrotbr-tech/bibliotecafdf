// A-08, A-13, A-14, A-16, A-17, A-18, A-19, A-20, A-36 y A-39:
// la forma de guardar vista desde la pantalla Voluntarios.
import { expect, test } from '@playwright/test';

import {
  ADMIN,
  VOLUNTARIA,
  contarVoluntarios,
  leerVoluntario,
  ponerVoluntario,
  sembrarBaseDemo,
} from '../ayuda/siembra.mjs';
import { CLAVE_INTENCION } from '../../docs/js/datos.js';

async function abrirVoluntarios(page, direccion = '/') {
  await page.goto(direccion);
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('formulario-voluntario')).toBeVisible();
}

async function llenarFormulario(page, { correo, nombre, rol = 'voluntario' }) {
  await page.getByTestId('nuevo-correo').fill(correo);
  await page.getByTestId('nuevo-nombre').fill(nombre);
  await page.getByTestId('nuevo-rol').selectOption(rol);
}

test.beforeEach(async () => {
  await sembrarBaseDemo();
});

test('A-08 el administrador agrega un voluntario y lo ve en la lista', async ({ page }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: 'nueva@example.com', nombre: 'Nueva Voluntaria' });
  await page.getByTestId('agregar-voluntario').click();

  await expect(page.getByText('Nueva Voluntaria quedó agregado')).toBeVisible();
  await expect(page.getByTestId('lista-voluntarios')).toContainText('nueva@example.com');

  const guardado = await leerVoluntario('nueva@example.com');
  expect(guardado.rol).toBe('voluntario');
  expect(guardado.activo).toBe(true);
  expect(guardado.creadoPor).toBe(ADMIN);
  expect(guardado.creacionId).toMatch(/^[0-9a-f]{32}$/);

  // El formulario se limpia solo después de la confirmación.
  await expect(page.getByTestId('nuevo-correo')).toHaveValue('');
});

test('A-13 un correo con mayúsculas y espacios se guarda normalizado', async ({ page }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: ' Ana.Rojas@Example.com ', nombre: 'Ana Rojas' });
  await page.getByTestId('agregar-voluntario').click();

  await expect(page.getByText('Ana Rojas quedó agregado')).toBeVisible();
  expect(await leerVoluntario('ana.rojas@example.com')).not.toBeNull();
  expect(await leerVoluntario(' Ana.Rojas@Example.com ')).toBeNull();
});

test('A-14 agregar un correo que ya está en la lista avisa y no cambia el existente', async ({ page }) => {
  await abrirVoluntarios(page);
  const antes = await leerVoluntario(VOLUNTARIA);

  await llenarFormulario(page, { correo: VOLUNTARIA, nombre: 'Otra Ana' });
  await page.getByTestId('agregar-voluntario').click();

  await expect(page.getByTestId('error-formulario')).toHaveText('Ese correo ya está en la lista');
  const despues = await leerVoluntario(VOLUNTARIA);
  expect(despues.nombre).toBe(antes.nombre);
  expect(despues.creacionId).toBe(antes.creacionId);
  // Lo escrito se conserva.
  await expect(page.getByTestId('nuevo-nombre')).toHaveValue('Otra Ana');
});

test('A-16 un doble toque en «Agregar voluntario» crea un solo documento', async ({ page }) => {
  await abrirVoluntarios(page);
  const antes = await contarVoluntarios();
  await llenarFormulario(page, { correo: 'doble@example.com', nombre: 'Doble Toque' });

  const boton = page.getByTestId('agregar-voluntario');
  // Dos toques seguidos, sin esperar al primero.
  await Promise.all([boton.click(), boton.click({ force: true })]);

  await expect(page.getByText('Doble Toque quedó agregado')).toBeVisible();
  expect(await contarVoluntarios()).toBe(antes + 1);
});

test('A-17 sin conexión los botones de escritura quedan deshabilitados y se avisa', async ({ page, context }) => {
  await abrirVoluntarios(page);
  await context.setOffline(true);
  // La app reacciona al evento del navegador.
  await page.evaluate(() => globalThis.dispatchEvent(new Event('offline')));

  await expect(page.getByTestId('agregar-voluntario')).toBeDisabled();
  await expect(page.getByText('Sin conexión: no se puede guardar')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('agregar-voluntario')).toBeEnabled();
});

test('A-18 si la red se corta entre el toque y la respuesta, no hay confirmación y el formulario se conserva', async ({
  page,
}) => {
  await abrirVoluntarios(page);

  // La escritura sale, pero la respuesta nunca llega: se demora y después
  // falla. Así aparece «Confirmando… no cierres la app».
  await page.route('**/*Firestore/Commit*', async (ruta) => {
    await new Promise((listo) => setTimeout(listo, 6000));
    await ruta.abort('connectionfailed');
  });

  await llenarFormulario(page, { correo: 'cortada@example.com', nombre: 'Red Cortada' });
  await page.getByTestId('agregar-voluntario').click();

  await expect(page.getByTestId('agregar-voluntario')).toBeDisabled();
  await expect(page.getByText('Confirmando… no cierres la app')).toBeVisible({ timeout: 15_000 });

  // Cuando la transacción termina mal, no se afirma que se guardó.
  await expect(page.getByTestId('error-formulario')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/quedó agregado/)).toHaveCount(0);
  await expect(page.getByTestId('nuevo-nombre')).toHaveValue('Red Cortada');
  await expect(page.getByTestId('nuevo-correo')).toHaveValue('cortada@example.com');
});

test('A-39 si la comprobación tampoco se puede hacer, no se afirma que no se guardó', async ({ page, context }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: 'dudosa@example.com', nombre: 'Dudosa' });

  await page.route('**/*Firestore/*', (ruta) => ruta.abort('connectionfailed'));
  await page.getByTestId('agregar-voluntario').click();

  const mensaje = page.getByTestId('error-formulario');
  await expect(mensaje).toBeVisible({ timeout: 30_000 });
  await expect(mensaje).toContainText('Revisa su estado antes de repetir');
  await expect(page.getByText('No se guardó. Inténtalo de nuevo')).toHaveCount(0);
  await context.setOffline(false);
});

test('A-19 si la escritura sí se había aplicado, al volver se reconoce y no se duplica', async ({ page }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: 'aplicada@example.com', nombre: 'Sí Quedó' });

  // Se corta todo lo que habla con Firestore: la app no puede confirmar.
  await page.route('**/*Firestore/*', (ruta) => ruta.abort('connectionfailed'));
  await page.getByTestId('agregar-voluntario').click();
  await expect(page.getByTestId('error-formulario')).toBeVisible({ timeout: 30_000 });

  // La intención quedó anotada: solo identificadores, nada personal.
  const intencion = JSON.parse(
    await page.evaluate((clave) => globalThis.sessionStorage.getItem(clave), CLAVE_INTENCION),
  );
  expect(Object.keys(intencion).sort()).toEqual(['identificadores', 'operacionId', 'ruta', 'tipo']);

  // En el servidor la escritura SÍ se había aplicado, con ese mismo creacionId.
  await ponerVoluntario({
    correo: 'aplicada@example.com',
    nombre: 'Sí Quedó',
    creacionId: intencion.operacionId,
  });

  await page.unroute('**/*Firestore/*');
  await page.reload();
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), ADMIN);

  await expect(page.getByText('Sí quedó guardado')).toBeVisible({ timeout: 20_000 });
  expect(await contarVoluntarios()).toBe(3); // admin, Ana y la nueva: sin duplicado
});

test('A-20 si la escritura no se aplicó, al volver se dice que no se guardó', async ({ page }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: 'perdida@example.com', nombre: 'No Quedó' });

  await page.route('**/*Firestore/*', (ruta) => ruta.abort('connectionfailed'));
  await page.getByTestId('agregar-voluntario').click();
  await expect(page.getByTestId('error-formulario')).toBeVisible({ timeout: 30_000 });

  await page.unroute('**/*Firestore/*');
  await page.reload();
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), ADMIN);

  await expect(page.getByText('No se guardó. Inténtalo de nuevo')).toBeVisible({ timeout: 20_000 });
  expect(await leerVoluntario('perdida@example.com')).toBeNull();
});

test('A-36 si el documento lo creó otra operación, no se presenta como éxito propio', async ({ page }) => {
  await abrirVoluntarios(page);
  await llenarFormulario(page, { correo: 'ajena@example.com', nombre: 'De Otro' });

  await page.route('**/*Firestore/*', (ruta) => ruta.abort('connectionfailed'));
  await page.getByTestId('agregar-voluntario').click();
  await expect(page.getByTestId('error-formulario')).toBeVisible({ timeout: 30_000 });

  // Otra persona, en otro teléfono, creó ese mismo correo.
  await ponerVoluntario({ correo: 'ajena@example.com', nombre: 'De Otro', creacionId: 'c'.repeat(32) });

  await page.unroute('**/*Firestore/*');
  await page.reload();
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), ADMIN);

  await expect(page.getByText(/creado por otra operación/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Sí quedó guardado')).toHaveCount(0);
});

test('A-10 el administrador no puede desactivarse a sí mismo desde la lista', async ({ page }) => {
  await abrirVoluntarios(page);
  await expect(page.getByTestId(`cambiar-estado-${ADMIN}`)).toBeDisabled();
  await expect(page.getByTestId(`cambiar-estado-${VOLUNTARIA}`)).toBeEnabled();
});

test('un administrador desactiva y reactiva a otra persona', async ({ page }) => {
  await abrirVoluntarios(page);

  await page.getByTestId(`cambiar-estado-${VOLUNTARIA}`).click();
  await expect(page.getByText('Voluntario desactivado')).toBeVisible();
  expect((await leerVoluntario(VOLUNTARIA)).activo).toBe(false);

  await page.getByTestId(`cambiar-estado-${VOLUNTARIA}`).click();
  await expect(page.getByText('Voluntario reactivado')).toBeVisible();
  expect((await leerVoluntario(VOLUNTARIA)).activo).toBe(true);
});

test('una voluntaria sin rol de administrador no ve la pantalla Voluntarios', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), VOLUNTARIA);
  await page.getByRole('button', { name: 'Más' }).click();

  await expect(page.getByTestId('mas')).toBeVisible();
  await expect(page.getByTestId('abrir-voluntarios')).toHaveCount(0);
});
