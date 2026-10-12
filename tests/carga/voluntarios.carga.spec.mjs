// Prueba de carga de la Etapa 1.
//
// Dos límites del documento:
//   - Lista de 200 voluntarios: la pantalla abre en menos de 1 segundo con el
//     procesador reducido a un cuarto.
//   - Lecturas de una apertura de sesión, medidas con el contador de datos.js:
//     menos de 10 mientras no haya otros datos.
//
// Los números medidos se imprimen para copiarlos al informe. Son medidas en
// emulador: no son una garantía de rendimiento en producción (base §3).
import { expect, test } from '@playwright/test';

import { ADMIN, VOLUNTARIA, sembrarBaseDemo } from '../ayuda/siembra.mjs';

const CUANTOS = 200;

function gentePrueba(cuantos) {
  return Array.from({ length: cuantos }, (_, i) => ({
    correo: `voluntario${String(i).padStart(3, '0')}@example.com`,
    nombre: `Voluntaria ${String(i).padStart(3, '0')}`,
    rol: i % 25 === 0 ? 'admin' : 'voluntario',
    activo: i % 7 !== 0,
  }));
}

test('carga: la lista de 200 voluntarios abre en menos de 1 s con el procesador a un cuarto', async ({
  page,
  context,
}) => {
  await sembrarBaseDemo({ voluntarios: gentePrueba(CUANTOS) });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto('/');
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 30_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await expect(page.getByTestId('mas')).toBeVisible();

  const partida = Date.now();
  await page.getByTestId('abrir-voluntarios').click();
  await expect(page.getByTestId('lista-voluntarios').locator('li')).toHaveCount(CUANTOS + 2, { timeout: 30_000 });
  const transcurrido = Date.now() - partida;

  const contadores = await page.evaluate(() => globalThis.__biblioteca.contadores());
  process.stdout.write(
    `\n[carga] lista de ${CUANTOS + 2} voluntarios abierta en ${transcurrido} ms con el procesador a 1/4\n` +
      `[carga] contadores: ${JSON.stringify(contadores)}\n`,
  );

  expect(transcurrido).toBeLessThan(1000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test('carga: una apertura de sesión hace menos de 10 lecturas de documento', async ({ page }) => {
  await sembrarBaseDemo();

  await page.goto('/');
  await page.waitForFunction(() => globalThis.__biblioteca !== undefined, { timeout: 30_000 });
  await page.evaluate((correo) => globalThis.__biblioteca.entrarSimulado(correo), VOLUNTARIA);
  await expect(page.locator('#barra-inferior')).toBeVisible();
  await expect(page.locator('#fecha-hoy')).not.toHaveText('Hora pendiente', { timeout: 20_000 });

  const contadores = await page.evaluate(() => globalThis.__biblioteca.contadores());
  process.stdout.write(`\n[carga] apertura de sesión: ${JSON.stringify(contadores)}\n`);

  // Telemetría del cliente, no facturación (contrato §8).
  expect(contadores.documentosDelServidor).toBeLessThan(10);
  expect(contadores.documentosModificadosPorEscucha).toBeLessThan(10);
});
