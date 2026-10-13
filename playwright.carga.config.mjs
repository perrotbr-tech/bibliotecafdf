// Pruebas de carga y mediciones de la Etapa 1. Separadas del E2E porque miden
// tiempos y lecturas, y no deben competir por el procesador con otras pruebas.
import base from './playwright.config.mjs';

export default {
  ...base,
  testDir: 'tests/carga',
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
};
