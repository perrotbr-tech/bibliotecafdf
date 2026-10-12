// Configuración de las pruebas de extremo a extremo.
// Corren siempre contra los emuladores: `npm run prueba:e2e` las envuelve en
// `firebase emulators:exec`, así que Auth y Firestore ya están arriba cuando
// Playwright arranca el servidor estático de docs/.
import { defineConfig, devices } from '@playwright/test';

export const PUERTO_SITIO = 5173;
export const DIRECCION_SITIO = `http://127.0.0.1:${PUERTO_SITIO}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  // Un voluntario a la vez por prueba, pero las pruebas de concurrencia abren
  // dos contextos dentro de la misma prueba. En serie para que la siembra de
  // una prueba no pise la de otra: comparten la base del emulador.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: DIRECCION_SITIO,
    // Las pantallas marcan sus piezas con `data-prueba`, no con `data-testid`.
    testIdAttribute: 'data-prueba',
    // Teléfono Android de referencia. Las pruebas que miden 320 px fijan su
    // propio viewport.
    viewport: { width: 360, height: 740 },
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-android',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    command: 'node scripts/servir.mjs',
    url: `${DIRECCION_SITIO}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
