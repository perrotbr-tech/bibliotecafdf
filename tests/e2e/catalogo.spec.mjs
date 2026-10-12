// Catálogo en la pantalla: C-02, C-03, C-05, C-06, C-07, C-25, C-26, C-27 y
// C-36, más el foco y el botón Atrás de la hoja.
import { expect, test } from '@playwright/test';

import { ADMIN, VOLUNTARIA, leerLibro, ponerLibro, sembrarBaseDemo } from '../ayuda/siembra.mjs';
import { abrir, entrar } from '../ayuda/navegador.mjs';

const LIBROS = [
  { codigo: 'INF003', titulo: 'El arca de Noé', autor: 'Ana Pardo', categoria: 'Infantil' },
  { codigo: 'INF027', titulo: 'Historias para dormir', autor: 'Luis Vera', categoria: 'Infantil' },
  { codigo: 'TEO006', titulo: 'El Dios pródigo', autor: 'Tim Keller', categoria: 'Teología' },
  {
    codigo: 'HM012',
    titulo: 'Cómo ser esposa',
    autor: 'Martha Peace',
    categoria: 'Hombres y mujeres',
    prestamoAbierto: 'prestamo-1',
    vecesPrestado: 3,
  },
];

async function abrirCatalogo(page, correo = ADMIN) {
  await abrir(page, '/');
  await entrar(page, correo);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByTestId('catalogo')).toBeVisible();
  await expect(page.getByTestId('libro-INF003')).toBeVisible();
}

test.beforeEach(async () => {
  await sembrarBaseDemo({ libros: LIBROS });
});

test('el catálogo se abre con los libros ordenados por código', async ({ page }) => {
  await abrirCatalogo(page);
  const codigos = await page.getByTestId('lista-libros').locator('.tejuelo').allTextContents();
  expect(codigos).toEqual(['HM012', 'INF003', 'INF027', 'TEO006']);
  await expect(page.getByTestId('resumen-catalogo')).toHaveText('4 libros');
});

test('C-25 buscar sin tildes encuentra lo que las tiene, y el código con espacios también', async ({ page }) => {
  await abrirCatalogo(page);
  const buscador = page.getByTestId('buscar-libro');

  await buscador.fill('dios prodigo');
  await expect(page.getByTestId('libro-TEO006')).toBeVisible();
  await expect(page.getByTestId('libro-INF003')).toBeHidden();

  await buscador.fill('inf 027');
  await expect(page.getByTestId('libro-INF027')).toBeVisible();
  await expect(page.getByTestId('libro-TEO006')).toBeHidden();

  await buscador.fill('PEACE');
  await expect(page.getByTestId('libro-HM012')).toBeVisible();
});

test('C-26 buscar «(.*[\\» deja la lista vacía con mensaje, sin error', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (fallo) => errores.push(fallo.message));
  await abrirCatalogo(page);

  await page.getByTestId('buscar-libro').fill('(.*[\\');
  await expect(page.getByText('No se encontró ningún libro')).toBeVisible();
  await expect(page.getByTestId('lista-libros').locator('.tejuelo')).toHaveCount(0);
  expect(errores, 'una búsqueda rara no puede lanzar nada').toEqual([]);
});

test('los filtros de categoría y de estado se combinan con la búsqueda', async ({ page }) => {
  await abrirCatalogo(page);

  await page.getByTestId('filtro-categoria-Infantil').click();
  await expect(page.getByTestId('libro-INF003')).toBeVisible();
  await expect(page.getByTestId('libro-TEO006')).toBeHidden();

  await page.getByTestId('filtro-categoria-todas').click();
  await page.getByTestId('filtro-estado-prestados').click();
  await expect(page.getByTestId('libro-HM012')).toBeVisible();
  await expect(page.getByTestId('libro-INF003')).toBeHidden();

  await page.getByTestId('filtro-estado-disponibles').click();
  await expect(page.getByTestId('libro-HM012')).toBeHidden();
  await expect(page.getByTestId('libro-INF003')).toBeVisible();
});

test('se muestran 40 filas y «Mostrar más» trae el resto', async ({ page }) => {
  const muchos = Array.from({ length: 45 }, (_, i) => ({
    codigo: `NV${String(i + 1).padStart(3, '0')}`,
    titulo: `Novela ${i + 1}`,
    categoria: 'Novelas',
  }));
  await sembrarBaseDemo({ libros: muchos });
  await abrir(page, '/');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByTestId('libro-NV001')).toBeVisible();

  await expect(page.getByTestId('lista-libros').locator('.tejuelo')).toHaveCount(40);
  await expect(page.getByTestId('mostrar-mas')).toHaveText('Mostrar más (5)');
  await page.getByTestId('mostrar-mas').click();
  await expect(page.getByTestId('lista-libros').locator('.tejuelo')).toHaveCount(45);
  await expect(page.getByTestId('mostrar-mas')).toBeHidden();
});

