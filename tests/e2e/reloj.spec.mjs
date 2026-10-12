// A-22, A-23, A-24 y A-33 en la pantalla: la hora verificada vista por quien
// usa la app.
import { expect, test } from '@playwright/test';

import { VOLUNTARIA, sembrarBaseDemo } from '../ayuda/siembra.mjs';

async function abrirYEntrar(page, direccion = '/') {
  await page.goto(direccion);
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 20_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), VOLUNTARIA);
  await expect(page.locator('#barra-inferior')).toBeVisible();
}

test.beforeEach(async () => {
  await sembrarBaseDemo();
});

test('A-22 con el reloj del teléfono adelantado tres días, la barra muestra la fecha real', async ({ page }) => {
  // Se adelanta el reloj del navegador antes de cargar la app.
  await page.addInitScript(() => {
    const TresDias = 3 * 24 * 60 * 60 * 1000;
    const RelojReal = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RelojReal {
      constructor(...argumentos) {
        super(...(argumentos.length === 0 ? [RelojReal.now() + TresDias] : argumentos));
      }
      static now() {
        return RelojReal.now() + TresDias;
      }
    };
  });

  await abrirYEntrar(page);

  const estado = await page.evaluate(() => globalThis.__biblioteca.reloj());
  expect(estado.hayHora).toBe(true);
  // La hora de la app viene del servidor, no del teléfono: el error es chico.
  const diferencia = Math.abs(new Date(estado.ahora).getTime() - Date.now());
  expect(diferencia).toBeLessThan(5000);
  expect(estado.incertidumbreMs).toBeLessThan(4000);

  // Y se avisa una sola vez del desfase.
  await expect(page.getByText('La hora de tu teléfono está corrida. La app usa la hora del servidor.')).toHaveCount(1);
  await expect(page.locator('#fecha-hoy')).not.toHaveText('Hora pendiente');
});

test('A-23 sin hora del servidor la barra dice «Hora pendiente» y se puede seguir consultando', async ({ page }) => {
  await abrirYEntrar(page);

  await page.evaluate(() => globalThis.__biblioteca.invalidarReloj('prueba A-23'));

  await expect(page.locator('#fecha-hoy')).toHaveText('Hora pendiente');
  const estado = await page.evaluate(() => globalThis.__biblioteca.reloj());
  expect(estado.hayHora).toBe(false);
  expect(estado.ahora).toBeNull();

  // La navegación y la consulta siguen funcionando sin hora.
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByTestId('catalogo')).toBeVisible();
});

test('A-33 la muestra se puede volver a pedir siempre que haya conexión', async ({ page }) => {
  await abrirYEntrar(page);
  await page.evaluate(() => globalThis.__biblioteca.invalidarReloj('volvió de suspensión'));
  await expect(page.locator('#fecha-hoy')).toHaveText('Hora pendiente');

  await page.evaluate(() => globalThis.__biblioteca.sincronizarReloj());
  await expect(page.locator('#fecha-hoy')).not.toHaveText('Hora pendiente');
});

test('A-24 contra el emulador, ?ahora= mueve la fecha de la barra', async ({ page }) => {
  await abrirYEntrar(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await expect(page.locator('#fecha-hoy')).toHaveText('sábado 10 de octubre de 2026');
});

test('A-24 un valor que no se entiende se ignora y se usa la hora del servidor', async ({ page }) => {
  await abrirYEntrar(page, '/?ahora=el%20s%C3%A1bado');
  await expect(page.locator('#fecha-hoy')).not.toHaveText('sábado 10 de octubre de 2026');
  const estado = await page.evaluate(() => globalThis.__biblioteca.reloj());
  expect(estado.hayHora).toBe(true);
});

test('las lecturas de una apertura de sesión se cuentan y son pocas', async ({ page }) => {
  await abrirYEntrar(page);
  const contadores = await page.evaluate(() => globalThis.__biblioteca.contadores());

  // El límite de la Etapa 1: menos de 10 documentos del servidor mientras no
  // haya otros datos. El detalle queda en el informe.
  expect(contadores.documentosDelServidor).toBeLessThan(10);
  expect(contadores).toHaveProperty('eventosDeCache');
  expect(contadores).toHaveProperty('lecturasDeTransaccion');
  expect(contadores).toHaveProperty('reintentosDeTransaccion');
});
