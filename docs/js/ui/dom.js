// Ayudas mínimas para construir pantallas.
//
// Todo el texto escrito por una persona entra como TEXTO, con `textContent`.
// En este archivo no hay ni una asignación a `innerHTML`: esa es la forma de
// cumplir la regla de base §7.10 sin tener que acordarse en cada pantalla.

/**
 * Crea un elemento.
 * @param {string} etiqueta
 * @param {object} [atributos]  `clase`, `texto`, `atributos`, `datos`, `al`
 * @param {Array<Node|string>} [hijos]
 */
export function el(etiqueta, atributos = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  const { clase, texto, al, ...resto } = atributos;

  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = String(texto);

  for (const [nombre, valor] of Object.entries(resto)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (nombre.startsWith('data-') || nombre.startsWith('aria-') || nombre === 'role') {
      nodo.setAttribute(nombre, String(valor));
    } else if (valor === true) {
      nodo.setAttribute(nombre, '');
    } else {
      nodo.setAttribute(nombre, String(valor));
    }
  }

  for (const [evento, manejar] of Object.entries(al ?? {})) nodo.addEventListener(evento, manejar);

  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  }
  return nodo;
}

/** Vacía un contenedor sin usar innerHTML. */
export function vaciar(nodo) {
  while (nodo.firstChild) nodo.firstChild.remove();
}

/** Reemplaza el contenido de un contenedor. */
export function pintar(nodo, ...contenido) {
  vaciar(nodo);
  nodo.append(...contenido.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return nodo;
}

/** Elementos que pueden recibir el foco dentro de un contenedor. */
export function enfocables(contenedor) {
  return [
    ...contenedor.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((nodo) => nodo.offsetParent !== null || nodo === document.activeElement);
}