test('la ficha de un libro muestra su estado y sus veces prestado', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('libro-HM012').click();

  await expect(page.getByTestId('hoja-libro')).toBeVisible();
  await expect(page.getByTestId('titulo-libro')).toHaveText('Cómo ser esposa');
  await expect(page.getByTestId('autor-libro')).toHaveText('Martha Peace');
  await expect(page.getByTestId('categoria-libro')).toHaveText('Hombres y mujeres');
  await expect(page.getByTestId('estado-libro')).toHaveText('Prestado');
  await expect(page.getByTestId('veces-prestado')).toHaveText('3');
});

test('la hoja se abre con el foco dentro, se cierra con Atrás y devuelve el foco', async ({ page }) => {
  await abrirCatalogo(page);
  const fila = page.getByTestId('libro-INF003');
  await fila.click();

  // El foco entró en la hoja.
  await expect(page.getByTestId('hoja-libro')).toBeVisible();
  const dentro = await page.evaluate(() => {
    const panel = document.querySelector('[data-prueba="hoja-libro"]');
    return panel.contains(document.activeElement);
  });
  expect(dentro, 'el foco tiene que estar dentro de la hoja').toBe(true);

  // El botón Atrás del teléfono cierra la hoja y NO se sale del catálogo.
  await page.goBack();
  await expect(page.getByTestId('hoja-libro')).toBeHidden();
  await expect(page.getByTestId('catalogo')).toBeVisible();

  // Y el foco volvió a la fila que se tocó.
  const volvio = await page.evaluate(
    () => document.activeElement?.getAttribute('data-prueba') ?? null,
  );
  expect(volvio).toBe('libro-INF003');
});

test('Esc cierra la hoja y Tab no se escapa de ella', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('libro-INF003').click();
  await expect(page.getByTestId('hoja-libro')).toBeVisible();

  // Diez tabulaciones y el foco sigue dentro: la hoja es modal de verdad.
  for (let vez = 0; vez < 10; vez += 1) await page.keyboard.press('Tab');
  const dentro = await page.evaluate(() => {
    const panel = document.querySelector('[data-prueba="hoja-libro"]');
    return panel.contains(document.activeElement);
  });
  expect(dentro).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hoja-libro')).toBeHidden();
});

test('C-03 y C-04 el administrador agrega un libro con el código sugerido', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('agregar-libro').click();
  await expect(page.getByTestId('formulario-libro')).toBeVisible();

  // La categoría inicial es la primera, Infantil, cuyo mayor es INF027.
  await expect(page.getByTestId('libro-codigo')).toHaveValue('INF028');

  // Al cambiar de categoría, la sugerencia cambia.
  await page.getByTestId('libro-categoria').selectOption('Teología');
  await expect(page.getByTestId('libro-codigo')).toHaveValue('TEO007');

  // C-03: con espacios y minúsculas se guarda en mayúsculas y junto.
  await page.getByTestId('libro-codigo').fill('teo 100');
  await page.getByTestId('libro-titulo').fill('Institución de la religión cristiana');
  await page.getByTestId('libro-autor').fill('Juan Calvino');
  await page.getByTestId('guardar-libro').click();

  await expect(page.getByText('Libro agregado')).toBeVisible();
  const guardado = await leerLibro('TEO100');
  expect(guardado).not.toBeNull();
  expect(guardado.codigo).toBe('TEO100');
  expect(guardado.titulo).toBe('Institución de la religión cristiana');
  expect(guardado.prestamoAbierto).toBeNull();
  expect(guardado.vecesPrestado).toBe(0);
  expect(guardado.baja).toBe(false);
});

test('C-02 agregar un libro con un código que ya existe avisa y no cambia el existente', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('agregar-libro').click();

  await page.getByTestId('libro-codigo').fill('INF003');
  await page.getByTestId('libro-titulo').fill('Otro título cualquiera');
  await page.getByTestId('guardar-libro').click();

  await expect(page.getByTestId('error-libro')).toHaveText('El código ya existe');
  const existente = await leerLibro('INF003');
  expect(existente.titulo).toBe('El arca de Noé');
});

