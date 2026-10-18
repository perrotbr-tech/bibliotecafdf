// Fechas de la biblioteca. Funciones puras: reciben el instante, nunca leen el
// reloj por dentro. Toda fecha se calcula en America/Santiago con Intl, jamás
// con un desfase horario fijo (base §3).
//
// ALCANCE. De la Etapa 1 son el día en Chile, su texto para la barra superior
// y la temporada, que `scripts/inicializar.mjs` requiere para `inicioJuego`.
// La Etapa 2 añade lo que la carga inicial necesita para convertir las fechas
// del Excel en instantes: el mediodía y el fin de un día en Chile.
//
// La Etapa 3 añade sábados, vencimientos y atrasos. El calendario canónico
// que las reglas exigen vive en `calendario/{salidaDia}` y lo genera
// `scripts/generar-calendario.mjs`; estas funciones calculan lo mismo en el
// cliente para armar la UI y cotejar antes de escribir.

export const ZONA = 'America/Santiago';

const PARTES_DIA = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TEXTO_LARGO = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function partes(instante, formateador) {
  const encontradas = {};
  for (const { type, value } of formateador.formatToParts(instante)) encontradas[type] = value;
  return encontradas;
}

/**
 * Día de la biblioteca: la fecha en Chile de un instante, como `AAAA-MM-DD`.
 * Las 23:30 de un sábado en Chile siguen siendo ese sábado, aunque en UTC ya
 * sea domingo.
 * @param {Date|number} instante
 */
export function diaEnChile(instante) {
  const fecha = instante instanceof Date ? instante : new Date(instante);
  const { year, month, day } = partes(fecha, PARTES_DIA);
  return `${year}-${month}-${day}`;
}

/**
 * Texto de la fecha para la barra superior: «sábado 10 de octubre de 2026».
 * Sin la coma que es-CL pone después del día de la semana.
 */
export function textoFechaLarga(instante) {
  const fecha = instante instanceof Date ? instante : new Date(instante);
  const { weekday, day, month, year } = partes(fecha, TEXTO_LARGO);
  return `${weekday} ${day} de ${month} de ${year}`;
}

/**
 * Temporada de un día: bimestre `AAAA-B`, con B de 1 a 6.
 * Enero–febrero es 1; noviembre–diciembre es 6.
 * @param {string} dia `AAAA-MM-DD`
 */
export function temporadaDe(dia) {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(dia ?? ''));
  if (!coincide) throw new TypeError(`Día con formato inesperado: ${dia}`);
  const anio = Number(coincide[1]);
  const mes = Number(coincide[2]);
  if (mes < 1 || mes > 12) throw new RangeError(`Mes fuera de rango: ${dia}`);
  return `${anio}-${Math.floor((mes - 1) / 2) + 1}`;
}

/** Temporada del instante dado, en hora de Chile. */
export function temporadaDeInstante(instante) {
  return temporadaDe(diaEnChile(instante));
}

// ---------------------------------------------------------------------------
// Etapa 2: de una fecha del archivo a un instante.
// ---------------------------------------------------------------------------

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/u;

const PARTES_RELOJ = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function numerosDeDia(dia) {
  const coincide = FORMATO_DIA.exec(String(dia ?? ''));
  if (!coincide) throw new TypeError(`Día con formato inesperado: ${dia}`);
  return [Number(coincide[1]), Number(coincide[2]), Number(coincide[3])];
}

const doble = (n) => String(n).padStart(2, '0');

/**
 * ¿Existe ese día en el calendario? `2025-02-30` tiene formato correcto y no
 * existe; la carga inicial lo rechaza antes de escribir (C-42).
 */
export function esDiaValido(dia) {
  if (!FORMATO_DIA.test(String(dia ?? ''))) return false;
  const [anio, mes, numero] = numerosDeDia(dia);
  if (mes < 1 || mes > 12 || numero < 1 || numero > 31) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, numero));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === numero
  );
}

