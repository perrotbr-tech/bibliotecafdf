// Préstamos: flujo feliz y Devueltos rotulados (orden por registro).
import { expect, test } from '@playwright/test';

import {
  ADMIN,
  VOLUNTARIA,
  ponerLibro,
  ponerPrestamo,
  sembrarBaseDemo,
  sembrarCalendarioSintetico,
  sembrarPrestamos,
  sembrarVolumen,
} from '../ayuda/siembra.mjs';
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

test('Devueltos muestra el rótulo «Orden por registro» (contrato §4)', async ({ page }) => {
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

test('Para recordar muestra 40 atrasados por tanda y el resto tras «Mostrar más»', async ({ page }) => {
  // Con 45 atrasados, pintarlos todos de golpe pasaba del segundo que pide
  // specs/04 (se midió 1.676 ms con 400). La pantalla pagina como el resto de
  // las listas largas, y el título sigue diciendo el total.
  await sembrarVolumen({ libros: 60, lectores: 20, prestamosFalsos: false });
  const sembrado = await sembrarPrestamos({
    libros: 60,
    lectores: 20,
    abiertos: 45,
    atrasados: 45,
    ahora: new Date('2026-10-10T15:00:00-03:00'),
  });
  await sembrarCalendarioSintetico('2026-10-10');

  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-para-recordar').click();

  const grupo = page.getByTestId('grupo-atraso');
  await expect(grupo).toContainText(`Atrasados (${sembrado.atrasados})`);
  await expect(grupo.getByTestId('fila-recordar')).toHaveCount(40);

  await grupo.getByTestId('mostrar-mas-atraso').click();
  await expect(grupo.getByTestId('fila-recordar')).toHaveCount(sembrado.atrasados);
  await expect(grupo.getByTestId('mostrar-mas-atraso')).toHaveCount(0);
});

test('P-47 la ficha de un lector con 2 abiertos y 9 devueltos muestra los 2 y los 5 más recientes', async ({
  page,
}) => {
  // La ficha lee con `lector == …` y ordena en el teléfono: sin orden del
  // servidor no hace falta otro índice compuesto (specs/03 §Pantallas).
  for (let i = 1; i <= 11; i += 1) {
    const codigo = `INF${String(100 + i).padStart(3, '0')}`;
    await ponerLibro({ codigo, titulo: `Libro ${i}`, autor: 'Autora' });
    const abierto = i <= 2;
    await ponerPrestamo(`${i}`.padStart(32, 'a'), {
      numero: i,
      libro: codigo,
      lector: 'L001',
      estado: abierto ? 'abierto' : 'devuelto',
      // Los devueltos, escalonados: el más reciente primero en la ficha.
      prestadoEn: new Date(`2026-09-${String(i).padStart(2, '0')}T15:00:00Z`),
      devueltoEn: abierto ? null : new Date(`2026-09-${String(i).padStart(2, '0')}T16:00:00Z`),
      devueltoPor: abierto ? null : VOLUNTARIA,
    });
  }

  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-lectores').click();
  await page.getByTestId('lector-L001').click();
  await expect(page.getByTestId('hoja-lector')).toBeVisible();

  const abiertos = page.getByTestId('abiertos-del-lector');
  await expect(abiertos).toContainText('Préstamos abiertos (2)');
  await expect(abiertos.getByTestId('prestamo-de-ficha')).toHaveCount(2);
  await expect(abiertos.getByTestId('devolver-en-ficha')).toHaveCount(2);

  // Nueve devueltos, de los que se muestran los cinco más recientes.
  const devueltos = page.getByTestId('devueltos-del-lector');
  await expect(devueltos).toContainText('Últimos devueltos (5)');
  await expect(devueltos.getByTestId('prestamo-de-ficha')).toHaveCount(5);
  await expect(devueltos.getByTestId('devolver-en-ficha')).toHaveCount(0);
  // El más reciente de los nueve es el 11; el más antiguo mostrado, el 7.
  await expect(devueltos).toContainText('Libro 11');
  await expect(devueltos).toContainText('Libro 7');
  await expect(devueltos).not.toContainText('Libro 6');
});

test('la ficha de un libro prestado dice a quién y ofrece Devolver', async ({ page }) => {
  await ponerLibro({ codigo: 'INF200', titulo: 'Prestado ahora', autor: 'Autora' });
  await ponerPrestamo('b'.repeat(32), {
    numero: 1,
    libro: 'INF200',
    lector: 'L001',
    estado: 'abierto',
    prestadoEn: new Date('2026-10-10T15:00:00Z'),
  });

  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await page.getByTestId('buscar-libro').fill('INF200');
  await page.getByTestId('lista-libros').getByText('Prestado ahora').click();
  await expect(page.getByTestId('hoja-libro')).toBeVisible();

  const ahora = page.getByTestId('prestado-ahora');
  await expect(ahora).toContainText('Ana Rojas');
  await expect(ahora.getByTestId('devolver-en-ficha')).toHaveCount(1);

  await ahora.getByTestId('devolver-en-ficha').click();
  await expect(page.getByText(/Devuelto: Prestado ahora/u)).toBeVisible({ timeout: 15_000 });
  // Al devolver desde la ficha, el libro deja de estar fuera y pasa a historia.
  await expect(page.getByTestId('ultimos-prestamos')).toContainText('Últimos préstamos (1)');
});

test('P-44 buscar en Devueltos con 80 cargados filtra esos 80 y lo dice', async ({ page }) => {
  // El caso pide 80 CARGADOS: Devueltos pagina de 40 en 40, así que hay que
  // pedir la segunda tanda antes de buscar.
  await sembrarVolumen({ libros: 200, lectores: 20, prestamosFalsos: false });
  await sembrarPrestamos({
    libros: 200,
    lectores: 20,
    abiertos: 0,
    devueltos: 120,
    ahora: new Date('2026-10-10T15:00:00-03:00'),
  });

  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Préstamos' }).click();
  await page.getByTestId('pestana-devueltos').click();

  const filas = page.getByTestId('lista-prestamos').getByTestId('fila-prestamo');
  await expect(filas).toHaveCount(40, { timeout: 30_000 });
  await page.getByTestId('cargar-mas').click();
  await expect(filas).toHaveCount(80, { timeout: 30_000 });

  // Con 80 cargados, la búsqueda filtra ESOS 80 y la pantalla lo dice, para que
  // nadie crea que buscó en los 120 que hay en la base.
  await page.getByTestId('buscar-prestamos').fill('Título número 7 ');
  await expect(page.getByTestId('busqueda-devueltos')).toHaveText('Buscando en los 80 cargados');
  await expect(filas.first()).toBeVisible();
});

test('P-36 «Prestar otro a (nombre)» abre Prestar con ese lector y el libro vacío', async ({ page }) => {
  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, VOLUNTARIA);
  await page.getByTestId('ir-prestar').click();
  await page.getByTestId('buscar-libro-prestar').fill('Radical');
  await page.getByTestId('elegir-libro').first().click();
  await page.getByTestId('buscar-lector-prestar').fill('Ana');
  await page.getByTestId('elegir-lector').first().click();
  await page.getByTestId('plazo-2').check();
  await page.getByTestId('confirmar-prestamo').click();

  // El aviso ofrece las dos acciones durante diez segundos.
  await expect(page.getByTestId('prestar-otro')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('deshacer-prestamo')).toBeVisible();
  await expect(page.getByTestId('prestar-otro')).toHaveText('Prestar otro a Ana');

  await page.getByTestId('prestar-otro').click();
  await expect(page.getByTestId('prestar')).toBeVisible();
  // El lector viene elegido; el libro, vacío.
  await expect(page.getByTestId('lector-elegido')).toHaveText('Ana Rojas');
  await expect(page.getByTestId('buscar-libro-prestar')).toBeVisible();
});

test('P-45 con un título de 120 letras a 320 px, «Deshacer» sigue dentro de la pantalla', async ({ page }) => {
  const titulo = 'A'.repeat(120);
  await ponerLibro({ codigo: 'INF300', titulo, autor: 'Autora' });
  await ponerPrestamo('c'.repeat(32), {
    numero: 1,
    libro: 'INF300',
    lector: 'L001',
    estado: 'abierto',
    prestadoEn: new Date('2026-10-10T15:00:00Z'),
    venceEl: new Date('2026-10-24T02:59:59.999Z'),
  });

  await page.setViewportSize({ width: 320, height: 740 });
  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, VOLUNTARIA);
  await page.getByRole('button', { name: 'Préstamos' }).click();
  await page.getByTestId('devolver').first().click();

  const deshacer = page.getByTestId('deshacer-devolucion');
  await expect(deshacer).toBeVisible({ timeout: 15_000 });
  const caja = await deshacer.boundingBox();
  expect(caja, 'el botón tiene que estar dibujado').not.toBeNull();
  expect(caja.x, 'no se sale por la izquierda').toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width, 'no se sale por la derecha de los 320 px').toBeLessThanOrEqual(320);
  // Y no hay desplazamiento horizontal en la página.
  const anchoPagina = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(anchoPagina).toBeLessThanOrEqual(320);
});

