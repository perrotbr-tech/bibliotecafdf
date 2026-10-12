# Contraprueba externa — Etapa 2 · segunda pasada

**SHA revisado:** `59353a4291e6eabd85f6f07b911abb7cd8750bc1` (`59353a4`)  
**Confirmación:** `git log -1 --oneline` → `59353a4 Informe: el SHA entregado es el de las correcciones`  
**Código de correcciones:** `4453fce` (ancestro inmediato; encima solo el informe del SHA).  
**Revisor:** misma sesión de contraprueba que entregó H-01/H-02/H-03 sobre `f64b78f`. No se modificó código de aplicación ni `informes/etapa-2.md`.

Informe anterior (ronda 1): PR #3 / rama `cursor/contraprueba-etapa-2-327c` (`informes/contraprueba-etapa-2.md`). En `etapa-2` ese archivo aún no está fusionado; esta ronda vive aparte.

---

## 1. Ejecución (`npm test`)

Tras `npm ci` y `npx playwright install chromium`:

| Suite | Resultado |
|---|---|
| revisar | sin hallazgos |
| unidad | **143** pass / 0 fail |
| reglas | **72** pass / 0 fail |
| scripts | **25** pass / 0 fail (incluye H-01) |
| e2e | **81** passed · `[e2e] el SDK se baja de www.gstatic.com` |
| carga | **6** passed · Catálogo 5.000 mediana 3.167 ms (**0,63 ms/doc**) |

Coincide con lo que declara el informe de entrega para este SHA (143/72/25/81/6).

---

## 2. Cierre de H-01, H-02, H-03

| ID | ¿Cerrado? | Evidencia |
|---|---|---|
| **H-01** | **Sí** | `restaurar.mjs` guarda `huella: respaldo.hash` (L158) y rechaza al reanudar si difiere (L165–169). Prueba `H-01 reanudar con OTRO respaldo…` en `tests/scripts/respaldo.test.mjs`. **Criterio falla/pasa comprobado aquí:** sin el `if (reanudar && manifiesto.huella !== nuevo.huella)` → `not ok` / `Missing expected rejection.`; con el check → `ok` / pass 1. Archivo restaurado después; árbol limpio. |
| **H-02** | **Sí** (código) | En `inscribirLector` tras `denegado`: (1) clave tomada → conflicto; (2) `leerDelServidor(contadores)` con `estado === 'denegada'` → **devuelve el denegado tal cual** (L147); (3) contador igual a `registro.ultimoLectorLeido` → denegado (o mensaje de mantenimiento si hay bloqueo), **sin** reetiquetar carrera (L149–159); (4) contador movido → reintento / `carrera-perdida`. Ambos caminos pedidos están en el código. **Observación:** no hay prueba automatizada dedicada que fije el caso «ni leer el contador se puede», pese a que el informe afirma que cada hallazgo dejó su prueba. El cierre se acredita por lectura del código + suites verdes, no por un test H-02. |
| **H-03** | **Sí** | §3 cita las dos máquinas (contenedor del implementador vs contraprueba: 1,04 vs 0,67 ms/doc; tablas de aperturas), ancla «EN ESTE CONTENEDOR», y separa forma del diseño (proporcional al nº de documentos; tecla OK; 5.000 no cumple) de los milisegundos del host. |

---

## 3. ¿Las quince correcciones de `4453fce` introdujeron un problema nuevo?

Revisé con especial atención: `claveDeNombre` (controles), reordenamiento del bloqueo en carga/restauración, y escucha única de `config/app` + `alCambiarCategorias`.

| Cambio | Veredicto |
|---|---|
| Controles fuera de `claveDeNombre` antes de la marca `\u0001` | **Sin problema nuevo.** `escaparTexto` limpia `\u0000–\u001F`; prueba de unidad fija `a\u0001b` → `ab` ≠ `añb`. Comprobado a mano igual. |
| Bloqueo: `respaldar({ token })` dentro del candado de quien reemplaza; `liberar` con token; manifiesto antes de soltar | **Sin problema nuevo.** Carga y restauración toman/reusan el bloqueo, respaldan con ese token, borran/reponen, cierran manifiesto y recién entonces liberan. |
| Escucha única en `main.js` + `alCambiarCategorias` en catálogo | **Sin problema nuevo.** Compara categorías con `JSON.stringify` antes de avisar; el catálogo ya no abre segunda escucha; solo repinta fichas/lista (no el buscador); si la categoría filtrada desaparece, vuelve a «Todas». |

**Único detalle nuevo (menor, documentación):** al insertar el párrafo de las dos máquinas en §3, quedaron **huérfanas** dos filas de la tabla markdown (`Abrir Voluntarios…` y la fila «en el SDK»), pegadas después del párrafo y fuera de la tabla. No reabre H-03 (el contenido está), pero el informe se lee mal ahí. Criterio: reintegrar esas dos filas a la tabla o pasarlas a prosa.

No encontré regresión de datos, permisos ni UI en los tres focos pedidos ni en el resto del commit al nivel de esta pasada.

---

## 4. Resumen

- **H-01, H-02, H-03: cerrados** en `59353a4` / `4453fce`.
- H-01 con prueba falla-sin / pasa-con ejecutada en esta sesión.
- `4453fce`: sin problema nuevo de producto en las zonas señaladas; solo el formato roto menor de la tabla en §3.
- Suites: **143 + 72 + 25 + 81 + 6**, todas verdes.
