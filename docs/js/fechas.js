// Fechas de la biblioteca. Funciones puras: reciben el instante, nunca leen el
// reloj por dentro. Toda fecha se calcula en America/Santiago con Intl, jamás
// con un desfase horario fijo (base §3).
//
// ALCANCE DE LA ETAPA 1. Aquí están solo las tres funciones que esta etapa
// necesita: el día en Chile y su texto para la barra superior, y la temporada,
// que `scripts/inicializar.mjs` requiere para escribir `inicioJuego`.
// Los sábados, los vencimientos y el avance de temporada son de la Etapa 3 y
// NO se adelantan (contrato §9).

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
