// Fechas de la biblioteca. Funciones puras: reciben el instante, nunca leen el
// reloj por dentro. Toda fecha se calcula en America/Santiago con Intl, jamás
// con un desfase horario fijo (base §3).
//
// ALCANCE. De la Etapa 1 son el día en Chile, su texto para la barra superior
// y la temporada, que `scripts/inicializar.mjs` requiere para `inicioJuego`.
// La Etapa 2 añade lo que la carga inicial necesita para convertir las fechas
// del Excel en instantes: el mediodía y el fin de un día en Chile.
//
// Los sábados, el calendario canónico, los vencimientos calculados y el avance
// de temporada son de la Etapa 3 y NO se adelantan (contrato §4 y §9). Lo de
// aquí convierte una fecha que YA viene verificada en el archivo; no decide si
// un día es hábil para prestar.

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