/**
 * Día `AAAA-MM-DD` desplazado en días. Aritmética de calendario, sin husos:
 * sumar un día a `2026-04-04` da `2026-04-05` aunque esa noche el reloj de
 * Chile se mueva.
 */
export function diaDesplazado(dia, dias) {
  const [anio, mes, numero] = numerosDeDia(dia);
  const fecha = new Date(Date.UTC(anio, mes - 1, numero + dias));
  return `${fecha.getUTCFullYear()}-${doble(fecha.getUTCMonth() + 1)}-${doble(fecha.getUTCDate())}`;
}

/** Milisegundos que el reloj de Chile va por delante de UTC en ese instante. */
function desfaseDeChile(instante) {
  const reloj = partes(new Date(instante), PARTES_RELOJ);
  const comoSiFueraUtc = Date.UTC(
    Number(reloj.year),
    Number(reloj.month) - 1,
    Number(reloj.day),
    Number(reloj.hour),
    Number(reloj.minute),
    Number(reloj.second),
  );
  const instanteSinMilisegundos = instante - (((instante % 1000) + 1000) % 1000);
  return comoSiFueraUtc - instanteSinMilisegundos;
}

/**
 * Instante de una hora de pared de Chile. Se calcula con `Intl`, nunca con un
 * desfase fijo: la primera pasada supone que la hora local es UTC y la segunda
 * corrige el desfase que resulte, que es lo que hace falta en los dos días del
 * año en que el desfase cambia.
 */
export function instanteEnChile(dia, hora = 12, minuto = 0, segundo = 0) {
  const [anio, mes, numero] = numerosDeDia(dia);
  const pared = Date.UTC(anio, mes - 1, numero, hora, minuto, segundo);
  let instante = pared;
  for (let pasada = 0; pasada < 2; pasada += 1) {
    const candidato = pared - desfaseDeChile(instante);
    if (candidato === instante) break;
    instante = candidato;
  }
  return new Date(instante);
}

/**
 * Mediodía de Chile de ese día: la hora que la carga inicial le pone a un
 * préstamo del Excel, del que solo consta la fecha.
 */
export function mediodiaEnChile(dia) {
  return instanteEnChile(dia, 12);
}

/**
 * Primer instante de un día en Chile. Se busca por bisección entre dos
 * mediodías en vez de suponer que el día empieza a las 00:00: en el cambio de
 * hora de septiembre esa medianoche no existe, y el día empieza a la 01:00.
 */
export function primerInstanteEnChile(dia) {
  let antes = mediodiaEnChile(diaDesplazado(dia, -1)).getTime();
  let despues = mediodiaEnChile(dia).getTime();
  while (despues - antes > 1) {
    const medio = antes + Math.floor((despues - antes) / 2);
    if (diaEnChile(medio) < dia) antes = medio;
    else despues = medio;
  }
  return new Date(despues);
}

/**
 * Fin de un día en Chile: un milisegundo antes del primer instante del día
 * siguiente (base §5). Es lo que se guarda en `venceEl`.
 */
export function finDelDiaEnChile(dia) {
  return new Date(primerInstanteEnChile(diaDesplazado(dia, 1)).getTime() - 1);
}

/**
 * Día de la semana de una fecha de calendario, 0 domingo a 6 sábado. No
 * depende del huso: el 10-10-2026 es sábado en Chile y en cualquier parte.
 *
 * Sirve para ADVERTIR sobre las fechas que llegan del Excel. El calendario
 * canónico que las reglas exigen para prestar es de la Etapa 3 y se construye
 * aparte, con documentos de confianza (contrato §4).
 */
export function diaDeLaSemana(dia) {
  const [anio, mes, numero] = numerosDeDia(dia);
  return new Date(Date.UTC(anio, mes - 1, numero)).getUTCDay();
}

export function esSabado(dia) {
  return diaDeLaSemana(dia) === 6;
}

