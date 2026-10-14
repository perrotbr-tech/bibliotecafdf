// Préstamos: flujo feliz y Devueltos rotulados (orden por registro).
import { expect, test } from '@playwright/test';

import { ADMIN, VOLUNTARIA, ponerLibro, ponerPrestamo, sembrarBaseDemo, sembrarCalendarioSintetico } from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

test.beforeEach(async () => {
  await sembrarBaseDemo({
    libros: [
      { codigo: 'INF001', titulo: 'Radical', autor: 'David Platt' },
      { codigo: 'INF002', titulo: 'Otro', autor: 'Alguien' },
    ],
    lectores: [
      { id: 'L001', nombre: 'Ana Rojas', telefono: '56900000012' },
      { id: 'L002', nombre: 'Pepita', telefono: null },
    ],
  });
  await sembrarCalendarioSintetico('2026-10-10');
});

test('P-01 prestar un libro disponible desde la app', async ({ page }) => {
  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, VOLUNTARIA);
  await page.getByTestId('ir-prestar').click();
  await page.getByTestId('buscar-libro-prestar').fill('Radical');
  await page.getByTestId('elegir-libro').first().click();
  await page.getByTestId('buscar-lector-prestar').fill('Ana');
  await page.getByTestId('elegir-lector').first().click();
  await page.getByTestId('plazo-2').check();
  await page.getByTestId('confirmar-prestamo').click();
  await expect(page.getByText(/Prestado a Ana/u)).toBeVisible({ timeout: 15_000 });
});

test('P-44 Devueltos muestra rotulado orden por registro', async ({ page }) => {
  await ponerLibro({ codigo: 'INF003', titulo: 'Devuelto', autor: 'X' });
  await ponerPrestamo('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
    numero: 1,
    libro: 'INF003',
    lector: 'L001',
    estado: 'devuelto',
    prestadoEn: new Date('2026-10-10T15:00:00Z'),
    devueltoEn: new Date('2026-10-10T16:00:00Z'),
    devueltoPor: VOLUNTARIA,
  });
  await abrir(page, '/?ahora=2026-10-10T18:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Préstamos' }).click();
  await page.getByTestId('pestana-devueltos').click();
  await expect(page.getByTestId('rotulo-orden')).toHaveText('Orden por registro');
});
