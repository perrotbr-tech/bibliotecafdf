// Concurrencia de préstamos: P-02 y P-03.
//
// Los préstamos se lanzan por `globalThis.__biblioteca.prestarLibro`, la MISMA
// operación que el botón, que solo existe contra el emulador: pasa por la misma
// transacción y las mismas reglas.
import { expect, test } from '@playwright/test';

import {
  VOLUNTARIA,
  leerContadores,
  leerLibro,
  listarPrestamos,
  sembrarBaseDemo,
  sembrarCalendarioSintetico,
} from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

/** Cinco libros distintos para la carrera de P-03. */
const CINCO = ['INF011', 'INF012', 'INF013', 'INF014', 'INF015'];

test.beforeEach(async () => {
  await sembrarBaseDemo({
    libros: [
      { codigo: 'INF010', titulo: 'Carrera', autor: 'X' },
      ...CINCO.map((codigo, i) => ({ codigo, titulo: `Libro ${i + 1}`, autor: 'Autora' })),
    ],
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

test('P-03 cinco clientes prestan cinco libros distintos a la vez', async ({ page }) => {
  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, VOLUNTARIA);
  await expect(page.locator('#barra-inferior')).toBeVisible();

  // Libros distintos: lo que se disputa no es el libro, es el contador.
  const resultados = await page.evaluate(
    (codigos) =>
      Promise.all(
        codigos.map((libroCodigo) =>
          globalThis.__biblioteca.prestarLibro({ libroCodigo, lectorId: 'L001', plazoSabados: 2 }),
        ),
      ),
    CINCO,
  );

  const exitos = resultados.filter((resultado) => resultado.esExito);
  const fallos = resultados.filter((resultado) => !resultado.esExito);
  process.stdout.write(
    `\n[concurrencia] cinco préstamos en paralelo: ${exitos.length} quedaron, ${fallos.length} no\n`,
  );
  expect(exitos.length, 'al menos uno tiene que pasar').toBeGreaterThan(0);

  // Los que terminan llevan números distintos y consecutivos desde 1, sin
  // huecos: el contador no se salta ni se repite.
  const numeros = exitos.map((resultado) => resultado.valor.numero).sort((uno, otro) => uno - otro);
  expect(new Set(numeros).size, 'ningún número repetido').toBe(exitos.length);
  expect(numeros).toEqual(Array.from({ length: exitos.length }, (_, i) => i + 1));

  // Los que no terminaron piden intentarlo de nuevo, sin afirmar nada.
  for (const fallo of fallos) {
    expect(fallo.esExito).toBe(false);
    expect(fallo.mensaje).toMatch(/Inténtalo de nuevo|mucho movimiento|acaba de prestarse/u);
  }

  // Y nada quedó a medias: un préstamo por éxito, cada libro apuntando al suyo
  // o libre si su intento no pasó, y el contador en el último número.
  const prestamos = await listarPrestamos();
  expect(prestamos).toHaveLength(exitos.length);
  for (const prestamo of prestamos) {
    expect(prestamo.estado).toBe('abierto');
    const libro = await leerLibro(prestamo.libro);
    expect(libro.prestamoAbierto, `el libro ${prestamo.libro} apunta a su préstamo`).toBe(prestamo.id);
    expect(libro.vecesPrestado).toBe(1);
  }
  const codigosPrestados = new Set(prestamos.map((prestamo) => prestamo.libro));
  for (const codigo of CINCO.filter((uno) => !codigosPrestados.has(uno))) {
    const libro = await leerLibro(codigo);
    expect(libro.prestamoAbierto, `el libro ${codigo} quedó libre`).toBe(null);
    expect(libro.vecesPrestado, `el libro ${codigo} no contó un préstamo que no quedó`).toBe(0);
  }
  const contadores = await leerContadores();
  expect(contadores.ultimoPrestamo).toBe(exitos.length);
});