test('C-05 un título de 1 o de 121 caracteres se rechaza con mensaje', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('agregar-libro').click();
  await page.getByTestId('libro-codigo').fill('INF500');

  await page.getByTestId('libro-titulo').fill('x');
  await page.getByTestId('guardar-libro').click();
  await expect(page.getByTestId('error-libro')).toContainText('de 2 a 120');

  await page.getByTestId('libro-titulo').fill('x'.repeat(121));
  await page.getByTestId('guardar-libro').click();
  await expect(page.getByTestId('error-libro')).toContainText('de 2 a 120');

  expect(await leerLibro('INF500')).toBeNull();
});

test('C-06 un título con una etiqueta HTML se muestra como texto y no ejecuta nada', async ({ page }) => {
  const alertas = [];
  page.on('dialog', (dialogo) => {
    alertas.push(dialogo.message());
    void dialogo.dismiss();
  });
  await ponerLibro({ codigo: 'INF900', titulo: '<img src=x onerror=alert(1)>', categoria: 'Infantil' });
  await abrirCatalogo(page);

  // Se ve como texto, y no hay ninguna imagen inyectada en la lista.
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.getByTestId('lista-libros').locator('img')).toHaveCount(0);
  expect(alertas).toEqual([]);
});

test('C-07 el administrador edita un libro sin tocar el préstamo ni la cuenta', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('libro-HM012').click();
  await page.getByTestId('editar-libro').click();

  // El código no se puede cambiar: identifica al libro.
  await expect(page.getByTestId('libro-codigo')).toBeDisabled();
  await page.getByTestId('libro-titulo').fill('Cómo ser esposa (2.ª edición)');
  await page.getByTestId('guardar-libro').click();

  await expect(page.getByText('Libro actualizado')).toBeVisible();
  const guardado = await leerLibro('HM012');
  expect(guardado.titulo).toBe('Cómo ser esposa (2.ª edición)');
  // Lo que la edición no toca sigue igual.
  expect(guardado.prestamoAbierto).toBe('prestamo-1');
  expect(guardado.vecesPrestado).toBe(3);
});

test('dar de baja pide confirmación y deja el libro de baja, no borrado', async ({ page }) => {
  await abrirCatalogo(page);
  await page.getByTestId('libro-INF027').click();
  await page.getByTestId('dar-de-baja').click();

  await expect(page.getByTestId('hoja-dar-de-baja')).toBeVisible();
  await expect(page.getByText('¿Dar de baja «Historias para dormir»?')).toBeVisible();
  await page.getByTestId('confirmar-baja').click();

  await expect(page.getByText('INF027 quedó de baja')).toBeVisible();
  const guardado = await leerLibro('INF027');
  expect(guardado.baja).toBe(true);
  // Y en la lista aparece como de baja, no desaparece.
  await expect(page.getByTestId('libro-INF027')).toBeVisible();
});

test('C-01 una voluntaria no ve «Agregar libro» ni «Editar»', async ({ page }) => {
  await abrirCatalogo(page, VOLUNTARIA);
  await expect(page.getByTestId('agregar-libro')).toHaveCount(0);

  await page.getByTestId('libro-INF003').click();
  await expect(page.getByTestId('hoja-libro')).toBeVisible();
  await expect(page.getByTestId('editar-libro')).toHaveCount(0);
  await expect(page.getByTestId('dar-de-baja')).toHaveCount(0);
});

test('C-27 otro teléfono agrega un libro mientras escribo: aparece sin perder el texto ni el foco', async ({
  page,
}) => {
  await abrirCatalogo(page);
  const buscador = page.getByTestId('buscar-libro');
  await buscador.click();
  await buscador.fill('arca');
  await expect(page.getByTestId('libro-INF003')).toBeVisible();

  // Otro teléfono agrega un libro que también coincide con lo escrito.
  await ponerLibro({ codigo: 'INF500', titulo: 'El arca de los pactos', categoria: 'Infantil' });

  await expect(page.getByTestId('libro-INF500')).toBeVisible();
  await expect(buscador).toHaveValue('arca');
  await expect(buscador).toBeFocused();
});

test('C-36 un título de una sola palabra de 60 letras no saca la página de ancho a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await sembrarBaseDemo({
    libros: [{ codigo: 'INF001', titulo: 'x'.repeat(60), autor: 'y'.repeat(60), categoria: 'Infantil' }],
  });
  await abrir(page, '/');
  await entrar(page, ADMIN);
  await page.getByRole('button', { name: 'Catálogo' }).click();
  await expect(page.getByTestId('libro-INF001')).toBeVisible();

  const sobraEnLista = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobraEnLista, 'la lista no puede desplazarse a lo ancho').toBeLessThanOrEqual(0);

  await page.getByTestId('libro-INF001').click();
  await expect(page.getByTestId('hoja-libro')).toBeVisible();
  const sobraEnFicha = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobraEnFicha, 'la ficha tampoco').toBeLessThanOrEqual(0);
});
