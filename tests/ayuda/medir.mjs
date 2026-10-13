// Medir tiempos en una máquina compartida.
//
// Una sola medición no dice gran cosa: el contenedor donde corren estas
// pruebas comparte procesador, y la misma apertura puede tardar 670 ms o
// 1.150 ms. Así que cada cosa se mide VARIAS veces y se compara la MEDIANA
// contra el límite, imprimiendo las tres cifras —mínimo, mediana y máximo—
// para que el informe no esconda la peor.
//
// Todas las mediciones son contra el emulador: no son una garantía de
// rendimiento en producción (base §3).

/** Estadísticas de una serie de medidas, en milisegundos. */
export function resumir(medidas) {
  const ordenadas = [...medidas].sort((uno, otro) => uno - otro);
  const mitad = Math.floor(ordenadas.length / 2);
  const mediana =
    ordenadas.length % 2 === 1 ? ordenadas[mitad] : Math.round((ordenadas[mitad - 1] + ordenadas[mitad]) / 2);
  return {
    minimo: ordenadas[0],
    mediana,
    maximo: ordenadas.at(-1),
    medidas: ordenadas,
  };
}

/** Corre `hacer` `veces` veces y resume lo que cada una tardó. */
export async function medir(veces, hacer) {
  const medidas = [];
  for (let vez = 0; vez < veces; vez += 1) medidas.push(await hacer(vez));
  return resumir(medidas);
}

/** Línea para el informe. */
export function anotar(que, resumen, unidad = 'ms') {
  process.stdout.write(
    `\n[carga] ${que}: mediana ${resumen.mediana} ${unidad} ` +
      `(mínimo ${resumen.minimo}, máximo ${resumen.maximo}, medidas ${resumen.medidas.join(' · ')})\n`,
  );
  return resumen;
}