/**
 * Cuántos sábados hay entre dos días, contando el final y no el principio.
 *
 * `tope` corta la cuenta: quien pregunta solo quiere saber si el plazo pasa de
 * cuatro sábados, y un `vence` mal tecleado como `9999-10-17` haría caminar
 * tres millones de días. Si se alcanza el tope, el resultado es el tope.
 */
export function sabadosEntre(desde, hasta, tope = Number.POSITIVE_INFINITY) {
  if (hasta < desde) return 0;
  let cuantos = 0;
  for (let dia = diaDesplazado(desde, 1); dia <= hasta; dia = diaDesplazado(dia, 1)) {
    if (esSabado(dia)) {
      cuantos += 1;
      if (cuantos >= tope) return cuantos;
    }
  }
  return cuantos;
}

// ---------------------------------------------------------------------------
// Etapa 3: sábados, vencimientos y atrasos.
// ---------------------------------------------------------------------------

/**
 * Próximo sábado a partir de un día (si el día ya es sábado, el siguiente).
 * «Hoy sábado» en «Para recordar» pide el sábado que viene, no el de hoy.
 */
export function sabadoSiguiente(dia) {
  let candidato = diaDesplazado(dia, 1);
  while (!esSabado(candidato)) candidato = diaDesplazado(candidato, 1);
  return candidato;
}

/**
 * El sábado de una jornada: si `dia` es sábado, él mismo; si no, el próximo.
 * Lo usa Inicio fuera de sábado («Próximo sábado, …»).
 */
export function sabadoDeJornada(dia) {
  return esSabado(dia) ? dia : sabadoSiguiente(dia);
}

/**
 * Día de vencimiento de un préstamo con plazo de `k` sábados (base §8).
 * Si salió un sábado, vence exactamente `7 × k` días después. Si no, el
 * k-ésimo sábado posterior al día de salida.
 */
export function diaDeVencimiento(salidaDia, plazoSabados) {
  const k = Number(plazoSabados);
  if (!Number.isInteger(k) || k < 1 || k > 4) {
    throw new RangeError(`plazoSabados fuera de rango: ${plazoSabados}`);
  }
  if (esSabado(salidaDia)) return diaDesplazado(salidaDia, 7 * k);
  let dia = salidaDia;
  for (let i = 0; i < k; i += 1) dia = sabadoSiguiente(dia);
  return dia;
}

/**
 * `venceEl`: un milisegundo antes del primer instante del domingo que sigue
 * al sábado de vencimiento, en America/Santiago (base §5 / §8).
 */
export function venceElDe(salidaDia, plazoSabados) {
  return finDelDiaEnChile(diaDeVencimiento(salidaDia, plazoSabados));
}