test('R-09 tras tocar «Recordar por WhatsApp», la fila dice «WhatsApp abierto hoy por…»', async ({ page }) => {
  // Que la regla permita el update está en `tests/reglas/prestamos.test.mjs`.
  // Lo que falta acreditar es el resultado que el caso escribe: la fila lo
  // cuenta, con quién lo abrió, y no dice «enviado».
  //
  // Esta prueba NO puede fijar la hora con `?ahora=`: la marca la pone el
  // servidor y el emulador escribe la hora real, así que un `?ahora=` de 2026
  // haría que la fila dijera «el domingo 18 de octubre» en vez de «hoy» por un
  // desacuerdo del fixture, no del producto. Se usa la hora real y el préstamo
  // se siembra atrasado contra ella.
  const ahora = new Date();
  const mesPasado = new Date(ahora.getTime() - 30 * 86_400_000);
  await ponerPrestamo('f'.repeat(32), {
    numero: 1,
    libro: 'INF001',
    lector: 'L001',
    estado: 'abierto',
    prestadoEn: new Date(ahora.getTime() - 45 * 86_400_000),
    venceEl: mesPasado,
  });

  await abrir(page, `/?ahora=${ahora.toISOString()}`);
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-para-recordar').click();

  const fila = page.getByTestId('fila-recordar').first();
  await expect(fila.getByTestId('ultimo-recordatorio')).toHaveCount(0);

  const emergente = page.context().waitForEvent('page').catch(() => null);
  await fila.getByTestId('recordar-whatsapp').click();

  // La escritura es la del servidor; la fila se repinta cuando la escucha la
  // trae de vuelta.
  await expect(page.getByTestId('ultimo-recordatorio').first()).toContainText(/WhatsApp abierto hoy por/u, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('ultimo-recordatorio').first()).toContainText('admin');
  await expect(page.getByTestId('error-apertura')).toHaveCount(0);
  // La app nunca afirma que el mensaje se envió.
  await expect(page.getByTestId('fila-recordar').first()).not.toContainText('enviado');

  const otra = await emergente;
  if (otra) await otra.close();
});

