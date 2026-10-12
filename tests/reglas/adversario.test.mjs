// Escenarios adversos contra las reglas de seguridad.
//
// Estos casos NO están en la lista A-01 a A-40 del documento: son intentos de
// colarse que se me ocurrieron construyendo, y van marcados «EXTRA» para que no
// se confundan con los casos de la especificación. Tampoco reemplazan la
// contraprueba: una revisión del propio implementador no es independiente
// (AGENTS.md).
import { after, before, beforeEach, test } from 'node:test';

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

import {
  ADMIN,
  AJENA,
  ID,
  INACTIVO,
  RUTAS,
  VOLUNTARIA,
  abrirEntorno,
  bloqueoMantenimiento,
  comoCuenta,
  loteDeAlta,
  sembrarBase,
} from '../ayuda/reglas.mjs';
import { BIB } from '../../docs/js/config-publica.js';

let entorno;

before(async () => {
  entorno = await abrirEntorno();
});
after(async () => {
  await entorno?.cleanup();
});
beforeEach(async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno);
});

function altaValida({ nombre = 'Intrusa', rol = 'voluntario', creadoPor = ADMIN } = {}) {
  return {
    nombre,
    rol,
    activo: true,
    creadoEn: serverTimestamp(),
    creadoPor,
    creacionId: ID('1'),
    ultimaConexion: null,
    sincronizacionId: null,
  };
}

test('EXTRA una cuenta que no está en la lista no puede inscribirse sola', async () => {
  // El camino más goloso: si alguien pudiera crear su propio documento de
  // voluntario, entraría sin que nadie lo autorice.
  const db = comoCuenta(entorno, AJENA);
  await assertFails(setDoc(doc(db, RUTAS.voluntario(AJENA)), altaValida({ nombre: 'Yo Mismo', creadoPor: AJENA })));
  await assertFails(
    setDoc(doc(db, RUTAS.voluntario(AJENA)), altaValida({ nombre: 'Yo Mismo', rol: 'admin', creadoPor: AJENA })),
  );
});

test('EXTRA un voluntario desactivado no puede reactivarse ni sincronizar la hora', async () => {
  const db = comoCuenta(entorno, INACTIVO);
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(INACTIVO)), {
      activo: true,
      ultimaOperacionId: ID('2'),
      modificadoEn: serverTimestamp(),
    }),
  );
  // Tampoco por la puerta de la muestra de hora.
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(INACTIVO)), { ultimaConexion: serverTimestamp(), sincronizacionId: ID('2') }),
  );
});

test('EXTRA un administrador desactivado deja de ser administrador', async () => {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.voluntario(ADMIN)).update({ activo: false });
  });
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(getDoc(doc(db, RUTAS.app)));
  await assertFails(setDoc(doc(db, RUTAS.voluntario('nueva@example.com')), altaValida()));
});

test('EXTRA un alta no puede atribuirse a otra persona', async () => {
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(
    setDoc(doc(db, RUTAS.voluntario('firmada@example.com')), altaValida({ creadoPor: VOLUNTARIA })),
  );
  await assertFails(
    setDoc(doc(db, RUTAS.voluntario('firmada@example.com')), altaValida({ creadoPor: 'carga-inicial' })),
  );
});

test('EXTRA el correo del token se compara en minúsculas', async () => {
  // El documento está guardado en minúsculas; la cuenta llega con mayúsculas.
  const db = comoCuenta(entorno, 'Ana@Example.com');
  await assertSucceeds(getDoc(doc(db, RUTAS.app)));
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      ultimaConexion: serverTimestamp(),
      sincronizacionId: ID('3'),
    }),
  );
});

test('EXTRA el permiso no se hereda a otra biblioteca', async () => {
  // Ser voluntario de `principal` no da acceso a `bibliotecas/otra`.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const base = contexto.firestore();
    await base.doc('bibliotecas/otra/config/app').set({ nombreBiblioteca: 'Otra' });
    await base.doc('bibliotecas/otra/config/control').set({ bloqueo: null });
  });

  const db = comoCuenta(entorno, ADMIN);
  await assertFails(getDoc(doc(db, 'bibliotecas/otra/config/app')));
  await assertFails(getDocs(collection(db, 'bibliotecas/otra/voluntarios')));
  await assertFails(setDoc(doc(db, 'bibliotecas/otra/voluntarios/intrusa@example.com'), altaValida()));
});

test('EXTRA un cierre vencido deja de bloquear; uno vigente bloquea', async () => {
  const unaHora = 60 * 60 * 1000;

  // Vencido: `hasta` ya pasó.
  await entorno.clearFirestore();
  await sembrarBase(entorno, {
    bloqueo: {
      tipo: 'cierre',
      token: ID('a'),
      por: ADMIN,
      iniciadoEn: new Date(Date.now() - 2 * unaHora),
      hasta: new Date(Date.now() - unaHora),
      temporada: '2026-5',
    },
  });
  await assertSucceeds(
    setDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.voluntario('despues@example.com')), altaValida()),
  );

  // Vigente: `hasta` está por venir.
  await entorno.clearFirestore();
  await sembrarBase(entorno, {
    bloqueo: {
      tipo: 'cierre',
      token: ID('a'),
      por: ADMIN,
      iniciadoEn: new Date(),
      hasta: new Date(Date.now() + unaHora),
      temporada: '2026-5',
    },
  });
  await assertFails(
    setDoc(doc(comoCuenta(entorno, ADMIN), RUTAS.voluntario('durante@example.com')), altaValida()),
  );
});