/** Días civiles entre dos fechas `AAAA-MM-DD` (hasta − desde). */
export function diasEntre(desde, hasta) {
  const [ay, am, ad] = numerosDeDia(desde);
  const [by, bm, bd] = numerosDeDia(hasta);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Texto de atraso de un préstamo abierto (base §8 / P-42).
 * `ahora` es la hora corregida; `venceEl` el Timestamp del préstamo.
 */
export function textoAtraso(venceEl, ahora) {
  const instanteVence = venceEl instanceof Date ? venceEl : venceEl?.toDate?.() ?? new Date(venceEl);
  const instanteAhora = ahora instanceof Date ? ahora : new Date(ahora);
  if (instanteAhora.getTime() <= instanteVence.getTime()) return null;
  const diaVence = diaEnChile(instanteVence);
  const hoy = diaEnChile(instanteAhora);
  const dias = diasEntre(diaVence, hoy);
  if (dias < 1) return null;
  if (dias <= 6) {
    return esSabado(diaVence) ? 'Venció el sábado' : `Venció el ${textoDiaCorto(diaVence)}`;
  }
  if (dias <= 62) {
    const n = Math.floor(dias / 7);
    return n === 1 ? 'Atrasado 1 sábado' : `Atrasado ${n} sábados`;
  }
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'Atrasado 1 mes' : `Atrasado ${meses} meses`;
}

/** «sábado 24 de octubre» o con año si no es el año en curso (specs/04). */
export function textoFechaVencimiento(venceElODia, { anioDeReferencia = null } = {}) {
  const dia =
    typeof venceElODia === 'string' && FORMATO_DIA.test(venceElODia)
      ? venceElODia
      : diaEnChile(venceElODia instanceof Date ? venceElODia : venceElODia?.toDate?.() ?? new Date(venceElODia));
  const [anio, mes, numero] = numerosDeDia(dia);
  const instante = mediodiaEnChile(dia);
  const { weekday, day, month, year } = partes(instante, TEXTO_LARGO);
  const anioRef = anioDeReferencia ?? new Date().getFullYear();
  if (Number(year) === Number(anioRef) || anio === anioRef) {
    return `${weekday} ${day} de ${month}`;
  }
  return `${weekday} ${day} de ${month} de ${year}`;
}

function textoDiaCorto(dia) {
  const instante = mediodiaEnChile(dia);
  const { weekday, day, month } = partes(instante, TEXTO_LARGO);
  return `${weekday} ${day} de ${month}`;
}

/**
 * ¿La devolución fue a tiempo? Contrato §5: si hay booleano de corrección o
 * legado, se usa; si no, se compara `devueltoEn <= venceEl`.
 */
export function fueATiempo(prestamo) {
  if (prestamo?.devueltoATiempo === true || prestamo?.devueltoATiempo === false) {
    return prestamo.devueltoATiempo;
  }
  const devuelto = prestamo?.devueltoEn;
  const vence = prestamo?.venceEl;
  if (devuelto == null || vence == null) return null;
  const a = devuelto instanceof Date ? devuelto : devuelto?.toDate?.() ?? new Date(devuelto);
  const b = vence instanceof Date ? vence : vence?.toDate?.() ?? new Date(vence);
  return a.getTime() <= b.getTime();
}

/** La ventana de arrepentimiento de las reglas: diez minutos. */
export const VENTANA_DE_DESHACER_MS = 10 * 60 * 1000;

/**
 * ¿`marca` está dentro de la ventana de diez minutos contada desde `ahora`?
 *
 * La cota es ESTRICTA, igual que la regla:
 * `request.time < desde + duration.value(10, 'm')`. Con `<=`, justo en el
 * minuto diez el botón de deshacer aparecía y el servidor denegaba la
 * escritura (H-06 de la contraprueba de Préstamos). Vive aquí, y no en la
 * ficha, porque es la misma clase de regla de fecha que el resto de este
 * archivo y así se puede fijar el borde al milisegundo.
 */
export function dentroDeDiezMinutos(marca, ahora) {
  if (!marca || !ahora) return false;
  const desde = marca instanceof Date ? marca : marca?.toDate?.() ?? new Date(marca);
  const transcurrido = ahora.getTime() - desde.getTime();
  return transcurrido >= 0 && transcurrido < VENTANA_DE_DESHACER_MS;
}

/**
 * Documento de calendario para un sábado: inicio, finExclusivo, temporada y
 * los cuatro vencimientos (plazo 1..4). Lo escribe el script del dueño.
 */
export function documentoDeCalendario(salidaDia) {
  if (!esSabado(salidaDia)) {
    throw new RangeError(`El calendario solo admite sábados: ${salidaDia}`);
  }
  return {
    inicio: primerInstanteEnChile(salidaDia),
    finExclusivo: primerInstanteEnChile(diaDesplazado(salidaDia, 1)),
    temporada: temporadaDe(salidaDia),
    vencimientos: [1, 2, 3, 4].map((k) => venceElDe(salidaDia, k)),
  };
}

/** Todos los sábados desde `desde` hasta `hasta`, ambos inclusive si son sábado. */
export function sabadosEnRango(desde, hasta) {
  const lista = [];
  let dia = esSabado(desde) ? desde : sabadoSiguiente(desde);
  while (dia <= hasta) {
    lista.push(dia);
    dia = diaDesplazado(dia, 7);
  }
  return lista;
}