test('R-12 sin conexión, el enlace se abre y la fila dice que la apertura no se anotó', async ({
  page,
  context,
}) => {
  // El `<a href>` navega en el mismo gesto; el guardado es independiente y
  // puede fallar. Antes la fila no decía nada: la vista avisaba por
  // `alActualizar` y ningún llamador lo pasaba (H-04 de la contraprueba).
  await ponerPrestamo('d'.repeat(32), {
    numero: 1,
    libro: 'INF001',
    lector: 'L001',
    estado: 'abierto',
    prestadoEn: new Date('2026-09-05T15:00:00Z'),
    venceEl: new Date('2026-09-19T02:59:59.999Z'),
  });

  await abrir(page, '/?ahora=2026-10-10T15:00:00-03:00');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('abrir-para-recordar').click();

  const fila = page.getByTestId('fila-recordar').first();
  await expect(fila.getByTestId('recordar-whatsapp')).toBeVisible();
  // El enlace es el de WhatsApp, y abre en otra pestaña: se deja preparada la
  // espera de esa pestaña para cerrarla, sin dejarla navegando.
  await expect(fila.getByTestId('recordar-whatsapp')).toHaveAttribute('href', /wa\.me/u);

  await context.setOffline(true);
  const emergente = context.waitForEvent('page').catch(() => null);
  await fila.getByTestId('recordar-whatsapp').click();
  await expect(fila.getByTestId('error-apertura')).toHaveText('No se pudo anotar la apertura', {
    timeout: 20_000,
  });
  // La fila no afirma que el mensaje se envió ni que quedó anotado.
  await expect(fila.getByTestId('ultimo-recordatorio')).toHaveCount(0);

  await context.setOffline(false);
  const otra = await emergente;
  if (otra) await otra.close();
});