test('EXTRA un bloqueo con forma inesperada cierra la puerta, no la abre', async () => {
  // Si el documento de control viene con basura, las escrituras se deniegan:
  // falla hacia el lado seguro.
  await entorno.clearFirestore();
  await sembrarBase(entorno, { bloqueo: 'mantenimiento' });

  const db = comoCuenta(entorno, ADMIN);
  await assertFails(setDoc(doc(db, RUTAS.voluntario('rara@example.com')), altaValida()));
  // Y la lectura se conserva.
  await assertSucceeds(getDoc(doc(db, RUTAS.app)));
});

test('EXTRA un administrador sí puede bajar de rango a otro administrador', async () => {
  // Decisión deliberada: la especificación solo prohíbe hacérselo a uno mismo,
  // así que siempre queda al menos un administrador activo.
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await contexto.firestore().doc(RUTAS.voluntario(VOLUNTARIA)).update({ rol: 'admin' });
  });
  const db = comoCuenta(entorno, ADMIN);
  await assertSucceeds(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      rol: 'voluntario',
      ultimaOperacionId: ID('4'),
      modificadoEn: serverTimestamp(),
    }),
  );
});

test('EXTRA una escritura que no cambia nada tampoco pasa sin hora del servidor', async () => {
  const db = comoCuenta(entorno, ADMIN);
  // Reenviar el documento tal cual, con los metadatos viejos, no es una
  // operación válida: `modificadoEn` tiene que ser la hora del servidor.
  await assertFails(
    updateDoc(doc(db, RUTAS.voluntario(VOLUNTARIA)), {
      ultimaOperacionId: ID('5'),
      modificadoEn: new Date('2026-10-10T18:00:00Z'),
    }),
  );
});

test('EXTRA una cuenta ajena o desactivada no inscribe lectores con el lote completo', async () => {
  // El lote está bien armado: los tres documentos, el enlace cerrado y la
  // hora del servidor. Lo único que falta es ser voluntario activo.
  for (const correo of [AJENA, INACTIVO]) {
    await entorno.clearFirestore();
    await sembrarBase(entorno);
    await assertFails(loteDeAlta(comoCuenta(entorno, correo), correo).commit(), correo);
  }
  // Y con el correo sin verificar, tampoco.
  await entorno.clearFirestore();
  await sembrarBase(entorno);
  await assertFails(
    loteDeAlta(comoCuenta(entorno, VOLUNTARIA, { verificado: false }), VOLUNTARIA).commit(),
  );
});

test('EXTRA el permiso de esta biblioteca no inscribe lectores en otra', async () => {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    const base = contexto.firestore();
    await base.doc('bibliotecas/otra/config/control').set({ bloqueo: null });
    await base.doc('bibliotecas/otra/config/contadores').set({
      ultimoPrestamo: 0,
      ultimoLector: 0,
      ultimoPrestamoId: null,
      ultimoLectorId: null,
    });
    // La misma cuenta, pero voluntaria solo de `principal`.
  });

  const db = comoCuenta(entorno, ADMIN);
  const lote = writeBatch(db);
  lote.set(doc(db, 'bibliotecas/otra/lectores/L001'), {
    nombre: 'Rafaela Toledo',
    clave: 'rafaela toledo',
    telefono: null,
    avisoDatos: { fecha: serverTimestamp(), por: ADMIN },
    fusionadoEn: null,
    esDestinoFusion: false,
    creadoEn: serverTimestamp(),
    creadoPor: ADMIN,
    creacionId: ID('a'),
  });
  lote.set(doc(db, 'bibliotecas/otra/lectoresClave/rafaela toledo'), {
    lector: 'L001',
    creadoEn: serverTimestamp(),
    creadoPor: ADMIN,
    creacionId: ID('b'),
  });
  lote.update(doc(db, 'bibliotecas/otra/config/contadores'), { ultimoLector: 1, ultimoLectorId: 'L001' });
  await assertFails(lote.commit());
});

test('EXTRA con mantenimiento vigente tampoco se toca config/app', async () => {
  await entorno.clearFirestore();
  await sembrarBase(entorno, { bloqueo: bloqueoMantenimiento() });
  const db = comoCuenta(entorno, ADMIN);
  await assertFails(
    updateDoc(doc(db, RUTAS.app), {
      nombreBiblioteca: 'Durante el mantenimiento',
      ultimaOperacionId: ID('6'),
      modificadoEn: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDocs(collection(db, `bibliotecas/${BIB}/voluntarios`)));
});
