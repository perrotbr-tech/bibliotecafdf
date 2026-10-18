// Genera los documentos de confianza `calendario/{salidaDia}` que las reglas
// exigen al prestar (contrato §4). Un documento por sábado, con inicio,
// finExclusivo, temporada y los cuatro vencimientos.
//
// Solo el script administrativo del dueño escribe aquí. El cliente no puede.
// El agente solo lo corre contra demo-biblioteca.
//
// Uso:
//   node scripts/generar-calendario.mjs --desde 2025-01-01 --hasta 2028-12-31
//   node scripts/generar-calendario.mjs --desde … --hasta … --simular
//   node scripts/generar-calendario.mjs --desde … --hasta … --proyecto biblioteca-fdf-ensayo --confirmo-proyecto-real

import { parseArgs } from 'node:util';

import { rutas } from '../docs/js/config-publica.js';
import {
  diaDesplazado,
  documentoDeCalendario,
  esDiaValido,
  esSabado,
  sabadosEnRango,
} from '../docs/js/fechas.js';
import { abrirBase, PROYECTO_DEMO } from './comun/destino.mjs';

/**
 * Calcula los documentos a escribir. Pura: no toca la base.
 * @returns {{sabados: string[], documentos: Array<{id:string, datos:object}>, ultimoSabado: string|null}}
 */
export function planDeCalendario({ desde, hasta }) {
  if (!esDiaValido(desde)) throw new Error(`«desde» no es un día válido: ${desde}`);
  if (!esDiaValido(hasta)) throw new Error(`«hasta» no es un día válido: ${hasta}`);
  if (hasta < desde) throw new Error(`«hasta» (${hasta}) es anterior a «desde» (${desde})`);

  // Los cuatro vencimientos del último sábado pueden caer DESPUÉS de `hasta`.
  // Hay que generar también esos sábados posteriores para que un préstamo del
  // último sábado con plazo 4 encuentre su documento de calendario.
  const ultimoDelRango = sabadosEnRango(desde, hasta).at(-1) ?? null;
  const coberturaHasta = ultimoDelRango ? diaDesplazado(ultimoDelRango, 7 * 4) : hasta;
  const sabados = sabadosEnRango(desde, coberturaHasta);

  const documentos = sabados.map((salidaDia) => ({
    id: salidaDia,
    datos: documentoDeCalendario(salidaDia),
  }));

  return {
    sabados,
    documentos,
    ultimoSabado: sabados.at(-1) ?? null,
    ultimoSabadoDelRangoPedido: ultimoDelRango,
  };
}

/**
 * Escribe o simula el calendario. Idempotente: un sábado ya existente se
 * sobrescribe solo si `--reemplazar`; si no, se deja y se informa.
 */
export async function generarCalendario({
  db,
  Timestamp,
  desde,
  hasta,
  simular = false,
  reemplazar = false,
}) {
  const plan = planDeCalendario({ desde, hasta });
  const creados = [];
  const actualizados = [];
  const omitidos = [];

  for (const { id, datos } of plan.documentos) {
    const referencia = db.doc(rutas.diaCalendario(id));
    const existente = await referencia.get();
    const payload = {
      inicio: Timestamp.fromDate(datos.inicio),
      finExclusivo: Timestamp.fromDate(datos.finExclusivo),
      temporada: datos.temporada,
      vencimientos: datos.vencimientos.map((v) => Timestamp.fromDate(v)),
    };

    if (existente.exists && !reemplazar) {
      omitidos.push(id);
      continue;
    }
    if (simular) {
      if (existente.exists) actualizados.push(id);
      else creados.push(id);
      continue;
    }
    await referencia.set(payload);
    if (existente.exists) actualizados.push(id);
    else creados.push(id);
  }

  return {
    ...plan,
    creados,
    actualizados,
    omitidos,
    simulado: simular,
  };
}

/**
 * Siembra un calendario sintético cuya ventana incluye `ahora`, para que las
 * pruebas E2E puedan prestar cualquier día civil sin mentir en las reglas
 * publicadas (contrato §2). Solo para demo.
 */
export function documentoCalendarioSintetico({ salidaDia, ahora = new Date(), temporada = null }) {
  if (!esSabado(salidaDia) && !/^\d{4}-\d{2}-\d{2}$/u.test(salidaDia)) {
    throw new RangeError(`salidaDia con forma inesperada: ${salidaDia}`);
  }
  const inicio = new Date(ahora.getTime() - 12 * 60 * 60 * 1000);
  const finExclusivo = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
  const doc = documentoDeCalendario(esSabado(salidaDia) ? salidaDia : sabadosEnRango(salidaDia, diaDesplazado(salidaDia, 7))[0] ?? salidaDia);
  return {
    inicio,
    finExclusivo,
    temporada: temporada ?? doc.temporada,
    vencimientos: doc.vencimientos,
    // Marca interna de prueba: el generador canónico nunca la escribe.
    sintetico: true,
  };
}

function imprimirInforme(informe) {
  const modo = informe.simulado ? 'simulación' : 'escritura';
  console.log(`Calendario (${modo}): ${informe.documentos.length} sábados`);
  console.log(`  creados:      ${informe.creados.length}`);
  console.log(`  actualizados: ${informe.actualizados.length}`);
  console.log(`  omitidos:     ${informe.omitidos.length}`);
  console.log(`  último sábado generado: ${informe.ultimoSabado ?? '(ninguno)'}`);
  if (informe.ultimoSabadoDelRangoPedido) {
    console.log(`  último sábado del rango pedido: ${informe.ultimoSabadoDelRangoPedido}`);
  }
}

async function principal(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      desde: { type: 'string' },
      hasta: { type: 'string' },
      proyecto: { type: 'string', default: PROYECTO_DEMO },
      simular: { type: 'boolean', default: false },
      reemplazar: { type: 'boolean', default: false },
      'confirmo-proyecto-real': { type: 'boolean', default: false },
    },
  });

  if (!values.desde || !values.hasta) {
    console.error('Faltan --desde y --hasta (AAAA-MM-DD).');
    process.exitCode = 1;
    return;
  }

  const { db, Timestamp } = await abrirBase({
    proyecto: values.proyecto,
    confirmaProyectoReal: values['confirmo-proyecto-real'],
  });

  const informe = await generarCalendario({
    db,
    Timestamp,
    desde: values.desde,
    hasta: values.hasta,
    simular: values.simular,
    reemplazar: values.reemplazar,
  });
  imprimirInforme(informe);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  principal().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  });
}
