// Concurrencia del alta de lector: C-19, C-20 y C-39.
//
// Aquí se prueba lo que no se puede probar con una pantalla sola: dos
// teléfonos inscribiendo el mismo nombre a la vez, cinco altas en paralelo y
// un reintento que conserva su identidad.
//
// Las altas se lanzan por `globalThis.__biblioteca.inscribirLector`, que usa
// EXACTAMENTE la misma operación que el formulario y solo existe contra el
// emulador. No es un atajo que se salte reglas: cada alta pasa por la misma
// transacción y las mismas reglas de seguridad.
import { expect, test } from '@playwright/test';

import { ADMIN, VOLUNTARIA, leerClave, leerContadores, listarLectores, sembrarBaseDemo } from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

test.beforeEach(async () => {
  await sembrarBaseDemo();
});

test('C-19 dos teléfonos inscriben el mismo nombre a la vez: uno se crea, el otro recibe «Ya existe»', async ({
  browser,
}) => {
  // Dos contextos de navegador: dos teléfonos de verdad, cada uno con su
  // sesión y su propia conexión al emulador.
  const unTelefono = await browser.newContext();
  const otroTelefono = await browser.newContext();
  const unaPagina = await unTelefono.newPage();
  const otraPagina = await otroTelefono.newPage();

  try {
    await abrir(unaPagina, '/');
    await entrar(unaPagina, ADMIN);
    await abrir(otraPagina, '/');
    await entrar(otraPagina, VOLUNTARIA);
    // Las dos pantallas listas antes de disparar, para que las dos altas
    // salgan lo más juntas posible.
    await expect(unaPagina.locator('#barra-inferior')).toBeVisible();
    await expect(otraPagina.locator('#barra-inferior')).toBeVisible();

    const [uno, otro] = await Promise.all([
      unaPagina.evaluate(() => globalThis.__biblioteca.inscribirLector({ nombre: 'Rafaela Toledo' })),
      otraPagina.evaluate(() => globalThis.__biblioteca.inscribirLector({ nombre: '  rafaela   TOLEDO ' })),
    ]);

    const exitos = [uno, otro].filter((resultado) => resultado.esExito);
    const fallos = [uno, otro].filter((resultado) => !resultado.esExito);
    expect(exitos, 'exactamente una de las dos altas queda').toHaveLength(1);
    expect(fallos, 'y la otra falla').toHaveLength(1);

    // Y en la base queda UN lector, con su clave y el contador en uno.
    const lectores = await listarLectores();
    expect(lectores).toHaveLength(1);
    // Cualquiera de los dos teléfonos puede ganar; lo que importa es que el
    // que pierde reciba el nombre del lector que SÍ quedó, para poder
    // buscarlo en la lista.
    expect(fallos[0].mensaje).toBe(`Ya existe: ${lectores[0].nombre}. Búscalo en la lista`);
    expect(lectores[0].clave).toBe('rafaela toledo');
    expect((await leerClave('rafaela toledo')).lector).toBe(lectores[0].id);
    const contadores = await leerContadores();
    expect(contadores.ultimoLector).toBe(1);
    expect(contadores.ultimoLectorId).toBe(lectores[0].id);
  } finally {
    await unTelefono.close();
    await otroTelefono.close();
  }
});