test('P-22 pasados los diez minutos el botón «Anular préstamo» no aparece, y dentro sí', async ({ page }) => {
  // La mitad de interfaz de P-22: el botón. La denegación de la regla está en
  // `tests/reglas/prestamos.test.mjs` y el borde al milisegundo, en
  // `tests/unidad/fechas.test.mjs` —aquí la hora verificada avanza unos
  // segundos mientras se dibuja la ficha, así que el instante exacto no se
  // puede fijar desde el navegador.
  await ponerLibro({ codigo: 'INF210', titulo: 'Recién prestado', autor: 'Autora' });
  await ponerPrestamo('e'.repeat(32), {
    numero: 1,
    libro: 'INF210',
    lector: 'L001',
    estado: 'abierto',
    prestadoEn: new Date('2026-10-10T15:00:00-03:00'),
    venceEl: new Date('2026-10-24T02:59:59.999Z'),
    creadoPor: VOLUNTARIA,
  });

  await abrir(page, '/?ahora=2026-10-10T15:10:00-03:00');
  await entrar(page, VOLUNTARIA);
  await page.getByRole('button', { name: 'Préstamos' }).click();
  await page.getByTestId('fila-prestamo').first().click();
  await expect(page.getByTestId('ficha-prestamo')).toBeVisible();
  await expect(page.getByTestId('ficha-anular')).toHaveCount(0);
  await expect(page.getByTestId('anular-bloqueado')).toBeVisible();

  // Un minuto antes sí se ofrece: la cota es la de la regla, no «nunca».
  await abrir(page, '/?ahora=2026-10-10T15:09:00-03:00');
  await entrar(page, VOLUNTARIA);
  await page.getByRole('button', { name: 'Préstamos' }).click();
  await page.getByTestId('fila-prestamo').first().click();
  await expect(page.getByTestId('ficha-anular')).toBeVisible();
});

// La mitad de interfaz de P-48: un martes, el flujo normal no se ofrece. La
// mitad de reglas está en `tests/reglas/prestamos.test.mjs`. El 13-10-2026 es
// martes. La excepción del administrador era H-09 de la contraprueba: entraba a
// los tres pasos y recibía el error del día en el último toque.
test('P-48 un martes nadie entra al flujo normal de Prestar, tampoco el administrador', async ({ page }) => {
  await abrir(page, '/?ahora=2026-10-13T15:00:00-03:00');
  await entrar(page, VOLUNTARIA);
  await expect(page.getByTestId('ir-prestar')).toBeDisabled();
  await page.locator('[data-destino="prestar"]').click();
  await expect(page.getByTestId('bloqueado-no-sabado')).toBeVisible();
  await expect(page.getByTestId('buscar-libro-prestar')).toHaveCount(0);

  await abrir(page, '/?ahora=2026-10-13T15:00:00-03:00');
  await entrar(page, ADMIN);
  await expect(page.getByTestId('ir-prestar')).toBeDisabled();
  // Su camino es otra pantalla, y está ofrecida.
  await expect(page.getByTestId('ir-papel')).toBeVisible();
  await page.locator('[data-destino="prestar"]').click();
  await expect(page.getByTestId('bloqueado-no-sabado')).toContainText('Registrar desde papel');
  await expect(page.getByTestId('buscar-libro-prestar')).toHaveCount(0);
});
