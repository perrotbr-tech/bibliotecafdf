// Arranque local con un solo comando: `npm start`.
//
// `npm start` envuelve este script en `firebase emulators:exec`, así que
// cuando corre ya hay un emulador de Auth y otro de Firestore arriba. Aquí se
// inicializa la base demo y se sirve docs/ hasta que se corte con Ctrl-C.

import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { PROYECTO_DEMO, comprobarDestino, inicializar } from './inicializar.mjs';

const RAIZ = join(import.meta.dirname, '..');
const CORREO_DEMO = process.env.CORREO_ADMIN ?? 'admin@demo.cl';
const NOMBRE_DEMO = process.env.NOMBRE_ADMIN ?? 'Administrador de prueba';

// AGENTS.md: verificar ambos hosts de emulador ANTES de usar Admin SDK. Sin
// esto, correr este script a mano —fuera de `npm start`, que es quien define
// las variables— escribiría contra el proyecto real con las credenciales que
// haya a mano.
try {
  comprobarDestino({ proyecto: PROYECTO_DEMO, confirmaProyectoReal: false });
} catch (error) {
  process.stderr.write(`${error.message}\nUsa \`npm start\`, que levanta los emuladores por ti.\n`);
  process.exit(2);
}

const { initializeApp, getApps } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
if (getApps().length === 0) initializeApp({ projectId: PROYECTO_DEMO });

const informe = await inicializar({
  db: getFirestore(),
  FieldValue,
  correo: CORREO_DEMO,
  nombre: NOMBRE_DEMO,
});

process.stdout.write(
  `base demo lista: ${informe.creados.length} creado(s), ${informe.yaExistian.length} intacto(s)\n` +
    `administrador de prueba: ${informe.correo}\n`,
);

const servidor = spawn(process.execPath, [join(RAIZ, 'scripts', 'servir.mjs')], {
  stdio: 'inherit',
  env: process.env,
});

process.stdout.write('Abre http://127.0.0.1:5173 y entra con el emulador de Google. Ctrl-C para terminar.\n');

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.kill(senal);
    process.exit(0);
  });
}
servidor.on('exit', (codigo) => process.exit(codigo ?? 0));