test('C-20 cinco altas en paralelo: identificadores distintos y consecutivos, y nada a medias', async ({ page }) => {
  await abrir(page, '/');
  await entrar(page, ADMIN);
  await expect(page.locator('#barra-inferior')).toBeVisible();

  const resultados = await page.evaluate(() =>
    Promise.all(
      ['Ana Rojas', 'Bruno Silva', 'Carla Díaz', 'Diego Luna', 'Elsa Pinto'].map((nombre) =>
        globalThis.__biblioteca.inscribirLector({ nombre }),
      ),
    ),
  );

  const exitos = resultados.filter((resultado) => resultado.esExito);
  const fallos = resultados.filter((resultado) => !resultado.esExito);
  process.stdout.write(`\n[concurrencia] cinco altas en paralelo: ${exitos.length} quedaron, ${fallos.length} no\n`);

  // Las que terminan tienen identificadores distintos y consecutivos desde
  // L001: el contador no se salta ni se repite.
  const identificadores = exitos.map((resultado) => resultado.valor.id).sort();
  expect(new Set(identificadores).size, 'ningún identificador repetido').toBe(exitos.length);
  expect(identificadores).toEqual(
    Array.from({ length: exitos.length }, (_, i) => `L${String(i + 1).padStart(3, '0')}`),
  );

  // Las que no terminaron dicen que se intente de nuevo, sin afirmar nada que
  // no se sepa.
  for (const fallo of fallos) {
    expect(fallo.estado, 'una carrera perdida no se presenta como falta de permiso').toBe('carrera-perdida');
    expect(fallo.mensaje).toBe('No se pudo inscribir ahora. Inténtalo de nuevo');
  }

  // Y nada quedó a medias: tantos lectores como altas confirmadas, cada uno
  // con su clave, y el contador justo en el último.
  const lectores = await listarLectores();
  expect(lectores).toHaveLength(exitos.length);
  for (const lector of lectores) {
    expect((await leerClave(lector.clave)).lector, `la clave de ${lector.id}`).toBe(lector.id);
  }
  const contadores = await leerContadores();
  expect(contadores.ultimoLector).toBe(exitos.length);
  expect(contadores.ultimoLectorId).toBe(`L${String(exitos.length).padStart(3, '0')}`);
});

test('C-39 un reintento tras una carrera conserva su operacionId y toma el correlativo que quede', async ({
  page,
}) => {
  await abrir(page, '/');
  await entrar(page, ADMIN);
  await expect(page.locator('#barra-inferior')).toBeVisible();

  // Una intención estable, como la que guarda el formulario desde el primer
  // toque. El primer intento pierde la carrera contra otro nombre que se
  // queda con el L001.
  const mia = 'a'.repeat(32);
  const resultado = await page.evaluate(
    async (operacionId) => {
      const primera = await Promise.all([
        globalThis.__biblioteca.inscribirLector({ nombre: 'Rafaela Toledo', operacionId }),
        globalThis.__biblioteca.inscribirLector({ nombre: 'María José Pérez' }),
      ]);
      // El reintento usa el MISMO operacionId: la intención no cambia porque
      // el formulario no cambió.
      const segunda = await globalThis.__biblioteca.inscribirLector({
        nombre: 'Rafaela Toledo',
        operacionId,
      });
      return { primera, segunda };
    },
    mia,
  );

  const mias = resultado.primera.filter((uno) => uno.operacionId === mia);
  expect(mias, 'la primera vuelta incluye mi intento').toHaveLength(1);
  expect(resultado.segunda.operacionId, 'el reintento conserva su identidad').toBe(mia);

  const lectores = await listarLectores();
  const rafaela = lectores.filter((uno) => uno.clave === 'rafaela toledo');
  expect(rafaela, 'Rafaela quedó inscrita UNA vez, aunque se intentara dos').toHaveLength(1);
  // Y su `creacionId` es el de mi intención: el documento es mío, no de otra
  // operación (contrato §3).
  expect(rafaela[0].creacionId).toBe(mia);

  // Dos lectores en total, con identificadores consecutivos y sin huecos.
  expect(lectores.map((uno) => uno.id).sort()).toEqual(['L001', 'L002']);
  expect((await leerContadores()).ultimoLector).toBe(2);

  // El correlativo se resolvió DENTRO del intento confirmado: si el primero
  // hubiera fijado el número antes de la carrera, Rafaela sería L001.
  process.stdout.write(
    `\n[concurrencia] Rafaela quedó como ${rafaela[0].id} tras el reintento; su operacionId no cambió\n`,
  );
});
