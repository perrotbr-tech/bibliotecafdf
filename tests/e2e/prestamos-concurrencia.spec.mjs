// P-02: dos clientes prestan el mismo libro; exactamente uno gana.
import { expect, test } from '@playwright/test';

import { VOLUNTARIA, sembrarBaseDemo, sembrarCalendarioSintetico } from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

test.beforeEach(async () => {
  await sembrarBaseDemo({
    libros: [{ codigo: 'INF010', titulo: 'Carrera', autor: 'X' }],
    lectores: [
      { id: 'L001', nombre: 'Ana Rojas', telefono: '56900000012' },
      { id: 'L002', nombre: 'Luis Perez', telefono: '56900000013' },
    ],
  });
  await sembrarCalendarioSintetico('2026-10-10');
});

test('P-02 dos clientes prestan el mismo libro al mismo tiempo', async ({ browser }) => {
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();
  const pageA = await contextoA.newPage();
  const pageB = await contextoB.newPage();

  await abrir(pageA, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(pageA, VOLUNTARIA);
  await abrir(pageB, '/?ahora=2026-10-10T15:00:00-03:00');
  // Segunda cuenta: misma voluntaria basta para la carrera del libro.
  await entrar(pageB, VOLUNTARIA);

  const [rA, rB] = await Promise.all([
    pageA.evaluate(() =>
      globalThis.__biblioteca.prestarLibro({
        libroCodigo: 'INF010',
        lectorId: 'L001',
        plazoSabados: 2,
      }),
    ),
    pageB.evaluate(() =>
      globalThis.__biblioteca.prestarLibro({
        libroCodigo: 'INF010',
        lectorId: 'L002',
        plazoSabados: 2,
      }),
    ),
  ]);

  const exitos = [rA, rB].filter((r) => r.esExito);
  const fallos = [rA, rB].filter((r) => !r.esExito);
  expect(exitos).toHaveLength(1);
  expect(fallos).toHaveLength(1);
  expect(fallos[0].mensaje).toMatch(/prest|conflicto|Inténtalo|permiso/iu);

  await contextoA.close();
  await contextoB.close();
});
